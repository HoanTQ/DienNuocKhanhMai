# DEPENDENCIES Security Report

## Status: HIGH

## Findings

### npm audit results
**12 high severity vulnerabilities found:**

| Package | Severity | Issue |
|---------|----------|-------|
| `next` (14.2.35) | HIGH | Multiple: DoS, SSRF, Cache poisoning, XSS via CSP nonces, middleware bypass |
| `postcss` (≤8.5.17) | HIGH | XSS via CSS stringify, arbitrary file read via sourceMappingURL |
| `sharp` (<0.35.0) | HIGH | Inherited libvips CVEs (via `@ericblade/quagga2`) |
| `undici` (7.0.0-7.27.2) | HIGH | TLS bypass, HTTP injection, WebSocket DoS, cookie downgrade |
| `vite` (8.0.0-8.0.15) | HIGH | NTLMv2 hash disclosure, server.fs.deny bypass (dev only) |
| `brace-expansion` | HIGH | DoS via exponential expansion |
| `glob` (10.2-10.4) | HIGH | Command injection via -c/--cmd |
| `js-yaml` (4.0-4.2) | HIGH | Quadratic DoS via merge key handling |

### Version pinning
- Uses `^` (caret) ranges in package.json — allows minor version updates
- `package-lock.json` is committed (good — ensures reproducible builds)

### Lock file
- ✅ `package-lock.json` exists and is committed to git

### Dependency legitimacy
All packages are well-known, actively maintained npm packages:
- `next`, `react`, `react-dom` — Meta/Vercel
- `@supabase/ssr`, `@supabase/supabase-js` — Supabase official
- `lucide-react` — Popular icon library
- `zustand` — State management
- `zod` — Schema validation
- `tailwind-merge`, `class-variance-authority`, `clsx` — Styling utilities
- `@ericblade/quagga2` — Barcode scanning (brings in sharp)

No suspicious or low-download packages found.

## What's at risk

- **Next.js vulnerabilities**: Multiple attack vectors including DoS, SSRF in rewrites, cache poisoning. Most require specific configurations (image optimizer, i18n, custom servers) that may not apply to this app.
- **postcss**: File read via sourceMappingURL — development/build concern
- **sharp/quagga2**: libvips CVEs — affects barcode scanning image processing
- **undici**: HTTP-level attacks — affects server-side fetch operations
- **vite**: Dev-only vulnerability (fs.deny bypass) — not a production risk

## What's already secure

- Lock file committed (reproducible builds)
- All packages are legitimate and well-known
- Private package (not published to npm)
- Dev-only vulnerabilities (vite) don't affect production

## Recommendations

1. **HIGH**: Run `npm audit fix` to patch non-breaking vulnerabilities (brace-expansion, js-yaml, undici, vite)
2. **HIGH**: Consider upgrading `next` to latest 14.x patch or 15.x for security fixes
3. **MEDIUM**: Evaluate if `@ericblade/quagga2` can be replaced (it pulls in vulnerable sharp)
4. **LOW**: Pin exact versions in package.json for production (remove `^`)
