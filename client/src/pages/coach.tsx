import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Lock, Send, Sparkles, User } from "lucide-react";
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
  content: "I am your MTB endurance coach. Ask for simple, practical guidance to stay consistent this week.",
};

const QUICK_PROMPTS = ["I missed a ride", "I feel tired", "What should I focus on?"];

interface CoachStatus {
  tier: "free" | "pro";
  canUse: boolean;
  monthlyLimit: number | null;
  usedThisMonth: number;
  remainingThisMonth: number | null;
  period: string;
}

interface Props {
  onUpgrade?: () => void;
}

export function CoachPage({ onUpgrade }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { data: coachStatus, isLoading: coachStatusLoading, refetch: refetchCoachStatus } =
    useQuery<CoachStatus>({
      queryKey: ["/api/coach/status"],
    });

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isSending]);

  const canUseCoach = coachStatus?.canUse ?? true;
  const isPro = coachStatus?.tier === "pro";
  const freeRemaining = coachStatus?.remainingThisMonth;
  const canSend = useMemo(
    () => input.trim().length > 0 && !isSending && canUseCoach,
    [input, isSending, canUseCoach],
  );

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || isSending) return;
    if (!canUseCoach) {
      onUpgrade?.();
      return;
    }

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
      await refetchCoachStatus();
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
    <div className="p-4 space-y-3" data-testid="coach-page">
      <div className="glass-panel p-4">
        <h2 className="text-xl font-semibold text-brand-text" data-testid="text-coach-title">
          Ask Your Coach
        </h2>
        <p className="text-sm text-brand-muted mt-1">Simple answers to stay consistent.</p>
        {coachStatusLoading ? (
          <p className="text-xs text-brand-muted mt-2">Checking access...</p>
        ) : isPro ? (
          <p className="mt-2 text-xs text-brand-success flex items-center gap-1.5">
            <Sparkles size={13} />
            Pro active. AI Coach is fully available.
          </p>
        ) : canUseCoach ? (
          <p className="mt-2 text-xs text-brand-warning">
            Free plan: {freeRemaining ?? 0} AI coach reply left this month.
          </p>
        ) : (
          <div className="mt-2 rounded-lg border border-brand-warning/40 bg-brand-warning/10 p-2.5">
            <p className="text-xs text-brand-warning font-semibold flex items-center gap-1.5">
              <Lock size={12} />
              Available in Pro
            </p>
            <p className="text-xs text-brand-muted mt-1">
              Your free monthly coach reply has been used. Upgrade to keep coaching anytime.
            </p>
            <button
              type="button"
              onClick={() => onUpgrade?.()}
              className="mt-2 min-h-[36px] rounded-md bg-brand-primary px-3 text-xs font-semibold text-brand-bg"
              data-testid="button-upgrade-from-coach"
            >
              Upgrade to Pro
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2" data-testid="coach-quick-prompts">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => (canUseCoach ? setInput(prompt) : onUpgrade?.())}
            className="min-h-[36px] rounded-full border border-brand-border/70 bg-brand-panel-2/35 px-3 text-xs font-medium text-brand-text disabled:opacity-50"
            disabled={!canUseCoach}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="glass-panel p-3 h-[46vh] overflow-y-auto space-y-3 border-brand-border/60"
        data-testid="coach-message-list"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[90%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed border",
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
            placeholder={
              canUseCoach
                ? "Ask about this week, recovery, or what to do next..."
                : "AI Coach is available on Pro. Upgrade to continue."
            }
            className="flex-1 min-h-[44px] max-h-32 rounded-lg bg-brand-bg border border-brand-border px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted resize-y focus:outline-none focus:border-brand-primary"
            data-testid="coach-input"
            disabled={!canUseCoach}
          />
          <button
            type="submit"
            disabled={!canSend}
            className="h-11 px-4 rounded-lg bg-brand-primary text-brand-bg text-xs font-semibold disabled:opacity-50 flex items-center gap-2"
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
