# DEPENDENCIES Fix Plan

## Changes

1. Run `npm audit fix` to patch non-breaking vulnerabilities
2. Verify app still builds and runs correctly after patches

## New files

None.

## Verification goals

After implementation:

- [x] Every dependency verified as legitimate on npm registry
- [x] No packages with suspiciously low downloads or recent publish dates
- [ ] Exact versions pinned (no ^ or ~ in production) — deferred, using lock file instead
- [x] Lock files committed
- [ ] `npm audit` shows no critical or high vulnerabilities

## Manual verification (for the human)

- Run `npm audit fix` and test the app
- Consider `npm audit fix --force` for Next.js upgrade (breaking change to v16)
- Run `npm run build` to verify no regressions
- Test barcode scanning after sharp update
