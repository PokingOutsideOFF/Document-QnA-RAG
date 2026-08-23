"use-client"

import { useCallback, useEffect, useState } from "react";
import { deleteDocument, listDocuments, uploadDocument } from "@/lib/api";

export function useDocuments(){
    const [documents, setDocuments] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<string|null>(null);
    
    const refresh = useCallback(async () =>{
        try{
            const docs = await listDocuments();
            setDocuments(docs);
        } catch(err){
            console.error("Failed to load documents", err);
        }
    }, []);

    useEffect(() => {
        refresh()
    }, [refresh])

    const upload = useCallback(
        async (file: File) => {
            setIsLoading(true);
            setUploadStatus(null);
            try{
                const result = await uploadDocument(file);
                // Optimistically add the new document to the list
                setDocuments((prev) => 
                    prev ? [...prev, result.filename] : [result.filename]
                );
                setUploadStatus(`Indexed ${result.chunks_indexed} chunks from "${result.filename}"`)
            } catch(err){
                setUploadStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
            } finally {
                setIsLoading(false);
            }
        }, []
    )

    const remove = useCallback(
        async (filename: string) => {
            try{
                await deleteDocument(filename);
                await refresh();
            } catch(err){
                console.error("Failed to delete document:", err);
            }
        }, [refresh]
    );

    return {documents, isLoading, uploadStatus, upload, remove, refresh};

}

