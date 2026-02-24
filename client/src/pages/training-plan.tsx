import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session, GoalEvent, Metric, StravaActivity } from "@shared/schema";
import {
  CheckCircle2,
  Circle,
  Clock,
  Mountain,
  ArrowRight,
  Save,
  Edit3,
  X,
  Eye,
  Sparkles,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WorkoutDetailModal } from "@/components/workout-detail-modal";
import { PlanManager } from "@/components/plan-manager";
import { AIPlanBuilder } from "@/components/ai-plan-builder";

interface Props {
  sessions: Session[];
  activeWeek: number;
  goal?: GoalEvent;
}

type SessionPatch = Partial<Pick<Session, "type" | "description" | "zone" | "strength" | "minutes" | "notes">>;
type WorkoutDifficulty = "easy" | "moderate" | "hard";

interface AdaptiveSuggestion {
  id: string;
  kind: "reduce-intensity" | "increase-volume" | "rest-day-hard-ride";
  title: string;
  description: string;
  actionLabel: string;
  sessionId: string;
  patch: SessionPatch;
  note: string;
}

type AlternateKind = "easier" | "shorter" | "harder";

const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const INTENSITY_KEYWORDS = ["tempo", "threshold", "vo2", "interval", "race simulation", "sweet spot", "climbing tempo"];

function dayOrder(day: string): number {
  const idx = WEEKDAY_ORDER.indexOf(day.slice(0, 3).toLowerCase());
  return idx >= 0 ? idx : 99;
}

