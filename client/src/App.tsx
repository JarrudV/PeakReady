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
import {
  applyTheme,
  isThemeAccent,
  isThemeMode,
  persistThemeLocally,
  readStoredTheme,
  type ThemeAccent,
  type ThemeMode,
} from "@/lib/theme";

type Tab = "dashboard" | "plan" | "coach" | "metrics" | "service" | "events" | "strava";

function MainApp() {
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [activeWeek, setActiveWeek] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStoredTheme().mode);
  const [themeAccent, setThemeAccent] = useState<ThemeAccent>(() => readStoredTheme().accent);

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
    <div className="min-h-screen text-brand-text font-sans pb-24">
      <header className="glass-panel rounded-none border-x-0 border-t-0 p-4 z-50 flex items-center justify-between">
        <OfflineIndicator />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <MountainSnow size={18} className="text-brand-bg" />
          </div>
          <h1 className="text-xl font-bold tracking-tight" data-testid="text-app-title">
            Peak<span className="text-gradient-primary">Ready</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsCenter />
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-brand-muted hover:text-brand-text transition-colors bg-brand-panel-2 border border-brand-border"
            title="Settings"
            data-testid="button-open-settings"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={() => logout()}
            className="w-9 h-9 rounded-full flex items-center justify-center text-brand-muted hover:text-brand-text transition-colors overflow-hidden"
            title="Sign out"
            data-testid="button-logout"
          >
            {user?.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt=""
                className="w-9 h-9 rounded-full object-cover"
                data-testid="img-user-avatar"
              />
            ) : (
              <User size={18} />
            )}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto w-full pb-4 pt-4 relative">
        {activeTab === "dashboard" && (
          <Dashboard
            sessions={sessions}
            metrics={metrics}
            goal={goal || undefined}
            activeWeek={activeWeek}
            maxWeek={maxWeek}
            onWeekChange={handleWeekChange}
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
      </main>

      <nav className="fixed bottom-0 w-full glass-panel rounded-none border-x-0 border-b-0 px-2 py-3 flex justify-between items-center z-30 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
        <NavItem
          icon={<Home size={22} />}
          label="Dash"
          isActive={activeTab === "dashboard"}
          onClick={() => setActiveTab("dashboard")}
          testId="nav-dashboard"
        />
        <NavItem
          icon={<CalendarDays size={22} />}
          label="Plan"
          isActive={activeTab === "plan"}
          onClick={() => setActiveTab("plan")}
          testId="nav-plan"
        />
        <NavItem
          icon={<MountainSnow size={24} />}
          label="Events"
          isActive={activeTab === "events"}
          isHighlight={true}
          onClick={() => setActiveTab("events")}
          testId="nav-events"
        />
        <NavItem
          icon={<MessageSquare size={22} />}
          label="Coach"
          isActive={activeTab === "coach"}
          onClick={() => setActiveTab("coach")}
          testId="nav-coach"
        />
        <NavItem
          icon={<Activity size={22} />}
          label="Metrics"
          isActive={activeTab === "metrics"}
          onClick={() => setActiveTab("metrics")}
          testId="nav-metrics"
        />
        <NavItem
          icon={<Wrench size={22} />}
          label="Bike"
          isActive={activeTab === "service"}
          onClick={() => setActiveTab("service")}
          testId="nav-service"
        />
        <NavItem
          icon={<Bike size={22} className="text-[#FC4C02]" />}
          label="Strava"
          isActive={activeTab === "strava"}
          onClick={() => setActiveTab("strava")}
          testId="nav-strava"
        />
      </nav>

      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        mode={themeMode}
        accent={themeAccent}
        onModeChange={handleThemeModeChange}
        onAccentChange={handleThemeAccentChange}
      />
    </div>
  );
}

function NavItem({
  icon,
  label,
  isActive,
  isHighlight,
  onClick,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isHighlight?: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 min-w-0 flex flex-col items-center justify-center transition-all duration-300 relative",
        isActive && !isHighlight
          ? "text-brand-primary font-medium drop-shadow-[0_0_8px_rgba(65,209,255,0.8)]"
          : "text-brand-muted",
        isHighlight && "text-brand-text"
      )}
      data-testid={testId}
    >
      {isHighlight && (
        <div className="absolute inset-0 bg-gradient-primary blur-lg opacity-20 -z-10 rounded-full scale-150" />
      )}
      <div
        className={cn(
          "mb-1 flex items-center justify-center",
          isActive && !isHighlight && "scale-110",
          isHighlight &&
          "p-3 rounded-full bg-gradient-primary shadow-[0_0_15px_rgba(189,52,254,0.5)] -mt-6 ring-4 ring-brand-bg",
          isActive &&
          isHighlight &&
          "scale-110 shadow-[0_0_25px_rgba(65,209,255,0.8)] ring-brand-panel"
        )}
      >
        {icon}
      </div>
      <span
        className={cn(
          "text-[10px] uppercase tracking-wider",
          isHighlight && "mt-1"
        )}
      >
        {label}
      </span>
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
