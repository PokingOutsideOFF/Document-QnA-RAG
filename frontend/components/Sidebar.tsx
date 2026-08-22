"use client";

import React, { useCallback, useRef, useState } from "react";
import { useDocuments } from "@/hooks/useDocuments";
import { Hourglass, File, Folder } from "lucide-react";

export default function Sidebar() {
  const { documents, isLoading, uploadStatus, upload, remove } = useDocuments();
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      Array.from(files).forEach((file) => upload(file));
    },
    [upload],
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-gray-700 text-sm">Documents</h2>
        <p className="text-xs text-gray-400 mt-0.5">PDF, DOCX, or TXT</p>
      </div>

      {/* Drop zone */}
      <div className="px-3 pt-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex gap-4 item-center border-2 border-dashed rounded-xl p-4 text-center cursor-pointer
                transition-colors
                ${isDragging ? "border-indigo-400 bg-indigo-50" : "border-gray-300 hover:border-indigo-300 hover:bg-gray-100"}`}
        >
          <div>{isLoading ? <Hourglass  className="h-4 w-4"/>: <Folder className="h-4 w-4"/>}</div>
          <p className="text-xs text-gray-500 font-medium">
            {isLoading ? "Indexing..." : "Drop files or click to upload"}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf, .docx, .txt"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* Upload status message */}
        {uploadStatus && (
          <p
            className={`mt-2 text-xs px-1 ${
              uploadStatus.startsWith("Error")
                ? "text-red-500"
                : "text-green-600"
            }`}
          >
            {uploadStatus}
          </p>
        )}
      </div>
      {/* Document List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 mt-1">
        {documents?.length === 0 ? (
          <p className="text-xs text-gray-400 text-center mt-4">
            No documents indexed yet
          </p>
        ) : (
          <ul className="space-y-1">
            {documents?.map((filename) => (
              <li
                key={filename}
                className="flex items-center jsutify-boolean bg-white rounded-lg px-3 py-2 border border-gray-200 group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">{fileIcon(filename)}</span>
                  <span className="text-xs text-gray-700">{filename}</span>
                </div>
                <button
                  onClick={() => remove(filename)}
                  className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover: opacity-100 flex-shrink-0 ml-1"
                  title="Remove Document"
                ></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-3 border-t border-gray-200">
        <p className="text-xsw text-gray-400">Powered by Ollama + Chroma</p>
      </div>
    </div>
  );
}

function fileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <File className="text-red-500 h-4 w-4"/>;
  if (ext === "docx") return <File className="text-blue-500 h-4 w-4"/>;
  return "";
}
