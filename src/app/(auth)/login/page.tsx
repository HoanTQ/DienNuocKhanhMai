'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { login } from '@/services/auth.service'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setRemainingAttempts(null)
    setIsLoading(true)

    try {
      const result = await login({ phone, password, rememberMe })

      if (result.success) {
        router.push('/')
        router.refresh()
      } else {
        setError(result.error || 'Đã xảy ra lỗi không xác định.')
        if (result.remainingAttempts !== undefined) {
          setRemainingAttempts(result.remainingAttempts)
        }
      }
    } catch {
      setError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Đăng nhập
          </h1>
          <p className="text-sm text-muted-foreground">
            Hệ thống Quản lý Cửa hàng Điện Nước
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Message */}
          {error && (
            <div
              className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}

          {/* Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="0901234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
              inputMode="tel"
              disabled={isLoading}
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>

          {/* Remember Me */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
            />
            <label
              htmlFor="remember-me"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Ghi nhớ đăng nhập
            </label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isLoading || !phone || !password}
          >
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>

          {/* Remaining Attempts Warning */}
          {remainingAttempts !== null && remainingAttempts > 0 && remainingAttempts <= 2 && (
            <p className="text-xs text-center text-muted-foreground">
              Cảnh báo: Tài khoản sẽ bị khóa sau {remainingAttempts} lần thử sai nữa.
            </p>
          )}
        </form>

        {/* Footer */}
        <p className="text-xs text-center text-muted-foreground">
          Liên hệ chủ cửa hàng nếu quên mật khẩu hoặc tài khoản bị khóa.
        </p>
      </div>
    </div>
  )
}
