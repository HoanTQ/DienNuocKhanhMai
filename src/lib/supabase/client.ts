import { createBrowserClient } from '@supabase/ssr'

/**
 * Tạo Supabase client cho browser (Client Components).
 * Sử dụng trong các React components chạy trên trình duyệt.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
