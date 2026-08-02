'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { login } from '@/services/auth.service';

/**
 * Login Page — Redesigned per design-system/pages/login.md
 *
 * - Centered card, max-width 400px
 * - Phone + password login
 * - Large touch targets (h-14 submit button)
 * - Clear error states
 * - Remember me checkbox
 */
export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRemainingAttempts(null);
    setIsLoading(true);

    try {
      const result = await login({ phone, password, rememberMe });

      if (result.success) {
        router.push('/');
        router.refresh();
      } else {
        setError(result.error || 'Số điện thoại hoặc mật khẩu không đúng.');
        if (result.remainingAttempts !== undefined) {
          setRemainingAttempts(result.remainingAttempts);
        }
      }
    } catch {
      setError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-[400px] space-y-8">
        {/* Logo & Title */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mx-auto">
            <span className="text-white font-bold text-xl">KM</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Hệ thống Quản lý Cửa hàng
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Điện nước Khánh Mai
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error Message */}
          {error && (
            <div
              className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive"
              role="alert"
              aria-live="polite"
            >
              <p className="font-medium">{error}</p>
              {remainingAttempts !== null && remainingAttempts > 0 && remainingAttempts <= 2 && (
                <p className="mt-1 text-xs opacity-80">
                  Còn {remainingAttempts} lần thử. Sau đó tài khoản sẽ bị khóa.
                </p>
              )}
            </div>
          )}

          {/* Account Input */}
          <div className="space-y-2">
            <label htmlFor="phone" className="block text-sm font-medium text-foreground">
              Tài khoản
            </label>
            <input
              id="phone"
              type="text"
              inputMode="text"
              placeholder="0912 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="username"
              disabled={isLoading}
              className="w-full h-12 px-4 rounded-lg border-[1.5px] border-border bg-white text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors disabled:opacity-50"
            />
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isLoading}
                className="w-full h-12 px-4 pr-12 rounded-lg border-[1.5px] border-border bg-white text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Eye className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center gap-3">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
            />
            <label
              htmlFor="remember-me"
              className="text-sm text-foreground cursor-pointer select-none"
            >
              Ghi nhớ đăng nhập
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !phone || !password}
            className="w-full h-14 rounded-lg bg-primary text-white text-base font-semibold hover:bg-primary/90 active:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Đang đăng nhập...</span>
              </>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-xs text-center text-muted-foreground">
          Quên mật khẩu? Liên hệ chủ cửa hàng để được hỗ trợ.
        </p>
      </div>
    </div>
  );
}
