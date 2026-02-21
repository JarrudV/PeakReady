import type { Session, Metric, GoalEvent } from "@shared/schema";
import { parseISODate } from "./dates";

export function weekStats(sessions: Session[], activeWeek: number) {
  const weekSessions = sessions.filter((s) => s.week === activeWeek);
  const targetMins = weekSessions.reduce((a, s) => a + (s.minutes || 0), 0);
  const completedMins = weekSessions
    .filter((s) => s.completed)
    .reduce((a, s) => a + (s.minutes || 0), 0);

  const completionPct = weekSessions.length
    ? weekSessions.filter((s) => s.completed).length / weekSessions.length
    : 0;

  return {
    targetMinutes: targetMins,
    completedMinutes: completedMins,
    completionPct: Math.round(completionPct * 100),
    completedCount: weekSessions.filter((s) => s.completed).length,
    totalCount: weekSessions.length,
  };
}

export function totalCompletedSessions(sessions: Session[]) {
  return sessions.filter((s) => s.completed).length;
}

export function latestMetric(metrics: Metric[], key: keyof Metric) {
  const sorted = [...metrics]
    .filter((m) => m[key] !== undefined && m[key] !== null)
    .sort((a, b) => (a.date > b.date ? 1 : -1));
  return sorted.at(-1)?.[key] ?? undefined;
}

export function planStatus(sessions: Session[], goal?: GoalEvent) {
  if (!sessions.length || !goal) {
    return {
      planProgress: 0,
      sessionProgress: 0,
      status: "Unknown",
      behindCount: 0,
    };
  }

  const firstSession = sessions.reduce((earliest, s) => {
    if (!s.scheduledDate) return earliest;
    if (!earliest) return s.scheduledDate;
    return s.scheduledDate < earliest ? s.scheduledDate : earliest;
  }, "" as string);

  if (!firstSession)
    return {
      planProgress: 0,
      sessionProgress: 0,
      status: "Unknown",
      behindCount: 0,
    };

  const startDate = parseISODate(firstSession);
  const raceDate = parseISODate(goal.startDate);
  const today = new Date();

  const totalDays = Math.max(
    1,
    (raceDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)
  );
  const elapsedDays = Math.max(
    0,
    (today.getTime() - startDate.getTime()) / (1000 * 3600 * 24)
  );

  const planProgress = Math.min(
    100,
    Math.round((elapsedDays / totalDays) * 100)
  );

  const totalSessions = sessions.length;
  const completedSessionsCount = sessions.filter((s) => s.completed).length;
  const sessionProgress = Math.round(
    (completedSessionsCount / totalSessions) * 100
  );

  const expectedSessionsToDate = Math.round(
    (planProgress / 100) * totalSessions
  );
  const behindCount = Math.max(0, expectedSessionsToDate - completedSessionsCount);

  let status = "On Track";
  if (behindCount > 0 && behindCount <= 2) {
    status = "Slightly Behind";
  } else if (behindCount > 2) {
    status = `Behind by ${behindCount}`;
  }

  return { planProgress, sessionProgress, status, behindCount };
}

export function calculateReadinessScore(
  sessions: Session[],
  metrics: Metric[],
  activeWeek: number
) {
  if (sessions.length === 0) return 0;

  let totalScore = 0;

  const currentWeekStats = weekStats(sessions, activeWeek);
  const weeklyScore =
    (Math.min(currentWeekStats.completionPct, 100) / 100) * 40;
  totalScore += weeklyScore;

  const completed = sessions.filter((s) => s.completed).length;
  const streakScore = Math.min((completed / 10) * 20, 20);
  totalScore += streakScore;

  let weightScore = 10;
  const weightEntries = metrics
    .filter((m) => m.weightKg !== undefined && m.weightKg !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (weightEntries.length > 1) {
    const delta =
      weightEntries[weightEntries.length - 1].weightKg! -
      weightEntries[0].weightKg!;
    if (delta < 0) {
      weightScore = Math.min(20, 10 + Math.abs(delta) * 2);
    } else if (delta > 0) {
      weightScore = Math.max(0, 10 - delta * 2);
    }
  }
  totalScore += weightScore;

  const today = new Date();
  const pastSessions = sessions.filter(
    (s) => s.scheduledDate && parseISODate(s.scheduledDate) <= today
  );
  if (pastSessions.length > 0) {
    const pastCompleted = pastSessions.filter((s) => s.completed).length;
    const consistencyScore = (pastCompleted / pastSessions.length) * 20;
    totalScore += consistencyScore;
  } else {
    totalScore += 20;
  }

  return Math.round(Math.min(100, Math.max(0, totalScore)));
}