function addDaysIso(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map((part) => Number(part));
  if (!year || !month || !day) return dateStr;
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function adjustMinutesBounded(minutes: number, deltaFraction: number): number {
  const boundedFraction = clamp(deltaFraction, -0.2, 0.2);
  const adjusted = Math.round(minutes * (1 + boundedFraction));
  return Math.max(20, adjusted);
}

function isIntensitySession(session: Session): boolean {
  if (session.type === "Long Ride") return true;
  if (session.type !== "Ride") return false;

  const zone = (session.zone || "").toLowerCase();
  if (zone.includes("z3") || zone.includes("z4") || zone.includes("z5")) return true;

  const description = (session.description || "").toLowerCase();
  return INTENSITY_KEYWORDS.some((keyword) => description.includes(keyword));
}

function getAlternatePatch(session: Session, kind: AlternateKind): { patch: SessionPatch; note: string; toastLabel: string } {
  if (kind === "easier") {
    return {
      patch: {
        type: "Ride",
        description: "Easy Endurance Ride (Alternate)",
        strength: false,
        minutes: adjustMinutesBounded(session.minutes, -0.15),
        zone: "Z1-Z2",
      },
      note: "Alternate applied: made easier for recovery and consistency.",
      toastLabel: "Easier alternate applied",
    };
  }

  if (kind === "shorter") {
    return {
      patch: {
        minutes: adjustMinutesBounded(session.minutes, -0.1),
      },
      note: "Alternate applied: shortened duration by 10% to fit available time.",
      toastLabel: "Shorter alternate applied",
    };
  }

  const harderZone =
    session.type === "Long Ride"
      ? "Z2-Z3"
      : session.zone?.includes("Z1")
        ? "Z2"
        : session.zone?.includes("Z2")
          ? "Z2-Z3"
          : session.zone?.includes("Z3")
            ? "Z3-Z4"
            : session.zone?.includes("Z4")
              ? "Z4-Z5"
              : "Z3-Z4";

  return {
    patch: {
      minutes: adjustMinutesBounded(session.minutes, 0.08),
      zone: harderZone,
    },
    note: "Alternate applied: increased load slightly (+8%) because readiness looks good.",
    toastLabel: "Harder alternate applied",
  };
}

function appendRecoveryNote(existing: string | null, note: string): string {
  if (!existing) return note;
  if (existing.includes(note)) return existing;
  return `${existing}\n${note}`;
}

function getLatestFatigue(metrics: Metric[]): number | null {
  const fatigueEntries = metrics
    .filter((metric) => metric.fatigue !== null && metric.fatigue !== undefined)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return fatigueEntries.length > 0 ? Number(fatigueEntries[fatigueEntries.length - 1].fatigue) : null;
}

function difficultyToRpe(difficulty: WorkoutDifficulty): number {
  if (difficulty === "easy") return 3;
  if (difficulty === "hard") return 8;
  return 6;
}

function getDifficultyFromRpe(rpe: number | null | undefined): WorkoutDifficulty | null {
  if (!rpe) return null;
  if (rpe <= 4) return "easy";
  if (rpe >= 8) return "hard";
  return "moderate";
}

function isHardRide(activity: StravaActivity): boolean {
  const movingTime = activity.movingTime || 0;
  const elevation = activity.totalElevationGain || 0;
  const distance = activity.distance || 0;
  const averageHr = activity.averageHeartrate || 0;
  const sufferScore = activity.sufferScore || 0;

  if (movingTime >= 2 * 60 * 60) return true;
  if (sufferScore >= 120) return true;
  if (movingTime >= 75 * 60 && (averageHr >= 150 || elevation >= 600 || distance >= 30000)) return true;
  return false;
}

export function TrainingPlan({ sessions, activeWeek, goal }: Props) {
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingSession, setViewingSession] = useState<Session | null>(null);
  const [showAIBuilder, setShowAIBuilder] = useState(false);
  const [applyingSuggestionId, setApplyingSuggestionId] = useState<string | null>(null);
  const [applyingAlternateId, setApplyingAlternateId] = useState<string | null>(null);
  const [loggingDifficultyId, setLoggingDifficultyId] = useState<string | null>(null);
  const { data: metrics = [] } = useQuery<Metric[]>({
    queryKey: ["/api/metrics"],
  });
  const { data: stravaActivities = [] } = useQuery<StravaActivity[]>({
    queryKey: ["/api/strava/activities"],
  });
  const { toast } = useToast();

  const handleToggleComplete = async (session: Session) => {
    try {
      await apiRequest("PATCH", `/api/sessions/${session.id}`, {
        completed: !session.completed,
        completedAt: !session.completed ? new Date().toISOString() : null,
        completionSource: !session.completed ? "manual" : null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
    } catch {
      toast({ title: "Failed to update session", variant: "destructive" });
    }
  };

  const handleSaveEdit = async (
    sessionId: string,
    updates: Partial<Session>
  ) => {
    try {
      await apiRequest("PATCH", `/api/sessions/${sessionId}`, updates);
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      setEditingId(null);
    } catch {
      toast({ title: "Failed to save changes", variant: "destructive" });
    }
  };

  const suggestions = useMemo<AdaptiveSuggestion[]>(() => {
    const list: AdaptiveSuggestion[] = [];
    const latestFatigue = getLatestFatigue(metrics);

    const previousWeekSessions = sessions.filter((session) => session.week === activeWeek - 1);
    const previousWeekCompletionPct = previousWeekSessions.length
      ? (previousWeekSessions.filter((session) => session.completed).length / previousWeekSessions.length) * 100
      : 0;

    const openRideSessions = weeklySessions.filter(
      (session) => !session.completed && (session.type === "Ride" || session.type === "Long Ride"),
    );
    const openIntensitySessions = weeklySessions.filter((session) => !session.completed && isIntensitySession(session));
    const nextWeekOpenRideSessions = sessions
      .filter(
        (session) =>
          session.week === activeWeek + 1 &&
          !session.completed &&
          (session.type === "Ride" || session.type === "Long Ride"),
      )
      .sort((a, b) => {
        if (a.scheduledDate && b.scheduledDate) {
          return a.scheduledDate.localeCompare(b.scheduledDate);
        }
        return dayOrder(a.day) - dayOrder(b.day);
      });

    if (latestFatigue !== null && latestFatigue >= 8) {
      const target = openIntensitySessions[0] || openRideSessions[0];
      if (target) {
        list.push({
          id: `reduce-intensity-${target.id}`,
          kind: "reduce-intensity",
          title: "High fatigue: swap next intensity to easy",
          description: `Latest fatigue is ${latestFatigue}/10. Convert your next intensity session into a recovery ride.`,
          actionLabel: "Apply Recovery Swap",
          sessionId: target.id,
          patch: {
            type: "Ride",
            description: "Recovery Ride (Adaptive)",
            strength: false,
            minutes: adjustMinutesBounded(target.minutes, -0.15),
            zone: "Z1-Z2",
          },
          note: "Adaptive suggestion: fatigue >= 8. Swapped planned intensity for an easy recovery ride.",
        });
      }
    }

    if (latestFatigue !== null && latestFatigue <= 3 && previousWeekCompletionPct >= 90) {
      const target = nextWeekOpenRideSessions.find((session) => session.type === "Long Ride") || nextWeekOpenRideSessions[0];
      if (target) {
        list.push({
          id: `increase-volume-${target.id}`,
          kind: "increase-volume",
          title: "Low fatigue + high completion: increase next week volume",
          description: `Fatigue is ${latestFatigue}/10 and previous week completion was ${Math.round(previousWeekCompletionPct)}%. Increase one next-week ride by 8%.`,
          actionLabel: "Apply +8% Next Week",
          sessionId: target.id,
          patch: {
            minutes: adjustMinutesBounded(target.minutes, 0.08),
          },
          note: "Adaptive suggestion: fatigue <= 3 and completion >= 90%. Increased next-week ride volume by 8%.",
        });
      }
    }

    const hardRidesByDate = new Map<string, StravaActivity>();
    for (const activity of stravaActivities) {
      if (!isHardRide(activity)) continue;
      const rideDate = activity.startDate.slice(0, 10);
      if (!hardRidesByDate.has(rideDate)) {
        hardRidesByDate.set(rideDate, activity);
      }
    }

    const restSessions = weeklySessions.filter((session) => session.type === "Rest" && !!session.scheduledDate);
    for (const restSession of restSessions) {
      const restDate = restSession.scheduledDate!;
      const hardRide = hardRidesByDate.get(restDate);
      if (!hardRide) continue;

      const nextDate = addDaysIso(restDate, 1);
      const nextSession = weeklySessions.find(
        (session) => session.scheduledDate === nextDate && !session.completed,
      );
      if (!nextSession) continue;

      list.push({
        id: `rest-day-hard-ride-${nextSession.id}`,
        kind: "rest-day-hard-ride",
        title: "Hard ride logged on rest day",
        description: `${hardRide.name} was hard enough to warrant a lighter next day.`,
        actionLabel: "Make Next Day Recovery",
        sessionId: nextSession.id,
          patch: {
            type: "Ride",
            description: "Recovery Ride (Adaptive)",
            strength: false,
            zone: "Z1-Z2",
            minutes: adjustMinutesBounded(nextSession.minutes, -0.15),
          },
          note: `Adaptive suggestion: hard Strava ride logged on rest day (${restDate}); converted next day to recovery.`,
        });
      break;
    }

    return list;
  }, [activeWeek, metrics, sessions, stravaActivities, weeklySessions]);

  const handleApplySuggestion = async (suggestion: AdaptiveSuggestion) => {
    const targetSession = sessions.find((session) => session.id === suggestion.sessionId);
    if (!targetSession) {
      toast({ title: "Suggestion target no longer exists", variant: "destructive" });
      return;
    }

    setApplyingSuggestionId(suggestion.id);
    try {
      await apiRequest("PATCH", `/api/sessions/${targetSession.id}`, {
        ...suggestion.patch,
        notes: appendRecoveryNote(targetSession.notes, suggestion.note),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: "Suggestion applied", description: suggestion.title });
    } catch {
      toast({ title: "Failed to apply suggestion", variant: "destructive" });
    } finally {
      setApplyingSuggestionId(null);
    }
  };

  const handleApplyAlternate = async (session: Session, kind: AlternateKind) => {
    const alternateId = `${session.id}-${kind}`;
    setApplyingAlternateId(alternateId);

    const { patch, note, toastLabel } = getAlternatePatch(session, kind);
    try {
      await apiRequest("PATCH", `/api/sessions/${session.id}`, {
        ...patch,
        notes: appendRecoveryNote(session.notes, note),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: toastLabel });
    } catch {
      toast({ title: "Failed to apply alternate", variant: "destructive" });
    } finally {
      setApplyingAlternateId(null);
    }
  };

  const handleLogDifficulty = async (session: Session, difficulty: WorkoutDifficulty) => {
    setLoggingDifficultyId(session.id);
    try {
      await apiRequest("PATCH", `/api/sessions/${session.id}`, {
        rpe: difficultyToRpe(difficulty),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: "Workout feedback saved" });
    } catch {
      toast({ title: "Failed to save workout feedback", variant: "destructive" });
    } finally {
      setLoggingDifficultyId(null);
    }
  };

  return (
    <div className="p-4 space-y-4" data-testid="training-plan-view">
      <h2 className="text-2xl font-bold mb-2 text-brand-text" data-testid="text-plan-title">
        Week {activeWeek} Plan
      </h2>

      <PlanManager sessionCount={sessions.length} />

      <button
        onClick={() => setShowAIBuilder(true)}
        className="w-full py-3 rounded-lg bg-gradient-primary text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(65,209,255,0.2)] hover:shadow-[0_0_25px_rgba(65,209,255,0.4)] transition-all"
        data-testid="button-open-ai-builder"
      >
        <Sparkles size={14} />
        Build Plan with AI
      </button>

      <div className="glass-panel p-4 border-brand-secondary/30" data-testid="card-week-suggestions">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb size={14} className="text-brand-secondary" />
          <h3 className="text-xs font-black uppercase tracking-widest text-brand-text">
            Suggestions
          </h3>
        </div>
        <p className="text-[11px] text-brand-muted mb-3 leading-relaxed">
          Adaptive suggestions are based on fatigue, completion, and recent Strava rides. Nothing changes unless you click Apply.
        </p>

        {suggestions.length === 0 ? (
          <p className="text-xs text-brand-muted">No adaptive changes recommended right now.</p>
        ) : (
          <div className="space-y-2.5">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="rounded-lg border border-brand-border/60 bg-brand-bg/60 p-3"
                data-testid={`suggestion-${suggestion.kind}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-brand-text">{suggestion.title}</h4>
                    <p className="text-xs text-brand-muted mt-1">{suggestion.description}</p>
                  </div>
                  <button
                    onClick={() => handleApplySuggestion(suggestion)}
                    disabled={applyingSuggestionId === suggestion.id}
                    className="shrink-0 rounded-md px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold bg-gradient-secondary text-brand-bg disabled:opacity-50"
                    data-testid={`button-apply-suggestion-${suggestion.kind}`}
                  >
                    {applyingSuggestionId === suggestion.id ? "Applying..." : suggestion.actionLabel}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {weeklySessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            isEditing={editingId === session.id}
            onEdit={() => setEditingId(session.id)}
            onSave={(updates) => handleSaveEdit(session.id, updates)}
            onCancel={() => setEditingId(null)}
            onToggleComplete={() => handleToggleComplete(session)}
            onViewDetails={() => setViewingSession(session)}
            onApplyAlternate={(kind) => handleApplyAlternate(session, kind)}
            applyingAlternateId={applyingAlternateId}
            onLogDifficulty={(difficulty) => handleLogDifficulty(session, difficulty)}
            loggingDifficultyId={loggingDifficultyId}
          />
        ))}

        {weeklySessions.length === 0 && (
          <div className="text-center py-10 text-brand-muted glass-panel border-brand-border/50" data-testid="text-no-sessions">
            No sessions planned for this week.
          </div>
        )}
      </div>

      {viewingSession && (
        <WorkoutDetailModal
          session={viewingSession}
          onClose={() => setViewingSession(null)}
        />
      )}

      {showAIBuilder && (
        <AIPlanBuilder
          onClose={() => setShowAIBuilder(false)}
          goal={goal}
        />
      )}
    </div>
  );
}

function SessionCard({
  session,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onToggleComplete,
  onViewDetails,
  onApplyAlternate,
  applyingAlternateId,
  onLogDifficulty,
  loggingDifficultyId,
}: {
  session: Session;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updates: Partial<Session>) => void;
  onCancel: () => void;
  onToggleComplete: () => void;
  onViewDetails: () => void;
  onApplyAlternate: (kind: AlternateKind) => void;
  applyingAlternateId: string | null;
  onLogDifficulty: (difficulty: WorkoutDifficulty) => void;
  loggingDifficultyId: string | null;
}) {
  const [editMinutes, setEditMinutes] = useState(session.minutes);
  const [editRpe, setEditRpe] = useState(session.rpe?.toString() || "");
  const [editNotes, setEditNotes] = useState(session.notes || "");
  const selectedDifficulty = getDifficultyFromRpe(session.rpe);

  const typeColor =
    session.type === "Long Ride"
      ? "text-brand-primary bg-brand-primary/10 border border-brand-primary/20 shadow-[0_0_10px_rgba(65,209,255,0.1)]"
      : session.type === "Ride"
        ? "text-brand-text bg-brand-panel-2 border border-brand-border/50"
        : session.type === "Strength"
          ? "text-brand-warning bg-brand-warning/10 border border-brand-warning/20 shadow-[0_0_10px_rgba(255,168,0,0.1)]"
          : "text-brand-muted bg-brand-panel-2 border border-brand-border/30";

  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-300 overflow-hidden relative",
        session.completed
          ? "bg-brand-bg opacity-70 border-brand-border"
          : "glass-panel shadow-md"
      )}
      data-testid={`card-session-${session.id}`}
    >
      {!session.completed && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-primary opacity-5 blur-2xl rounded-full pointer-events-none" />
      )}
      <div className="p-4 relative z-10">
        <div className="flex justify-between items-start mb-3">
          <button
            onClick={onViewDetails}
            className="text-left flex-1 focus:outline-none group"
            data-testid={`button-view-${session.id}`}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-brand-muted mb-1 block">
              {session.day}
              {session.scheduledDate && (
                <span className="ml-2 text-brand-primary/70 font-mono">
                  {session.scheduledDate}
                </span>
              )}
            </span>
            <h3
              className={cn(
                "text-lg font-bold leading-tight group-hover:text-brand-primary transition-colors",
                session.completed && "text-brand-muted"
              )}
            >
              {session.description}
            </h3>
            {session.completed && session.completionSource && (
              <span className="text-[10px] uppercase tracking-widest font-bold text-brand-success/80 mt-1 block">
                Completed via {session.completionSource}
              </span>
            )}
            {session.detailsMarkdown && (
              <span className="text-[10px] uppercase tracking-widest font-bold text-brand-primary/60 flex items-center gap-1 mt-1">
                <Eye size={10} /> Tap for workout details
              </span>
            )}
          </button>
          <button
            onClick={onToggleComplete}
            className="flex-shrink-0 ml-2 focus:outline-none transition-transform"
            data-testid={`button-toggle-${session.id}`}
          >
            {session.completed ? (
              <CheckCircle2
                size={26}
                className="text-brand-success drop-shadow-[0_0_10px_rgba(89,191,150,0.5)]"
              />
            ) : (
              <Circle
                size={26}
                className="text-brand-muted hover:text-brand-text drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]"
              />
            )}
          </button>
        </div>

        {!isEditing && (
          <div className="flex flex-wrap gap-2 mb-3">
            <span
              className={cn(
                "text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-md",
                typeColor
              )}
            >
              {session.type}
            </span>
            <span className="flex items-center text-[10px] uppercase font-bold tracking-widest border border-brand-border/40 bg-brand-bg text-brand-muted px-2 py-1 rounded-md">
              <Clock size={12} className="mr-1 text-brand-primary" />
              {session.minutes} min
            </span>
            {session.zone && (
              <span className="flex items-center text-[10px] uppercase font-bold tracking-widest border border-brand-border/40 bg-brand-bg text-brand-muted px-2 py-1 rounded-md">
                <ArrowRight size={12} className="mr-1 text-brand-secondary" />
                {session.zone}
              </span>
            )}
            {session.elevation && (
              <span className="flex items-center text-[10px] uppercase font-bold tracking-widest border border-brand-border/40 bg-brand-bg text-brand-muted px-2 py-1 rounded-md">
                <Mountain size={12} className="mr-1 text-brand-primary" />
                {session.elevation}
              </span>
            )}
          </div>
        )}

        {!isEditing && (session.rpe || session.notes) && (
          <div className="mt-3 pt-3 border-t border-brand-border space-y-2">
            {session.rpe && (
              <div className="flex items-center text-sm">
                <span className="text-brand-muted w-12">RPE:</span>
                <span className="font-semibold text-brand-text">
                  {session.rpe}/10
                </span>
              </div>
            )}
            {session.notes && (
              <div className="text-sm">
                <span className="text-brand-muted block mb-1">Notes:</span>
                <p className="text-brand-muted bg-brand-bg p-2 rounded-lg italic">
                  &ldquo;{session.notes}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}

        {!isEditing && session.completed && (
          <div className="mt-3 pt-3 border-t border-brand-border/70">
            <p className="text-[10px] uppercase tracking-widest text-brand-muted font-bold mb-2">
              How did this workout feel?
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onLogDifficulty("easy")}
                disabled={loggingDifficultyId === session.id}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-[10px] uppercase tracking-widest font-bold disabled:opacity-50",
                  selectedDifficulty === "easy"
                    ? "border-brand-success bg-brand-success/15 text-brand-success"
                    : "border-brand-border/60 bg-brand-bg/70 text-brand-muted hover:text-brand-text"
                )}
                data-testid={`button-difficulty-easy-${session.id}`}
              >
                Easy
              </button>
              <button
                onClick={() => onLogDifficulty("moderate")}
                disabled={loggingDifficultyId === session.id}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-[10px] uppercase tracking-widest font-bold disabled:opacity-50",
                  selectedDifficulty === "moderate"
                    ? "border-brand-primary bg-brand-primary/15 text-brand-primary"
                    : "border-brand-border/60 bg-brand-bg/70 text-brand-muted hover:text-brand-text"
                )}
                data-testid={`button-difficulty-moderate-${session.id}`}
              >
                Moderate
              </button>
              <button
                onClick={() => onLogDifficulty("hard")}
                disabled={loggingDifficultyId === session.id}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-[10px] uppercase tracking-widest font-bold disabled:opacity-50",
                  selectedDifficulty === "hard"
                    ? "border-brand-warning bg-brand-warning/15 text-brand-warning"
                    : "border-brand-border/60 bg-brand-bg/70 text-brand-muted hover:text-brand-text"
                )}
                data-testid={`button-difficulty-hard-${session.id}`}
              >
                Hard
              </button>
            </div>
          </div>
        )}

        {!isEditing && !session.completed && (session.type === "Ride" || session.type === "Long Ride") && (
          <div className="mt-3 pt-3 border-t border-brand-border/70">
            <p className="text-[10px] uppercase tracking-widest text-brand-muted font-bold mb-2">
              Need an alternate today?
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onApplyAlternate("easier")}
                disabled={applyingAlternateId === `${session.id}-easier`}
                className="rounded-md border border-brand-border/60 bg-brand-bg/70 px-2 py-1.5 text-[10px] uppercase tracking-widest font-bold text-brand-muted hover:text-brand-text disabled:opacity-50"
                data-testid={`button-alt-easier-${session.id}`}
              >
                {applyingAlternateId === `${session.id}-easier` ? "..." : "Easier"}
              </button>
              <button
                onClick={() => onApplyAlternate("shorter")}
                disabled={applyingAlternateId === `${session.id}-shorter`}
                className="rounded-md border border-brand-border/60 bg-brand-bg/70 px-2 py-1.5 text-[10px] uppercase tracking-widest font-bold text-brand-muted hover:text-brand-text disabled:opacity-50"
                data-testid={`button-alt-shorter-${session.id}`}
              >
                {applyingAlternateId === `${session.id}-shorter` ? "..." : "Shorter"}
              </button>
              <button
                onClick={() => onApplyAlternate("harder")}
                disabled={applyingAlternateId === `${session.id}-harder`}
                className="rounded-md border border-brand-border/60 bg-brand-bg/70 px-2 py-1.5 text-[10px] uppercase tracking-widest font-bold text-brand-muted hover:text-brand-text disabled:opacity-50"
                data-testid={`button-alt-harder-${session.id}`}
              >
                {applyingAlternateId === `${session.id}-harder` ? "..." : "Harder"}
              </button>
            </div>
          </div>
        )}

        {!isEditing && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={onEdit}
              className="text-xs font-medium text-brand-muted flex items-center hover:text-brand-text transition-colors"
              data-testid={`button-edit-${session.id}`}
            >
              <Edit3 size={14} className="mr-1" />
              {session.completed ? "Edit Details" : "Add RPE/Notes"}
            </button>
          </div>
        )}

        {isEditing && (
          <div className="mt-4 space-y-3 bg-brand-bg/50 p-4 rounded-xl border border-brand-border shadow-inner">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold block mb-1.5">
                Duration (mins)
              </label>
              <input
                type="number"
                value={editMinutes}
                onChange={(e) =>
                  setEditMinutes(parseInt(e.target.value) || 0)
                }
                className="w-full bg-brand-bg text-brand-text border border-brand-border/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                data-testid="input-edit-minutes"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold block mb-1.5">
                RPE (1-10)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={editRpe}
                onChange={(e) => setEditRpe(e.target.value)}
                className="w-full bg-brand-bg text-brand-text border border-brand-border/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                placeholder="How hard was it?"
                data-testid="input-edit-rpe"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold block mb-1.5">
                Notes
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full bg-brand-bg text-brand-text border border-brand-border/60 rounded-lg px-3 py-2 text-sm min-h-[60px] resize-none focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                placeholder="Felt strong on the climbs..."
                data-testid="input-edit-notes"
              />
            </div>
            <div className="flex gap-2 justify-end pt-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-brand-muted hover:bg-brand-panel hover:text-brand-text rounded-lg transition-colors flex items-center"
                data-testid="button-cancel-edit"
              >
                <X size={14} className="mr-1" /> Cancel
              </button>
              <button
                onClick={() =>
                  onSave({
                    minutes: editMinutes,
                    rpe: editRpe ? parseInt(editRpe) : undefined,
                    notes: editNotes || undefined,
                  })
                }
                className="px-5 py-2 text-xs font-black tracking-widest uppercase bg-gradient-primary shadow-[0_0_10px_rgba(65,209,255,0.4)] text-brand-bg hover:opacity-90 rounded-lg transition-colors flex items-center"
                data-testid="button-save-edit"
              >
                <Save size={14} className="mr-1" /> Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
