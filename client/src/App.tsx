import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Home,
  CalendarDays,
  Activity,
  MessageSquare,
  Wrench,
  MountainSnow,
  User,
  Settings,
  Bike,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";
import { Dashboard } from "@/pages/dashboard";
import { TrainingPlan } from "@/pages/training-plan";
import { Metrics } from "@/pages/metrics";
import { ServiceTracker } from "@/pages/service-tracker";
import { EventTracker } from "@/pages/event-tracker";
import { StravaDashboard } from "@/pages/strava-dashboard";
import { CoachPage } from "@/pages/coach";
import { LoginPage } from "@/pages/login";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Session, Metric, ServiceItem, GoalEvent } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { OfflineIndicator } from "@/components/offline-indicator";
import { NotificationsCenter } from "@/components/notifications-center";
import { SettingsModal } from "@/components/settings-modal";
import { NewRiderOnboarding } from "@/components/new-rider-onboarding";
import { AccountCenterModal } from "@/components/account-center-modal";
import { useToast } from "@/hooks/use-toast";
import {
  applyTheme,
  isThemeAccent,
  isThemeMode,
  persistThemeLocally,
  readStoredTheme,
  type ThemeAccent,
  type ThemeMode,
} from "@/lib/theme";

type Tab = "dashboard" | "plan" | "coach" | "metrics" | "service" | "events" | "strava" | "more";

