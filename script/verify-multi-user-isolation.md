# Multi-User Isolation Manual Verification

## 1) Apply DB changes

1. Apply `migrations/0001_user_isolation.sql` to your Postgres database.
2. Restart the app server.

## 2) Verify legacy data migration safety

1. Sign in as the original user (the one who owned pre-migration data).
2. Open Dashboard/Plan/Metrics/Service/Events once each.
3. Confirm previous data is still visible.
4. Optional DB check:
   - `SELECT COUNT(*) FROM sessions WHERE user_id = '__legacy__';`
   - Repeat for `metrics`, `service_items`, `goal_events`, `strava_activities`, `app_settings`.
   - Expected: `0` after first access by the original user.

## 3) Verify isolation between two users

1. User A signs in and creates/updates:
   - at least 1 session update
   - 1 metric
   - 1 service item
   - goal event
   - active week setting
2. Sign out, then sign in as User B.
3. Confirm User B does not see User A data on:
   - `/api/sessions`
   - `/api/metrics`
   - `/api/service-items`
   - `/api/goal`
   - `/api/settings/activeWeek`
4. Create different data as User B.
5. Sign back in as User A and confirm User A still sees only A data.

## 4) Verify destructive actions are user-scoped

1. As User A, run "Load default plan" (or CSV upload).
2. Confirm only User A sessions changed.
3. Sign in as User B and verify User B sessions are unchanged.

## 5) Verify Strava scoping

1. Connect Strava as User A and run sync.
2. Confirm `/api/strava/activities` returns activities for User A.
3. Sign in as User B and verify no Strava activities appear until User B connects Strava.
