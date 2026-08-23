"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDocuments } from "@/hooks/useDocuments";
import { Hourglass, File, Folder, Trash2 } from "lucide-react";
import { listOllamaModels } from "@/lib/api";

interface Props {
  model: string;
  onModelChange: (model: string) => void;
  selectedDocs: string[];
  onToggleDoc: (filename: string) => void;
}

/**
 * WHY Sidebar now accepts props:
 *  The selected model needs to be shared with ChatPanel - both are children of
 *  page.tsx. If Sidebar owned model state internally, ChatPanel could never read it.
 *  Lifting state to page.tsx(parent) and passing it down as props is standard solution.
 */

export default function Sidebar({
  model,
  onModelChange,
  selectedDocs,
  onToggleDoc,
}: Props) {
  const { documents, isLoading, uploadStatus, upload, remove } = useDocuments();
  const [isDragging, setIsDragging] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch installed Ollama models once on mount
  useEffect(() => {
    listOllamaModels().then((models) => {
      setAvailableModels(models);
    });
  }, []);

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
          <div>
            {isLoading ? (
              <Hourglass className="h-4 w-4" />
            ) : (
              <Folder className="h-4 w-4" />
            )}
          </div>
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
        {documents.length === 0 ? (
          <p className="text-xs text-gray-400 text-center mt-4">
            No documents indexed yet
          </p>
        ) : (
          <>
            {/* Hint shown when user has selected a subset */}
            {selectedDocs.length > 0 && (
              <p className="text-xs text-indigo-500 mb-2 px-1">
                Querying {selectedDocs.length} of {documents.length} doc
                {documents.length != 1 ? "s" : ""}
              </p>
            )}
            <ul className="space-y-1">
              {documents?.map((filename) => {
                const isSelected = selectedDocs.includes(filename);
                return (
                  <li
                    key={filename}
                    className={`flex items-center justify-between rounded-lg
                              px-3 py-2 border group tranisiton-colors 
                              ${
                                isSelected
                                  ? "bg-indigo-50 border-indigo-200"
                                  : "bg-white border-gray-200 "
                              }`}
                  >
                    {/* Checkbox + filename */}
                    <label className="flex items-center gap-2 min-w-0 cursor-pointer flex-1 text-wrap break-all">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleDoc(filename)}
                        className="accent-indigo-600 flex-shrink-0"
                      />
                      <span className="text-sm">{fileIcon(filename)}</span>
                      <span className="text-xs text-gray-700 text-wrap">
                        {filename}
                      </span>
                    </label>
                    <button
                      onClick={() => remove(filename)}
                      className="text-gray-300 hover:text-red-500 transition-colors 
                                opacity-0 group-hover:opacity-100 flex-shrink-0 ml-1"
                      title="Remove Document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {/* Clear selection shortcut */}
            {selectedDocs.length > 0 && (
              <button
                onClick={() => selectedDocs.forEach(onToggleDoc)}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600 px-1"
              >
                Clear Selection (search all)
              </button>
            )}
          </>
        )}
      </div>

      {/* Model Selector */}
      <div className="px-3 py-4 border-t border-gray-200">
        <label className="block text-xs text-gray-400 mb-1.5 font-medium">
          Model
        </label>
        {availableModels.length > 0 ? (
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5
                       bg-white text-gray-700 focus:outline-none focus:ring-2
                      focus:ring-indigo-300"
          >
            {availableModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-gray-400">{model}</p>
        )}
      </div>
    </div>
  );
}

function fileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <File className="text-red-500 h-4 w-4" />;
  if (ext === "docx") return <File className="text-blue-500 h-4 w-4" />;
  return "";
}
