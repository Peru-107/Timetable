"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Send, Globe, Sparkles } from "lucide-react";
import { ThinkingDots } from "@/components/ThinkingDots";
import { useAutoResizeTextarea } from "@/lib/hooks/useAutoResizeTextarea";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  usedWebSearch: boolean;
  createdAt: string;
}

interface StudyChatProps {
  semesterId: string;
  courseId?: string | null;
  /** Shown in the empty state and as a hint of what's in scope for this thread. */
  scopeLabel: string;
}

/**
 * A chat thread scoped to either one course (courseId set) or every course
 * in the semester (courseId omitted). The same component drives both -
 * only the scope passed to the API differs.
 */
export function StudyChat({ semesterId, courseId, scopeLabel }: StudyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 40, maxHeight: 160 });

  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semesterId, courseId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  const fetchMessages = async () => {
    try {
      const params = new URLSearchParams({ semesterId });
      if (courseId) params.set("courseId", courseId);
      const res = await fetch(`/api/study-chat?${params}`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching study chat:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || isSending) return;

    setInput("");
    adjustHeight(true);
    setIsSending(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `optimistic-${Date.now()}`,
        role: "user",
        content: question,
        usedWebSearch: useWebSearch,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch("/api/study-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId, courseId, question, useWebSearch }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [
          ...prev.filter((m) => !m.id.startsWith("optimistic-")),
          data.userMessage,
          data.assistantMessage,
        ]);
      } else {
        setMessages((prev) => prev.filter((m) => !m.id.startsWith("optimistic-")));
      }
    } catch (error) {
      console.error("Error sending study chat message:", error);
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("optimistic-")));
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="frosted flex flex-col rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="frosted-inset flex h-9 w-9 items-center justify-center rounded-xl">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Ask AI</h3>
          <p className="text-xs text-muted-foreground">{scopeLabel}</p>
        </div>
      </div>

      <div ref={scrollRef} className="mb-3 flex max-h-96 min-h-[10rem] flex-col gap-3 overflow-y-auto pr-1">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask a question about {scopeLabel.toLowerCase()} - answers come from what you&apos;ve
            uploaded, unless you turn on web search below.
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "self-end rounded-br-md bg-primary text-primary-foreground"
                    : "frosted-inset self-start rounded-bl-md text-foreground"
                }`}
              >
                {m.content}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        {isSending && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="frosted-inset flex max-w-[85%] items-center gap-2 self-start rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-muted-foreground"
          >
            <ThinkingDots />
          </motion.div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => setUseWebSearch((v) => !v)}
          className={`flex h-10 flex-shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition-colors ${
            useWebSearch
              ? "bg-secondary text-secondary-foreground"
              : "frosted-inset text-muted-foreground"
          }`}
          aria-pressed={useWebSearch}
          title={useWebSearch ? "Web search on" : "Web search off"}
        >
          <Globe className="h-3.5 w-3.5" />
          Web
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={`Ask about ${scopeLabel.toLowerCase()}...`}
          className="frosted-inset flex-1 resize-none rounded-xl px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!input.trim() || isSending}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
          aria-label="Send question"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
