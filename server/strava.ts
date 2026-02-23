import { storage } from "./storage";
import { createHmac, timingSafeEqual } from "crypto";
import type { InsertStravaActivity, Session } from "@shared/schema";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";
const AUTO_COMPLETE_TOLERANCE = 0.2;
const STRAVA_STATE_TTL_MS = 10 * 60 * 1000;

const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

interface StravaStatePayload {
  userId: string;
  exp: number;
}

function getStateSecret(): string {
  const secret = process.env.STRAVA_STATE_SECRET || process.env.SESSION_SECRET || process.env.STRAVA_CLIENT_SECRET;
  if (!secret) {
    throw new Error("Missing STRAVA_STATE_SECRET or SESSION_SECRET for Strava OAuth state");
  }
  return secret;
}

function signStatePayload(payloadBase64: string): string {
  return createHmac("sha256", getStateSecret())
    .update(payloadBase64)
    .digest("base64url");
}

export function createStravaOAuthState(userId: string): string {
  const payload: StravaStatePayload = {
    userId,
    exp: Date.now() + STRAVA_STATE_TTL_MS,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signStatePayload(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export function parseStravaOAuthState(state: string): string {
  const [payloadBase64, signature] = state.split(".", 2);
  if (!payloadBase64 || !signature) {
    throw new Error("Invalid Strava OAuth state");
  }

  const expectedSignature = signStatePayload(payloadBase64);
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new Error("Invalid Strava OAuth signature");
  }

  const raw = Buffer.from(payloadBase64, "base64url").toString("utf8");
  const payload = JSON.parse(raw) as Partial<StravaStatePayload>;

  if (!payload.userId || typeof payload.userId !== "string" || !payload.exp || typeof payload.exp !== "number") {
    throw new Error("Invalid Strava OAuth state payload");
  }

  if (Date.now() > payload.exp) {
    throw new Error("Strava OAuth state expired");
  }

  return payload.userId;
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const cached = tokenCache.get(refreshToken);

  if (cached && cached.expiresAt > now + 60) {
    return cached.accessToken;
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Strava credentials not configured");
  }

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  tokenCache.set(refreshToken, {
    accessToken: data.access_token,
    expiresAt: data.expires_at,
  });

  return data.access_token;
}

interface StravaApiActivity {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  start_date: string;
  moving_time: number;
  elapsed_time: number;
  distance: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  kilojoules?: number;
  suffer_score?: number;
}

async function fetchActivities(refreshToken: string, page = 1, perPage = 50): Promise<StravaApiActivity[]> {
  const token = await getAccessToken(refreshToken);

  const url = new URL(`${STRAVA_API_BASE}/athlete/activities`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava API error: ${res.status} ${text}`);
  }

  return res.json();
}

function mapActivity(a: StravaApiActivity): InsertStravaActivity {
  return {
    id: `strava-${a.id}`,
    stravaId: String(a.id),
    name: a.name,
    type: a.type,
    sportType: a.sport_type || null,
    startDate: a.start_date,
    movingTime: a.moving_time,
    elapsedTime: a.elapsed_time,
    distance: a.distance,
    totalElevationGain: a.total_elevation_gain,
    averageSpeed: a.average_speed,
    maxSpeed: a.max_speed,
    averageHeartrate: a.average_heartrate ?? null,
    maxHeartrate: a.max_heartrate ?? null,
    averageWatts: a.average_watts ?? null,
    kilojoules: a.kilojoules ?? null,
    sufferScore: a.suffer_score ?? null,
    syncedAt: new Date().toISOString(),
  };
}

export async function syncStravaActivities(
  userId: string,
  refreshToken: string,
): Promise<{ synced: number; total: number; autoCompleted: number }> {
  let allActivities: StravaApiActivity[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const batch = await fetchActivities(refreshToken, page, perPage);
    if (batch.length === 0) break;
    allActivities = allActivities.concat(batch);
    if (batch.length < perPage) break;
    page++;
    if (page > 5) break;
  }

  const rideTypes = ["Ride", "VirtualRide", "MountainBikeRide", "GravelRide", "EBikeRide"];
  const rides = allActivities.filter((a) => rideTypes.includes(a.type));

  let synced = 0;
  for (const ride of rides) {
    await storage.upsertStravaActivity(userId, mapActivity(ride));
    synced++;
  }

  const autoCompleted = await autoCompleteSessionsFromActivities(userId, rides);

  return { synced, total: allActivities.length, autoCompleted };
}

export function isStravaConfigured(): boolean {
  return !!(
    process.env.STRAVA_CLIENT_ID &&
    process.env.STRAVA_CLIENT_SECRET
  );
}

function toDateOnly(isoString: string): string {
  return isoString.slice(0, 10);
}

function getActivityDurationSeconds(activity: StravaApiActivity): number {
  return activity.moving_time || activity.elapsed_time || 0;
}

async function autoCompleteSessionsFromActivities(userId: string, activities: StravaApiActivity[]): Promise<number> {
  const sessions = await storage.getSessions(userId);

  const candidateSessions = sessions.filter(
    (session) =>
      !session.completed &&
      !!session.scheduledDate &&
      (session.type === "Ride" || session.type === "Long Ride") &&
      session.minutes > 0,
  );

  if (candidateSessions.length === 0 || activities.length === 0) {
    return 0;
  }

  const pairs: Array<{
    session: Session;
    activity: StravaApiActivity;
    ratioDelta: number;
  }> = [];

  for (const session of candidateSessions) {
    const plannedSeconds = session.minutes * 60;
    for (const activity of activities) {
      if (toDateOnly(activity.start_date) !== session.scheduledDate) {
        continue;
      }

      const activitySeconds = getActivityDurationSeconds(activity);
      if (!activitySeconds) {
        continue;
      }

      const ratioDelta = Math.abs(activitySeconds - plannedSeconds) / plannedSeconds;
      if (ratioDelta <= AUTO_COMPLETE_TOLERANCE) {
        pairs.push({
          session,
          activity,
          ratioDelta,
        });
      }
    }
  }

  if (pairs.length === 0) {
    return 0;
  }

  // Deterministic matching: best duration fit first, then stable tie-breakers.
  pairs.sort((a, b) => {
    if (a.ratioDelta !== b.ratioDelta) {
      return a.ratioDelta - b.ratioDelta;
    }
    if (a.activity.start_date !== b.activity.start_date) {
      return a.activity.start_date.localeCompare(b.activity.start_date);
    }
    if (a.session.id !== b.session.id) {
      return a.session.id.localeCompare(b.session.id);
    }
    return String(a.activity.id).localeCompare(String(b.activity.id));
  });

  const usedSessionIds = new Set<string>();
  const usedActivityIds = new Set<number>();
  const selected = pairs.filter((pair) => {
    if (usedSessionIds.has(pair.session.id) || usedActivityIds.has(pair.activity.id)) {
      return false;
    }
    usedSessionIds.add(pair.session.id);
    usedActivityIds.add(pair.activity.id);
    return true;
  });

  await Promise.all(
    selected.map((pair) =>
      storage.updateSession(userId, pair.session.id, {
        completed: true,
        completedAt: pair.activity.start_date,
        completionSource: "strava",
      }),
    ),
  );

  return selected.length;
}

export function getStravaAuthUrl(redirectUri: string, state?: string): string {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) throw new Error("STRAVA_CLIENT_ID not set");

  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "read,activity:read_all");
  url.searchParams.set("approval_prompt", "force");
  if (state) {
    url.searchParams.set("state", state);
  }

  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<{ refresh_token: string; access_token: string; expires_at: number }> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) throw new Error("Strava credentials not configured");

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (data.refresh_token) {
    tokenCache.set(data.refresh_token, {
      accessToken: data.access_token,
      expiresAt: data.expires_at,
    });
  }

  return data;
}
