import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

export interface UpdateSessionResult {
  response: NextResponse
  supabase: SupabaseClient
  user: User | null
}

/**
 * Tạo Supabase client cho Next.js Middleware.
 * Xử lý refresh token và cập nhật cookies trên request/response.
 * Trả về cả supabase client và user để middleware chính có thể sử dụng.
 */
export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Quan trọng: Không đặt logic nào giữa createServerClient và supabase.auth.getUser().
  // Một lỗi đơn giản có thể khiến người dùng bị đăng xuất ngẫu nhiên.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response: supabaseResponse, supabase, user }
}
