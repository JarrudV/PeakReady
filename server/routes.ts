import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import {
  insertMetricSchema,
  insertServiceItemSchema,
  insertGoalEventSchema,
  type Metric,
  type Session,
  type StravaActivity,
} from "@shared/schema";
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
import { getGeminiClient, getGeminiModel } from "./gemini-client";
import { isAuthenticated } from "./auth";
import { getPublicVapidKey, isPushConfigured } from "./push";
import {
  buildTrainingPlanFromPreset,
  DEFAULT_TRAINING_PLAN_PRESET_ID,
  getTrainingPlanTemplateById,
  getTrainingPlanTemplates,
} from "./plan-presets";

const sessionUpdateSchema = z.object({
  completed: z.boolean().optional(),
  completedAt: z.string().nullable().optional(),
  completionSource: z.enum(["manual", "strava"]).nullable().optional(),
  type: z.enum(["Ride", "Long Ride", "Strength", "Rest"]).optional(),
  description: z.string().min(1).optional(),
  zone: z.string().nullable().optional(),
  strength: z.boolean().optional(),
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

const loadDefaultPlanSchema = z.object({
  presetId: z.string().trim().min(1).optional(),
});

const coachHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const coachChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(coachHistoryItemSchema).max(20).optional().default([]),
});

