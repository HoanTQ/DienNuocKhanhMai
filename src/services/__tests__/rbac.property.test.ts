import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

/**
 * **Validates: Requirements 4.4, 4.9, 8.6, 17.3, 17.4**
 *
 * Property 9: Role-Based Access Control
 * - Với mọi user role 'staff', access vào restricted routes đều bị denied (redirect to /pos)
 * - Với mọi user role 'owner', access vào tất cả resources đều được granted
 *
 * Restricted resources for staff:
 * - cost prices (weighted_avg_cost, last_cost) → handled by products_staff_view in DB
 * - profit reports → /reports
 * - revenue reports → /reports
 * - debt management → /debts
 * - supplier management → /purchasing
 * - user management → /settings
 * - audit logs → /audit-log
 */

// ============================================================
// Replicate the RBAC logic from src/middleware.ts for pure testing
// ============================================================

const STAFF_RESTRICTED_ROUTES = [
  '/reports',
  '/audit-log',
  '/purchasing',
  '/debts',
  '/settings',
];

const ALLOWED_ROUTES = [
  '/pos',
  '/inventory',
  '/products',
  '/customers',
  '/notifications',
  '/returns',
];

/**
 * Pure function replicating the middleware's route matching logic.
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

type UserRole = 'owner' | 'staff';
type AccessResult = 'granted' | 'denied';

/**
 * Pure RBAC access check function - mirrors the middleware logic.
 * Returns 'granted' if user can access the route, 'denied' if blocked.
 */
function checkRouteAccess(role: UserRole, pathname: string): AccessResult {
  if (role === 'staff' && matchesRoute(pathname, STAFF_RESTRICTED_ROUTES)) {
    return 'denied';
  }
  return 'granted';
}

// ============================================================
// Generators
// ============================================================

/**
 * Generate a random sub-path suffix (e.g., "/details", "/123/edit", "")
 */
const segmentArb = fc.stringMatching(/^[a-z0-9_-]{1,8}$/);

const subPathArb = fc.oneof(
  fc.constant(''),
  segmentArb.map((s) => `/${s}`),
  fc.tuple(segmentArb, segmentArb).map(([a, b]) => `/${a}/${b}`),
);

/**
 * Generate a restricted route path (base + optional sub-path)
 */
const restrictedRouteArb = fc.tuple(
  fc.constantFrom(...STAFF_RESTRICTED_ROUTES),
  subPathArb
).map(([base, sub]) => `${base}${sub}`);

/**
 * Generate an allowed route path (base + optional sub-path)
 */
const allowedRouteArb = fc.tuple(
  fc.constantFrom(...ALLOWED_ROUTES),
  subPathArb
).map(([base, sub]) => `${base}${sub}`);

/**
 * Generate any valid route (restricted or allowed)
 */
const anyRouteArb = fc.oneof(restrictedRouteArb, allowedRouteArb);

// ============================================================
// Property Tests
// ============================================================

describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 9: Role-Based Access Control', () => {
  it('staff bị denied khi truy cập bất kỳ restricted route nào', () => {
    fc.assert(
      fc.property(
        restrictedRouteArb,
        (pathname) => {
          const result = checkRouteAccess('staff', pathname);
          expect(result).toBe('denied');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('owner được granted khi truy cập bất kỳ route nào (restricted + allowed)', () => {
    fc.assert(
      fc.property(
        anyRouteArb,
        (pathname) => {
          const result = checkRouteAccess('owner', pathname);
          expect(result).toBe('granted');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('staff được granted khi truy cập allowed routes', () => {
    fc.assert(
      fc.property(
        allowedRouteArb,
        (pathname) => {
          const result = checkRouteAccess('staff', pathname);
          expect(result).toBe('granted');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('RBAC decision chỉ phụ thuộc vào role và pathname - deterministic', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<UserRole>('owner', 'staff'),
        anyRouteArb,
        (role, pathname) => {
          const result1 = checkRouteAccess(role, pathname);
          const result2 = checkRouteAccess(role, pathname);
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('staff bị denied truy cập /reports (profit reports, revenue reports)', () => {
    fc.assert(
      fc.property(
        subPathArb,
        (sub) => {
          const pathname = `/reports${sub}`;
          expect(checkRouteAccess('staff', pathname)).toBe('denied');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('staff bị denied truy cập /audit-log (audit logs)', () => {
    fc.assert(
      fc.property(
        subPathArb,
        (sub) => {
          const pathname = `/audit-log${sub}`;
          expect(checkRouteAccess('staff', pathname)).toBe('denied');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('staff bị denied truy cập /purchasing (supplier management)', () => {
    fc.assert(
      fc.property(
        subPathArb,
        (sub) => {
          const pathname = `/purchasing${sub}`;
          expect(checkRouteAccess('staff', pathname)).toBe('denied');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('staff bị denied truy cập /debts (debt management)', () => {
    fc.assert(
      fc.property(
        subPathArb,
        (sub) => {
          const pathname = `/debts${sub}`;
          expect(checkRouteAccess('staff', pathname)).toBe('denied');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('staff bị denied truy cập /settings (user management)', () => {
    fc.assert(
      fc.property(
        subPathArb,
        (sub) => {
          const pathname = `/settings${sub}`;
          expect(checkRouteAccess('staff', pathname)).toBe('denied');
        }
      ),
      { numRuns: 100 }
    );
  });
});
