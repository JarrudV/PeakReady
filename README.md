# PeakReady

## Auth Setup (Firebase)

Replit auth has been removed. The app now uses Firebase Authentication with:
- Google sign-in
- Email/password sign-in (with account creation in the login form)

### Railway environment variables

Set all of these in Railway:

Core server/runtime:
- `DATABASE_URL`
- `SESSION_SECRET`
- `NODE_ENV=production`

Client/web config (used by Vite build):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Server/admin config (used to verify Firebase ID tokens):
- Either `FIREBASE_SERVICE_ACCOUNT_JSON` (full JSON service account as one string)
- Or:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY` (with `\\n` escaped newlines; app converts to real newlines)

Optional local bypass:
- `AUTH_BYPASS=true` for local dev without Firebase auth.

Strava integration (required for connect + sync):
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_STATE_SECRET` (recommended; falls back to `SESSION_SECRET` if unset)

Strava app callback URL to whitelist:
- `https://web.peakready.app/api/strava/callback`

### Gemini / AI Plan generation
Set one of these API key options:
- `GEMINI_API_KEY` (recommended for direct Google Gemini API)
- `AI_INTEGRATIONS_GEMINI_API_KEY` (Replit AI Integrations)

Optional:
- `GEMINI_BASE_URL` (custom proxy endpoint)
- `AI_INTEGRATIONS_GEMINI_BASE_URL` (Replit Modelfarm endpoint)
- `GEMINI_MODEL` (default is `gemini-2.5-flash` for plan generation)

Notes:
- If you use Replit AI Integrations locally, `AI_INTEGRATIONS_GEMINI_BASE_URL` must point to a reachable endpoint.
- `http://localhost:1106/modelfarm/gemini` only works when that local proxy is actually running.

### Firebase console checklist
- Enable providers:
  - Google
  - Email/Password
- Add authorized domain(s) for your deployed app URL.

## Consolidated Feature Guide (PWA + Strava + Push + Share + Themes)

### 1) PWA and Offline Caching
- Manifest: `client/public/manifest.json` with standalone display, start URL, colors, and app icons.
- Service worker: `client/public/sw.js`.
- App shell assets (`/`, html, js/css bundles, icons) use cache-first.
- Key API responses use stale-while-revalidate:
  - `/api/sessions`
  - `/api/metrics`
  - `/api/service-items`
  - `/api/goal`
  - selected settings/strava/template endpoints
- Offline behavior:
  - If the network fails, cached sessions/metrics are served when available.
  - Header includes online/offline indicator and last sync timestamp.
- Logout cache safety:
  - Logout sends `CLEAR_USER_CACHE` to service worker and clears local sync markers.

### 2) Strava Integration (Planned vs Actual + Auto-Complete)
- Metrics tab includes a 14-day chart (Recharts): planned session minutes vs actual Strava minutes.
- Strava sync auto-completes sessions using deterministic matching rules:
  - only current user data
  - only incomplete `Ride`/`Long Ride` sessions
  - same date match (`scheduledDate` == Strava activity date)
  - duration tolerance: `abs(actual-planned)/planned <= 0.20`
  - one-to-one pairing with stable tie-break ordering
- Session completion fields:
  - `completed` boolean
  - `completedAt` timestamp
  - `completionSource` (`manual` or `strava`)
- Undo is supported from session toggle (reverts completion + source).

### 3) Push Notifications + Scheduled Reminders
- New routes:
  - `POST /api/push/subscribe`
  - `POST /api/push/unsubscribe`
  - `GET /api/push/status`
  - `GET /api/reminders/settings`
  - `POST /api/reminders/settings`
  - `GET /api/notifications`
  - `POST /api/notifications/read`
  - `POST /api/notifications/clear`
- Scheduler:
  - Node cron runs every 5 minutes (`server/reminders.ts`).
  - Sends reminders only when toggles are enabled.
  - Reminder types:
    - long ride evening before
    - service item due date
    - goal event one-week countdown
- Fallback:
  - If push is unavailable, reminder is stored as in-app notification and shown in Notifications Center.
- Service worker handles `push` and `notificationclick` events.

### 4) Shareable Workout Cards
- Completed session detail modal includes a **Share** button.
- Card generation:
  - client-side canvas
  - high DPI PNG output
  - includes session title/date/duration/RPE
  - includes matched Strava stats when available (distance/elevation/time)
  - PeakReady gradient + glass style
- Share flow:
  - Web Share API with file when supported
  - otherwise automatic PNG download fallback

### 5) Theme System
- Settings modal includes:
  - light/dark mode
  - accent presets: `peakready`, `neon`, `sunset`
  - push/reminder settings panel
- Persistence:
  - local storage for instant first paint
  - per-user persistence in DB through existing `/api/settings/:key` values:
    - `themeMode`
    - `themeAccent`
- First paint flash prevention:
  - inline theme bootstrap script in `client/index.html` applies stored theme before app mount.
- Dynamic theme color:
  - `meta[name=theme-color]` is updated on theme changes where browser support exists.

### Push Env Vars
Set these in your environment for web push delivery:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (example: `mailto:you@example.com`)

Generate VAPID keys (example):
```bash
npx web-push generate-vapid-keys
```

Notes:
- Do not log private keys.
- iOS web push requires iOS/iPadOS Home Screen installation and user permission; browser behavior varies by version.

## Local Testing

### Install and run
```bash
npm install
npm run check
npm run build
npm run dev
```

### PWA install/offline test
1. Open app in browser and install as PWA.
2. Navigate key pages once while online.
3. Disable network (DevTools > Offline) and refresh.
4. Confirm app shell loads and sessions/metrics are served from cache.
5. Confirm offline indicator switches state and last sync is shown.

### Strava matching test
1. Connect Strava and sync activities.
2. Ensure planned session exists on same date as a synced ride.
3. Use a ride duration within 20% of planned duration.
4. Confirm session auto-completes with `completionSource = strava`.
5. Undo completion from UI and confirm state resets.

### Push and reminders test
1. Set VAPID env vars and restart server.
2. Open Settings modal, grant notification permission, subscribe.
3. Enable reminder toggles.
4. Create test data for long ride/service due date/goal countdown.
5. Wait for cron window or temporarily adjust data/time for test.
6. Confirm push notification received.
7. Test unsubscribe.
8. Deny permission and confirm reminders appear in Notifications Center.

### Share card test
1. Open a completed session detail.
2. Click **Share**.
3. On supported devices, confirm native share sheet with PNG file.
4. On unsupported devices, confirm PNG download fallback.

### Theme test
1. Open Settings modal.
2. Toggle dark/light and each accent preset.
3. Refresh page and confirm theme persists instantly.
4. Log out/log in and confirm per-user theme settings are restored.

## Manual Test Checklist
- [ ] PWA installs and opens standalone.
- [ ] Offline shell cache works.
- [ ] Offline plan/metrics cache fallback works.
- [ ] Logout clears cached user API data.
- [ ] Strava 14-day planned vs actual chart renders.
- [ ] Strava auto-complete marks matching sessions completed.
- [ ] Undo completion works.
- [ ] Push subscribe/unsubscribe works.
- [ ] Reminder toggles are respected by scheduler.
- [ ] In-app notifications appear when push unavailable.
- [ ] Share card generated and shared/downloaded.
- [ ] Theme mode and accent switch correctly.
- [ ] Theme persists via local storage + DB.
- [ ] `npm run check` passes.
- [ ] `npm run build` passes.