function requireUserId(req: Request, res: Response): string | null {
  const userId = (req as any)?.user?.claims?.sub;
  if (!userId || typeof userId !== "string") {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

function sanitizeStravaErrorMessage(input: unknown): string {
  const raw = typeof input === "string" ? input : input instanceof Error ? input.message : "Unknown Strava error";

  // Remove sensitive token-like values from messages before storing/returning.
  let sanitized = raw
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/(access_token|refresh_token|client_secret|authorization_code|code)=([^&\s]+)/gi, "$1=[redacted]");

  if (sanitized.length > 400) {
    sanitized = `${sanitized.slice(0, 400)}...`;
  }

  return sanitized;
}

async function setStravaLastError(userId: string, message: string | null): Promise<void> {
  await storage.setSetting(userId, "stravaLastError", message ?? "");
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
      const metric = await storage.upsertMetric(userId, parsed.data);
      res.json(metric);
    } catch (err: any) {
      if (err?.message?.includes("Metric date")) {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: "Failed to upsert metric" });
    }
  });

  app.delete("/api/metrics/:id", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const deleted = await storage.deleteMetric(userId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Metric not found" });
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete metric" });
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
      const parsedBody = loadDefaultPlanSchema.safeParse(req.body ?? {});
      if (!parsedBody.success) return res.status(400).json({ error: parsedBody.error.message });

      const presetId = parsedBody.data.presetId ?? DEFAULT_TRAINING_PLAN_PRESET_ID;
      const selectedTemplate = getTrainingPlanTemplateById(presetId);
      if (!selectedTemplate) {
        return res.status(400).json({ error: `Unknown training plan preset: ${presetId}` });
      }

      await storage.deleteAllSessions(userId);
      const goal = await storage.getGoal(userId);
      const targetDate = goal?.startDate || getDefaultTargetDate(selectedTemplate.weeks);
      const raceDate = new Date(targetDate);
      const planStart = new Date(raceDate);
      planStart.setDate(planStart.getDate() - selectedTemplate.weeks * 7);

      const plan = buildTrainingPlanFromPreset(selectedTemplate.id, planStart);
      if (!plan) {
        return res.status(500).json({ error: "Failed to build selected training plan" });
      }

      await storage.upsertManySessions(userId, plan);
      res.json({ success: true, count: plan.length, presetId: selectedTemplate.id });
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
    const lastSyncAt = await storage.getSetting(userId, "stravaLastSync");
    const hasScope = await storage.getSetting(userId, "stravaHasActivityScope");
    const refreshToken = await storage.getSetting(userId, "stravaRefreshToken");
    const lastErrorRaw = await storage.getSetting(userId, "stravaLastError");
    const connected = !!refreshToken;
    const lastError = lastErrorRaw?.trim() ? lastErrorRaw : null;

    res.json({
      configured: isStravaConfigured(),
      connected,
      lastSyncAt: lastSyncAt || null,
      lastError,
      // Backwards-compatible fields currently used by frontend components.
      isConnected: connected,
      lastSync: lastSyncAt || null,
      hasActivityScope: hasScope === "true",
    });
  });

  app.get("/api/strava/auth-url", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;

      const forwardedProtoRaw = req.headers["x-forwarded-proto"];
      const forwardedHostRaw = req.headers["x-forwarded-host"];
      const forwardedProto = Array.isArray(forwardedProtoRaw)
        ? forwardedProtoRaw[0]
        : forwardedProtoRaw?.split(",")[0]?.trim();
      const forwardedHost = Array.isArray(forwardedHostRaw)
        ? forwardedHostRaw[0]
        : forwardedHostRaw?.split(",")[0]?.trim();

      let protocol = forwardedProto || (req.secure ? "https" : "http");
      const host = forwardedHost || req.get("host") || "localhost:5000";

      // In production behind a proxy/custom domain, non-local hosts should be HTTPS.
      const isLocalHost = /^localhost(?::\d+)?$/i.test(host) || /^127\.0\.0\.1(?::\d+)?$/i.test(host);
      if (process.env.NODE_ENV === "production" && !isLocalHost) {
        protocol = "https";
      }

      const redirectUri = `${protocol}://${host}/api/strava/callback`;
      console.log(`[strava] auth-url protocol=${protocol} host=${host} redirectUri=${redirectUri}`);
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
      const message = "Missing STRAVA_CLIENT_ID and/or STRAVA_CLIENT_SECRET on server.";
      await setStravaLastError(userId, message);
      return res.status(500).json({ error: message });
    }
    const savedRefresh = await storage.getSetting(userId, "stravaRefreshToken");
    if (!savedRefresh) {
      const message = "No Strava refresh token for this user. Reconnect your Strava account.";
      await setStravaLastError(userId, message);
      return res.status(400).json({ error: message });
    }
    try {
      const result = await syncStravaActivities(userId, savedRefresh);
      await storage.setSetting(userId, "stravaLastSync", new Date().toISOString());
      await setStravaLastError(userId, null);
      res.json(result);
    } catch (err: any) {
      const rawMessage = err?.message || "Strava sync failed";
      const sanitizedRaw = sanitizeStravaErrorMessage(rawMessage);

      let clientMessage = sanitizedRaw;
      let status = 500;
      if (sanitizedRaw.includes("Strava API error:")) {
        status = 502;
        clientMessage = `Strava API error while fetching activities. ${sanitizedRaw}`;
      } else if (sanitizedRaw.includes("Strava token refresh failed:")) {
        status = 502;
        clientMessage = "Strava token refresh failed. Reconnect your Strava account and try again.";
      } else if (sanitizedRaw.includes("Strava credentials not configured")) {
        status = 500;
        clientMessage = "Missing STRAVA_CLIENT_ID and/or STRAVA_CLIENT_SECRET on server.";
      }

      await setStravaLastError(userId, clientMessage);
      console.error("Strava sync error:", sanitizedRaw);
      res.status(status).json({ error: clientMessage });
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

  app.post("/api/coach/chat", async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;

      const parsed = coachChatSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "message is required" });
      }

      const [sessions, metrics, activities, savedActiveWeek, refreshToken] = await Promise.all([
        storage.getSessions(userId),
        storage.getMetrics(userId),
        storage.getStravaActivities(userId),
        storage.getSetting(userId, "activeWeek"),
        storage.getSetting(userId, "stravaRefreshToken"),
      ]);

      const activeWeek = resolveCurrentWeek(savedActiveWeek, sessions);
      const context = buildCoachContext({
        sessions,
        metrics,
        activities,
        activeWeek,
        stravaConnected: Boolean(refreshToken),
      });

      const prompt = buildCoachPrompt({
        message: parsed.data.message,
        history: parsed.data.history,
        context,
      });

      const ai = getGeminiClient();
      const model = getGeminiModel("gemini-2.5-flash");
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.55,
          maxOutputTokens: 1200,
        },
      });

      const reply = response.text?.trim();
      if (!reply) {
        return res.status(502).json({ error: "Coach response was empty. Please retry." });
      }

      res.json({
        reply,
        context: {
          activeWeek,
          planSessionCount: sessions.filter((session) => session.week === activeWeek).length,
          hasStravaConnection: Boolean(refreshToken),
          stravaRecentRideCount: countRecentStravaRides(activities, 14),
          metricsRecentCount: countRecentMetrics(metrics, 7),
        },
      });
    } catch (err: any) {
      console.error("Coach chat error:", err?.message || err);
      res.status(500).json({ error: err?.message || "Failed to generate coach response" });
    }
  });

  app.get("/api/plan/templates", async (_req, res) => {
    res.json(getTrainingPlanTemplates());
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

  const defaultTemplate = getTrainingPlanTemplateById(DEFAULT_TRAINING_PLAN_PRESET_ID);
  if (!defaultTemplate) throw new Error("Default training plan preset not found");

  const goal = await storage.getGoal(userId);
  const targetDate = goal?.startDate || getDefaultTargetDate(defaultTemplate.weeks);

  const raceDate = new Date(targetDate);
  const planStart = new Date(raceDate);
  planStart.setDate(planStart.getDate() - defaultTemplate.weeks * 7);

  const plan = buildTrainingPlanFromPreset(defaultTemplate.id, planStart);
  if (!plan) throw new Error("Failed to build default training plan preset");

  await storage.upsertManySessions(userId, plan);
}

function getDefaultTargetDate(weeksAhead = 12): string {
  const d = new Date();
  d.setDate(d.getDate() + weeksAhead * 7);
  return d.toISOString().split("T")[0];
}

type CoachHistoryItem = z.infer<typeof coachHistoryItemSchema>;

const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function safeDate(input: string): Date | null {
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(input: string): string {
  const parsed = safeDate(input);
  if (!parsed) return input;
  return parsed.toISOString().slice(0, 10);
}

function getDaysAgoDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function resolveCurrentWeek(savedActiveWeek: string | null, sessions: Session[]): number {
  if (sessions.length === 0) return 1;
  const weeks = Array.from(new Set(sessions.map((session) => session.week))).sort((a, b) => a - b);

  const parsedActiveWeek = savedActiveWeek ? Number.parseInt(savedActiveWeek, 10) : NaN;
  if (Number.isFinite(parsedActiveWeek) && weeks.includes(parsedActiveWeek)) {
    return parsedActiveWeek;
  }

  for (const week of weeks) {
    const weekSessions = sessions.filter((session) => session.week === week);
    if (weekSessions.some((session) => !session.completed)) {
      return week;
    }
  }

  return weeks[0];
}

function getWeekSessionSummary(sessions: Session[], activeWeek: number): string {
  const weekSessions = sessions
    .filter((session) => session.week === activeWeek)
    .sort((a, b) => {
      if (a.scheduledDate && b.scheduledDate) return a.scheduledDate.localeCompare(b.scheduledDate);
      const dayIndexA = WEEKDAY_ORDER.indexOf((a.day || "").slice(0, 3).toLowerCase());
      const dayIndexB = WEEKDAY_ORDER.indexOf((b.day || "").slice(0, 3).toLowerCase());
      return dayIndexA - dayIndexB;
    });

  if (weekSessions.length === 0) {
    return "No sessions found for the selected week.";
  }

  const completed = weekSessions.filter((session) => session.completed).length;
  const totalMinutes = weekSessions.reduce((sum, session) => sum + (session.minutes || 0), 0);
  const detailLines = weekSessions
    .map((session) => {
      const datePart = session.scheduledDate ? `${session.scheduledDate} ` : "";
      const status = session.completed ? "done" : "planned";
      const zone = session.zone ? ` ${session.zone}` : "";
      return `- ${datePart}${session.day}: ${session.description} (${session.type}, ${session.minutes} min${zone}) [${status}]`;
    })
    .join("\n");

  return `Week ${activeWeek}: ${completed}/${weekSessions.length} sessions completed, ${totalMinutes} total planned minutes.\n${detailLines}`;
}

function countRecentStravaRides(activities: StravaActivity[], days: number): number {
  const threshold = getDaysAgoDate(days).getTime();
  return activities.filter((activity) => {
    const startedAt = safeDate(activity.startDate);
    return startedAt ? startedAt.getTime() >= threshold : false;
  }).length;
}

function getStravaSummary(activities: StravaActivity[], connected: boolean): string {
  if (!connected) {
    return "Not connected to Strava (no refresh token).";
  }

  const threshold = getDaysAgoDate(14).getTime();
  const recentRides = activities
    .filter((activity) => {
      const startedAt = safeDate(activity.startDate);
      return startedAt ? startedAt.getTime() >= threshold : false;
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  if (recentRides.length === 0) {
    return "Connected to Strava, but no rides synced in the last 14 days.";
  }

  const totalDistanceKm = recentRides.reduce((sum, activity) => sum + (activity.distance || 0), 0) / 1000;
  const totalElevation = recentRides.reduce((sum, activity) => sum + (activity.totalElevationGain || 0), 0);
  const totalMovingHours = recentRides.reduce((sum, activity) => sum + (activity.movingTime || 0), 0) / 3600;

  const hrValues = recentRides
    .map((activity) => activity.averageHeartrate)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const averageHr =
    hrValues.length > 0
      ? (hrValues.reduce((sum, value) => sum + value, 0) / hrValues.length).toFixed(0)
      : null;

  const topRides = recentRides
    .slice(0, 5)
    .map((activity) => {
      const distanceKm = ((activity.distance || 0) / 1000).toFixed(1);
      const climbM = (activity.totalElevationGain || 0).toFixed(0);
      return `- ${formatDate(activity.startDate)}: ${activity.name} (${distanceKm} km, ${climbM} m climb)`;
    })
    .join("\n");

  return `Rides in last 14 days: ${recentRides.length}; distance ${totalDistanceKm.toFixed(1)} km; moving time ${totalMovingHours.toFixed(1)} h; elevation ${totalElevation.toFixed(0)} m${averageHr ? `; avg HR ${averageHr} bpm` : ""}.\nRecent rides:\n${topRides}`;
}

function countRecentMetrics(metrics: Metric[], days: number): number {
  const threshold = getDaysAgoDate(days).getTime();
  return metrics.filter((metric) => {
    const metricDate = safeDate(metric.date);
    return metricDate ? metricDate.getTime() >= threshold : false;
  }).length;
}

function getMetricsSummary(metrics: Metric[]): string {
  const threshold = getDaysAgoDate(7).getTime();
  const recent = metrics
    .filter((metric) => {
      const metricDate = safeDate(metric.date);
      return metricDate ? metricDate.getTime() >= threshold : false;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (recent.length === 0) {
    return "No metrics logged in the last 7 days.";
  }

  const latest = recent[recent.length - 1];
  const fatigueValues = recent
    .map((metric) => metric.fatigue)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const avgFatigue =
    fatigueValues.length > 0
      ? (fatigueValues.reduce((sum, value) => sum + value, 0) / fatigueValues.length).toFixed(1)
      : null;

  const lines = recent.map((metric) => {
    const parts: string[] = [];
    if (metric.fatigue !== null && metric.fatigue !== undefined) parts.push(`fatigue ${metric.fatigue}/10`);
    if (metric.restingHr !== null && metric.restingHr !== undefined) parts.push(`RHR ${metric.restingHr} bpm`);
    if (metric.weightKg !== null && metric.weightKg !== undefined) parts.push(`weight ${metric.weightKg.toFixed(1)} kg`);
    if (metric.rideMinutes !== null && metric.rideMinutes !== undefined) parts.push(`ride ${metric.rideMinutes} min`);
    if (metric.longRideKm !== null && metric.longRideKm !== undefined) parts.push(`long ride ${metric.longRideKm.toFixed(1)} km`);
    return `- ${metric.date}: ${parts.join(", ") || "no values"}`;
  });

  const latestParts: string[] = [];
  if (latest.fatigue !== null && latest.fatigue !== undefined) latestParts.push(`fatigue ${latest.fatigue}/10`);
  if (latest.restingHr !== null && latest.restingHr !== undefined) latestParts.push(`RHR ${latest.restingHr} bpm`);
  if (latest.weightKg !== null && latest.weightKg !== undefined) latestParts.push(`weight ${latest.weightKg.toFixed(1)} kg`);

  return `Metrics entries in last 7 days: ${recent.length}. Latest (${latest.date}): ${latestParts.join(", ") || "no values"}${avgFatigue ? `; avg fatigue ${avgFatigue}/10` : ""}.\nRecent metrics:\n${lines.join("\n")}`;
}

function buildCoachContext(params: {
  sessions: Session[];
  metrics: Metric[];
  activities: StravaActivity[];
  activeWeek: number;
  stravaConnected: boolean;
}): string {
  const weekSummary = getWeekSessionSummary(params.sessions, params.activeWeek);
  const stravaSummary = getStravaSummary(params.activities, params.stravaConnected);
  const metricsSummary = getMetricsSummary(params.metrics);
  const today = new Date().toISOString().slice(0, 10);

  return [
    `Today: ${today}`,
    `Current week in app: ${params.activeWeek}`,
    "Current week plan:",
    weekSummary,
    "Strava last 14 days:",
    stravaSummary,
    "Latest metrics (last 7 days):",
    metricsSummary,
  ].join("\n");
}

function buildCoachPrompt(params: {
  message: string;
  history: CoachHistoryItem[];
  context: string;
}): string {
  const historyText = params.history
    .slice(-12)
    .map((item) => `${item.role === "assistant" ? "Coach" : "Athlete"}: ${item.content}`)
    .join("\n");

  return `You are PeakReady Coach, an MTB endurance coach.
Style and behavior rules:
- Be practical, direct, and supportive.
- Give specific actions (durations, intensity zones, recovery suggestions) when useful.
- Use the provided training context and do not invent data.
- If information is missing, say what is missing and ask 1 clarifying question.
- If the athlete reports severe pain, dizziness, or red-flag symptoms, advise them to stop training and seek medical care.
- Keep responses concise (roughly 80-180 words) and structured with short bullets when helpful.

Training context:
${params.context}

Recent conversation:
${historyText || "No prior messages."}

Athlete message:
${params.message}

Respond as the MTB endurance coach only.`;
}
