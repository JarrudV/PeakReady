import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Metric, Session, StravaActivity } from "@shared/schema";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Plus, X, Weight, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Props {
  metrics: Metric[];
  sessions: Session[];
}

export function Metrics({ metrics, sessions }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();
  const { data: stravaActivities = [] } = useQuery<StravaActivity[]>({
    queryKey: ["/api/strava/activities"],
  });

  const sortedMetrics = [...metrics].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const chartData = [...sortedMetrics]
    .reverse()
    .filter((m) => m.weightKg != null)
    .map((m) => ({
      ...m,
      dateFormatted: format(parseISO(m.date), "MMM d"),
    }));

  const plannedVsActualData = buildPlannedVsActualSeries(sessions, stravaActivities);

  const handleAddEntry = async (entry: {
    date: string;
    weightKg?: number;
    restingHr?: number;
    fatigue?: number;
    notes?: string;
  }) => {
    try {
      await apiRequest("POST", "/api/metrics", entry);
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      setIsAdding(false);
      toast({ title: "Metrics saved" });
    } catch {
      toast({ title: "Failed to save metrics", variant: "destructive" });
    }
  };

  return (
    <div className="p-4 space-y-6" data-testid="metrics-view">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-brand-text" data-testid="text-metrics-title">Metrics</h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={cn(
            "p-2 rounded-full transition-all shadow-lg",
            isAdding
              ? "bg-brand-panel-2 text-brand-text"
              : "bg-gradient-secondary text-brand-bg shadow-[0_0_15px_rgba(255,168,0,0.4)]"
          )}
          data-testid="button-toggle-add-metric"
        >
          {isAdding ? <X size={20} /> : <Plus size={20} />}
        </button>
      </div>

      {isAdding && (
        <AddMetricForm
          onAdd={handleAddEntry}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {!isAdding && chartData.length > 0 && (
        <div className="glass-panel p-4 border-brand-border/50 shadow-[0_0_20px_rgba(65,209,255,0.05)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-primary opacity-10 blur-3xl -mr-10 -mt-10 rounded-full pointer-events-none" />
          <h3 className="text-brand-muted text-[10px] uppercase font-bold tracking-widest mb-4">
            Weight Trend (kg)
          </h3>
          <div className="h-48 w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="dateFormatted"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  domain={["dataMin - 2", "dataMax + 2"]}
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15,12,41,0.95)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  itemStyle={{ color: "#41D1FF" }}
                />
                <Line
                  type="monotone"
                  dataKey="weightKg"
                  stroke="#41D1FF"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#41D1FF", strokeWidth: 0 }}
                  activeDot={{
                    r: 6,
                    fill: "#fff",
                    stroke: "#41D1FF",
                    strokeWidth: 2,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!isAdding && (
        <div className="glass-panel p-4 border-brand-border/50 shadow-[0_0_20px_rgba(255,168,0,0.05)] relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-secondary opacity-10 blur-3xl -ml-10 -mb-10 rounded-full pointer-events-none" />
          <h3 className="text-brand-muted text-[10px] uppercase font-bold tracking-widest mb-4">
            Planned vs Actual (Last 14 Days)
          </h3>
          <div className="h-56 w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={plannedVsActualData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="dateFormatted"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                  width={35}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15,12,41,0.95)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  formatter={(value: number, name: string) => [
                    `${Number(value || 0).toFixed(0)} min`,
                    name,
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="plannedMinutes"
                  name="Planned"
                  stroke="#41D1FF"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="actualMinutes"
                  name="Actual (Strava)"
                  stroke="#FFA800"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-brand-muted mt-3">
            Missing Strava data is shown as 0 minutes.
          </p>
        </div>
      )}

      {!isAdding && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-brand-text">History</h3>
          {sortedMetrics.length === 0 ? (
            <p className="text-brand-muted text-center py-6 glass-panel border-brand-border/50" data-testid="text-no-metrics">
              No metrics recorded yet.
            </p>
          ) : (
            sortedMetrics.map((m) => (
              <div
                key={m.id}
                className="glass-panel p-4 border-brand-border/40"
                data-testid={`card-metric-${m.id}`}
              >
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-brand-border/50">
                  <span className="font-bold text-sm text-brand-text">
                    {format(parseISO(m.date), "MMM d, yyyy")}
                  </span>
                  {m.fatigue && (
                    <span
                      className={cn(
                        "text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-md border",
                        m.fatigue >= 8
                          ? "bg-brand-danger/10 text-brand-danger border-brand-danger/30 shadow-[0_0_8px_rgba(255,92,122,0.2)]"
                          : m.fatigue >= 5
                            ? "bg-brand-warning/10 text-brand-warning border-brand-warning/30 shadow-[0_0_8px_rgba(255,168,0,0.2)]"
                            : "bg-brand-success/10 text-brand-success border-brand-success/30"
                      )}
                    >
                      Fatigue: {m.fatigue}/10
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                  {m.weightKg && (
                    <div className="flex items-center text-brand-text">
                      <Weight size={16} className="text-brand-muted mr-2" />
                      <span className="font-semibold">{m.weightKg} kg</span>
                    </div>
                  )}
                  {m.restingHr && (
                    <div className="flex items-center text-brand-text">
                      <HeartPulse
                        size={16}
                        className="text-brand-danger/80 mr-2"
                      />
                      <span className="font-semibold">{m.restingHr} bpm</span>
                    </div>
                  )}
                </div>
                {m.notes && (
                  <p className="mt-3 text-sm text-brand-muted italic bg-brand-bg p-2 rounded-lg">
                    &ldquo;{m.notes}&rdquo;
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function buildPlannedVsActualSeries(sessions: Session[], activities: StravaActivity[]) {
  const days: Array<{ key: string; dateFormatted: string; plannedMinutes: number; actualMinutes: number }> = [];
  const now = new Date();

  for (let i = 13; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    days.push({
      key,
      dateFormatted: format(day, "MMM d"),
      plannedMinutes: 0,
      actualMinutes: 0,
    });
  }

  const indexByDate = new Map(days.map((d, idx) => [d.key, idx]));

  for (const session of sessions) {
    if (!session.scheduledDate) continue;
    const idx = indexByDate.get(session.scheduledDate);
    if (idx === undefined) continue;
    if (session.type !== "Ride" && session.type !== "Long Ride") continue;
    days[idx].plannedMinutes += session.minutes || 0;
  }

  for (const activity of activities) {
    const key = activity.startDate.slice(0, 10);
    const idx = indexByDate.get(key);
    if (idx === undefined) continue;
    const seconds = activity.movingTime || activity.elapsedTime || 0;
    days[idx].actualMinutes += Math.round(seconds / 60);
  }

  return days;
}

function AddMetricForm({
  onAdd,
  onCancel,
}: {
  onAdd: (entry: {
    date: string;
    weightKg?: number;
    restingHr?: number;
    fatigue?: number;
    notes?: string;
  }) => void;
  onCancel: () => void;
}) {
  const td = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(td);
  const [weightKg, setWeightKg] = useState<string>("");
  const [restingHr, setRestingHr] = useState<string>("");
  const [fatigue, setFatigue] = useState<string>("5");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      date,
      weightKg: weightKg ? parseFloat(weightKg) : undefined,
      restingHr: restingHr ? parseInt(restingHr, 10) : undefined,
      fatigue: fatigue ? parseInt(fatigue, 10) : undefined,
      notes: notes || undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-panel p-5 border-brand-primary/30 shadow-[0_0_20px_rgba(65,209,255,0.1)] relative overflow-hidden"
      data-testid="form-add-metric"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-primary opacity-20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
      <h3 className="text-lg font-bold mb-4 text-brand-text">Log Daily Metrics</h3>
      <div className="space-y-4 relative z-10">
        <div>
          <label className="text-xs text-brand-muted font-medium block mb-1">
            Date
          </label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-brand-bg text-brand-text border border-brand-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-brand-primary outline-none"
            data-testid="input-metric-date"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-brand-muted font-medium block mb-1">
              Weight (kg)
            </label>
            <input
              type="number"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full bg-brand-bg text-brand-text border border-brand-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-brand-primary outline-none"
              placeholder="e.g. 75.5"
              data-testid="input-metric-weight"
            />
          </div>
          <div>
            <label className="text-xs text-brand-muted font-medium block mb-1">
              Resting HR
            </label>
            <input
              type="number"
              value={restingHr}
              onChange={(e) => setRestingHr(e.target.value)}
              className="w-full bg-brand-bg text-brand-text border border-brand-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-brand-primary outline-none"
              placeholder="bpm"
              data-testid="input-metric-hr"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-brand-muted font-medium block mb-1">
            <span className="flex justify-between">
              <span>Fatigue Score</span>
              <span
                className={cn(
                  "font-bold",
                  parseInt(fatigue) >= 8
                    ? "text-brand-danger"
                    : parseInt(fatigue) >= 5
                      ? "text-brand-warning"
                      : "text-brand-success"
                )}
              >
                {fatigue}/10
              </span>
            </span>
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={fatigue}
            onChange={(e) => setFatigue(e.target.value)}
            className="w-full accent-[#41D1FF]"
            data-testid="input-metric-fatigue"
          />
          <div className="flex justify-between text-xs text-brand-muted mt-1">
            <span>1 (Fresh)</span>
            <span>10 (Exhausted)</span>
          </div>
        </div>
        <div>
          <label className="text-xs text-brand-muted font-medium block mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-brand-bg text-brand-text border border-brand-border rounded-lg px-3 py-2 text-sm min-h-[80px] resize-none focus:ring-1 focus:ring-brand-primary outline-none"
            placeholder="Sleep quality, mood, diet, etc..."
            data-testid="input-metric-notes"
          />
        </div>
        <div className="flex gap-3 pt-3 text-[10px] tracking-widest uppercase font-bold">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-brand-bg border border-brand-border/60 text-brand-text rounded-lg transition-colors"
            data-testid="button-cancel-metric"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-3 bg-gradient-secondary border border-brand-warning/50 text-brand-bg rounded-lg transition-all shadow-[0_0_15px_rgba(255,168,0,0.4)]"
            data-testid="button-save-metric"
          >
            Save Metrics
          </button>
        </div>
      </div>
    </form>
  );
}
