import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, date, timestamp, index, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable("sessions", {
  userId: text("user_id").notNull().default("__legacy__"),
  id: varchar("id", { length: 64 }).notNull(),
  week: integer("week").notNull(),
  day: text("day").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  minutes: integer("minutes").notNull(),
  zone: text("zone"),
  elevation: text("elevation"),
  strength: boolean("strength").notNull().default(false),
  completed: boolean("completed").notNull().default(false),
  completionSource: text("completion_source"),
  rpe: integer("rpe"),
  notes: text("notes"),
  scheduledDate: text("scheduled_date"),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  detailsMarkdown: text("details_markdown"),
}, (table) => [
  primaryKey({ columns: [table.userId, table.id] }),
  index("sessions_user_id_idx").on(table.userId),
]);

export const metrics = pgTable("metrics", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().default("__legacy__"),
  date: text("date").notNull(),
  weightKg: real("weight_kg"),
  restingHr: integer("resting_hr"),
  rideMinutes: integer("ride_minutes"),
  longRideKm: real("long_ride_km"),
  fatigue: integer("fatigue"),
  notes: text("notes"),
}, (table) => [index("metrics_user_id_idx").on(table.userId)]);

export const serviceItems = pgTable("service_items", {
  userId: text("user_id").notNull().default("__legacy__"),
  id: varchar("id", { length: 64 }).notNull(),
  date: text("date"),
  item: text("item").notNull(),
  shop: text("shop"),
  cost: real("cost"),
  status: text("status").notNull().default("Planned"),
  notes: text("notes"),
}, (table) => [
  primaryKey({ columns: [table.userId, table.id] }),
  index("service_items_user_id_idx").on(table.userId),
]);

export const goalEvents = pgTable("goal_events", {
  userId: text("user_id").notNull().default("__legacy__"),
  id: varchar("id", { length: 64 }).notNull(),
  name: text("name").notNull(),
  link: text("link"),
  startDate: text("start_date").notNull(),
  location: text("location"),
  distanceKm: real("distance_km"),
  elevationMeters: integer("elevation_meters"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.id] }),
  index("goal_events_user_id_idx").on(table.userId),
]);

export const stravaActivities = pgTable("strava_activities", {
  userId: text("user_id").notNull().default("__legacy__"),
  id: varchar("id", { length: 64 }).notNull(),
  stravaId: text("strava_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  sportType: text("sport_type"),
  startDate: text("start_date").notNull(),
  movingTime: integer("moving_time").notNull(),
  elapsedTime: integer("elapsed_time"),
  distance: real("distance").notNull(),
  totalElevationGain: real("total_elevation_gain"),
  averageSpeed: real("average_speed"),
  maxSpeed: real("max_speed"),
  averageHeartrate: real("average_heartrate"),
  maxHeartrate: real("max_heartrate"),
  averageWatts: real("average_watts"),
  kilojoules: real("kilojoules"),
  sufferScore: integer("suffer_score"),
  syncedAt: text("synced_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.id] }),
  index("strava_activities_user_id_idx").on(table.userId),
]);

export const appSettings = pgTable("app_settings", {
  userId: text("user_id").notNull().default("__legacy__"),
  key: varchar("key", { length: 64 }).notNull(),
  value: text("value").notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.key] }),
  index("app_settings_user_id_idx").on(table.userId),
]);

export const insertSessionSchema = createInsertSchema(sessions).omit({ userId: true });
export const insertMetricSchema = createInsertSchema(metrics).omit({ id: true, userId: true });
export const insertServiceItemSchema = createInsertSchema(serviceItems).omit({ userId: true });
export const insertGoalEventSchema = createInsertSchema(goalEvents).omit({ userId: true });
export const insertStravaActivitySchema = createInsertSchema(stravaActivities).omit({ userId: true });

export type Session = typeof sessions.$inferSelect;
export type SessionCompletionSource = "manual" | "strava" | null;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Metric = typeof metrics.$inferSelect;
export type InsertMetric = z.infer<typeof insertMetricSchema>;
export type ServiceItem = typeof serviceItems.$inferSelect;
export type InsertServiceItem = z.infer<typeof insertServiceItemSchema>;
export type GoalEvent = typeof goalEvents.$inferSelect;
export type InsertGoalEvent = z.infer<typeof insertGoalEventSchema>;
export type StravaActivity = typeof stravaActivities.$inferSelect;
export type InsertStravaActivity = z.infer<typeof insertStravaActivitySchema>;

export * from "./models/chat";
export * from "./models/auth";

export type SessionType = "Ride" | "Long Ride" | "Strength" | "Rest";

export interface AppData {
  sessions: Session[];
  metrics: Metric[];
  serviceItems: ServiceItem[];
  activeWeek: number;
  goal?: GoalEvent;
}
