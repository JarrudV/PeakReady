import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, CalendarCheck2, Gauge, Mountain, Activity } from "lucide-react";

interface NewRiderOnboardingProps {
  open: boolean;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function NewRiderOnboarding({
  open,
  saving = false,
  onOpenChange,
  onComplete,
}: NewRiderOnboardingProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-brand-bg border border-brand-border text-brand-text max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-brand-text flex items-center gap-2">
            <BookOpen size={16} className="text-brand-primary" />
            New Rider Guide
          </DialogTitle>
          <DialogDescription className="text-brand-muted">
            Built for couch-to-first-event riders. Keep it simple: follow the plan, log how you feel, and stay consistent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <GuideCard
            icon={<Gauge size={14} className="text-brand-primary" />}
            title="Dashboard"
            text="Readiness is a simple daily signal. Fatigue drives it most. Use it to decide if today should be normal or easier."
          />
          <GuideCard
            icon={<CalendarCheck2 size={14} className="text-brand-secondary" />}
            title="Plan"
            text="Open each session card for purpose, workout steps, and notes. If life gets busy, use easier or shorter options and keep moving."
          />
          <GuideCard
            icon={<Activity size={14} className="text-brand-success" />}
            title="Metrics"
            text="Log fatigue daily (1 fresh, 10 exhausted). Resting HR helps spot recovery trends if you log it regularly."
          />
          <GuideCard
            icon={<Mountain size={14} className="text-brand-warning" />}
            title="Events and Strava"
            text="Set your first event target and sync rides with Strava. The app compares planned vs actual so you can adjust early."
          />
        </div>

        <div className="glass-panel p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-bold text-brand-muted">
            First Week Checklist
          </p>
          <p className="text-xs text-brand-text">1. Set your event date and distance.</p>
          <p className="text-xs text-brand-text">2. Complete at least 3 sessions, even if short.</p>
          <p className="text-xs text-brand-text">3. Log fatigue after each training day.</p>
          <p className="text-xs text-brand-text">4. Review your readiness before hard sessions.</p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-2 rounded-lg border border-brand-border text-brand-muted text-xs font-bold uppercase tracking-widest"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onComplete}
            disabled={saving}
            className="px-3 py-2 rounded-lg bg-gradient-primary text-brand-bg text-xs font-black uppercase tracking-widest disabled:opacity-60"
            data-testid="button-complete-onboarding"
          >
            {saving ? "Saving..." : "Got it"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GuideCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="glass-panel p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-[10px] uppercase tracking-widest font-bold text-brand-muted">{title}</p>
      </div>
      <p className="text-xs text-brand-text leading-relaxed">{text}</p>
    </div>
  );
}
