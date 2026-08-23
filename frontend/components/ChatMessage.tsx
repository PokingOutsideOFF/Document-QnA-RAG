"use client";

import type { Message } from "@/lib/types";
import CitationBadge from "./CitationBadge";
import { Bot, Copy, User } from "lucide-react";
import { useState } from "react";

interface Props {
  message: Message;
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 200);
    });
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center 
                        text-white text-xs font-bold mr-2 mt-1 flex-shrink-0"
        >
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div
        className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col`}
      >
        {/* Bubble */}
        <div
          className={`group relative rounded-2xl px-4 py-3 text-sm leading-relaxed
            ${
              isUser
                ? "bg-indigo-600 text-white rounded-br-sm"
                : "bg-gray-100 text-gray-900 rounded-bl-sm"
            }`}
        >
          <p className="whitespace-pre-wrap"> {message.content}
          {/* Blinking cursor while model is generating  */}
          {message.isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-gray-500 ml-0.5 align-middle animate-pulse" />
          )}
          </p>
          {/* Copy button - appears on hover for assitant messages only */}
          {!isUser && !message.isStreaming && message.content && (
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity 
                        text-xs text-gray-400 hover:text-gray-600 bg-white rounded px-1.5 
                        py-0.5 shadow-sm"
            >
              {copied ? "Copied" : <Copy className="h-4 w-4"/>}
            </button>
          )}
        </div>

        {/* Citation badges - appear below the bubble after streaming completes */}
        {!message.isStreaming &&
          message.citations &&
          message.citations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-xs text-gray-400 w-full">Sources:</span>
              {message.citations.map((citation, i) => (
                <CitationBadge key={i} index={i + 1} citation={citation} />
              ))}
            </div>
          )}
      </div>

      {/* Avatar for use */}
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-bold ml-2 mt-1 flex-shrink-0">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
