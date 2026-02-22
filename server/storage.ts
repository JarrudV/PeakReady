import { and, eq } from "drizzle-orm";
import { db } from "./db";
import {
  sessions,
  metrics,
  serviceItems,
  goalEvents,
  appSettings,
  stravaActivities,
  type Session,
  type InsertSession,
  type Metric,
  type InsertMetric,
  type ServiceItem,
  type InsertServiceItem,
  type GoalEvent,
  type InsertGoalEvent,
  type StravaActivity,
  type InsertStravaActivity,
} from "@shared/schema";

const LEGACY_USER_ID = "__legacy__";

export interface IStorage {
  getSessions(userId: string): Promise<Session[]>;
  getSession(userId: string, id: string): Promise<Session | undefined>;
  upsertSession(userId: string, session: InsertSession): Promise<Session>;
  updateSession(userId: string, id: string, updates: Partial<Omit<Session, "userId">>): Promise<Session | undefined>;
  upsertManySessions(userId: string, sessionList: InsertSession[]): Promise<void>;
  deleteAllSessions(userId: string): Promise<void>;

  getMetrics(userId: string): Promise<Metric[]>;
  createMetric(userId: string, metric: InsertMetric): Promise<Metric>;

  getServiceItems(userId: string): Promise<ServiceItem[]>;
  upsertServiceItem(userId: string, item: InsertServiceItem): Promise<ServiceItem>;
  updateServiceItem(userId: string, id: string, updates: Partial<Omit<ServiceItem, "userId">>): Promise<ServiceItem | undefined>;

  getGoal(userId: string): Promise<GoalEvent | null>;
  upsertGoal(userId: string, goal: InsertGoalEvent): Promise<GoalEvent>;

  getSetting(userId: string, key: string): Promise<string | null>;
  setSetting(userId: string, key: string, value: string): Promise<void>;

  getStravaActivities(userId: string): Promise<StravaActivity[]>;
  upsertStravaActivity(userId: string, activity: InsertStravaActivity): Promise<StravaActivity>;
  deleteAllStravaActivities(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private readonly migratedUsers = new Set<string>();

  private async claimLegacyRowsForUser(userId: string): Promise<void> {
    if (!userId || userId === LEGACY_USER_ID || this.migratedUsers.has(userId)) {
      return;
    }

    const [hasSessions] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId)).limit(1);
    if (!hasSessions) {
      await db.update(sessions).set({ userId }).where(eq(sessions.userId, LEGACY_USER_ID));
    }

    const [hasMetrics] = await db.select({ id: metrics.id }).from(metrics).where(eq(metrics.userId, userId)).limit(1);
    if (!hasMetrics) {
      await db.update(metrics).set({ userId }).where(eq(metrics.userId, LEGACY_USER_ID));
    }

    const [hasServiceItems] = await db
      .select({ id: serviceItems.id })
      .from(serviceItems)
      .where(eq(serviceItems.userId, userId))
      .limit(1);
    if (!hasServiceItems) {
      await db.update(serviceItems).set({ userId }).where(eq(serviceItems.userId, LEGACY_USER_ID));
    }

    const [hasGoal] = await db.select({ id: goalEvents.id }).from(goalEvents).where(eq(goalEvents.userId, userId)).limit(1);
    if (!hasGoal) {
      await db.update(goalEvents).set({ userId }).where(eq(goalEvents.userId, LEGACY_USER_ID));
    }

    const [hasStrava] = await db
      .select({ id: stravaActivities.id })
      .from(stravaActivities)
      .where(eq(stravaActivities.userId, userId))
      .limit(1);
    if (!hasStrava) {
      await db.update(stravaActivities).set({ userId }).where(eq(stravaActivities.userId, LEGACY_USER_ID));
    }

    const [hasSettings] = await db
      .select({ key: appSettings.key })
      .from(appSettings)
      .where(eq(appSettings.userId, userId))
      .limit(1);
    if (!hasSettings) {
      await db.update(appSettings).set({ userId }).where(eq(appSettings.userId, LEGACY_USER_ID));
    }

