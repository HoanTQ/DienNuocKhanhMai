'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ShoppingCart,
  Package,
  Users,
  MoreHorizontal,
  Home,
  BarChart3,
  Truck,
  CreditCard,
  ClipboardList,
  Settings,
  RotateCcw,
  Bell,
} from 'lucide-react';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { cn } from '@/lib/utils';

/**
 * Dashboard Layout - Responsive navigation
 *
 * Mobile: Bottom navigation bar (4 tabs + More)
 * Desktop: Sidebar navigation + top header
 *
 * Đảm bảo:
 * - Nút bấm tối thiểu 44px touch target (Requirement 5.3)
 * - Font chữ đủ lớn trên mobile (Requirement 5.3)
 * - Luồng thao tác ngắn gọn (Requirement 22.1)
 *
 * Validates: Requirements 5.3, 22.1
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  mobileNav?: boolean;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Trang chủ', icon: Home, mobileNav: true },
  { href: '/pos', label: 'Bán hàng', icon: ShoppingCart, mobileNav: true },
  { href: '/inventory', label: 'Tồn kho', icon: Package, mobileNav: true },
  { href: '/customers', label: 'Khách hàng', icon: Users, mobileNav: true },
  { href: '/products', label: 'Sản phẩm', icon: ClipboardList },
  { href: '/debts', label: 'Công nợ', icon: CreditCard },
  { href: '/purchasing/orders', label: 'Đặt hàng', icon: Truck },
  { href: '/purchasing/receipts', label: 'Nhập kho', icon: Package },
  { href: '/returns', label: 'Trả hàng', icon: RotateCcw },
  { href: '/delivery', label: 'Giao hàng', icon: Truck },
  { href: '/reports', label: 'Báo cáo', icon: BarChart3 },
  { href: '/notifications', label: 'Thông báo', icon: Bell },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
];

const mobileNavItems = navItems.filter((item) => item.mobileNav);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r z-30">
        {/* Sidebar Header */}
        <div className="flex items-center h-16 px-6 border-b">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-primary whitespace-nowrap">⚡ Khánh Mai</span>
          </Link>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3" aria-label="Điều hướng chính">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      'min-h-[44px]', // Touch-friendly minimum height
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Desktop Top Header */}
        <header className="hidden lg:flex items-center justify-between h-16 px-6 bg-white border-b sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              {navItems.find((item) => isActive(item.href))?.label || 'Trang chủ'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>

        {/* Mobile Top Header */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 bg-white border-b sticky top-0 z-20">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-base font-bold text-primary whitespace-nowrap">⚡ Khánh Mai</span>
          </Link>
          <NotificationBell />
        </header>

        {/* Page Content */}
        <main className="flex-1 pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t z-30 safe-area-bottom"
        aria-label="Điều hướng nhanh"
      >
        <ul className="flex items-center justify-around h-16">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 py-2 min-h-[48px] transition-colors',
                    active
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium leading-tight">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
          {/* More button */}
          <li className="flex-1">
            <Link
              href="/reports"
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 min-h-[48px] transition-colors',
                pathname.startsWith('/reports') ||
                  pathname.startsWith('/debts') ||
                  pathname.startsWith('/settings')
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-tight">Thêm</span>
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
