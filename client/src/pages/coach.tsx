import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "coach-welcome",
  role: "assistant",
  content:
    "I am your MTB coach for everyday riders. Ask about this week's plan, recovery, and simple ways to stay consistent.",
};

export function CoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isSending]);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || isSending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
    };

    const historyForApi = messages.slice(-12).map((item) => ({
      role: item.role,
      content: item.content,
    }));

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const res = await apiRequest("POST", "/api/coach/chat", {
        message,
        history: historyForApi,
      });
      const data = await res.json();
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply || "I could not generate a response. Please try again.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      toast({
        title: "Coach reply failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: "I could not respond right now. Retry in a moment.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-4 space-y-4" data-testid="coach-page">
      <div className="glass-panel p-4 border-brand-primary/20">
        <h2 className="text-2xl font-bold text-brand-text" data-testid="text-coach-title">
          Coach
        </h2>
        <p className="text-xs text-brand-muted mt-1">
          Chat with an AI coach that helps you get back on the bike, build confidence, and ride consistently.
        </p>
        <p className="text-[11px] text-brand-muted/80 mt-1">
          Conversation is kept in this browser session only and is not stored long-term.
        </p>
      </div>

      <div
        ref={scrollRef}
        className="glass-panel p-4 h-[58vh] overflow-y-auto space-y-3 border-brand-border/60"
        data-testid="coach-message-list"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[88%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed border",
              message.role === "assistant"
                ? "mr-auto bg-brand-panel-2 border-brand-border text-brand-text"
                : "ml-auto bg-brand-primary/15 border-brand-primary/35 text-brand-text",
            )}
          >
            <div className="text-[10px] uppercase tracking-widest font-bold mb-1 text-brand-muted flex items-center gap-1">
              {message.role === "assistant" ? <Bot size={11} /> : <User size={11} />}
              {message.role === "assistant" ? "Coach" : "You"}
            </div>
            {message.content}
          </div>
        ))}
        {isSending && (
          <div className="max-w-[88%] mr-auto rounded-xl px-3 py-2 text-sm border bg-brand-panel-2 border-brand-border text-brand-muted">
            Coach is thinking...
          </div>
        )}
      </div>

      <form onSubmit={sendMessage} className="glass-panel p-3 border-brand-border/60" data-testid="coach-chat-form">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about this week, recovery, or how to adjust a session in simple terms..."
            className="flex-1 min-h-[44px] max-h-32 rounded-lg bg-brand-bg border border-brand-border px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted resize-y focus:outline-none focus:border-brand-primary"
            data-testid="coach-input"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="h-11 px-4 rounded-lg bg-gradient-primary text-brand-bg text-xs font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
            data-testid="coach-send"
          >
            <Send size={14} />
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
