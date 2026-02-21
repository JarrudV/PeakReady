import { useState } from "react";
import type { Session, Metric, GoalEvent } from "@shared/schema";
import {
  weekStats,
  totalCompletedSessions,
  latestMetric,
  planStatus,
  calculateReadinessScore,
} from "@/lib/stats";
import {
  ChevronDown,
  TrendingDown,
  TrendingUp,
  Minus,
  Zap,
  Activity as ActivityIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  sessions: Session[];
  metrics: Metric[];
  goal?: GoalEvent;
  activeWeek: number;
  onWeekChange: (week: number) => void;
}

export function Dashboard({
  sessions,
  metrics,
  goal,
  activeWeek,
  onWeekChange,
}: Props) {
  const currentWeekStats = weekStats(sessions, activeWeek);
  const targetHours = currentWeekStats.targetMinutes / 60;
  const completedHours = currentWeekStats.completedMinutes / 60;
  const completionPct = currentWeekStats.completionPct;

  const totalSessions = totalCompletedSessions(sessions);
  const statusInfo = planStatus(sessions, goal);
  const readinessScore = calculateReadinessScore(sessions, metrics, activeWeek);

  const currentWeight = latestMetric(metrics, "weightKg");

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

  return (
    <div className="p-4 space-y-6" data-testid="dashboard-view">
      <div className="flex justify-between items-center relative z-10">
        <h2 className="text-2xl font-bold text-brand-text" data-testid="text-dashboard-title">
          Dashboard
        </h2>
        <div className="relative">
          <select
            value={activeWeek}
            onChange={(e) => onWeekChange(parseInt(e.target.value, 10))}
            className="appearance-none glass-panel py-2 pl-4 pr-10 text-brand-text font-bold uppercase tracking-widest text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer"
            data-testid="select-week"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
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
            <span className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">
              0-100
            </span>
          </div>
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
    </div>
  );
}
