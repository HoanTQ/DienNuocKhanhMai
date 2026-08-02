# RATE_LIMITING Fix Plan

## Status: LOW — No immediate fixes needed

The current account lockout mechanism + Supabase's built-in rate limiting is adequate for a small store management system with 2 users.

## Changes

None required at this time. If the system scales:
- Add IP-based rate limiting via Vercel Edge Middleware
- Configure Supabase Auth rate limits in dashboard

## Verification goals

- [x] Login has rate limiting (account lockout after 5 failed attempts)
- [x] Rate limit triggers after 5 failed attempts per account
- [ ] Rate limiter cannot be bypassed by spoofing X-Forwarded-For (N/A — no custom IP rate limiting)
- [x] Locked accounts show appropriate error message

## Manual verification (for the human)

- Try logging in with wrong password 5 times — verify account locks for 30 minutes
- Check Supabase Dashboard → Auth → Rate Limits for built-in protection settings
