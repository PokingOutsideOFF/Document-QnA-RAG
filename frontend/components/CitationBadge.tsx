"use client";

import { useState } from "react";
import type { Citation } from "@/lib/types";
import { X } from "lucide-react";

interface Props {
  index: number;
  citation: Citation;
}

export default function CitationBadge({ index, citation }: Props) {
  const [open, setOpen] = useState(false);

  // Convert cosine distance to 0-100 relevance score.
  // Cosine distance: 0 = identical vectors, 2 = opposite vectors
  // So: relevance = (1 - distance) * 100, clamped to [0, 100]
  const relevance = Math.round(Math.max(0, (1 - citation.distance) * 100));

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200 border border-blue-200 dark:border-blue-800 rounded-full px-2.5 py-1 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors font-medium"
      >
        [{index}] {citation.source_filename}
      </button>
      {open && (
        <>
          {/* Backdrop to close an outside click */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          {/* Popver */}
          <div className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 z-20">
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate max-w-[200px]">
                  {citation.source_filename}
                </p>
                <p className="text-xs text-gray-400">
                  Chunk {citation.chunk_index} . {relevance}% match
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm ml-2"
              >
                <X />
              </button>
            </div>
            {/* Relevance bar */}
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1 mb-3">
              <div
                className="bg-blue-500 h-1 rounded-full transition-all"
                style={{ width: `${relevance}%` }}
              />
            </div>

            {/* Passage text */}
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-6">
              {citation.chunk_text}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
