import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { insertMetricSchema, insertServiceItemSchema, insertGoalEventSchema } from "@shared/schema";
import { getWorkoutDetails } from "./workout-library";
import {
  syncStravaActivities,
  isStravaConfigured,
  getStravaAuthUrl,
  exchangeCodeForToken,
  createStravaOAuthState,
  parseStravaOAuthState,
} from "./strava";
import { generateAIPlan, type PlanRequest } from "./ai-plan-generator";
import { isAuthenticated } from "./auth";
import { getPublicVapidKey, isPushConfigured } from "./push";

const sessionUpdateSchema = z.object({
  completed: z.boolean().optional(),
  completedAt: z.string().nullable().optional(),
  completionSource: z.enum(["manual", "strava"]).nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  notes: z.string().nullable().optional(),
  minutes: z.number().positive().optional(),
});

const serviceItemUpdateSchema = z.object({
  status: z.string().optional(),
  date: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const settingValueSchema = z.object({
  value: z.string(),
});

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

const reminderSettingsSchema = z.object({
  timezone: z.string().min(1),
  longRideEveningBeforeEnabled: z.boolean(),
  serviceDueDateEnabled: z.boolean(),
  goalOneWeekCountdownEnabled: z.boolean(),
});

const markNotificationReadSchema = z.object({
  id: z.string().optional(),
  all: z.boolean().optional(),
});

function requireUserId(req: Request, res: Response): string | null {
  const userId = (req as any)?.user?.claims?.sub;
  if (!userId || typeof userId !== "string") {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use("/api", (req, res, next) => {
    const path = req.path || "";
    if (
      path === "/login" ||
      path === "/logout" ||
      path === "/callback" ||
      path === "/strava/callback" ||
      path.startsWith("/auth/") ||
      path === "/vapid-public-key"
    ) {
      return next();
    }
    return isAuthenticated(req, res, next);
  });

  app.get("/api/vapid-public-key", (_req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
  });

  app.get("/api/sessions", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const sessions = await storage.getSessions(userId);
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const parsed = sessionUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const session = await storage.updateSession(userId, req.params.id, parsed.data);
      if (!session) return res.status(404).json({ error: "Session not found" });
      res.json(session);
    } catch (err) {
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  app.get("/api/metrics", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const metrics = await storage.getMetrics(userId);
      res.json(metrics);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  app.post("/api/metrics", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const parsed = insertMetricSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const metric = await storage.createMetric(userId, parsed.data);
      res.json(metric);
    } catch (err) {
      res.status(500).json({ error: "Failed to create metric" });
    }
  });

  app.get("/api/service-items", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const items = await storage.getServiceItems(userId);
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch service items" });
    }
  });

  app.post("/api/service-items", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const parsed = insertServiceItemSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const item = await storage.upsertServiceItem(userId, parsed.data);
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: "Failed to create service item" });
    }
  });

  app.patch("/api/service-items/:id", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const parsed = serviceItemUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const item = await storage.updateServiceItem(userId, req.params.id, parsed.data);
      if (!item) return res.status(404).json({ error: "Item not found" });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: "Failed to update service item" });
    }
  });

  app.get("/api/goal", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const goal = await storage.getGoal(userId);
      res.json(goal);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch goal" });
    }
  });

  app.post("/api/goal", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const parsed = insertGoalEventSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const goal = await storage.upsertGoal(userId, parsed.data);
      res.json(goal);
    } catch (err) {
      res.status(500).json({ error: "Failed to create goal" });
    }
  });

  app.put("/api/goal", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const parsed = insertGoalEventSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const goal = await storage.upsertGoal(userId, parsed.data);
      res.json(goal);
    } catch (err) {
      res.status(500).json({ error: "Failed to update goal" });
    }
  });

  app.post("/api/scrape-event", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;

      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }

      const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }

      const html = await response.text();
      const cheerio = await import("cheerio");
      const $ = cheerio.load(html);

      const title = $('meta[property="og:title"]').attr('content') || $('title').text() || "";
      const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || "";

      // Clean body text for heuristic extraction
      const bodyText = $('body').text().replace(/\s+/g, ' ');

      // Extract Distance (look for numbers followed by km, k, miles, mi)
      let distanceKm: number | null = null;
      const distMatch = bodyText.match(/(\d+(?:\.\d+)?)\s*(?:km|k|kilometer|kilometers)/i);
      if (distMatch) {
        distanceKm = parseFloat(distMatch[1]);
      } else {
        const miMatch = bodyText.match(/(\d+(?:\.\d+)?)\s*(?:mi|mile|miles)/i);
        if (miMatch) distanceKm = parseFloat(miMatch[1]) * 1.60934;
      }

      // Extract Elevation (look for numbers followed by m, meters, ft, feet, vertical)
      let elevationMeters: number | null = null;
      const elevMatchM = bodyText.match(/(\d{3,4}(?:,\d{3})?)\s*(?:m|meter|meters|\vm|\+m)\b/i);
      if (elevMatchM) {
        elevationMeters = parseInt(elevMatchM[1].replace(/,/g, ''), 10);
      } else {
        const elevMatchFt = bodyText.match(/(\d{3,4}(?:,\d{3})?)\s*(?:ft|feet|vertical feet)\b/i);
        if (elevMatchFt) elevationMeters = Math.round(parseInt(elevMatchFt[1].replace(/,/g, ''), 10) * 0.3048);
      }

      // Extract Date (Look for common formats like DD MMM YYYY or YYYY-MM-DD)
      let dateStr: string | null = null;
      const dateRegexes = [
        /\b(202[4-9])-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/, // YYYY-MM-DD
        /\b(0[1-9]|[12]\d|3[01])\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(202[4-9])\b/i // DD MMM YYYY
      ];

      for (const rx of dateRegexes) {
        const match = bodyText.match(rx);
        if (match) {
          if (match[2].length >= 3 && isNaN(parseInt(match[2], 10))) {
            // Month text match (DD MMM YYYY) -> convert to Date Object then to ISO String
            try {
              const d = new Date(`${match[1]} ${match[2]} ${match[3]}`);
              if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
            } catch { }
          } else {
            // Exact match format (YYYY-MM-DD)
            dateStr = match[0];
          }
          break;
        }
      }

      res.json({
        title: title.trim(),
        description: description.trim(),
        distanceKm: distanceKm ? Math.round(distanceKm) : null,
        elevationMeters: elevationMeters || null,
        date: dateStr || null
      });
    } catch (err: any) {
      console.error("Scrape error:", err.message);
      res.status(500).json({ error: "Failed to scrape event website" });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const value = await storage.getSetting(userId, req.params.key);
      res.json({ value });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.put("/api/settings/:key", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const parsed = settingValueSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      await storage.setSetting(userId, req.params.key, parsed.data.value);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save setting" });
    }
  });

  app.get("/api/push/status", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const subscriptions = await storage.listPushSubscriptions(userId);
      res.json({
        configured: isPushConfigured(),
        vapidPublicKey: getPublicVapidKey(),
        subscribed: subscriptions.length > 0,
        subscriptionCount: subscriptions.length,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch push status" });
    }
  });

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const parsed = pushSubscriptionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

      await storage.upsertPushSubscription(userId, parsed.data.endpoint, parsed.data);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save push subscription" });
    }
  });

  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : undefined;
      await storage.removePushSubscription(userId, endpoint);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to unsubscribe push" });
    }
  });

  app.get("/api/reminders/settings", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const settings = await storage.getReminderSettings(userId);
      res.json(
        settings ?? {
          timezone: "UTC",
          longRideEveningBeforeEnabled: false,
          serviceDueDateEnabled: false,
          goalOneWeekCountdownEnabled: false,
        },
      );
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch reminder settings" });
    }
  });

  app.post("/api/reminders/settings", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const parsed = reminderSettingsSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const saved = await storage.upsertReminderSettings(userId, parsed.data);
      res.json(saved);
    } catch (err) {
      res.status(500).json({ error: "Failed to save reminder settings" });
    }
  });

  app.get("/api/notifications", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const notifications = await storage.listInAppNotifications(userId);
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/read", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const parsed = markNotificationReadSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

      if (parsed.data.all) {
        const notifications = await storage.listInAppNotifications(userId);
        await Promise.all(notifications.map((item) => storage.markInAppNotificationRead(userId, item.id)));
      } else if (parsed.data.id) {
        await storage.markInAppNotificationRead(userId, parsed.data.id);
      } else {
        return res.status(400).json({ error: "Notification id or all=true is required" });
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to mark notifications read" });
    }
  });

  app.post("/api/notifications/clear", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      await storage.clearInAppNotifications(userId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to clear notifications" });
    }
  });

  app.post("/api/seed", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      await seedTrainingPlan(userId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to seed data" });
    }
  });

  app.post("/api/plan/load-default", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      await storage.deleteAllSessions(userId);
      const goal = await storage.getGoal(userId);
      const targetDate = goal?.startDate || getDefaultTargetDate();
      const raceDate = new Date(targetDate);
      const planStart = new Date(raceDate);
      planStart.setDate(planStart.getDate() - 12 * 7);
      const plan = generatePlan(planStart);
      await storage.upsertManySessions(userId, plan);
      res.json({ success: true, count: plan.length });
    } catch (err) {
      res.status(500).json({ error: "Failed to load default plan" });
    }
  });

  app.post("/api/plan/upload-csv", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const { csv } = req.body;
      if (!csv || typeof csv !== "string") {
        return res.status(400).json({ error: "CSV data required" });
      }
      const sessions = parseCsvPlan(csv);
      if (sessions.length === 0) {
        return res.status(400).json({ error: "No valid sessions found in CSV" });
      }
      await storage.deleteAllSessions(userId);
      await storage.upsertManySessions(userId, sessions);
      res.json({ success: true, count: sessions.length });
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to parse CSV" });
    }
  });

  app.get("/api/strava/status", async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const lastSync = await storage.getSetting(userId, "stravaLastSync");
    const hasScope = await storage.getSetting(userId, "stravaHasActivityScope");
    const refreshToken = await storage.getSetting(userId, "stravaRefreshToken");

    // The frontend uses `configured` to know if it should show the "Connect" button at all.
    // So `configured` means the server has credentials.
    // The frontend infers if the *user* is connected by looking at the auth flow or lack of activities.
    // (We also pass back `isConnected` explicitly just in case)
    res.json({
      configured: isStravaConfigured(),
      isConnected: !!refreshToken,
      lastSync,
      hasActivityScope: hasScope === "true",
    });
  });

  app.get("/api/strava/auth-url", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;

      const protocol = req.headers["x-forwarded-proto"] || "http";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5000";
      const redirectUri = `${protocol}://${host}/api/strava/callback`;
      const state = createStravaOAuthState(userId);
      const url = getStravaAuthUrl(redirectUri, state);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/strava/callback", async (req, res) => {
    const state = req.query.state as string;
    const code = req.query.code as string;
    const error = req.query.error as string;

    if (error) {
      return res.redirect("/?strava=denied");
    }

    if (!code || !state) {
      return res.status(400).send("Missing authorization code");
    }

    try {
      const userId = parseStravaOAuthState(state);
      const tokenData = await exchangeCodeForToken(code);
      await storage.setSetting(userId, "stravaRefreshToken", tokenData.refresh_token);
      await storage.setSetting(userId, "stravaHasActivityScope", "true");
      res.redirect("/?strava=connected");
    } catch (err: any) {
      console.error("Strava callback error:", err.message);
      res.redirect("/?strava=error");
    }
  });

  app.get("/api/strava/activities", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const activities = await storage.getStravaActivities(userId);
      res.json(activities);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  app.post("/api/strava/sync", async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    if (!isStravaConfigured()) {
      return res.status(400).json({ error: "Strava not configured" });
    }
    const savedRefresh = await storage.getSetting(userId, "stravaRefreshToken");
    if (!savedRefresh) {
      return res.status(400).json({ error: "Strava not connected for this user" });
    }
    try {
      const result = await syncStravaActivities(userId, savedRefresh);
      await storage.setSetting(userId, "stravaLastSync", new Date().toISOString());
      res.json(result);
    } catch (err: any) {
      console.error("Strava sync error:", err.message);
      res.status(500).json({ error: err.message || "Strava sync failed" });
    }
  });

  const aiPlanSchema = z.object({
    eventName: z.string().min(1),
    eventDate: z.string().min(1),
    eventDistance: z.number().positive().optional(),
    eventElevation: z.number().positive().optional(),
    fitnessLevel: z.enum(["beginner", "intermediate", "advanced"]),
    goals: z.array(z.string()).min(1),
    currentWeight: z.number().positive().optional(),
    targetWeight: z.number().positive().optional(),
    daysPerWeek: z.number().int().min(2).max(7).default(4),
    hoursPerWeek: z.number().min(2).max(30).default(8),
    equipment: z.enum(["gym", "home_full", "home_minimal", "no_equipment"]).default("home_minimal"),
    injuries: z.string().optional(),
    additionalNotes: z.string().optional(),
  });

  app.post("/api/plan/generate-ai", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const parsed = aiPlanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Event name, date, fitness level, and at least one goal are required" });
      }
      const planReq: PlanRequest = parsed.data;

      const sessions = await generateAIPlan(planReq);

      await storage.deleteAllSessions(userId);
      await storage.upsertManySessions(userId, sessions);

      res.json({ success: true, count: sessions.length });
    } catch (err: any) {
      console.error("AI plan generation error:", err.message);
      res.status(500).json({ error: err.message || "Failed to generate AI plan" });
    }
  });

  app.get("/api/plan/templates", async (_req, res) => {
    res.json([
      {
        id: "mtb-12week",
        name: "12-Week MTB Race Prep",
        description: "Progressive mountain bike training plan with base, build, peak, and taper phases. Includes strength work, interval sessions, and long rides.",
        weeks: 12,
        sessionsPerWeek: "3-4",
      },
    ]);
  });

  return httpServer;
}

