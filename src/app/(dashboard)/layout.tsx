'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { logout } from '@/services/auth.service';
import {
  ShoppingCart,
  Package,
  ScanBarcode,
  Bell,
  Menu,
  Home,
  Users,
  BarChart3,
  Truck,
  CreditCard,
  ClipboardList,
  Settings,
  RotateCcw,
  FileText,
  LogOut,
  ChevronLeft,
  Building2,
  X,
} from 'lucide-react';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { cn } from '@/lib/utils';

/**
 * Dashboard Layout — Redesigned per Design System MASTER.md
 *
 * Desktop (≥1024px): Collapsible sidebar + top navbar
 * Tablet/Mobile (<1024px): Top navbar + bottom tab bar
 *
 * Bottom tabs (mobile):
 * - Chủ cửa hàng: Bán hàng | Tồn kho | Tra giá | Thông báo | Menu
 * - Nhân viên: Bán hàng | Tồn kho | Tra giá | Báo giá | Menu
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: string;
}

const navItems: NavItem[] = [
  { href: '/pos', label: 'Bán hàng', icon: ShoppingCart, section: 'sales' },
  { href: '/reports/quotation', label: 'Báo giá', icon: FileText, section: 'sales' },
  { href: '/inventory', label: 'Tồn kho', icon: Package, section: 'warehouse' },
  { href: '/purchasing/orders', label: 'Đặt hàng NCC', icon: Truck, section: 'warehouse' },
  { href: '/purchasing/receipts', label: 'Nhập kho', icon: Package, section: 'warehouse' },
  { href: '/delivery', label: 'Giao hàng', icon: Truck, section: 'logistics' },
  { href: '/returns', label: 'Trả hàng', icon: RotateCcw, section: 'logistics' },
  { href: '/debts', label: 'Công nợ KH', icon: CreditCard, section: 'debt' },
  { href: '/purchasing/debts', label: 'Công nợ NCC', icon: CreditCard, section: 'debt' },
  { href: '/', label: 'Tổng quan', icon: Home, section: 'reports' },
  { href: '/reports', label: 'Báo cáo', icon: BarChart3, section: 'reports' },
  { href: '/products', label: 'Sản phẩm', icon: ClipboardList, section: 'master' },
  { href: '/customers', label: 'Khách hàng', icon: Users, section: 'master' },
  { href: '/purchasing/suppliers', label: 'Nhà cung cấp', icon: Building2, section: 'master' },
  { href: '/delivery#transporters', label: 'Người vận chuyển', icon: Truck, section: 'master' },
  { href: '/notifications', label: 'Thông báo', icon: Bell, section: 'system' },
  { href: '/audit-log', label: 'Nhật ký', icon: ClipboardList, section: 'system' },
  { href: '/settings', label: 'Cài đặt', icon: Settings, section: 'system' },
];

// Bottom tab items for mobile
const mobileTabItems: NavItem[] = [
  { href: '/pos', label: 'Bán hàng', icon: ShoppingCart },
  { href: '/inventory', label: 'Tồn kho', icon: Package },
  { href: '/products', label: 'Tra giá', icon: ScanBarcode },
  { href: '/notifications', label: 'Thông báo', icon: Bell },
];

const sectionLabels: Record<string, string> = {
  sales: 'Bán hàng',
  warehouse: 'Kho hàng',
  logistics: 'Giao hàng & Trả hàng',
  debt: 'Công nợ',
  reports: 'Báo cáo',
  master: 'Danh mục chung',
  system: 'Hệ thống',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    router.push('/login');
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const currentPageLabel = navItems.find((item) => isActive(item.href))?.label || 'Tổng quan';

  // Group nav items by section
  const sections = ['sales', 'warehouse', 'logistics', 'debt', 'reports', 'master', 'system'];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* === Desktop Sidebar === */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-border z-30 transition-all duration-200',
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          {!sidebarCollapsed && (
            <Link href="/" className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">KM</span>
              </div>
              <span className="text-sm font-bold text-foreground truncate">Khánh Mai</span>
            </Link>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg hover:bg-muted transition-colors min-w-touch-sm min-h-touch-sm flex items-center justify-center cursor-pointer"
            aria-label={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform', sidebarCollapsed && 'rotate-180')} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Điều hướng chính">
          {sections.map((section) => {
            const sectionItems = navItems.filter((item) => item.section === section);
            if (sectionItems.length === 0) return null;
            return (
              <div key={section} className="mb-4">
                {!sidebarCollapsed && (
                  <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {sectionLabels[section]}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {sectionItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                            'min-h-touch-sm',
                            sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                            active
                              ? 'bg-accent text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                          aria-current={active ? 'page' : undefined}
                          title={sidebarCollapsed ? item.label : undefined}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          {!sidebarCollapsed && <span>{item.label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        {!sidebarCollapsed && (
          <div className="p-3 border-t border-border">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer min-h-touch-sm disabled:opacity-50"
            >
              <LogOut className="h-5 w-5" />
              <span>{isLoggingOut ? 'Đang xuất...' : 'Đăng xuất'}</span>
            </button>
          </div>
        )}
      </aside>

      {/* === Main Content Area === */}
      <div className={cn(
        'flex-1 flex flex-col min-h-screen transition-all duration-200',
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
      )}>
        {/* Desktop Top Header */}
        <header className="hidden lg:flex items-center justify-between h-16 px-6 bg-white border-b border-border sticky top-0 z-20">
          <h1 className="text-lg font-semibold text-foreground">{currentPageLabel}</h1>
          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>

        {/* Mobile Top Header */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-border sticky top-0 z-20">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-xs">KM</span>
            </div>
            <span className="text-sm font-bold text-foreground">Khánh Mai</span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg hover:bg-muted transition-colors min-w-touch min-h-touch flex items-center justify-center cursor-pointer"
              aria-label="Mở menu"
            >
              <Menu className="h-5 w-5 text-foreground" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* === Mobile Bottom Tab Bar === */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-border z-30 safe-area-bottom"
        aria-label="Điều hướng nhanh"
      >
        <ul className="flex items-center justify-around h-16">
          {mobileTabItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 min-h-touch transition-colors cursor-pointer',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
                  <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                </Link>
              </li>
            );
          })}
          {/* Menu tab */}
          <li className="flex-1">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 min-h-touch w-full transition-colors cursor-pointer',
                mobileMenuOpen ? 'text-primary' : 'text-muted-foreground'
              )}
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-tight">Menu</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* === Mobile Full Menu (Slide-up) === */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Menu Panel */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-250">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            {/* Close button */}
            <div className="flex items-center justify-between px-5 pb-3">
              <h2 className="text-lg font-semibold">Menu</h2>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-muted min-w-touch-sm min-h-touch-sm flex items-center justify-center cursor-pointer"
                aria-label="Đóng menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Nav items */}
            <nav className="px-3 pb-8">
              {sections.map((section) => {
                const sectionItems = navItems.filter((item) => item.section === section);
                if (sectionItems.length === 0) return null;
                return (
                  <div key={section} className="mb-4">
                    <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {sectionLabels[section]}
                    </p>
                    <ul className="space-y-0.5">
                      {sectionItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className={cn(
                                'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                                'min-h-touch',
                                active
                                  ? 'bg-accent text-primary'
                                  : 'text-foreground hover:bg-muted'
                              )}
                            >
                              <Icon className="h-5 w-5 flex-shrink-0" />
                              <span>{item.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              {/* Logout */}
              <div className="mt-4 pt-4 border-t border-border">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer min-h-touch disabled:opacity-50"
                >
                  <LogOut className="h-5 w-5" />
                  <span>{isLoggingOut ? 'Đang xuất...' : 'Đăng xuất'}</span>
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
