# AUTH_MIDDLEWARE Fix Plan

## Status: No fixes needed — PASS

## Changes

No changes required.

## New files

None.

## Verification goals

All verified:

- [x] Every route that returns or modifies user data has auth middleware (all routes covered by middleware matcher)
- [x] Auth middleware runs before the handler (Next.js middleware architecture)
- [x] Unauthenticated requests to protected routes redirect to /login (301/307)
- [x] Non-owner requests to owner routes redirect to /pos
- [x] No API routes exist that could bypass middleware

## Manual verification (for the human)

- Open an incognito browser and navigate to `/pos` — should redirect to `/login`
- Log in as staff and navigate to `/reports` — should redirect to `/pos`
- Log in as staff and navigate to `/debts` — should redirect to `/pos`
