# SECURITY_HEADERS Fix Plan

## Changes

- `next.config.mjs` — Add `headers()` async function with all 5 security headers

## New files

None.

## Verification goals

After implementation, ALL of these must be true:

- [x] Content-Security-Policy header present on every response
- [x] Strict-Transport-Security header present on every response
- [x] X-Frame-Options header present on every response
- [x] X-Content-Type-Options header present on every response
- [x] Referrer-Policy header present on every response
- [x] Headers set via next.config.mjs (global, not per-route)

## Manual verification (for the human)

- Deploy to Vercel and check response headers with: `curl -I https://diennuockhanhmai.vercel.app`
- Verify all 5 headers appear in the response
- Check in DevTools → Network → select any page request → inspect Response Headers
