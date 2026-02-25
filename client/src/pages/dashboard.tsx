import { useMemo, useState } from "react";
import type { Session } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WorkoutDetailModal } from "@/components/workout-detail-modal";

const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

interface Props {
  sessions: Session[];
  activeWeek: number;
  maxWeek: number;
  onOpenPlan: () => void;
}

function dayOrder(day: string): number {
  const idx = WEEKDAY_ORDER.indexOf((day || "").slice(0, 3).toLowerCase());
  return idx >= 0 ? idx : 99;
}

function getTodayOrder(): number {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

function isRideSession(session: Session): boolean {
  return session.type === "Ride" || session.type === "Long Ride";
}

function isPastDueRide(session: Session, todayIso: string, todayOrder: number): boolean {
  if (session.completed || !isRideSession(session)) return false;
  if (session.scheduledDate) return session.scheduledDate < todayIso;
  return dayOrder(session.day) < todayOrder;
}

function effortTypeForSession(session: Session): string {
  if (session.type === "Strength") return "Strength";
  if (session.type === "Rest") return "Recovery";
  if (session.zone) return session.zone;

  const description = (session.description || "").toLowerCase();
  if (description.includes("skill") || description.includes("trail")) return "Skills";
  if (session.type === "Long Ride") return "Endurance";
  return "Ride";
}

export function Dashboard({ sessions, activeWeek, maxWeek, onOpenPlan }: Props) {
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

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayOrder = getTodayOrder();

  const plannedRideSessions = weeklySessions.filter(isRideSession);
  const completedRideCount = plannedRideSessions.filter((session) => session.completed).length;
  const hasMissedRide = plannedRideSessions.some((session) =>
    isPastDueRide(session, todayIso, todayOrder),
  );
  const statusLabel = hasMissedRide ? "Needs Adjustment" : "On Track";
  const rideCompletionText = `${completedRideCount} of ${plannedRideSessions.length} rides completed`;
  const rideCompletionPct = plannedRideSessions.length
    ? Math.round((completedRideCount / plannedRideSessions.length) * 100)
    : 0;

  const incompleteRideSessions = plannedRideSessions.filter((session) => !session.completed);
  const nextUpcomingRide = incompleteRideSessions.find(
    (session) => !isPastDueRide(session, todayIso, todayOrder),
  );
  const nextRide = nextUpcomingRide || incompleteRideSessions[0] || null;

  const plannedHours = weeklySessions.reduce((sum, session) => sum + (session.minutes || 0), 0) / 60;
  const completedHours =
    weeklySessions
      .filter((session) => session.completed)
      .reduce((sum, session) => sum + (session.minutes || 0), 0) / 60;
  const consistencyScore = plannedRideSessions.length
    ? Math.max(0, Math.min(10, Math.round((completedRideCount / plannedRideSessions.length) * 10)))
    : 0;

  const handleToggleComplete = async (session: Session) => {
    try {
      await apiRequest("PATCH", `/api/sessions/${session.id}`, {
        completed: !session.completed,
        completedAt: !session.completed ? new Date().toISOString() : null,
        completionSource: !session.completed ? "manual" : null,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
    } catch {
      toast({ title: "Failed to update session", variant: "destructive" });
    }
  };

  return (
    <div className="p-4 space-y-8" data-testid="dashboard-view">
      <section className="glass-panel p-4 space-y-3" data-testid="dash-status-section">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-brand-text">Week {activeWeek} of {maxWeek}</h2>
          <span
            className={
              hasMissedRide
                ? "rounded-md bg-brand-warning/18 text-brand-warning px-2.5 py-1 text-xs font-semibold"
                : "rounded-md bg-brand-success/18 text-brand-success px-2.5 py-1 text-xs font-semibold"
            }
            data-testid="dash-status-badge"
          >
            {statusLabel}
          </span>
        </div>
        <p className="text-sm text-brand-muted" data-testid="dash-ride-progress-text">
          {rideCompletionText}
        </p>
        <div className="h-2 rounded-full bg-brand-bg/55 overflow-hidden">
          <div
            className="h-2 rounded-full bg-brand-primary transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, rideCompletionPct))}%` }}
            data-testid="dash-ride-progress-bar"
          />
        </div>
      </section>

      <section className="glass-panel p-5 space-y-4 border border-brand-primary/30" data-testid="dash-next-ride-section">
        <h3 className="text-lg font-semibold text-brand-text">Next Ride</h3>
        {nextRide ? (
          <>
            <div className="space-y-1">
              <p className="text-sm text-brand-muted">
                {nextRide.day}
                {nextRide.scheduledDate ? ` - ${nextRide.scheduledDate}` : ""}
              </p>
              <p className="text-xl font-semibold text-brand-text">{nextRide.description}</p>
              <p className="text-sm text-brand-muted">
                {nextRide.minutes} min - {effortTypeForSession(nextRide)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setViewingSession(nextRide)}
              className="w-full min-h-[48px] rounded-lg bg-[#22c55e] text-white font-semibold text-sm"
              data-testid="button-view-next-session"
            >
              View Session
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-brand-muted">
              No upcoming ride for this week. Open your week plan to review or adjust sessions.
            </p>
            <button
              type="button"
              onClick={onOpenPlan}
              className="w-full min-h-[48px] rounded-lg border border-brand-border bg-brand-panel-2/55 text-brand-text font-semibold text-sm"
              data-testid="button-open-plan-from-dash"
            >
              Open Week Plan
            </button>
          </>
        )}
      </section>

      <section className="glass-panel p-4" data-testid="dash-weekly-snapshot">
        <h3 className="text-lg font-semibold text-brand-text mb-3">Weekly Snapshot</h3>
        <div className="space-y-2 text-sm text-brand-muted">
          <p>Planned: {plannedHours.toFixed(1)} hrs</p>
          <p>Completed: {completedHours.toFixed(1)} hrs</p>
          <p>Consistency score: {consistencyScore}/10</p>
        </div>
      </section>

      {viewingSession && (
        <WorkoutDetailModal
          session={viewingSession}
          onClose={() => setViewingSession(null)}
          onToggleComplete={() => handleToggleComplete(viewingSession)}
        />
      )}
    </div>
  );
}