    this.migratedUsers.add(userId);
  }

  async getSessions(userId: string): Promise<Session[]> {
    await this.claimLegacyRowsForUser(userId);
    return db.select().from(sessions).where(eq(sessions.userId, userId));
  }

  async getSession(userId: string, id: string): Promise<Session | undefined> {
    await this.claimLegacyRowsForUser(userId);
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.id, id)));
    return session;
  }

  async upsertSession(userId: string, session: InsertSession): Promise<Session> {
    await this.claimLegacyRowsForUser(userId);
    const row = { ...session, userId };
    const [result] = await db
      .insert(sessions)
      .values(row)
      .onConflictDoUpdate({
        target: [sessions.userId, sessions.id],
        set: row,
      })
      .returning();
    return result;
  }

  async updateSession(userId: string, id: string, updates: Partial<Omit<Session, "userId">>): Promise<Session | undefined> {
    await this.claimLegacyRowsForUser(userId);
    const [result] = await db
      .update(sessions)
      .set(updates)
      .where(and(eq(sessions.userId, userId), eq(sessions.id, id)))
      .returning();
    return result;
  }

  async upsertManySessions(userId: string, sessionList: InsertSession[]): Promise<void> {
    await this.claimLegacyRowsForUser(userId);
    for (const session of sessionList) {
      await this.upsertSession(userId, session);
    }
  }

  async deleteAllSessions(userId: string): Promise<void> {
    await this.claimLegacyRowsForUser(userId);
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  async getMetrics(userId: string): Promise<Metric[]> {
    await this.claimLegacyRowsForUser(userId);
    return db.select().from(metrics).where(eq(metrics.userId, userId));
  }

  async createMetric(userId: string, metric: InsertMetric): Promise<Metric> {
    await this.claimLegacyRowsForUser(userId);
    const [result] = await db.insert(metrics).values({ ...metric, userId }).returning();
    return result;
  }

  async getServiceItems(userId: string): Promise<ServiceItem[]> {
    await this.claimLegacyRowsForUser(userId);
    return db.select().from(serviceItems).where(eq(serviceItems.userId, userId));
  }

  async upsertServiceItem(userId: string, item: InsertServiceItem): Promise<ServiceItem> {
    await this.claimLegacyRowsForUser(userId);
    const row = { ...item, userId };
    const [result] = await db
      .insert(serviceItems)
      .values(row)
      .onConflictDoUpdate({
        target: [serviceItems.userId, serviceItems.id],
        set: row,
      })
      .returning();
    return result;
  }

  async updateServiceItem(
    userId: string,
    id: string,
    updates: Partial<Omit<ServiceItem, "userId">>,
  ): Promise<ServiceItem | undefined> {
    await this.claimLegacyRowsForUser(userId);
    const [result] = await db
      .update(serviceItems)
      .set(updates)
      .where(and(eq(serviceItems.userId, userId), eq(serviceItems.id, id)))
      .returning();
    return result;
  }

  async getGoal(userId: string): Promise<GoalEvent | null> {
    await this.claimLegacyRowsForUser(userId);
    const goals = await db.select().from(goalEvents).where(eq(goalEvents.userId, userId));
    return goals[0] ?? null;
  }

  async upsertGoal(userId: string, goal: InsertGoalEvent): Promise<GoalEvent> {
    await this.claimLegacyRowsForUser(userId);
    const existing = await this.getGoal(userId);
    if (existing) {
      await db.delete(goalEvents).where(and(eq(goalEvents.userId, userId), eq(goalEvents.id, existing.id)));
    }
    const [result] = await db.insert(goalEvents).values({ ...goal, userId }).returning();
    return result;
  }

  async getSetting(userId: string, key: string): Promise<string | null> {
    await this.claimLegacyRowsForUser(userId);
    const [row] = await db
      .select()
      .from(appSettings)
      .where(and(eq(appSettings.userId, userId), eq(appSettings.key, key)));
    return row?.value ?? null;
  }

  async setSetting(userId: string, key: string, value: string): Promise<void> {
    await this.claimLegacyRowsForUser(userId);
    await db
      .insert(appSettings)
      .values({ userId, key, value })
      .onConflictDoUpdate({
        target: [appSettings.userId, appSettings.key],
        set: { value },
      });
  }

  async getStravaActivities(userId: string): Promise<StravaActivity[]> {
    await this.claimLegacyRowsForUser(userId);
    return db.select().from(stravaActivities).where(eq(stravaActivities.userId, userId));
  }

  async upsertStravaActivity(userId: string, activity: InsertStravaActivity): Promise<StravaActivity> {
    await this.claimLegacyRowsForUser(userId);
    const row = { ...activity, userId };
    const [result] = await db
      .insert(stravaActivities)
      .values(row)
      .onConflictDoUpdate({
        target: [stravaActivities.userId, stravaActivities.id],
        set: row,
      })
      .returning();
    return result;
  }

  async deleteAllStravaActivities(userId: string): Promise<void> {
    await this.claimLegacyRowsForUser(userId);
    await db.delete(stravaActivities).where(eq(stravaActivities.userId, userId));
  }
}

export const storage = new DatabaseStorage();
