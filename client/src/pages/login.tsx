import { MountainSnow, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" data-testid="login-page">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-gradient-primary opacity-[0.07] blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] rounded-full bg-brand-accent opacity-[0.05] blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-sm w-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-[0_0_30px_rgba(65,209,255,0.3)]">
            <MountainSnow size={32} className="text-brand-bg" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-3xl font-bold tracking-tight text-brand-text">
              Peak
            </span>
            <span className="text-3xl font-bold text-gradient-primary">Ready</span>
          </div>
          <p className="text-brand-muted text-sm text-center leading-relaxed">
            Your personal mountain bike training tracker.
            Track workouts, monitor progress, and crush your goals.
          </p>
        </div>

        <div className="glass-panel p-6 w-full flex flex-col gap-5">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-brand-text mb-1">Welcome back</h2>
            <p className="text-brand-muted text-xs">Sign in to access your training dashboard</p>
          </div>

          <Button
            asChild
            size="lg"
            className="w-full bg-gradient-primary text-brand-bg font-semibold"
            data-testid="button-login"
          >
            <a href="/api/login">
              <LogIn size={18} className="mr-2" />
              Sign in with Replit
            </a>
          </Button>

          <p className="text-brand-muted text-[10px] text-center">
            Supports Google, GitHub, Apple, email &amp; more
          </p>
        </div>

        <p className="text-brand-muted/50 text-[10px] uppercase tracking-widest font-bold">
          Train smarter. Ride harder.
        </p>
      </div>
    </div>
  );
}
