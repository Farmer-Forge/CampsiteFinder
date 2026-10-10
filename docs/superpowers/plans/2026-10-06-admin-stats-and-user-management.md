# Admin Stats & User Management — Retroactive Record

> Written after the fact (2026-10-10). This work shipped without a spec/plan; this file records
> what was built so the plans folder stays a complete history.

Commits: `5657c90` (2026-10-06), admin half of `63c499b` (2026-10-08).

**Goal:** Give admins site-wide usage counts and the ability to manage users without going to
the Supabase dashboard.

## Stats
- [x] Migration `0016_admin_stats.sql`: admin-gated `get_admin_stats` RPC (same pattern as `get_users_for_admin`)
- [x] `AdminStatsService` + favorite/trip counts shown above the admin tabs

## User management
- [x] Migration `0017_admin_update_user_display_name.sql`: `security definer` RPC, `is_admin(auth.uid())` check, execute revoked from `anon`
- [x] Edge Function `admin-update-user-email` (auth.users change — not reachable from public schema)
- [x] Edge Function `admin-invite-user` (`inviteUserByEmail` creates the auth row and sends the email; list reloads afterward)
- [x] `AdminUsersService`: `updateDisplayName`, `updateEmail`, `inviteUser`; shared `invokeAdminFunction` error unwrapping (also used by `deleteUser`)
- [x] Admin page UI for invite / edit name / edit email
- [x] Specs for `AdminUsersService` and `AdminComponent`