function parseCsvRecords(csv: string): string[][] {
  const normalized = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        current.push(field);
        field = "";
      } else if (char === "\n") {
        current.push(field);
        field = "";
        if (current.some((c) => c.trim())) {
          records.push(current);
        }
        current = [];
      } else {
        field += char;
      }
    }
  }

  current.push(field);
  if (current.some((c) => c.trim())) {
    records.push(current);
  }

  return records;
}

function parseCsvPlan(csv: string) {
  const records = parseCsvRecords(csv);
  if (records.length < 2) throw new Error("CSV must have a header row and at least one data row");

  const header = records[0].map((h) => h.trim().toLowerCase());

  const weekIdx = header.indexOf("week");
  const dayIdx = header.indexOf("day");
  const typeIdx = header.indexOf("type");
  const descIdx = header.findIndex((h) => h === "description" || h === "desc");
  const minsIdx = header.findIndex((h) => h === "minutes" || h === "mins" || h === "duration");
  const zoneIdx = header.indexOf("zone");
  const elevIdx = header.findIndex((h) => h === "elevation" || h === "elev");
  const detailsIdx = header.findIndex((h) => h === "details" || h === "detailsmarkdown" || h === "details_markdown");

  if (weekIdx === -1 || dayIdx === -1 || typeIdx === -1 || descIdx === -1 || minsIdx === -1) {
    throw new Error("CSV must have columns: week, day, type, description, minutes");
  }

  const sessions: any[] = [];

  for (let i = 1; i < records.length; i++) {
    const cols = records[i];
    const week = parseInt(cols[weekIdx]?.trim(), 10);
    const day = cols[dayIdx]?.trim();
    const type = cols[typeIdx]?.trim();
    const description = cols[descIdx]?.trim();
    const minutes = parseInt(cols[minsIdx]?.trim(), 10);

    if (!week || !day || !type || !description || !minutes) continue;

    const zone = zoneIdx >= 0 ? cols[zoneIdx]?.trim() || null : null;
    const elevation = elevIdx >= 0 ? cols[elevIdx]?.trim() || null : null;
    const details = detailsIdx >= 0 ? cols[detailsIdx]?.trim() || null : null;

    const isStrength = type.toLowerCase().includes("strength");

    sessions.push({
      id: `csv-w${week}-${day.toLowerCase()}-${i}`,
      week,
      day,
      type,
      description,
      minutes,
      zone,
      elevation,
      strength: isStrength,
      completed: false,
      rpe: null,
      notes: null,
      scheduledDate: null,
      completedAt: null,
      detailsMarkdown: details || getWorkoutDetails(type, description, week),
    });
  }

  return sessions;
}

