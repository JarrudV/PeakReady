import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Clock, Mountain, ArrowRight, CheckCircle2, Share2 } from "lucide-react";
import type { Session, StravaActivity } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { generateWorkoutShareCard } from "@/lib/share-card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { resolveNonRideWorkoutDetails } from "@/lib/workout-details";

interface Props {
  session: Session;
  onClose: () => void;
}

function getBestMatchingActivity(session: Session, activities: StravaActivity[]) {
  if (!session.scheduledDate) return null;

  const sameDay = activities.filter((activity) => activity.startDate.slice(0, 10) === session.scheduledDate);
  if (sameDay.length === 0) return null;

  const targetSeconds = session.minutes * 60;
  return sameDay
    .slice()
    .sort((a, b) => {
      const aSeconds = a.movingTime || a.elapsedTime || 0;
      const bSeconds = b.movingTime || b.elapsedTime || 0;
      return Math.abs(aSeconds - targetSeconds) - Math.abs(bSeconds - targetSeconds);
    })[0];
}

export function WorkoutDetailModal({ session, onClose }: Props) {
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);
  const [notesDraft, setNotesDraft] = useState(session.notes ?? "");
  const [savedNotes, setSavedNotes] = useState(session.notes ?? "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const { data: stravaActivities = [] } = useQuery<StravaActivity[]>({
    queryKey: ["/api/strava/activities"],
    enabled: session.completed,
  });

  const matchedActivity = getBestMatchingActivity(session, stravaActivities);
  const nonRideDetails = useMemo(() => resolveNonRideWorkoutDetails(session), [session]);
  const hasUnsavedNotes = notesDraft.trim() !== savedNotes.trim();

  useEffect(() => {
    const nextNotes = session.notes ?? "";
    setNotesDraft(nextNotes);
    setSavedNotes(nextNotes);
  }, [session.id, session.notes]);

  const handleShare = async () => {
    try {
      setIsSharing(true);
      const blob = await generateWorkoutShareCard({
        session,
        stravaActivity: matchedActivity,
      });

      const fileName = `peakready-${session.id}.png`;
      const pngFile = new File([blob], fileName, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };

      if (nav.share && nav.canShare?.({ files: [pngFile] })) {
        await nav.share({
          title: "PeakReady Workout",
          text: `${session.description} completed`,
          files: [pngFile],
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Workout card downloaded" });
    } catch {
      toast({ title: "Failed to share workout card", variant: "destructive" });
    } finally {
      setIsSharing(false);
    }
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    const normalizedNotes = notesDraft.trim();
    try {
      await apiRequest("PATCH", `/api/sessions/${session.id}`, {
        notes: normalizedNotes.length > 0 ? normalizedNotes : null,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      setSavedNotes(normalizedNotes);
      toast({ title: "Session notes saved" });
    } catch {
      toast({ title: "Failed to save notes", variant: "destructive" });
    } finally {
      setIsSavingNotes(false);
    }
  };

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
          <div className="flex items-center gap-2 flex-shrink-0">
            {session.completed && (
              <button
                onClick={handleShare}
                disabled={isSharing}
                className="px-3 py-2 rounded-full bg-gradient-primary text-brand-bg text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-colors"
                data-testid="button-share-workout"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Share2 size={14} />
                  {isSharing ? "Preparing..." : "Share"}
                </span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-brand-panel-2 text-brand-text hover:bg-brand-panel transition-colors"
              data-testid="button-close-detail"
            >
              <X size={20} />
            </button>
          </div>
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
            Week {session.week} | {session.day}
          </span>
        </div>

        <div
          className="flex-1 overflow-y-auto p-5 workout-markdown"
          data-testid="text-workout-details"
        >
          {nonRideDetails ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-brand-border/70 bg-brand-bg/40 p-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-brand-text mb-2">
                  Purpose
                </h3>
                <p className="text-sm text-brand-muted leading-relaxed">{nonRideDetails.purpose}</p>
              </div>

              <StructuredSection title="Warm-up" items={nonRideDetails.warmUp} />
              <StructuredSection title="Main set" items={nonRideDetails.mainSet} />
              <StructuredSection title="Cool-down" items={nonRideDetails.coolDown} />

              {nonRideDetails.equipment && nonRideDetails.equipment.length > 0 && (
                <StructuredSection title="Equipment" items={nonRideDetails.equipment} />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-brand-border/60 bg-brand-bg/40 p-3">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-1">Time estimate</p>
                  <p className="text-sm font-semibold text-brand-text">{nonRideDetails.timeEstimate}</p>
                </div>
                <div className="rounded-lg border border-brand-border/60 bg-brand-bg/40 p-3">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-1">RPE guidance</p>
                  <p className="text-sm font-semibold text-brand-text">{nonRideDetails.rpeGuidance}</p>
                </div>
              </div>

              {nonRideDetails.fallbackMessage && (
                <p className="text-xs text-brand-secondary">{nonRideDetails.fallbackMessage}</p>
              )}
            </div>
          ) : session.detailsMarkdown ? (
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
                    <span className="text-brand-primary mt-1.5 text-[6px]">*</span>
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

        <div className="border-t border-brand-border p-4 bg-brand-bg/50 space-y-3">
          {session.rpe && (
            <div className="flex items-center text-sm">
              <span className="text-brand-muted w-12">RPE:</span>
              <span className="font-semibold text-brand-text">
                {session.rpe}/10
              </span>
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold block mb-1.5">
              Your session notes
            </label>
            <textarea
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              className="w-full bg-brand-bg text-brand-text border border-brand-border/60 rounded-lg px-3 py-2 text-sm min-h-[72px] resize-none focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              placeholder="Add your own cues, substitutions, or post-workout observations..."
              data-testid="input-workout-detail-notes"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleSaveNotes}
                disabled={isSavingNotes || !hasUnsavedNotes}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-md bg-gradient-primary text-brand-bg disabled:opacity-50"
                data-testid="button-save-workout-detail-notes"
              >
                {isSavingNotes ? "Saving..." : "Save notes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StructuredSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-brand-border/70 bg-brand-bg/40 p-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-brand-text mb-2">{title}</h3>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={`${title}-${idx}`} className="text-sm text-brand-muted flex items-start gap-2">
            <span className="text-brand-primary mt-1.5 text-[6px]">*</span>
            <span className="flex-1">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
