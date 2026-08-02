# PASSWORD_HASHING Fix Plan

## Status: N/A — Handled by Supabase Auth (bcrypt)

No application-level password hashing exists. Supabase Auth manages all password security.

## Changes

None.

## Verification goals

- [x] Passwords hashed with bcrypt (by Supabase Auth)
- [x] No MD5, SHA-1, or SHA-256 used for passwords in app code
- [x] No custom password handling logic

## Manual verification (for the human)

None needed.
