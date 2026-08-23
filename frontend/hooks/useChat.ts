"use client";

/**
 * useChat: manages the entire chat state machine.
 *
 * WHY THE FUNCTIONAL UPDATER setMessages(prev => ...) IS CRITICAL:
 *  The onToken callback is a closure created at the start of each stream.]
 *  React closures capture state values at the time they are created.
 *  If we wrote setMessage(messages.map(...)), every token callback would
 *  see the same stale 'messages' from when streaming started - each token
 *  would overwrite the message with only itself instead of accumulating
 *
 *  The functional form setMessages(prev => prev.map(...)) always receives
 *  the most recent state from React's queue, so tokens accumulate correctly:
 *  "Hello" -> "Hello world" -> "Hello world!"
 *  instead of: "Hello" -> " world" -> "!"
 *
 * WHY useRef for the cancel function (not useState):
 *  cancelRef holds the abort function returned by streamQuery()
 *  We don't need React to re-render when it changes - it's an imperative
 *  handle, not UI state. useRef is correct tool for values that should
 *  persist across renders without triggering re-renders
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { streamQuery } from "@/lib/api";
import type { Citation, Message } from "@/lib/types";

const STORAGE_KEY = "rag-chat-history";

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  // Persit message to localStorage whenever they Changa_One.
  // Only save completed messages (not mid-stream) so we never save half written messages

  useEffect(() => {
    setMessages(loadHistory());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || isStreaming) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // localStorage can be unavailable in some browser contexts - fail silently
    }
  }, [messages, isStreaming, hydrated]);

  const sendMessage = useCallback(
    (question: string) => {
      if (isStreaming || !question.trim()) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
      };

      // Create the assitant message shell immediately - content fills in as token arrive
      const assitantId = crypto.randomUUID();
      const assitantMsg: Message = {
        id: assitantId,
        role: "assistant",
        content: "",
        citations: [],
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assitantMsg]);
      setIsStreaming(true);

      cancelRef.current = streamQuery(
        question,

        // onToken: append each token to the assitant message's content
        (token: string) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assitantId ? { ...m, content: m.content + token } : m,
            ),
          );
        },

        // onCitations: attach the retrieved sources to the message
        // (arrives before any tokens - sent first by the backend)
        (citations: Citation[]) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assitantId ? { ...m, citations } : m)),
          );
        },

        // onDone: mark streaming complete so the UI shows citation badges
        () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assitantId ? { ...m, isStreaming: false } : m,
            ),
          );
          setIsStreaming(false);
        },

        // onError: surface the error in the message bubble
        (error: string) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assitantId
                ? { ...m, content: `Error: ${error}`, isStreaming: false }
                : m,
            ),
          );
          setIsStreaming(false);
        },
      );
    },
    [isStreaming],
  );

  const stopStreaming = useCallback(() => {
    cancelRef.current?.();
    setIsStreaming(false);
    // Mark the current streaming message as no longer streaming
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
    );
  }, []);

  const clearMessages = useCallback(() => {
    if (!isStreaming) {
      setMessages([]);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, [isStreaming]);

  /**
   * exportChat: converts messages array into a Markdown file and triggers browser download
   *
   * HOW BROWSER FILE DOWNLOAD WORKS (without a server):
   *  1. Build the file content as a string.
   *  2. Wrap it in a Blob - a browser object representing raw binary data (here: text/ markdown)
   *  3. Create an object URL -  a temporary in-memory URL that points to that Blob. It lives only as this tab is open.
   *  4. Programatically click an invisible <a download> link pointing to that URL.
   *  5. Revoke the URL immediately after - this releases the memory held by the Blob.
   *
   * WHY NOT use a server endpoint for this?
   *  The data is already in the browser (React state). Sending it to server and back just to get a file would be wasteful
   *  round trip. The Blob approach is instant, works offline, and keeps server stateless.
   */
  const exportChat = useCallback(() => {
    if (messages.length === 0) return;

    const lines: string[] = ["# Chat Export \n"];

    for (const msg of messages) {
      if (msg.isStreaming) continue; //skip incomplete messages

      if (msg.role === "user") {
        lines.push(`***You:*** ${msg.content}\n`);
      } else {
        lines.push(`***Assitant:*** ${msg.content}\n`);

        if (msg.citations && msg.citations.length > 0) {
          lines.push("***Sources:***");
          msg.citations.forEach((c, i) => {
            const relevance = Math.round(Math.max(0, (1 - c.distance) * 100));
            lines.push(` - [${i+1}] ${c.source_filename} (chunk ${c.chunk_index}, ${relevance}% relavance): "${c.chunk_text.slice(0, 120)}... "`);
          });
          lines.push("");
        }
      }

    }
    const blob = new Blob([lines.join("\n")], {type: "text/markdown"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages]);

  return { messages, isStreaming, sendMessage, stopStreaming, clearMessages, exportChat };
}
