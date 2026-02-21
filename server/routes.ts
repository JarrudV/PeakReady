import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { insertMetricSchema, insertServiceItemSchema, insertGoalEventSchema } from "@shared/schema";

const sessionUpdateSchema = z.object({
  completed: z.boolean().optional(),
  completedAt: z.string().nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  notes: z.string().nullable().optional(),
  minutes: z.number().positive().optional(),
});

const serviceItemUpdateSchema = z.object({
  status: z.string().optional(),
  date: z.string().nullable().optional(),
});

const settingValueSchema = z.object({
  value: z.string(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/sessions", async (_req, res) => {
    try {
      const sessions = await storage.getSessions();
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    try {
      const parsed = sessionUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const session = await storage.updateSession(req.params.id, parsed.data);
      if (!session) return res.status(404).json({ error: "Session not found" });
      res.json(session);
    } catch (err) {
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  app.get("/api/metrics", async (_req, res) => {
    try {
      const metrics = await storage.getMetrics();
      res.json(metrics);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  app.post("/api/metrics", async (req, res) => {
    try {
      const parsed = insertMetricSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const metric = await storage.createMetric(parsed.data);
      res.json(metric);
    } catch (err) {
      res.status(500).json({ error: "Failed to create metric" });
    }
  });

  app.get("/api/service-items", async (_req, res) => {
    try {
      const items = await storage.getServiceItems();
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch service items" });
    }
  });

  app.post("/api/service-items", async (req, res) => {
    try {
      const parsed = insertServiceItemSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const item = await storage.upsertServiceItem(parsed.data);
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: "Failed to create service item" });
    }
  });

  app.patch("/api/service-items/:id", async (req, res) => {
    try {
      const parsed = serviceItemUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const item = await storage.updateServiceItem(req.params.id, parsed.data);
      if (!item) return res.status(404).json({ error: "Item not found" });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: "Failed to update service item" });
    }
  });

  app.get("/api/goal", async (_req, res) => {
    try {
      const goal = await storage.getGoal();
      res.json(goal);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch goal" });
    }
  });

  app.post("/api/goal", async (req, res) => {
    try {
      const parsed = insertGoalEventSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const goal = await storage.upsertGoal(parsed.data);
      res.json(goal);
    } catch (err) {
      res.status(500).json({ error: "Failed to create goal" });
    }
  });

  app.put("/api/goal", async (req, res) => {
    try {
      const parsed = insertGoalEventSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const goal = await storage.upsertGoal(parsed.data);
      res.json(goal);
    } catch (err) {
      res.status(500).json({ error: "Failed to update goal" });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const value = await storage.getSetting(req.params.key);
      res.json({ value });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.put("/api/settings/:key", async (req, res) => {
    try {
      const parsed = settingValueSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      await storage.setSetting(req.params.key, parsed.data.value);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save setting" });
    }
  });

  app.post("/api/seed", async (_req, res) => {
    try {
      await seedTrainingPlan();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to seed data" });
    }
  });

  return httpServer;
}

async function seedTrainingPlan() {
  const existingSessions = await storage.getSessions();
  if (existingSessions.length > 0) return;

  const goal = await storage.getGoal();
  const targetDate = goal?.startDate || getDefaultTargetDate();

  const raceDate = new Date(targetDate);
  const planStart = new Date(raceDate);
  planStart.setDate(planStart.getDate() - 12 * 7);

  const plan = generatePlan(planStart);
  await storage.upsertManySessions(plan);
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
      });
    }
  }

  return sessions;
}
