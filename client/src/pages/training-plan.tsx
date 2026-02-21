import { useState } from "react";
import type { Session } from "@shared/schema";
import {
  CheckCircle2,
  Circle,
  Clock,
  Mountain,
  ArrowRight,
  Save,
  Edit3,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Props {
  sessions: Session[];
  activeWeek: number;
}

export function TrainingPlan({ sessions, activeWeek }: Props) {
  const weeklySessions = sessions.filter((s) => s.week === activeWeek);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleToggleComplete = async (session: Session) => {
    try {
      await apiRequest("PATCH", `/api/sessions/${session.id}`, {
        completed: !session.completed,
        completedAt: !session.completed ? new Date().toISOString() : null,
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

  return (
    <div className="p-4 space-y-4" data-testid="training-plan-view">
      <h2 className="text-2xl font-bold mb-2 text-brand-text" data-testid="text-plan-title">
        Week {activeWeek} Plan
      </h2>

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
          />
        ))}

        {weeklySessions.length === 0 && (
          <div className="text-center py-10 text-brand-muted glass-panel border-brand-border/50" data-testid="text-no-sessions">
            No sessions planned for this week.
          </div>
        )}
      </div>
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
}: {
  session: Session;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updates: Partial<Session>) => void;
  onCancel: () => void;
  onToggleComplete: () => void;
}) {
  const [editMinutes, setEditMinutes] = useState(session.minutes);
  const [editRpe, setEditRpe] = useState(session.rpe?.toString() || "");
  const [editNotes, setEditNotes] = useState(session.notes || "");

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
          <div>
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
                "text-lg font-bold leading-tight",
                session.completed && "text-brand-muted"
              )}
            >
              {session.description}
            </h3>
          </div>
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
