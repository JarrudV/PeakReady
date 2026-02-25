import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Clock } from "lucide-react";
import type { Session } from "@shared/schema";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WorkoutDetailModal } from "@/components/workout-detail-modal";

interface Props {
  sessions: Session[];
  activeWeek: number;
  maxWeek: number;
  onWeekChange: (week: number) => void;
}

const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function dayOrder(day: string): number {
  const idx = WEEKDAY_ORDER.indexOf((day || "").slice(0, 3).toLowerCase());
  return idx >= 0 ? idx : 99;
}

function getPhaseName(activeWeek: number, maxWeek: number): string {
  const safeMaxWeek = Math.max(maxWeek, 1);
  const ratio = activeWeek / safeMaxWeek;
  if (ratio <= 0.4) return "Foundation Phase";
  if (ratio <= 0.8) return "Build Phase";
  return "Sharpen & Taper";
}

function getEffortType(session: Session): string {
  if (session.type === "Strength") return "Strength";
  if (session.type === "Rest") return "Recovery";
  if (session.zone) return session.zone;

  const description = (session.description || "").toLowerCase();
  if (description.includes("skill") || description.includes("trail")) return "Skills";
  if (session.type === "Long Ride") return "Endurance";
  return "Ride";
}

export function TrainingPlan({ sessions, activeWeek, maxWeek, onWeekChange }: Props) {
  const [viewingSession, setViewingSession] = useState<Session | null>(null);
  const { toast } = useToast();

  const weeklySessions = useMemo(
    () =>
      sessions
        .filter((session) => session.week === activeWeek)
        .sort((a, b) => {
          if (a.scheduledDate && b.scheduledDate) {
            return a.scheduledDate.localeCompare(b.scheduledDate);
          }
          return dayOrder(a.day) - dayOrder(b.day);
        }),
    [sessions, activeWeek],
  );

  const phaseName = getPhaseName(activeWeek, maxWeek);

  const handleToggleComplete = async (session: Session) => {
    try {
      await apiRequest("PATCH", `/api/sessions/${session.id}`, {
        completed: !session.completed,
        completedAt: !session.completed ? new Date().toISOString() : null,
        completionSource: !session.completed ? "manual" : null,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      setViewingSession(null);
    } catch {
      toast({ title: "Failed to update session", variant: "destructive" });
    }
  };

  return (
    <div className="p-4 space-y-5" data-testid="training-plan-view">
      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-brand-text" data-testid="text-plan-title">
            Week {activeWeek} - {phaseName}
          </h2>
          <p className="text-sm text-brand-muted">Your week at a glance. Tap a session for details.</p>
        </div>
        <div className="max-w-[220px]">
          <label className="text-xs text-brand-muted block mb-1.5">Switch week</label>
          <div className="relative">
            <select
              value={activeWeek}
              onChange={(event) => onWeekChange(Number(event.target.value))}
              className="w-full appearance-none rounded-lg border border-brand-border bg-brand-panel-2/45 px-3 py-2.5 pr-9 text-sm text-brand-text focus:outline-none focus:border-brand-primary"
              data-testid="select-active-week"
            >
              {Array.from({ length: Math.max(maxWeek, 1) }, (_, index) => index + 1).map((week) => (
                <option key={week} value={week}>
                  Week {week}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted"
            />
          </div>
        </div>
      </section>

      <section className="glass-panel p-2.5" data-testid="week-session-list">
        {weeklySessions.length === 0 ? (
          <p className="text-sm text-brand-muted px-2 py-6 text-center">No sessions planned for this week yet.</p>
        ) : (
          <div className="divide-y divide-brand-border/40">
            {weeklySessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setViewingSession(session)}
                className="w-full min-h-[56px] px-2.5 py-3 text-left flex items-center gap-3"
                data-testid={`plan-row-${session.id}`}
              >
                <span
                  className={cn(
                    "w-7 h-7 rounded-full border flex items-center justify-center shrink-0",
                    session.completed
                      ? "border-brand-success/50 bg-brand-success/15 text-brand-success"
                      : "border-brand-border/60 bg-brand-bg/45 text-brand-muted",
                  )}
                >
                  {session.completed ? <CheckCircle2 size={15} /> : <Circle size={14} />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-brand-muted">{session.day}</span>
                  <span className="block text-sm font-semibold text-brand-text truncate">{session.description}</span>
                  <span className="block text-xs text-brand-muted">
                    {session.type === "Rest" ? "Rest" : `${session.minutes}m - ${getEffortType(session)}`}
                  </span>
                </span>

                <span className="shrink-0 text-brand-muted flex items-center gap-1 text-xs">
                  <Clock size={12} />
                  {session.minutes}m
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {viewingSession && (
        <WorkoutDetailModal
          session={viewingSession}
          onClose={() => setViewingSession(null)}
          onToggleComplete={() => handleToggleComplete(viewingSession)}
          completionActionLabel={viewingSession.completed ? "Mark Incomplete" : "Mark Complete"}
        />
      )}
    </div>
  );
}
