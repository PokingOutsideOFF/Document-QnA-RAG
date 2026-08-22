export interface Citation{
    source_filename: string;
    chunk_index: number;
    chunk_text: string; // the actual passage text, shown in the popover
    distance: number // cosine distance: lower = more similar to the query
}

export interface Message{
    id: string;
    role: "user" | "assistant";
    content: string;
    citations?: Citation[];
    isStreaming?: boolean;
}

export interface UploadResult{
    filename: string;
    chunks_indexed: number;
    message: string;
}