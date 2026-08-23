"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/types";
import ChatMessage from "./ChatMessage";
import { File, SendHorizontal, Square } from "lucide-react";

interface Props {
  messages: Message[];
  isStreaming: boolean;
  onSend: (question: string) => void;
  onStop: () => void;
  onClear: () => void;
  onExport: () => void;
}

export default function ChatPanel({
  messages,
  isStreaming,
  onSend,
  onStop,
  onClear,
  onExport,
}: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll to the latest message as tokens arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || isStreaming) return;
    setInput("");
    onSend(q);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Submit on Enter, allow Shit+Enter for newlines
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <h1 className="font-semibold text-gray-800">Document Q&A</h1>
        {messages.length > 0 && !isStreaming && (
          <div className="flex gap-3">
            <button
              onClick={onExport}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Export
            </button>
            <button
              onClick={onClear}
              className="text-xs text-gray-400 hover:Ltext-gray-600 transition-colors"
            >
              Clear chat
            </button>
          </div>
        )}
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <div className="text-4xl mb-3">
              <File />
            </div>
            <p className="text-sm font-medium">
              Upload a document in the sidebar,{" "}
            </p>
            <p className="text-sm">then ask anything about it here.</p>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input form */}
      <div className="border-t border-gray200 bg-white px-4 py-3">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your documents.. (Enter to send)"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm
                        focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50 
                        disabled:text-gray-400 max-h-32 overflow-y-auto"
            style={{ minHeight: "42px" }}
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="px-4 py-2.5 bg-red-500 text-white text-sm rounded-xl 
                        hover:bg-red-600 transition-colros font-medium"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-4 py-2.5 bg-indigo-600 text-white text-sm rounded-xl 
                        hover:bg-indigo-700 transition-colors font-medium 
                        disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
