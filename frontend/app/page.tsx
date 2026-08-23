"use client";

import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/ChatPanel";
import { useChat } from "@/hooks/useChat";
import { useState } from "react";

export default function Home() {
  const {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearMessages,
    exportChat,
  } = useChat();
  const [model, setModel] = useState("llama3.1:8b");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  // Toggle a document in/out of the selection filter.
  // Empty selection = search all documents (no filter sent to backend)
  function toggleDoc(filename: string) {
    setSelectedDocs((prev) =>
      prev.includes(filename)
        ? prev.filter((f) => f !== filename)
        : [...prev, filename],
    );
  }
  return (
    <main className="flex h-screen bg-white overflow-hidden">
      {/* Left Sidebar: document management */}
      <aside className="w-72 border-r border-gray-200 flex-shrink-0">
        <Sidebar
          model={model}
          onModelChange={setModel}
          selectedDocs={selectedDocs}
          onToggleDoc={toggleDoc}
        />
      </aside>

      {/* Right panel: chat interface */}
      <section className="flex-1 flex flex-col min-w-0">
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          onSend={sendMessage}
          onStop={stopStreaming}
          onClear={clearMessages}
          onExport={exportChat}
        />
      </section>
    </main>
  );
}