async function seedTrainingPlan(userId: string) {
  const existingSessions = await storage.getSessions(userId);
  if (existingSessions.length > 0) return;

  const goal = await storage.getGoal(userId);
  const targetDate = goal?.startDate || getDefaultTargetDate();

  const raceDate = new Date(targetDate);
  const planStart = new Date(raceDate);
  planStart.setDate(planStart.getDate() - 12 * 7);

  const plan = generatePlan(planStart);
  await storage.upsertManySessions(userId, plan);
}

function getDefaultTargetDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 12 * 7);
  return d.toISOString().split("T")[0];
}

function generatePlan(startDate: Date) {
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const sessions: any[] = [];

  for (let week = 1; week <= 12; week++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (week - 1) * 7);

    const isRecovery = week % 4 === 0;
    const isTaper = week >= 11;
    const isBase = week <= 4;
    const isBuild = week >= 5 && week <= 8;

    const weekSessions = [];

    if (isRecovery) {
      weekSessions.push({
        day: "Mon",
        type: "Ride",
        description: "Recovery Spin",
        minutes: 30,
        zone: "Z1",
      });
      weekSessions.push({
        day: "Wed",
        type: "Ride",
        description: "Easy Ride",
        minutes: 45,
        zone: "Z2",
      });
      weekSessions.push({
        day: "Sat",
        type: "Long Ride",
        description: "Easy Long Ride",
        minutes: 60 + week * 3,
        zone: "Z2",
        elevation: "Low",
      });
    } else if (isTaper) {
      weekSessions.push({
        day: "Mon",
        type: "Ride",
        description: "Short Opener",
        minutes: 25,
        zone: "Z2-Z3",
      });
      weekSessions.push({
        day: "Wed",
        type: "Ride",
        description: "Light Intervals",
        minutes: 30,
        zone: "Z3",
      });
      weekSessions.push({
        day: "Fri",
        type: "Ride",
        description: "Shakeout Ride",
        minutes: 20,
        zone: "Z1",
      });
    } else if (isBase) {
      weekSessions.push({
        day: "Mon",
        type: "Strength",
        description: "Core & Stability",
        minutes: 30,
        strength: true,
      });
      weekSessions.push({
        day: "Tue",
        type: "Ride",
        description: "Endurance Ride",
        minutes: 45 + week * 5,
        zone: "Z2",
      });
      weekSessions.push({
        day: "Thu",
        type: "Ride",
        description: "Tempo Ride",
        minutes: 40 + week * 5,
        zone: "Z3",
      });
      weekSessions.push({
        day: "Sat",
        type: "Long Ride",
        description: "Weekend Long Ride",
        minutes: 90 + week * 15,
        zone: "Z2",
        elevation: `${600 + week * 100}m`,
      });
    } else if (isBuild) {
      weekSessions.push({
        day: "Mon",
        type: "Strength",
        description: "Explosive Strength",
        minutes: 35,
        strength: true,
      });
      weekSessions.push({
        day: "Tue",
        type: "Ride",
        description: "Sweet Spot Intervals",
        minutes: 60 + (week - 4) * 5,
        zone: "Z3-Z4",
      });
      weekSessions.push({
        day: "Thu",
        type: "Ride",
        description: "Threshold Climbs",
        minutes: 50 + (week - 4) * 5,
        zone: "Z4",
        elevation: `${800 + (week - 4) * 150}m`,
      });
      weekSessions.push({
        day: "Sat",
        type: "Long Ride",
        description: "Endurance + Climbs",
        minutes: 120 + (week - 4) * 15,
        zone: "Z2-Z3",
        elevation: `${1000 + (week - 4) * 200}m`,
      });
    } else {
      weekSessions.push({
        day: "Mon",
        type: "Strength",
        description: "Power & Plyometrics",
        minutes: 40,
        strength: true,
      });
      weekSessions.push({
        day: "Tue",
        type: "Ride",
        description: "VO2max Intervals",
        minutes: 60,
        zone: "Z4-Z5",
      });
      weekSessions.push({
        day: "Thu",
        type: "Ride",
        description: "Race Simulation",
        minutes: 70,
        zone: "Z3-Z5",
        elevation: "1500m+",
      });
      weekSessions.push({
        day: "Sat",
        type: "Long Ride",
        description: "Race Rehearsal",
        minutes: 180,
        zone: "Z2-Z4",
        elevation: "1800m+",
      });
    }

    for (const s of weekSessions) {
      const dayIdx = dayNames.indexOf(s.day);
      const sessionDate = new Date(weekStart);
      sessionDate.setDate(sessionDate.getDate() + dayIdx);
      const dateStr = sessionDate.toISOString().split("T")[0];

      sessions.push({
        id: `w${week}-${s.day.toLowerCase()}-${s.type.replace(/\s/g, "")}`,
        week,
        day: s.day,
        type: s.type,
        description: s.description,
        minutes: s.minutes,
        zone: s.zone || null,
        elevation: s.elevation || null,
        strength: s.strength || false,
        completed: false,
        rpe: null,
        notes: null,
        scheduledDate: dateStr,
        completedAt: null,
        detailsMarkdown: getWorkoutDetails(s.type, s.description, week),
      });
    }
  }

  return sessions;
}
