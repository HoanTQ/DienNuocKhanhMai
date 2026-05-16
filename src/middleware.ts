import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Thời gian tối đa không hoạt động trước khi tự động đăng xuất (8 giờ).
 */
const INACTIVITY_TIMEOUT_MS = 8 * 60 * 60 * 1000

/**
 * Routes mà staff KHÔNG được truy cập.
 * Bao gồm: báo cáo, audit log, quản lý NCC/đặt hàng/nhập hàng, công nợ, cài đặt.
 */
const STAFF_RESTRICTED_ROUTES = [
  '/reports',
  '/audit-log',
  '/purchasing',
  '/debts',
  '/settings',
]

/**
 * Routes công khai không cần xác thực.
 */
const PUBLIC_ROUTES = ['/login', '/auth']

/**
 * Kiểm tra xem pathname có bắt đầu bằng một trong các routes cho trước không.
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

/**
 * Next.js Middleware - Xử lý xác thực và phân quyền cho mọi request.
 *
 * Luồng xử lý:
 * 1. Gọi updateSession() để refresh Supabase session
 * 2. Kiểm tra user đã đăng nhập chưa (redirect /login nếu chưa)
 * 3. Kiểm tra last_activity - nếu > 8 giờ, đăng xuất và redirect /login
 * 4. Kiểm tra role + path - nếu staff truy cập route bị chặn, redirect /pos
 * 5. Cập nhật last_activity timestamp
 * 6. Cho phép đăng nhập đồng thời nhiều thiết bị (không enforce single-session)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Redirect root path to /pos
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/pos'
    return NextResponse.redirect(url)
  }

  // Bỏ qua routes công khai
  if (matchesRoute(pathname, PUBLIC_ROUTES)) {
    const { response } = await updateSession(request)
    return response
  }

  // 1. Refresh session và lấy thông tin user
  const { response, supabase, user } = await updateSession(request)

  // 2. Chưa đăng nhập → redirect về /login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 3. Kiểm tra last_activity để auto-logout sau 8 giờ không hoạt động
  const { data: userProfile } = await supabase
    .from('users')
    .select('role, last_activity')
    .eq('id', user.id)
    .single()

  if (!userProfile) {
    // User không có profile trong bảng users → đăng xuất
    await supabase.auth.signOut()
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Kiểm tra thời gian không hoạt động
  if (userProfile.last_activity) {
    const lastActivity = new Date(userProfile.last_activity).getTime()
    const now = Date.now()
    const inactiveTime = now - lastActivity

    if (inactiveTime > INACTIVITY_TIMEOUT_MS) {
      // Quá 8 giờ không hoạt động → đăng xuất
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('reason', 'inactivity')
      return NextResponse.redirect(url)
    }
  }

  // 4. Kiểm tra phân quyền: staff không được truy cập routes nhạy cảm
  if (userProfile.role === 'staff' && matchesRoute(pathname, STAFF_RESTRICTED_ROUTES)) {
    const url = request.nextUrl.clone()
    url.pathname = '/pos'
    return NextResponse.redirect(url)
  }

  // 5. Cập nhật last_activity (cho phép đăng nhập đồng thời nhiều thiết bị)
  await supabase
    .from('users')
    .update({ last_activity: new Date().toISOString() })
    .eq('id', user.id)

  return response
}

/**
 * Matcher config: áp dụng middleware cho tất cả routes trừ static files và API routes nội bộ.
 */
export const config = {
  matcher: [
    /*
     * Match tất cả request paths trừ:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Các file tĩnh (svg, png, jpg, jpeg, gif, webp, ico)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
