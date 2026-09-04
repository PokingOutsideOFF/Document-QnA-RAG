"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/ChatPanel";
import { useChat } from "@/hooks/useChat";

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

  // Keep the initial render identical on the server and client. Browser-only
  // theme state is restored after hydration to avoid changing the SVG tree.
  const [darkMode, setDarkMode] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    try {
      setDarkMode(localStorage.getItem("theme") === "dark");
    } catch {
      setDarkMode(false);
    }
    setThemeLoaded(true);
  }, []);

  useEffect(() => {
    if (!themeLoaded) return;
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

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
    <main className="flex h-screen bg-white text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100 overflow-hidden">
      {/* Left Sidebar: document management */}
      <aside className="w-72 border-r border-gray-200 dark:border-gray-800 flex-shrink-0">
        <Sidebar
          model={model}
          onModelChange={setModel}
          selectedDocs={selectedDocs}
          onToggleDoc={toggleDoc}
          darkMode={darkMode}
          onToggleDark={() => setDarkMode((d) => !d)}
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
