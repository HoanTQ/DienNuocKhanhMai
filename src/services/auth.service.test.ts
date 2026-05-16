import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  checkAccountLockStatus,
  incrementFailedAttempts,
  resetFailedAttemptsAndUpdateActivity,
  login,
  type LoginCredentials,
} from './auth.service'

// Mock Supabase client
const mockFrom = vi.fn()
const mockAuth = {
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
    auth: mockAuth,
  }),
}))

// Helper to create chainable query mock
function createQueryMock(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  }
  return chain
}

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkAccountLockStatus', () => {
    it('should return not locked when user not found', async () => {
      const chain = createQueryMock(null, { message: 'not found' })
      mockFrom.mockReturnValue(chain)

      const result = await checkAccountLockStatus('0901234567')

      expect(result.isLocked).toBe(false)
      expect(result.failedAttempts).toBe(0)
    })

    it('should return locked when locked_until is in the future', async () => {
      const futureDate = new Date()
      futureDate.setMinutes(futureDate.getMinutes() + 30)

      const chain = createQueryMock({
        failed_login_attempts: 5,
        locked_until: futureDate.toISOString(),
      })
      mockFrom.mockReturnValue(chain)

      const result = await checkAccountLockStatus('0901234567')

      expect(result.isLocked).toBe(true)
      expect(result.failedAttempts).toBe(5)
      expect(result.lockedUntil).toBe(futureDate.toISOString())
    })

    it('should return not locked when locked_until is in the past', async () => {
      const pastDate = new Date()
      pastDate.setMinutes(pastDate.getMinutes() - 10)

      const chain = createQueryMock({
        failed_login_attempts: 5,
        locked_until: pastDate.toISOString(),
      })
      mockFrom.mockReturnValue(chain)

      const result = await checkAccountLockStatus('0901234567')

      expect(result.isLocked).toBe(false)
      expect(result.failedAttempts).toBe(5)
    })

    it('should return not locked when locked_until is null', async () => {
      const chain = createQueryMock({
        failed_login_attempts: 2,
        locked_until: null,
      })
      mockFrom.mockReturnValue(chain)

      const result = await checkAccountLockStatus('0901234567')

      expect(result.isLocked).toBe(false)
      expect(result.failedAttempts).toBe(2)
    })
  })

  describe('incrementFailedAttempts', () => {
    it('should increment failed attempts and not lock when under threshold', async () => {
      // First call: select user
      const selectChain = createQueryMock({ id: 'user-1', failed_login_attempts: 2 })
      // Second call: update
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      mockFrom
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(updateChain)

      const result = await incrementFailedAttempts('0901234567')

      expect(result.failedAttempts).toBe(3)
      expect(result.isNowLocked).toBe(false)
    })

    it('should lock account when reaching 5 failed attempts', async () => {
      const selectChain = createQueryMock({ id: 'user-1', failed_login_attempts: 4 })
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      mockFrom
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(updateChain)

      const result = await incrementFailedAttempts('0901234567')

      expect(result.failedAttempts).toBe(5)
      expect(result.isNowLocked).toBe(true)
      expect(result.lockedUntil).toBeDefined()
    })

    it('should return 0 attempts when user not found', async () => {
      const selectChain = createQueryMock(null, { message: 'not found' })
      mockFrom.mockReturnValue(selectChain)

      const result = await incrementFailedAttempts('0999999999')

      expect(result.failedAttempts).toBe(0)
      expect(result.isNowLocked).toBe(false)
    })
  })

  describe('resetFailedAttemptsAndUpdateActivity', () => {
    it('should reset failed attempts and update last_activity', async () => {
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
      mockFrom.mockReturnValue(updateChain)

      await resetFailedAttemptsAndUpdateActivity('user-1')

      expect(mockFrom).toHaveBeenCalledWith('users')
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          failed_login_attempts: 0,
          locked_until: null,
        })
      )
    })
  })

  describe('login', () => {
    it('should return ACCOUNT_LOCKED when account is locked', async () => {
      const futureDate = new Date()
      futureDate.setMinutes(futureDate.getMinutes() + 30)

      const chain = createQueryMock({
        failed_login_attempts: 5,
        locked_until: futureDate.toISOString(),
      })
      mockFrom.mockReturnValue(chain)

      const credentials: LoginCredentials = {
        phone: '0901234567',
        password: 'wrong',
      }

      const result = await login(credentials)

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('ACCOUNT_LOCKED')
    })

    it('should return INVALID_CREDENTIALS on wrong password', async () => {
      // checkAccountLockStatus call
      const lockCheckChain = createQueryMock({
        failed_login_attempts: 1,
        locked_until: null,
      })

      // incrementFailedAttempts - select
      const incrementSelectChain = createQueryMock({
        id: 'user-1',
        failed_login_attempts: 1,
      })

      // incrementFailedAttempts - update
      const incrementUpdateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      mockFrom
        .mockReturnValueOnce(lockCheckChain)
        .mockReturnValueOnce(incrementSelectChain)
        .mockReturnValueOnce(incrementUpdateChain)

      mockAuth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      })

      const credentials: LoginCredentials = {
        phone: '0901234567',
        password: 'wrongpassword',
      }

      const result = await login(credentials)

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('INVALID_CREDENTIALS')
      expect(result.remainingAttempts).toBe(3)
    })

    it('should return success on valid credentials', async () => {
      // checkAccountLockStatus
      const lockCheckChain = createQueryMock({
        failed_login_attempts: 0,
        locked_until: null,
      })

      // Check is_active
      const activeCheckChain = createQueryMock({ is_active: true })

      // resetFailedAttempts
      const resetChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      mockFrom
        .mockReturnValueOnce(lockCheckChain)
        .mockReturnValueOnce(activeCheckChain)
        .mockReturnValueOnce(resetChain)

      mockAuth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-1' }, session: {} },
        error: null,
      })

      const credentials: LoginCredentials = {
        phone: '0901234567',
        password: 'correctpassword',
      }

      const result = await login(credentials)

      expect(result.success).toBe(true)
    })

    it('should return ACCOUNT_INACTIVE when user is deactivated', async () => {
      // checkAccountLockStatus
      const lockCheckChain = createQueryMock({
        failed_login_attempts: 0,
        locked_until: null,
      })

      // Check is_active - returns inactive
      const activeCheckChain = createQueryMock({ is_active: false })

      mockFrom
        .mockReturnValueOnce(lockCheckChain)
        .mockReturnValueOnce(activeCheckChain)

      mockAuth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-1' }, session: {} },
        error: null,
      })
      mockAuth.signOut.mockResolvedValue({ error: null })

      const credentials: LoginCredentials = {
        phone: '0901234567',
        password: 'correctpassword',
      }

      const result = await login(credentials)

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('ACCOUNT_INACTIVE')
      expect(mockAuth.signOut).toHaveBeenCalled()
    })

    it('should lock account after 5th failed attempt', async () => {
      // checkAccountLockStatus - not locked yet
      const lockCheckChain = createQueryMock({
        failed_login_attempts: 4,
        locked_until: null,
      })

      // incrementFailedAttempts - select (4 attempts)
      const incrementSelectChain = createQueryMock({
        id: 'user-1',
        failed_login_attempts: 4,
      })

      // incrementFailedAttempts - update
      const incrementUpdateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      mockFrom
        .mockReturnValueOnce(lockCheckChain)
        .mockReturnValueOnce(incrementSelectChain)
        .mockReturnValueOnce(incrementUpdateChain)

      mockAuth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      })

      const credentials: LoginCredentials = {
        phone: '0901234567',
        password: 'wrongpassword',
      }

      const result = await login(credentials)

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('ACCOUNT_LOCKED')
      expect(result.remainingAttempts).toBe(0)
      expect(result.lockedUntil).toBeDefined()
    })
  })
})
