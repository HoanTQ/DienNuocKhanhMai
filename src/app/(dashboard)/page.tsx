'use client';

import Link from 'next/link';
import {
  ShoppingCart,
  Search,
  Package,
  Users,
  CreditCard,
  BarChart3,
  Truck,
  ClipboardList,
  RotateCcw,
  Bell,
  ScanBarcode,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Dashboard Home Page - Trang chủ với quick actions
 *
 * Thiết kế tối ưu luồng thao tác:
 * - Quick actions lớn cho các chức năng thường dùng nhất (tạo đơn, tra giá)
 * - Nút bấm tối thiểu 44px touch target
 * - Tối thiểu số bước nhấn để truy cập chức năng
 *
 * Validates: Requirements 22.1, 5.3, 5.4
 */

interface QuickAction {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  priority: 'high' | 'normal';
}

const quickActions: QuickAction[] = [
  {
    href: '/pos',
    label: 'Bán hàng',
    description: 'Tạo đơn bán hàng nhanh',
    icon: ShoppingCart,
    color: 'bg-blue-500',
    priority: 'high',
  },
  {
    href: '/products/pricing',
    label: 'Tra giá',
    description: 'Quét mã vạch hoặc tìm kiếm',
    icon: ScanBarcode,
    color: 'bg-green-500',
    priority: 'high',
  },
  {
    href: '/inventory',
    label: 'Tồn kho',
    description: 'Xem tồn kho realtime',
    icon: Package,
    color: 'bg-orange-500',
    priority: 'normal',
  },
  {
    href: '/customers',
    label: 'Khách hàng',
    description: 'Tra cứu khách hàng',
    icon: Users,
    color: 'bg-purple-500',
    priority: 'normal',
  },
  {
    href: '/debts',
    label: 'Công nợ',
    description: 'Theo dõi công nợ',
    icon: CreditCard,
    color: 'bg-red-500',
    priority: 'normal',
  },
  {
    href: '/products',
    label: 'Sản phẩm',
    description: 'Quản lý danh mục',
    icon: ClipboardList,
    color: 'bg-indigo-500',
    priority: 'normal',
  },
  {
    href: '/purchasing/receipts/new',
    label: 'Nhập kho',
    description: 'Tạo phiếu nhập kho',
    icon: Truck,
    color: 'bg-teal-500',
    priority: 'normal',
  },
  {
    href: '/returns',
    label: 'Trả hàng',
    description: 'Xử lý trả/đổi hàng',
    icon: RotateCcw,
    color: 'bg-amber-500',
    priority: 'normal',
  },
  {
    href: '/reports',
    label: 'Báo cáo',
    description: 'Doanh thu, lợi nhuận',
    icon: BarChart3,
    color: 'bg-cyan-500',
    priority: 'normal',
  },
  {
    href: '/notifications',
    label: 'Thông báo',
    description: 'Cảnh báo & thông báo',
    icon: Bell,
    color: 'bg-pink-500',
    priority: 'normal',
  },
];

const highPriorityActions = quickActions.filter((a) => a.priority === 'high');
const normalActions = quickActions.filter((a) => a.priority === 'normal');

export default function DashboardPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">
          Xin chào! 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Chọn chức năng bên dưới để bắt đầu
        </p>
      </div>

      {/* Primary Quick Actions - Large touch targets for most common tasks */}
      <section aria-label="Thao tác nhanh">
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {highPriorityActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="block focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-xl"
              >
                <Card className="h-full hover:shadow-md transition-shadow border-2 hover:border-primary/30">
                  <CardContent className="flex flex-col items-center justify-center p-6 md:p-8 min-h-[120px] md:min-h-[140px]">
                    <div
                      className={`${action.color} p-3 rounded-xl text-white mb-3`}
                    >
                      <Icon className="h-7 w-7 md:h-8 md:w-8" />
                    </div>
                    <span className="text-base md:text-lg font-semibold text-center">
                      {action.label}
                    </span>
                    <span className="text-xs text-muted-foreground text-center mt-1">
                      {action.description}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Secondary Quick Actions */}
      <section aria-label="Chức năng khác">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Chức năng khác</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-3">
              {normalActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex flex-col items-center gap-2 p-3 md:p-4 rounded-lg hover:bg-accent transition-colors min-h-[80px] justify-center focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <div
                      className={`${action.color} p-2 rounded-lg text-white`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs md:text-sm font-medium text-center leading-tight">
                      {action.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Quick Tips */}
      <section aria-label="Mẹo sử dụng">
        <Card className="bg-blue-50/50 border-blue-100">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Search className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900">Mẹo nhanh</p>
                <p className="text-xs text-blue-700 mt-1">
                  Từ trang Bán hàng, bạn có thể quét mã vạch hoặc gõ tên sản phẩm để thêm vào đơn ngay lập tức — chỉ cần 2 bước để tạo đơn!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
