import { storage } from "./storage";
import type { InsertStravaActivity } from "@shared/schema";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  if (cachedAccessToken && tokenExpiresAt > now + 60) {
    return cachedAccessToken;
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

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
  cachedAccessToken = data.access_token;
  tokenExpiresAt = data.expires_at;

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

async function fetchActivities(page = 1, perPage = 50): Promise<StravaApiActivity[]> {
  const token = await getAccessToken();

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

export async function syncStravaActivities(): Promise<{ synced: number; total: number }> {
  let allActivities: StravaApiActivity[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const batch = await fetchActivities(page, perPage);
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
    await storage.upsertStravaActivity(mapActivity(ride));
    synced++;
  }

  return { synced, total: allActivities.length };
}

export function isStravaConfigured(): boolean {
  return !!(
    process.env.STRAVA_CLIENT_ID &&
    process.env.STRAVA_CLIENT_SECRET &&
    process.env.STRAVA_REFRESH_TOKEN
  );
}

export function getStravaAuthUrl(redirectUri: string): string {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) throw new Error("STRAVA_CLIENT_ID not set");

  return `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=read,activity:read_all&approval_prompt=force`;
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
  cachedAccessToken = data.access_token;
  tokenExpiresAt = data.expires_at;

  return data;
}
