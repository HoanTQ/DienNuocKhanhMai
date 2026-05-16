import { createClient } from '@/lib/supabase/client'

/**
 * Auth Service - Xử lý logic đăng nhập, quản lý session, và khóa tài khoản.
 * 
 * Luồng đăng nhập:
 * 1. Kiểm tra tài khoản có bị khóa không (locked_until > now)
 * 2. Nếu khóa → trả lỗi
 * 3. Nếu không → thử đăng nhập qua Supabase Auth
 * 4. Nếu sai → tăng failed_login_attempts, khóa nếu >= 5
 * 5. Nếu đúng → reset failed_login_attempts, cập nhật last_activity
 */

export interface LoginCredentials {
  phone: string
  password: string
  rememberMe?: boolean
}

export interface LoginResult {
  success: boolean
  error?: string
  errorCode?: 'ACCOUNT_LOCKED' | 'INVALID_CREDENTIALS' | 'ACCOUNT_INACTIVE' | 'UNKNOWN_ERROR'
  remainingAttempts?: number
  lockedUntil?: string
}

const MAX_FAILED_ATTEMPTS = 5
const LOCK_DURATION_MINUTES = 30

/**
 * Kiểm tra tài khoản có bị khóa không.
 * Trả về thông tin khóa nếu locked_until > now.
 */
export async function checkAccountLockStatus(phone: string): Promise<{
  isLocked: boolean
  lockedUntil?: string
  failedAttempts: number
}> {
  const supabase = createClient()

  const { data: user, error } = await supabase
    .from('users')
    .select('failed_login_attempts, locked_until')
    .eq('phone', phone)
    .single()

  if (error || !user) {
    return { isLocked: false, failedAttempts: 0 }
  }

  const now = new Date()
  const lockedUntil = user.locked_until ? new Date(user.locked_until) : null

  if (lockedUntil && lockedUntil > now) {
    return {
      isLocked: true,
      lockedUntil: user.locked_until,
      failedAttempts: user.failed_login_attempts,
    }
  }

  return {
    isLocked: false,
    failedAttempts: user.failed_login_attempts,
  }
}

/**
 * Tăng số lần đăng nhập sai và khóa tài khoản nếu >= 5 lần.
 */
export async function incrementFailedAttempts(phone: string): Promise<{
  failedAttempts: number
  isNowLocked: boolean
  lockedUntil?: string
}> {
  const supabase = createClient()

  // Lấy số lần sai hiện tại
  const { data: user } = await supabase
    .from('users')
    .select('id, failed_login_attempts')
    .eq('phone', phone)
    .single()

  if (!user) {
    return { failedAttempts: 0, isNowLocked: false }
  }

  const newAttempts = user.failed_login_attempts + 1
  const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS

  const updateData: Record<string, unknown> = {
    failed_login_attempts: newAttempts,
  }

  if (shouldLock) {
    const lockUntil = new Date()
    lockUntil.setMinutes(lockUntil.getMinutes() + LOCK_DURATION_MINUTES)
    updateData.locked_until = lockUntil.toISOString()
  }

  await supabase
    .from('users')
    .update(updateData)
    .eq('id', user.id)

  return {
    failedAttempts: newAttempts,
    isNowLocked: shouldLock,
    lockedUntil: shouldLock ? (updateData.locked_until as string) : undefined,
  }
}

/**
 * Reset số lần đăng nhập sai và cập nhật last_activity khi đăng nhập thành công.
 */
export async function resetFailedAttemptsAndUpdateActivity(userId: string): Promise<void> {
  const supabase = createClient()

  await supabase
    .from('users')
    .update({
      failed_login_attempts: 0,
      locked_until: null,
      last_activity: new Date().toISOString(),
    })
    .eq('id', userId)
}

/**
 * Đăng nhập bằng số điện thoại và mật khẩu.
 * Xử lý toàn bộ luồng: kiểm tra khóa → đăng nhập → cập nhật trạng thái.
 */
export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  const { phone, password, rememberMe } = credentials
  const supabase = createClient()

  try {
    // 1. Kiểm tra tài khoản có bị khóa không
    const lockStatus = await checkAccountLockStatus(phone)

    if (lockStatus.isLocked) {
      return {
        success: false,
        error: `Tài khoản đã bị khóa. Vui lòng thử lại sau.`,
        errorCode: 'ACCOUNT_LOCKED',
        lockedUntil: lockStatus.lockedUntil,
      }
    }

    // 2. Thử đăng nhập qua Supabase Auth
    // Supabase Auth sử dụng email-based login, ta dùng phone@store.local format
    const email = `${phone}@store.local`

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !data.user) {
      // 3. Đăng nhập thất bại → tăng failed attempts
      const result = await incrementFailedAttempts(phone)

      if (result.isNowLocked) {
        return {
          success: false,
          error: 'Tài khoản đã bị khóa do nhập sai mật khẩu quá nhiều lần. Vui lòng liên hệ chủ cửa hàng.',
          errorCode: 'ACCOUNT_LOCKED',
          lockedUntil: result.lockedUntil,
          remainingAttempts: 0,
        }
      }

      return {
        success: false,
        error: `Số điện thoại hoặc mật khẩu không đúng. Còn ${MAX_FAILED_ATTEMPTS - result.failedAttempts} lần thử.`,
        errorCode: 'INVALID_CREDENTIALS',
        remainingAttempts: MAX_FAILED_ATTEMPTS - result.failedAttempts,
      }
    }

    // 4. Kiểm tra tài khoản có active không
    const { data: userProfile } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', data.user.id)
      .single()

    if (userProfile && !userProfile.is_active) {
      await supabase.auth.signOut()
      return {
        success: false,
        error: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ chủ cửa hàng.',
        errorCode: 'ACCOUNT_INACTIVE',
      }
    }

    // 5. Đăng nhập thành công → reset failed attempts
    await resetFailedAttemptsAndUpdateActivity(data.user.id)

    return { success: true }
  } catch {
    return {
      success: false,
      error: 'Đã xảy ra lỗi. Vui lòng thử lại.',
      errorCode: 'UNKNOWN_ERROR',
    }
  }
}

/**
 * Đăng xuất người dùng.
 */
export async function logout(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
}

/**
 * Lấy thông tin user hiện tại.
 */
export async function getCurrentUser() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}
