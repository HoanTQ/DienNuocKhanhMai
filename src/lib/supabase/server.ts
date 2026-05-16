import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Tạo Supabase client cho Server Components và Server Actions.
 * Sử dụng trong các page.tsx, layout.tsx, và server actions.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll được gọi từ Server Component nơi không thể set cookies.
            // Có thể bỏ qua nếu middleware đã refresh session.
          }
        },
      },
    }
  )
}
