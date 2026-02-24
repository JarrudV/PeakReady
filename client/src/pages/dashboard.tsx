import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session, Metric, GoalEvent } from "@shared/schema";
import {
  weekStats,
  totalCompletedSessions,
  latestMetric,
  planStatus,
  calculateReadinessDetails,
} from "@/lib/stats";
import {
  ChevronDown,
  TrendingDown,
  TrendingUp,
  Minus,
  Zap,
  Activity as ActivityIcon,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StravaPanel } from "@/components/strava-panel";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const DAILY_QUOTES = [
  { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Arnold Schwarzenegger" },
  { text: "It never gets easier, you just get faster.", author: "Greg LeMond" },
  { text: "Suffer now and live the rest of your life as a champion.", author: "Muhammad Ali" },
  { text: "The bicycle is the most civilized conveyance known to man.", author: "Iris Murdoch" },
  { text: "Life is like riding a bicycle. To keep your balance, you must keep moving.", author: "Albert Einstein" },
  { text: "Nothing compares to the simple pleasure of riding a bike.", author: "John F. Kennedy" },
  { text: "Persistence can change failure into extraordinary achievement.", author: "Marv Levy" },
  { text: "Don't count the days, make the days count.", author: "Muhammad Ali" },
  { text: "When my legs hurt, I say: Shut up legs! Do what I tell you to do!", author: "Jens Voigt" },
  { text: "Champions keep playing until they get it right.", author: "Billie Jean King" },
  { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
  { text: "Strength does not come from winning. It comes from the struggles.", author: "Mahatma Gandhi" },
  { text: "A year from now you will wish you had started today.", author: "Karen Lamb" },
  { text: "The hardest part is showing up. After that, the ride takes care of itself.", author: "Unknown" },
  { text: "The mountains are calling and I must go.", author: "John Muir" },
  { text: "Every ride is a chance to feel alive.", author: "Unknown" },
  { text: "Success isn't always about greatness. It's about consistency.", author: "Dwayne Johnson" },
  { text: "Sore today. Strong tomorrow.", author: "Unknown" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
  { text: "Ride as much or as little, as long or as short as you feel. But ride.", author: "Eddy Merckx" },
  { text: "The best rides are the ones where you bite off much more than you can chew.", author: "Doug Bradbury" },
  { text: "It's not about the bike.", author: "Lance Armstrong" },
  { text: "Sweat is just fat crying.", author: "Unknown" },
  { text: "Cycling is the new golf. It's the new networking.", author: "Patrick Dempsey" },
  { text: "Ride your bike, ride your bike, ride your bike.", author: "Fausto Coppi" },
  { text: "The will to win means nothing without the will to prepare.", author: "Juma Ikangaa" },
  { text: "What doesn't kill you makes you stronger.", author: "Friedrich Nietzsche" },
  { text: "When the spirits are low, when the day appears dark, just mount a bicycle.", author: "Arthur Conan Doyle" },
  { text: "Somewhere behind the athlete you've become is the child who fell in love with the sport.", author: "Unknown" },
  { text: "The real workout starts when you want to stop.", author: "Ronnie Coleman" },
  { text: "Think of what it would mean to have that body, that health, that freedom.", author: "Unknown" },
];

function getDailyQuote() {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

type ZoneLabel = "Z1" | "Z2" | "Z3" | "Z4" | "Z5";
type SkillKey = "cornering" | "braking" | "descending";

interface SkillProgressEntry {
  weekKey: string;
  cornering: number;
  braking: number;
  descending: number;
}

interface ZoneProgress {
  zone: ZoneLabel;
  score: number;
  sessions: number;
}

const ZONE_LABELS: ZoneLabel[] = ["Z1", "Z2", "Z3", "Z4", "Z5"];

function getCurrentWeekKey(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function parseSkillLog(rawValue: string | null | undefined): SkillProgressEntry[] {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.weekKey === "string")
      .map((item) => ({
        weekKey: item.weekKey,
        cornering: Number(item.cornering) || 1,
        braking: Number(item.braking) || 1,
        descending: Number(item.descending) || 1,
      }));
  } catch {
    return [];
  }
}

function clampSkill(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function extractZones(session: Session): ZoneLabel[] {
  const combined = `${session.zone || ""} ${session.description || ""}`.toUpperCase();
  const matches = combined.match(/Z[1-5]/g) || [];
  const unique = Array.from(new Set(matches));
  return unique.filter((zone): zone is ZoneLabel => ZONE_LABELS.includes(zone as ZoneLabel));
}

function getRecentTimestamp(session: Session): number | null {
  if (session.completedAt) {
    const parsed = new Date(session.completedAt);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  if (session.scheduledDate) {
    const parsed = new Date(session.scheduledDate);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  return null;
}

function calculateZoneProgression(sessions: Session[]): ZoneProgress[] {
  const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const buckets = Object.fromEntries(
    ZONE_LABELS.map((zone) => [zone, { sessions: 0, minutes: 0, rpes: [] as number[] }]),
  ) as Record<ZoneLabel, { sessions: number; minutes: number; rpes: number[] }>;

  for (const session of sessions) {
    if (!session.completed) continue;
    if (!(session.type === "Ride" || session.type === "Long Ride")) continue;
    const stamp = getRecentTimestamp(session);
    if (!stamp || stamp < cutoff) continue;

    const zones = extractZones(session);
    if (zones.length === 0) continue;

    for (const zone of zones) {
      buckets[zone].sessions += 1;
      buckets[zone].minutes += session.minutes || 0;
      if (typeof session.rpe === "number") {
        buckets[zone].rpes.push(session.rpe);
      }
    }
  }

  return ZONE_LABELS.map((zone) => {
    const bucket = buckets[zone];
    const base = Math.min(85, bucket.sessions * 10 + bucket.minutes / 20);
    const avgRpe = bucket.rpes.length
      ? bucket.rpes.reduce((sum, rpe) => sum + rpe, 0) / bucket.rpes.length
      : null;

    let adjustment = 0;
    if (avgRpe !== null) {
      if (avgRpe >= 8) adjustment = -8;
      else if (avgRpe >= 4 && avgRpe <= 7) adjustment = 10;
      else adjustment = 5;
    }

    return {
      zone,
      sessions: bucket.sessions,
      score: Math.max(0, Math.min(100, Math.round(base + adjustment))),
    };
  });
}

function trendForSkill(entries: SkillProgressEntry[], key: SkillKey): "up" | "down" | "flat" {
  if (entries.length < 2) return "flat";
  const prev = entries[entries.length - 2][key];
  const current = entries[entries.length - 1][key];
  if (current > prev) return "up";
  if (current < prev) return "down";
  return "flat";
}

interface Props {
  sessions: Session[];
  metrics: Metric[];
  goal?: GoalEvent;
  activeWeek: number;
  maxWeek: number;
  onWeekChange: (week: number) => void;
  onOpenOnboarding: () => void;
}

export function Dashboard({
  sessions,
  metrics,
  goal,
  activeWeek,
  maxWeek,
  onWeekChange,
  onOpenOnboarding,
}: Props) {
  const currentWeekStats = weekStats(sessions, activeWeek);
  const targetHours = currentWeekStats.targetMinutes / 60;
  const completedHours = currentWeekStats.completedMinutes / 60;
  const completionPct = currentWeekStats.completionPct;

  const totalSessions = totalCompletedSessions(sessions);
  const statusInfo = planStatus(sessions, goal);
  const readiness = calculateReadinessDetails(metrics);
  const readinessScore = readiness.score;
  const [showReadinessInfo, setShowReadinessInfo] = useState(false);

  const currentWeight = latestMetric(metrics, "weightKg");
  const { toast } = useToast();

  const { data: skillLogSetting } = useQuery<{ value: string | null }>({
    queryKey: ["/api/settings", "skillsProgressLog"],
  });
  const skillEntries = useMemo(() => parseSkillLog(skillLogSetting?.value), [skillLogSetting?.value]);
  const latestSkillEntry = skillEntries.length > 0 ? skillEntries[skillEntries.length - 1] : null;
  const [skillDraft, setSkillDraft] = useState({
    cornering: latestSkillEntry?.cornering ?? 3,
    braking: latestSkillEntry?.braking ?? 3,
    descending: latestSkillEntry?.descending ?? 3,
  });
  const [isSavingSkills, setIsSavingSkills] = useState(false);
  const zoneProgress = useMemo(() => calculateZoneProgression(sessions), [sessions]);

  useEffect(() => {
    if (!latestSkillEntry) return;
    setSkillDraft({
      cornering: latestSkillEntry.cornering,
      braking: latestSkillEntry.braking,
      descending: latestSkillEntry.descending,
    });
  }, [latestSkillEntry?.weekKey]);

  let weightDelta: number | null = null;
  const weightEntries = metrics
    .filter((m) => m.weightKg !== undefined && m.weightKg !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (weightEntries.length > 1) {
    weightDelta =
      weightEntries[weightEntries.length - 1].weightKg! -
      weightEntries[0].weightKg!;
  }

  const latestFatigue = latestMetric(metrics, "fatigue");
  const dailyQuote = useMemo(() => getDailyQuote(), []);

  const handleSaveSkills = async () => {
    setIsSavingSkills(true);
    try {
      const weekKey = getCurrentWeekKey();
      const nextEntry: SkillProgressEntry = {
        weekKey,
        cornering: clampSkill(skillDraft.cornering),
        braking: clampSkill(skillDraft.braking),
        descending: clampSkill(skillDraft.descending),
      };

      const current = [...skillEntries];
      const existingIndex = current.findIndex((entry) => entry.weekKey === weekKey);
      if (existingIndex >= 0) {
        current[existingIndex] = nextEntry;
      } else {
        current.push(nextEntry);
      }

      const trimmed = current.sort((a, b) => a.weekKey.localeCompare(b.weekKey)).slice(-52);
      await apiRequest("PUT", "/api/settings/skillsProgressLog", {
        value: JSON.stringify(trimmed),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/settings", "skillsProgressLog"] });
      toast({ title: "Skills confidence saved" });
    } catch {
      toast({ title: "Failed to save skills confidence", variant: "destructive" });
    } finally {
      setIsSavingSkills(false);
    }
  };

  return (
    <div className="p-4 space-y-6" data-testid="dashboard-view">
      <div className="flex justify-between items-center relative z-10">
        <h2 className="text-2xl font-bold text-brand-text" data-testid="text-dashboard-title">
          Dashboard
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenOnboarding}
            className="glass-panel px-2.5 py-2 text-[10px] uppercase tracking-widest font-bold text-brand-primary flex items-center gap-1.5 hover:opacity-90"
            data-testid="button-open-rider-guide"
          >
            <HelpCircle size={12} />
            Guide
          </button>
          <div className="relative">
          <select
            value={activeWeek}
            onChange={(e) => onWeekChange(parseInt(e.target.value, 10))}
            className="appearance-none glass-panel py-2 pl-4 pr-10 text-brand-text font-bold uppercase tracking-widest text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer"
            data-testid="select-week"
          >
            {Array.from({ length: Math.max(1, maxWeek) }, (_, i) => i + 1).map((w) => (
              <option
                className="bg-brand-bg text-brand-text"
                key={w}
                value={w}
              >
                Week {w}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-primary pointer-events-none"
            size={16}
          />
          </div>
        </div>
      </div>

      <div className="glass-panel px-5 py-4 relative overflow-hidden border-l-2 border-brand-primary/40" data-testid="daily-quote">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-primary opacity-10 blur-3xl -mr-8 -mt-8 rounded-full pointer-events-none" />
        <p className="text-sm italic text-brand-text/90 leading-relaxed relative z-10" data-testid="text-quote">
          "{dailyQuote.text}"
        </p>
        <p className="text-[10px] uppercase tracking-widest font-bold text-brand-muted mt-1.5 relative z-10" data-testid="text-quote-author">
          — {dailyQuote.author}
        </p>
      </div>

      <div className="glass-panel p-6 shadow-[0_0_20px_rgba(189,52,254,0.15)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-primary opacity-20 blur-3xl -mr-10 -mt-10 rounded-full" />
        <h3 className="text-brand-muted text-[10px] uppercase tracking-widest font-bold mb-1 relative z-10">
          Weekly Progress
        </h3>
        <div className="flex items-end gap-2 mb-4 relative z-10">
          <span
            className="text-5xl font-black font-mono text-gradient-primary"
            data-testid="text-completed-hours"
          >
            {completedHours.toFixed(1)}
          </span>
          <span className="text-brand-muted font-bold text-sm mb-1 uppercase tracking-widest">
            / {targetHours.toFixed(1)} hrs
          </span>
        </div>
        <div className="w-full bg-brand-bg/50 rounded-full h-3 mb-2 relative overflow-hidden z-10 border border-brand-border/50">
          <div
            className="bg-gradient-secondary h-3 rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(255,168,0,0.8)]"
            style={{ width: `${Math.min(completionPct, 100)}%` }}
            data-testid="progress-weekly"
          />
        </div>
        <div className="flex justify-between text-[10px] uppercase font-bold text-brand-muted relative z-10">
          <span>0%</span>
          <span
            className={cn(
              completionPct === 100 && "text-brand-success font-black"
            )}
          >
            {completionPct}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-panel p-5 flex flex-col justify-between col-span-2 shadow-[0_0_15px_rgba(65,209,255,0.05)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-primary opacity-10 blur-3xl -ml-10 -mt-10 rounded-full pointer-events-none" />
          <div className="flex justify-between items-center relative z-10">
            <h3 className="text-brand-muted text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">
              <Zap size={12} className="text-brand-primary" /> Readiness Score
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowReadinessInfo((prev) => !prev)}
                className="text-[10px] font-bold text-brand-primary uppercase tracking-widest hover:underline"
                data-testid="button-readiness-info"
              >
                How this is calculated
              </button>
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">
                0-100
              </span>
            </div>
          </div>
          {showReadinessInfo && (
            <p
              className="mt-2 text-[11px] text-brand-muted leading-relaxed relative z-10"
              data-testid="text-readiness-info"
            >
              Readiness is driven mainly by fatigue (1 fresh, 10 exhausted). If a resting-HR baseline exists, today&apos;s RHR can nudge the score; treat it as a simple directional signal, not a precise performance prediction.
            </p>
          )}
          <div className="mt-4 flex items-center justify-between relative z-10">
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-5xl font-black font-mono",
                  readinessScore >= 80
                    ? "text-brand-success drop-shadow-[0_0_10px_rgba(89,191,150,0.6)]"
                    : readinessScore >= 50
                      ? "text-brand-secondary drop-shadow-[0_0_10px_rgba(255,234,131,0.6)]"
                      : "text-brand-danger drop-shadow-[0_0_10px_rgba(255,92,122,0.6)]"
                )}
                data-testid="text-readiness-score"
              >
                {readinessScore}
              </span>
              <span className="text-xs uppercase font-bold text-brand-muted tracking-widest">
                {readinessScore >= 80
                  ? "Peak"
                  : readinessScore >= 50
                    ? "Steady"
                    : "Recover"}
              </span>
            </div>
            {readiness.usesRhrBaseline && readiness.baselineRhr !== null ? (
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">
                Baseline RHR: {readiness.baselineRhr} bpm
              </span>
            ) : (
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">
                Using fatigue only
              </span>
            )}
          </div>
        </div>

        <div className="glass-panel p-5 flex flex-col justify-between col-span-2 shadow-[0_0_15px_rgba(189,52,254,0.05)]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-brand-muted text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">
              <ActivityIcon size={12} className="text-brand-primary" /> Plan vs
              Timeline
            </h3>
            <div
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border",
                statusInfo.behindCount === 0
                  ? "bg-brand-success/20 text-brand-success border-brand-success/30"
                  : statusInfo.behindCount <= 2
                    ? "bg-brand-secondary/20 text-brand-secondary border-brand-secondary/30"
                    : "bg-brand-danger/20 text-brand-danger border-brand-danger/30 shadow-[0_0_8px_rgba(255,92,122,0.4)]"
              )}
              data-testid="text-plan-status"
            >
              {statusInfo.status}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[10px] uppercase font-bold text-brand-muted mb-1">
                <span>Time Elapsed</span>
                <span className="text-white">{statusInfo.planProgress}%</span>
              </div>
              <div className="w-full bg-brand-bg/50 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-brand-muted h-1.5 rounded-full"
                  style={{ width: `${statusInfo.planProgress}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] uppercase font-bold text-brand-muted mb-1">
                <span>Sessions Done</span>
                <span className="text-brand-primary drop-shadow-[0_0_5px_rgba(65,209,255,0.6)]">
                  {statusInfo.sessionProgress}%
                </span>
              </div>
              <div className="w-full bg-brand-bg/50 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-primary h-1.5 rounded-full shadow-[0_0_8px_rgba(65,209,255,0.8)]"
                  style={{ width: `${statusInfo.sessionProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 col-span-2 space-y-3 border-brand-border/60">
          <div className="flex items-center justify-between">
            <h3 className="text-brand-muted text-[10px] uppercase tracking-widest font-bold">
              Zone Progression (Last 4 Weeks)
            </h3>
            <span className="text-[10px] text-brand-muted uppercase tracking-widest">
              Beginner-friendly score
            </span>
          </div>
          <p className="text-[11px] text-brand-muted leading-relaxed">
            Higher scores mean you are consistently completing rides in that zone at manageable effort.
          </p>
          <div className="space-y-2">
            {zoneProgress.map((item) => (
              <div key={item.zone}>
                <div className="flex justify-between text-[10px] uppercase font-bold text-brand-muted mb-1">
                  <span>
                    {item.zone} ({item.sessions} sessions)
                  </span>
                  <span className="text-brand-text">{item.score}</span>
                </div>
                <div className="w-full bg-brand-bg/50 rounded-full h-1.5 overflow-hidden border border-brand-border/40">
                  <div
                    className="h-1.5 rounded-full bg-gradient-primary"
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-5 col-span-2 space-y-3 border-brand-border/60">
          <div className="flex items-center justify-between">
            <h3 className="text-brand-muted text-[10px] uppercase tracking-widest font-bold">
              Skills Confidence Track
            </h3>
            <span className="text-[10px] text-brand-muted uppercase tracking-widest">
              1 = not confident, 5 = very confident
            </span>
          </div>
          <p className="text-[11px] text-brand-muted leading-relaxed">
            Quick weekly check-in for off-road skills. This helps keep your plan realistic for your first event.
          </p>

          <SkillInputRow
            label="Cornering"
            value={skillDraft.cornering}
            trend={trendForSkill(skillEntries, "cornering")}
            onChange={(value) => setSkillDraft((prev) => ({ ...prev, cornering: value }))}
          />
          <SkillInputRow
            label="Braking"
            value={skillDraft.braking}
            trend={trendForSkill(skillEntries, "braking")}
            onChange={(value) => setSkillDraft((prev) => ({ ...prev, braking: value }))}
          />
          <SkillInputRow
            label="Descending"
            value={skillDraft.descending}
            trend={trendForSkill(skillEntries, "descending")}
            onChange={(value) => setSkillDraft((prev) => ({ ...prev, descending: value }))}
          />

          <button
            onClick={handleSaveSkills}
            disabled={isSavingSkills}
            className="w-full mt-1 py-2 rounded-lg bg-gradient-secondary text-brand-bg text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
            data-testid="button-save-skills-progress"
          >
            {isSavingSkills ? "Saving..." : "Save Skills Check-In"}
          </button>
        </div>

        <div className="glass-panel p-4 flex flex-col justify-between">
          <h3 className="text-brand-muted text-[10px] uppercase tracking-widest font-bold">
            Total Sessions
          </h3>
          <span className="text-3xl font-black font-mono mt-1 text-white" data-testid="text-total-sessions">
            {totalSessions}
          </span>
        </div>

        <div className="glass-panel p-4 flex flex-col justify-between">
          <h3 className="text-brand-muted text-[10px] uppercase tracking-widest font-bold">
            Weight
          </h3>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-black font-mono">
              {currentWeight !== undefined
                ? `${Number(currentWeight).toFixed(1)}`
                : "--"}
              <span className="text-[10px] font-bold text-brand-muted ml-0.5 uppercase">
                kg
              </span>
            </span>
            {weightDelta !== null && (
              <div
                className={cn(
                  "flex items-center text-[10px] font-bold px-2 py-1 rounded-full",
                  weightDelta < 0
                    ? "bg-brand-success/20 text-brand-success"
                    : weightDelta > 0
                      ? "bg-brand-danger/20 text-brand-danger shadow-[0_0_8px_rgba(255,92,122,0.4)]"
                      : "bg-brand-panel-2 text-brand-muted"
                )}
              >
                {weightDelta < 0 ? (
                  <TrendingDown size={12} className="mr-1" />
                ) : weightDelta > 0 ? (
                  <TrendingUp size={12} className="mr-1" />
                ) : (
                  <Minus size={12} className="mr-1" />
                )}
                {Math.abs(weightDelta).toFixed(1)}
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel p-4 flex flex-col justify-between col-span-2">
          <div className="flex justify-between items-center">
            <h3 className="text-brand-muted text-[10px] uppercase tracking-widest font-bold">
              Latest Fatigue
            </h3>
            <span className="text-[10px] font-bold text-brand-muted uppercase tracking-widest bg-brand-bg/50 px-2 py-1 rounded-md border border-brand-border/30">
              Scale: 1-10
            </span>
          </div>
          <div className="mt-3 flex items-center">
            <span
              className={cn(
                "text-3xl font-black font-mono",
                latestFatigue !== undefined && Number(latestFatigue) >= 8
                  ? "text-brand-danger drop-shadow-[0_0_8px_rgba(255,92,122,0.6)]"
                  : latestFatigue !== undefined && Number(latestFatigue) >= 5
                    ? "text-brand-warning drop-shadow-[0_0_8px_rgba(255,168,0,0.6)]"
                    : "text-brand-success drop-shadow-[0_0_8px_rgba(89,191,150,0.6)]"
              )}
              data-testid="text-fatigue"
            >
              {latestFatigue ?? "--"}
            </span>
            {latestFatigue !== undefined && (
              <div className="ml-4 flex-1 h-3 bg-brand-bg/50 rounded-full overflow-hidden border border-brand-border/50">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    Number(latestFatigue) >= 8
                      ? "bg-brand-danger shadow-[0_0_8px_rgba(255,92,122,0.8)]"
                      : Number(latestFatigue) >= 5
                        ? "bg-gradient-secondary shadow-[0_0_8px_rgba(255,168,0,0.8)]"
                        : "bg-brand-success"
                  )}
                  style={{
                    width: `${(Number(latestFatigue) / 10) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <StravaPanel />
    </div>
  );
}

function SkillInputRow({
  label,
  value,
  trend,
  onChange,
}: {
  label: string;
  value: number;
  trend: "up" | "down" | "flat";
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-widest font-bold text-brand-muted">{label}</span>
        <div className="flex items-center gap-1 text-[10px] font-bold text-brand-muted">
          {trend === "up" ? <TrendingUp size={12} className="text-brand-success" /> : null}
          {trend === "down" ? <TrendingDown size={12} className="text-brand-danger" /> : null}
          {trend === "flat" ? <Minus size={12} /> : null}
          <span>{value}/5</span>
        </div>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[var(--color-brand-primary)]"
      />
    </div>
  );
}
