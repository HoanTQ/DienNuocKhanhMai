import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// Mock the updateSession module
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: vi.fn(),
}))

import { updateSession } from '@/lib/supabase/middleware'

const mockUpdateSession = vi.mocked(updateSession)

// Helper to create a mock NextRequest
function createMockRequest(pathname: string): NextRequest {
  const url = new URL(pathname, 'http://localhost:3000')
  return new NextRequest(url)
}

// Helper to setup updateSession mock with user and supabase client
function setupMockSession(options: {
  user: { id: string } | null
  profile?: { role: string; last_activity: string | null } | null
  profileError?: boolean
}) {
  const mockSignOut = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  })
  const mockSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: options.profileError ? null : options.profile,
        error: options.profileError ? { message: 'not found' } : null,
      }),
    }),
  })
  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: mockSelect,
        update: mockUpdate,
      }
    }
    return { select: mockSelect, update: mockUpdate }
  })

  mockUpdateSession.mockImplementation(async (request: NextRequest) => {
    const response = NextResponse.next({ request })
    return {
      response,
      supabase: {
        auth: { signOut: mockSignOut },
        from: mockFrom,
      } as any,
      user: options.user as any,
    }
  })

  return { mockSignOut, mockFrom, mockUpdate, mockSelect }
}

describe('Middleware', () => {
  let middleware: (request: NextRequest) => Promise<NextResponse>

  beforeEach(async () => {
    vi.resetAllMocks()
    // Dynamic import to get fresh module
    const mod = await import('./middleware')
    middleware = mod.middleware
  })

  describe('Public routes', () => {
    it('should allow access to /login without authentication', async () => {
      setupMockSession({ user: null })
      const request = createMockRequest('/login')
      const response = await middleware(request)

      expect(response.status).toBe(200)
    })

    it('should allow access to /auth routes without authentication', async () => {
      setupMockSession({ user: null })
      const request = createMockRequest('/auth/callback')
      const response = await middleware(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Authentication check', () => {
    it('should redirect to /login when user is not authenticated', async () => {
      setupMockSession({ user: null })
      const request = createMockRequest('/pos')
      const response = await middleware(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/login')
    })

    it('should redirect to /login when user has no profile', async () => {
      const { mockSignOut } = setupMockSession({
        user: { id: 'user-1' },
        profileError: true,
      })
      const request = createMockRequest('/pos')
      const response = await middleware(request)

      expect(mockSignOut).toHaveBeenCalled()
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/login')
    })
  })

  describe('Inactivity timeout (8 hours)', () => {
    it('should sign out and redirect when last_activity > 8 hours ago', async () => {
      const nineHoursAgo = new Date()
      nineHoursAgo.setHours(nineHoursAgo.getHours() - 9)

      const { mockSignOut } = setupMockSession({
        user: { id: 'user-1' },
        profile: { role: 'owner', last_activity: nineHoursAgo.toISOString() },
      })

      const request = createMockRequest('/pos')
      const response = await middleware(request)

      expect(mockSignOut).toHaveBeenCalled()
      expect(response.status).toBe(307)
      const location = response.headers.get('location')!
      expect(location).toContain('/login')
      expect(location).toContain('reason=inactivity')
    })

    it('should allow access when last_activity < 8 hours ago', async () => {
      const oneHourAgo = new Date()
      oneHourAgo.setHours(oneHourAgo.getHours() - 1)

      setupMockSession({
        user: { id: 'user-1' },
        profile: { role: 'owner', last_activity: oneHourAgo.toISOString() },
      })

      const request = createMockRequest('/pos')
      const response = await middleware(request)

      expect(response.status).toBe(200)
    })

    it('should allow access when last_activity is exactly 8 hours ago', async () => {
      const exactlyEightHours = new Date()
      exactlyEightHours.setHours(exactlyEightHours.getHours() - 8)
      // Subtract 1ms to be exactly at the boundary (not over)
      exactlyEightHours.setMilliseconds(exactlyEightHours.getMilliseconds() + 1)

      setupMockSession({
        user: { id: 'user-1' },
        profile: { role: 'owner', last_activity: exactlyEightHours.toISOString() },
      })

      const request = createMockRequest('/pos')
      const response = await middleware(request)

      expect(response.status).toBe(200)
    })

    it('should allow access when last_activity is null (first login)', async () => {
      setupMockSession({
        user: { id: 'user-1' },
        profile: { role: 'owner', last_activity: null },
      })

      const request = createMockRequest('/pos')
      const response = await middleware(request)

      expect(response.status).toBe(200)
    })
  })

  describe('RBAC - Staff route restrictions', () => {
    const restrictedRoutes = [
      '/reports',
      '/audit-log',
      '/purchasing',
      '/purchasing/suppliers',
      '/purchasing/orders',
      '/debts',
      '/settings',
    ]

    const allowedRoutes = [
      '/pos',
      '/inventory',
      '/products',
      '/customers',
      '/notifications',
    ]

    restrictedRoutes.forEach((route) => {
      it(`should redirect staff from ${route} to /pos`, async () => {
        const recentActivity = new Date()
        recentActivity.setMinutes(recentActivity.getMinutes() - 30)

        setupMockSession({
          user: { id: 'staff-1' },
          profile: { role: 'staff', last_activity: recentActivity.toISOString() },
        })

        const request = createMockRequest(route)
        const response = await middleware(request)

        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toContain('/pos')
      })
    })

    allowedRoutes.forEach((route) => {
      it(`should allow staff to access ${route}`, async () => {
        const recentActivity = new Date()
        recentActivity.setMinutes(recentActivity.getMinutes() - 30)

        setupMockSession({
          user: { id: 'staff-1' },
          profile: { role: 'staff', last_activity: recentActivity.toISOString() },
        })

        const request = createMockRequest(route)
        const response = await middleware(request)

        expect(response.status).toBe(200)
      })
    })

    // Owner can access everything
    const allRoutes = [...restrictedRoutes, ...allowedRoutes]

    allRoutes.forEach((route) => {
      it(`should allow owner to access ${route}`, async () => {
        const recentActivity = new Date()
        recentActivity.setMinutes(recentActivity.getMinutes() - 30)

        setupMockSession({
          user: { id: 'owner-1' },
          profile: { role: 'owner', last_activity: recentActivity.toISOString() },
        })

        const request = createMockRequest(route)
        const response = await middleware(request)

        expect(response.status).toBe(200)
      })
    })
  })

  describe('Last activity update', () => {
    it('should update last_activity on successful request', async () => {
      const recentActivity = new Date()
      recentActivity.setMinutes(recentActivity.getMinutes() - 5)

      const { mockFrom } = setupMockSession({
        user: { id: 'user-1' },
        profile: { role: 'owner', last_activity: recentActivity.toISOString() },
      })

      const request = createMockRequest('/pos')
      await middleware(request)

      // Verify that from('users') was called for both select and update
      expect(mockFrom).toHaveBeenCalledWith('users')
      // Called at least twice: once for select (profile), once for update (last_activity)
      expect(mockFrom.mock.calls.filter((c) => c[0] === 'users').length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Concurrent sessions', () => {
    it('should not enforce single-session - multiple devices can access simultaneously', async () => {
      const recentActivity = new Date()
      recentActivity.setMinutes(recentActivity.getMinutes() - 5)

      // First device request
      setupMockSession({
        user: { id: 'user-1' },
        profile: { role: 'owner', last_activity: recentActivity.toISOString() },
      })

      const request1 = createMockRequest('/pos')
      const response1 = await middleware(request1)
      expect(response1.status).toBe(200)

      // Second device request (same user, different route)
      setupMockSession({
        user: { id: 'user-1' },
        profile: { role: 'owner', last_activity: recentActivity.toISOString() },
      })

      const request2 = createMockRequest('/inventory')
      const response2 = await middleware(request2)
      expect(response2.status).toBe(200)
    })
  })
})
