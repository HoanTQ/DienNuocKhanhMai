# DATABASE_ACCESS Fix Plan

## Status: LOW — Optional improvement only

## Changes

- Supabase migration: Update `audit_logs_system_insert` policy to validate `user_id = auth.uid()`

## New files

None required.

## Verification goals

All currently pass:

- [x] Every table has RLS enabled (24/24)
- [x] Every table has explicit policies scoped to `auth.uid()` via `get_user_role()`
- [x] No policy uses `USING (true)` for SELECT without a proper condition
- [x] Anonymous (unauthenticated) requests cannot read any table data

Optional improvement:

- [ ] `audit_logs_system_insert` validates `user_id = auth.uid()`

## Manual verification (for the human)

- Test with Supabase Dashboard: use the anon key in a REST client (Postman/curl) without a session token to confirm 0 rows returned from any table
- Verify staff user cannot access owner-only tables via the app UI