function MainApp() {
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [activeWeek, setActiveWeek] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingInitialized, setOnboardingInitialized] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStoredTheme().mode);
  const [themeAccent, setThemeAccent] = useState<ThemeAccent>(() => readStoredTheme().accent);
  const { toast } = useToast();

  const { data: savedWeek } = useQuery<{ value: string | null }>({
    queryKey: ["/api/settings", "activeWeek"],
    enabled: isAuthenticated,
  });
  const { data: savedThemeMode } = useQuery<{ value: string | null }>({
    queryKey: ["/api/settings", "themeMode"],
    enabled: isAuthenticated,
  });
  const { data: savedThemeAccent } = useQuery<{ value: string | null }>({
    queryKey: ["/api/settings", "themeAccent"],
    enabled: isAuthenticated,
  });
  const { data: onboardingSeenSetting } = useQuery<{ value: string | null }>({
    queryKey: ["/api/settings", "onboardingSeenV1"],
    enabled: isAuthenticated,
  });
  const { data: subscriptionTierSetting } = useQuery<{ value: string | null }>({
    queryKey: ["/api/settings", "subscriptionTier"],
    enabled: isAuthenticated,
  });
  const { data: subscriptionBillingSetting } = useQuery<{ value: string | null }>({
    queryKey: ["/api/settings", "subscriptionBillingCycle"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (savedWeek?.value) {
      const parsed = parseInt(savedWeek.value, 10);
      if (parsed >= 1) setActiveWeek(parsed);
    }
  }, [savedWeek]);

  useEffect(() => {
    if (isThemeMode(savedThemeMode?.value)) {
      setThemeMode(savedThemeMode.value);
    }
  }, [savedThemeMode?.value]);

  useEffect(() => {
    if (isThemeAccent(savedThemeAccent?.value)) {
      setThemeAccent(savedThemeAccent.value);
    }
  }, [savedThemeAccent?.value]);

  useEffect(() => {
    applyTheme(themeMode, themeAccent);
    persistThemeLocally(themeMode, themeAccent);
  }, [themeMode, themeAccent]);

  useEffect(() => {
    if (!isAuthenticated) {
      setOnboardingOpen(false);
      setOnboardingInitialized(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || onboardingInitialized) return;
    if (onboardingSeenSetting === undefined) return;

    const seen = onboardingSeenSetting?.value === "true";
    if (!seen) setOnboardingOpen(true);
    setOnboardingInitialized(true);
  }, [isAuthenticated, onboardingInitialized, onboardingSeenSetting]);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
    enabled: isAuthenticated,
  });
  const maxWeek = sessions.length > 0 ? Math.max(...sessions.map((session) => session.week), 1) : 12;

  const { data: metrics = [], isLoading: metricsLoading } = useQuery<Metric[]>({
    queryKey: ["/api/metrics"],
    enabled: isAuthenticated,
  });

  const { data: serviceItems = [], isLoading: serviceLoading } = useQuery<ServiceItem[]>({
    queryKey: ["/api/service-items"],
    enabled: isAuthenticated,
  });

  const { data: goal, isLoading: goalLoading } = useQuery<GoalEvent | null>({
    queryKey: ["/api/goal"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (activeWeek > maxWeek) {
      setActiveWeek(maxWeek);
    }
  }, [activeWeek, maxWeek]);

  const handleWeekChange = async (week: number) => {
    const boundedWeek = Math.min(Math.max(week, 1), maxWeek);
    setActiveWeek(boundedWeek);
    try {
      await apiRequest("PUT", "/api/settings/activeWeek", { value: boundedWeek.toString() });
    } catch { }
  };

  const handleThemeModeChange = async (mode: ThemeMode) => {
    setThemeMode(mode);
    try {
      await apiRequest("PUT", "/api/settings/themeMode", { value: mode });
    } catch { }
  };

  const handleThemeAccentChange = async (accent: ThemeAccent) => {
    setThemeAccent(accent);
    try {
      await apiRequest("PUT", "/api/settings/themeAccent", { value: accent });
    } catch { }
  };

  const handleCompleteOnboarding = async () => {
    setOnboardingSaving(true);
    try {
      await apiRequest("PUT", "/api/settings/onboardingSeenV1", {
        value: "true",
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/settings", "onboardingSeenV1"],
      });
      setOnboardingOpen(false);
    } catch {
      toast({
        title: "Failed to save onboarding status",
        variant: "destructive",
      });
    } finally {
      setOnboardingSaving(false);
    }
  };

  const subscriptionTier = subscriptionTierSetting?.value === "pro" ? "pro" : "free";
  const billingCycle = subscriptionBillingSetting?.value === "annual" ? "annual" : "monthly";
  const riderDisplayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Rider";
  const isMoreActive =
    activeTab === "more" ||
    activeTab === "events" ||
    activeTab === "service" ||
    activeTab === "strava";

  const handleSelectPlan = async (tier: "free" | "pro", cycle: "monthly" | "annual") => {
    setPlanSaving(true);
    try {
      await Promise.all([
        apiRequest("PUT", "/api/settings/subscriptionTier", { value: tier }),
        apiRequest("PUT", "/api/settings/subscriptionBillingCycle", { value: cycle }),
      ]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/settings", "subscriptionTier"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/settings", "subscriptionBillingCycle"] }),
      ]);
      toast({
        title: tier === "pro" ? "Pro preference saved" : "Free plan selected",
        description: `Billing preference: ${cycle}.`,
      });
    } catch {
      toast({
        title: "Failed to save subscription preference",
        variant: "destructive",
      });
    } finally {
      setPlanSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-primary animate-pulse" />
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-brand-text">
              Peak
            </span>
            <span className="text-xl font-bold text-gradient-primary">Ready</span>
          </div>
          <div className="text-brand-muted text-xs uppercase tracking-widest font-bold">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const isLoading = sessionsLoading || metricsLoading || serviceLoading || goalLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-primary animate-pulse" />
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-brand-text">
              Peak
            </span>
            <span className="text-xl font-bold text-gradient-primary">Ready</span>
          </div>
          <div className="text-brand-muted text-xs uppercase tracking-widest font-bold">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-brand-text font-sans overflow-x-hidden pb-[calc(env(safe-area-inset-bottom,0px)+7rem)]">
      <header className="glass-panel rounded-none border-x-0 border-t-0 pt-safe-top px-safe pb-4 z-50">
        <div className="mobile-shell flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <button
              onClick={() => setAccountOpen(true)}
              className="flex-1 min-w-0 overflow-hidden flex items-center gap-3 rounded-xl border border-brand-border bg-brand-panel-2 px-2.5 py-2 text-left"
              title="Account"
              data-testid="button-open-account"
            >
              <div className="w-11 h-11 rounded-full overflow-hidden border border-brand-border/70 bg-brand-panel-2 shrink-0 flex items-center justify-center">
                {user?.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt=""
                    className="w-11 h-11 rounded-full object-cover"
                    data-testid="img-user-avatar"
                  />
                ) : (
                  <User size={18} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] tracking-wide text-brand-muted truncate">Signed in as</p>
                <p className="text-sm font-semibold truncate">{riderDisplayName}</p>
              </div>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <NotificationsCenter />
              <button
                onClick={() => setSettingsOpen(true)}
                className="w-11 h-11 rounded-full flex items-center justify-center text-brand-muted hover:text-brand-text transition-colors bg-brand-panel-2 border border-brand-border"
                title="Settings"
                data-testid="button-open-settings"
              >
                <Settings size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl overflow-hidden border border-brand-border/60 bg-brand-panel-2 shrink-0">
              <img
                src="/favicon.png"
                alt="PeakReady logo"
                className="w-full h-full object-cover"
                data-testid="img-app-logo"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold tracking-tight leading-tight truncate" data-testid="text-app-title">
                Peak<span className="text-gradient-primary">Ready</span>
              </h1>
              <p className="text-sm text-brand-muted leading-snug">Get back on the bike. Build confidence. Ride consistently.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <OfflineIndicator />
          </div>
        </div>
      </header>

      <main className="mobile-shell w-full px-safe sm:px-4 pb-4 pt-5 relative">
        {activeTab === "dashboard" && (
          <Dashboard
            sessions={sessions}
            metrics={metrics}
            goal={goal || undefined}
            activeWeek={activeWeek}
            maxWeek={maxWeek}
            onWeekChange={handleWeekChange}
            onOpenOnboarding={() => setOnboardingOpen(true)}
          />
        )}
        {activeTab === "plan" && (
          <TrainingPlan sessions={sessions} activeWeek={activeWeek} goal={goal || undefined} />
        )}
        {activeTab === "coach" && (
          <CoachPage />
        )}
        {activeTab === "metrics" && <Metrics metrics={metrics} sessions={sessions} />}
        {activeTab === "service" && (
          <ServiceTracker serviceItems={serviceItems} />
        )}
        {activeTab === "events" && (
          <EventTracker goal={goal || undefined} />
        )}
        {activeTab === "strava" && (
          <StravaDashboard />
        )}
        {activeTab === "more" && (
          <MoreHub
            onOpenEvents={() => setActiveTab("events")}
            onOpenBike={() => setActiveTab("service")}
            onOpenStrava={() => setActiveTab("strava")}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 w-full glass-panel rounded-none border-x-0 border-b-0 z-30 px-safe pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
        <div className="mobile-shell grid w-full grid-cols-[1fr_1fr_auto_1fr_1fr] items-end gap-x-1.5">
          <NavItem
            icon={<CalendarDays size={24} />}
            label="Plan"
            isActive={activeTab === "plan"}
            onClick={() => setActiveTab("plan")}
            testId="nav-plan"
          />
          <NavItem
            icon={<MessageSquare size={24} />}
            label="Coach"
            isActive={activeTab === "coach"}
            onClick={() => setActiveTab("coach")}
            testId="nav-coach"
          />
          <DashNavItem
            icon={<Home size={26} />}
            label="Dash"
            isActive={activeTab === "dashboard"}
            onClick={() => setActiveTab("dashboard")}
            testId="nav-dashboard"
          />
          <NavItem
            icon={<Activity size={24} />}
            label="Stats"
            isActive={activeTab === "metrics"}
            onClick={() => setActiveTab("metrics")}
            testId="nav-metrics"
          />
          <NavItem
            icon={<MoreHorizontal size={24} />}
            label="More"
            isActive={isMoreActive}
            onClick={() => setActiveTab("more")}
            testId="nav-more"
          />
        </div>
      </nav>

      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        mode={themeMode}
        accent={themeAccent}
        onModeChange={handleThemeModeChange}
        onAccentChange={handleThemeAccentChange}
      />
      <NewRiderOnboarding
        open={onboardingOpen}
        saving={onboardingSaving}
        onOpenChange={setOnboardingOpen}
        onComplete={handleCompleteOnboarding}
      />
      <AccountCenterModal
        open={accountOpen}
        onOpenChange={setAccountOpen}
        name={riderDisplayName}
        email={user?.email || "No email available"}
        profileImageUrl={user?.profileImageUrl}
        subscriptionTier={subscriptionTier}
        billingCycle={billingCycle}
        isSavingPlan={planSaving}
        onSelectPlan={handleSelectPlan}
        onOpenSettings={() => {
          setAccountOpen(false);
          setSettingsOpen(true);
        }}
        onOpenGuide={() => {
          setAccountOpen(false);
          setOnboardingOpen(true);
        }}
        onLogout={() => {
          setAccountOpen(false);
          logout();
        }}
      />
    </div>
  );
}

function NavItem({
  icon,
  label,
  isActive,
  onClick,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative min-h-[52px] w-full min-w-0 rounded-xl px-0.5 py-2 transition-all duration-200 flex flex-col items-center justify-end gap-1",
        isActive
          ? "text-brand-primary bg-brand-panel-2/40"
          : "text-brand-muted hover:text-brand-text"
      )}
      data-testid={testId}
    >
      <span
        className={cn(
          "absolute top-1 h-1.5 w-7 rounded-full transition-all duration-200",
          isActive ? "bg-brand-primary opacity-100" : "opacity-0",
        )}
      />
      <div className={cn("h-6 w-6 flex items-center justify-center", isActive && "drop-shadow-[0_0_8px_rgba(65,209,255,0.45)]")}>
        {icon}
      </div>
      <span className="text-[11px] leading-none font-semibold text-center">
        {label}
      </span>
    </button>
  );
}

