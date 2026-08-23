"use client";

import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/ChatPanel";
import { useChat } from "@/hooks/useChat";
import { useState } from "react";

export default function Home() {
  const { messages, isStreaming, sendMessage, stopStreaming, clearMessages, exportChat } =
    useChat();
  const [model, setModel] = useState("llama3.1:8b");

  return (
    <main className="flex h-screen bg-white overflow-hidden">
      {/* Left Sidebar: document management */}
      <aside className="w-72 border-r border-gray-200 flex-shrink-0">
        <Sidebar model={model} onModelChange={setModel}/>
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
