# RATE_LIMITING Security Report

## Status: LOW

## Findings

### Application-level protection (implemented)
- **Account lockout**: After 5 failed login attempts, account is locked for 30 minutes
- **Implementation**: `src/services/auth.service.ts` — `incrementFailedAttempts()` function
- **Lock tracking**: `failed_login_attempts` and `locked_until` columns in `users` table
- **User feedback**: Remaining attempts shown to user, lockout message displayed

### Rate limiting gaps
1. **Per-account only**: The lockout is per phone number. An attacker could try different accounts without being blocked.
2. **No IP-based rate limiting**: No middleware-level rate limiting on the login endpoint.
3. **No API routes**: Since all auth goes through Supabase Auth API directly, Supabase's own rate limiting applies.

### Supabase built-in protection
Supabase Auth has built-in rate limiting:
- Email/Password sign-in: Rate limited per IP (default: 30 requests per hour for auth endpoints)
- This provides baseline protection even without custom rate limiting

### No registration or password reset
- No self-registration feature exists (users are created by the owner)
- No password reset endpoint (instructions say "contact the store owner")
- Therefore, no rate limiting needed for these non-existent features

## What's at risk

- **Low risk**: An attacker could enumerate valid phone numbers by trying logins (the error message differs slightly, but account lockout kicks in after 5 tries per account)
- **Mitigated by**: Supabase's built-in IP rate limiting on auth endpoints, small user base (2 users), non-public system

## What's already secure

- Account lockout after 5 failed attempts (30-minute lock duration)
- Clear user feedback about remaining attempts
- Supabase Auth's built-in rate limiting at the infrastructure level
- No self-registration (reduces attack surface)
- No password reset endpoint

## Recommendations

1. **LOW**: For a production system with more users, consider adding IP-based rate limiting via Vercel Edge Middleware or Supabase's auth rate limit configuration
2. **INFO**: Current protection is adequate for a 2-user store management system
