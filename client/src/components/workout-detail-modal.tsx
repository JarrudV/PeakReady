import { X, Clock, Mountain, ArrowRight, CheckCircle2 } from "lucide-react";
import type { Session } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface Props {
  session: Session;
  onClose: () => void;
}

export function WorkoutDetailModal({ session, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      data-testid="modal-workout-detail"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-lg max-h-[85vh] bg-brand-bg border border-brand-border rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-black/50">
        <div className="sticky top-0 z-20 flex items-center justify-between p-4 border-b border-brand-border bg-brand-bg/95 backdrop-blur-sm">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={cn(
                  "text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-md",
                  session.type === "Long Ride"
                    ? "text-brand-primary bg-brand-primary/10 border border-brand-primary/20"
                    : session.type === "Ride"
                      ? "text-brand-text bg-brand-panel-2 border border-brand-border/50"
                      : session.type === "Strength"
                        ? "text-brand-warning bg-brand-warning/10 border border-brand-warning/20"
                        : "text-brand-muted bg-brand-panel-2 border border-brand-border/30"
                )}
              >
                {session.type}
              </span>
              {session.completed && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-brand-success" />
                  {session.completionSource && (
                    <span className="text-[10px] uppercase tracking-widest font-bold text-brand-success/80">
                      {session.completionSource}
                    </span>
                  )}
                </div>
              )}
            </div>
            <h2 className="text-lg font-bold text-brand-text leading-tight">
              {session.description}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-brand-panel-2 text-brand-text hover:bg-brand-panel transition-colors flex-shrink-0"
            data-testid="button-close-detail"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-3 px-4 py-3 border-b border-brand-border bg-brand-bg/50">
          <span className="flex items-center text-[10px] uppercase font-bold tracking-widest text-brand-muted">
            <Clock size={14} className="mr-1 text-brand-primary" />
            {session.minutes} min
          </span>
          {session.zone && (
            <span className="flex items-center text-[10px] uppercase font-bold tracking-widest text-brand-muted">
              <ArrowRight size={14} className="mr-1 text-brand-secondary" />
              {session.zone}
            </span>
          )}
          {session.elevation && (
            <span className="flex items-center text-[10px] uppercase font-bold tracking-widest text-brand-muted">
              <Mountain size={14} className="mr-1 text-brand-primary" />
              {session.elevation}
            </span>
          )}
          <span className="flex items-center text-[10px] uppercase font-bold tracking-widest text-brand-muted ml-auto">
            Week {session.week} · {session.day}
          </span>
        </div>

        <div
          className="flex-1 overflow-y-auto p-5 workout-markdown"
          data-testid="text-workout-details"
        >
          {session.detailsMarkdown ? (
            <ReactMarkdown
              components={{
                h2: ({ children }) => (
                  <h2 className="text-xl font-bold text-gradient-primary mb-3 mt-2 first:mt-0">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-bold text-brand-text uppercase tracking-wider mt-5 mb-2 flex items-center gap-2">
                    <div className="w-1 h-4 bg-gradient-primary rounded-full" />
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-sm text-brand-muted leading-relaxed mb-2">
                    {children}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong className="text-brand-text font-semibold">
                    {children}
                  </strong>
                ),
                ul: ({ children }) => (
                  <ul className="space-y-1.5 mb-3 ml-1">{children}</ul>
                ),
                li: ({ children }) => (
                  <li className="text-sm text-brand-muted flex items-start gap-2">
                    <span className="text-brand-primary mt-1.5 text-[6px]">●</span>
                    <span className="flex-1">{children}</span>
                  </li>
                ),
                hr: () => (
                  <hr className="border-brand-border my-4" />
                ),
              }}
            >
              {session.detailsMarkdown}
            </ReactMarkdown>
          ) : (
            <div className="text-center py-8 text-brand-muted">
              <p className="text-sm">No detailed workout instructions available for this session.</p>
              <p className="text-xs mt-2">Check back after loading a training plan with workout details.</p>
            </div>
          )}
        </div>

        {(session.rpe || session.notes) && (
          <div className="border-t border-brand-border p-4 bg-brand-bg/50">
            {session.rpe && (
              <div className="flex items-center text-sm mb-1">
                <span className="text-brand-muted w-12">RPE:</span>
                <span className="font-semibold text-brand-text">
                  {session.rpe}/10
                </span>
              </div>
            )}
            {session.notes && (
              <p className="text-sm text-brand-muted italic">
                &ldquo;{session.notes}&rdquo;
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
