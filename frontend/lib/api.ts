/**
 * API client: typed wrappers for every backend endpoint.
 * 
 * WHY fetch + ReadableStream instead of EventSource for streaming:
 *     The browser's native EventSource API only supports GET requests.
 *     Our /query/ endpoint is POST because the question goes in the request body.
 *     Using fetch() with response.body.getReader() gives us the same streaming 
 *     behaviour over a POST request.
 * 
 * WHY we buffer the stream before parsing:
 *     Network data arrives in chunks that don't align with SSE event boundaries.
 *     A single TCP packet might contain "data: {...}\n\ndata: {" - i.e., one
 *     complete event and the start of the next. The buffer accumulates bytes,
 *     splits on the "\n\n" SSE delimiter, and only processes complete events.
 *     The incomplete last piece goes back into the buffer for next chunk.
 */


import type { Citation, UploadResult } from "./types";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"

export async function uploadDocument(file: File): Promise<UploadResult> {
    const form = new FormData();
    form.append("file",file);
    const res = await fetch(`${BACKEND}/documents/upload`, {
        method: "POST",
        body: form,
    });
    if(!res.ok){
        const text = await res.text();
        throw new Error(text || `Upload failed (${res.status})`)
    }
    return res.json();
}

export async function listDocuments(): Promise<string[]> {
    const res = await fetch(`${BACKEND}/documents/`);
    if(!res.ok) throw new Error(`Failed to fetch documents (${res.status})`);
    const data = await res.json();
    return data.documents as string[];
}

export async function deleteDocument(filename: string): Promise<void>{
    const res = await fetch(`${BACKEND}/documents/${encodeURIComponent(filename)}`,
    {method: "DELETE"}
);
if(!res.ok) throw new Error(`Delete failed (${res.status})`);
}

/**
 * Opens a streaming query connection to the backend
 * Calls teh appropriate callback for each SSE event type
 * Returns a cleanup function -  call it to abort the request mid-stream
 */
export function streamQuery(
    question: string,
    onToken: (token: string) => void,
    onCitations: (citations: Citation[]) => void,
    onDone:() => void,
    onError: (error:string) => void
): () => void {
    const controller = new AbortController();
    
    fetch(`${BACKEND}/query/`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({question}),
        signal: controller.signal,
    })
        .then(async (res) => {
            if(!res.ok){
                onError(`Query failed: ${res.status}`);
                return;
            }
            
            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while(true){
                const { done, value } = await reader.read();
                if(done) break;

                buffer += decoder.decode(value, {stream: true});

                // Split on the SSE double-newline delimiter
                const parts = buffer.split("\n\n");
                // The last element may be an incomplete event - keep it in the buffer
                buffer = parts.pop() ?? "";

                for (const part of parts) {
                    // Each SSE event line starts with "data: "
                    const dataline = part.replace(/^data: /, "").trim();
                    if(!dataline) continue;

                    try{
                        const event = JSON.parse(dataline);
                        if(event.type === "token") onToken(event.content);
                        else if(event.type === "citation") onCitations(event.citations);
                        else if(event.type === "done") onDone();
                        else if(event.type === "error") onError(event.error);
                    }catch {
                        // malformed JSON line skip silently
                    }
                }
            }
        })
        .catch((err) => {
            if(err.name !== "AbortError") onError(String(err));
        });

    // Caller can invoke this to cancel the in-flight request
    return () => controller.abort();

}