function DashNavItem({
  icon,
  label,
  isActive,
  onClick,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <div className="flex flex-col items-center justify-end min-w-[64px]">
      <button
        onClick={onClick}
        className={cn(
          "h-[66px] w-[66px] -mt-8 rounded-full border-4 ring-2 ring-black/20 border-brand-bg bg-[#22c55e] text-white shadow-[0_10px_24px_rgba(0,0,0,0.45)] flex items-center justify-center transition-transform duration-200",
          isActive ? "scale-105" : "hover:scale-[1.03]"
        )}
        data-testid={testId}
      >
        {icon}
      </button>
      <span className={cn("mt-1 text-[11px] leading-none font-semibold", isActive ? "text-brand-primary" : "text-brand-muted")}>
        {label}
      </span>
    </div>
  );
}

function MoreHub({
  onOpenEvents,
  onOpenBike,
  onOpenStrava,
  onOpenSettings,
}: {
  onOpenEvents: () => void;
  onOpenBike: () => void;
  onOpenStrava: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="p-4 space-y-4" data-testid="more-view">
      <h2 className="text-2xl font-bold text-brand-text">More</h2>
      <p className="text-sm text-brand-muted leading-relaxed">
        Extra tools and integrations, kept simple for everyday riders.
      </p>
      <div className="glass-panel p-2 space-y-2">
        <MoreAction
          icon={<MountainSnow size={18} className="text-brand-primary" />}
          title="Events"
          description="Goal event, countdown, and event intel."
          onClick={onOpenEvents}
          testId="button-more-events"
        />
        <MoreAction
          icon={<Wrench size={18} className="text-brand-primary" />}
          title="Bike"
          description="Maintenance tracking and distance-based checks."
          onClick={onOpenBike}
          testId="button-more-bike"
        />
        <MoreAction
          icon={<Bike size={18} className="text-[#FC4C02]" />}
          title="Strava"
          description="Connect, sync activities, and compare plan vs actual."
          onClick={onOpenStrava}
          testId="button-more-strava"
        />
        <MoreAction
          icon={<Settings size={18} className="text-brand-primary" />}
          title="Settings"
          description="Theme and notifications."
          onClick={onOpenSettings}
          testId="button-more-settings"
        />
      </div>
    </div>
  );
}

function MoreAction({
  icon,
  title,
  description,
  onClick,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[52px] rounded-xl border border-brand-border/60 bg-brand-panel-2/60 px-3 py-3 flex items-center gap-3 text-left"
      data-testid={testId}
    >
      <span className="w-8 h-8 rounded-lg bg-brand-bg/60 border border-brand-border/50 flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-brand-text truncate">{title}</span>
        <span className="block text-xs text-brand-muted leading-snug">{description}</span>
      </span>
      <ChevronRight size={16} className="text-brand-muted shrink-0" />
    </button>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <MainApp />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
