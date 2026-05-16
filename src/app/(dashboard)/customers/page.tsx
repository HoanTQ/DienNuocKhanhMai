'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { CustomerDetail } from '@/components/customers/CustomerDetail';
import type { Customer } from '@/lib/types';

/**
 * Trang Quản lý Khách hàng
 *
 * - Danh sách khách hàng với tìm kiếm theo tên/SĐT
 * - Form thêm/sửa khách hàng (chỉ Owner)
 * - Xem chi tiết: lịch sử mua hàng, công nợ
 * - Staff chỉ xem, không chỉnh sửa
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userRole, setUserRole] = useState<'owner' | 'staff'>('staff');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const supabase = useMemo(() => createClient(), []);

  /** Lấy role của user hiện tại */
  const fetchUserRole = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile) {
      setUserRole(profile.role as 'owner' | 'staff');
    }
  }, [supabase]);

  /** Fetch danh sách khách hàng */
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Lỗi tải danh sách khách hàng:', error.message);
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchUserRole();
    fetchCustomers();
  }, [fetchUserRole, fetchCustomers]);

  /** Tìm kiếm khách hàng theo tên hoặc SĐT */
  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.phone.toLowerCase().includes(query)
    );
  });

  /** Mở form thêm khách hàng mới */
  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setShowForm(true);
  };

  /** Mở form sửa khách hàng */
  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };

  /** Xử lý sau khi lưu form thành công */
  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingCustomer(null);
    fetchCustomers();
  };

  /** Đóng form */
  const handleFormClose = () => {
    setShowForm(false);
    setEditingCustomer(null);
  };

  /** Mở chi tiết khách hàng */
  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
  };

  /** Đóng chi tiết */
  const handleCloseDetail = () => {
    setSelectedCustomer(null);
  };

  /** Format giá tiền VND */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const isOwner = userRole === 'owner';
  const customersWithDebt = customers.filter((c) => c.current_debt > 0).length;
  const totalDebt = customers.reduce((sum, c) => sum + c.current_debt, 0);

  // Nếu đang xem chi tiết khách hàng
  if (selectedCustomer) {
    return (
      <CustomerDetail
        customer={selectedCustomer}
        userRole={userRole}
        onBack={handleCloseDetail}
        onEdit={isOwner ? () => handleEditCustomer(selectedCustomer) : undefined}
      />
    );
  }

  // Nếu đang hiển thị form thêm/sửa
  if (showForm) {
    return (
      <div className="p-4 md:p-6">
        <CustomerForm
          customer={editingCustomer}
          onSuccess={handleFormSuccess}
          onCancel={handleFormClose}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải danh sách khách hàng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Quản lý Khách hàng</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Thông tin khách hàng và lịch sử giao dịch
          </p>
        </div>
        {isOwner && (
          <Button onClick={handleAddCustomer} className="self-start md:self-auto">
            + Thêm khách hàng
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Tìm kiếm theo tên hoặc số điện thoại..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
            aria-label="Tìm kiếm khách hàng"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tổng khách hàng</p>
            <p className="text-xl md:text-2xl font-bold">{customers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Đang có nợ</p>
            <p className="text-xl md:text-2xl font-bold text-destructive">
              {customersWithDebt}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tổng công nợ</p>
            <p className="text-lg md:text-xl font-bold text-destructive">
              {formatPrice(totalDebt)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Đang hiển thị</p>
            <p className="text-xl md:text-2xl font-bold">{filteredCustomers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer List - Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Không tìm thấy khách hàng nào
            </CardContent>
          </Card>
        ) : (
          filteredCustomers.map((customer) => (
            <CustomerCardMobile
              key={customer.id}
              customer={customer}
              isOwner={isOwner}
              onView={() => handleViewCustomer(customer)}
              onEdit={() => handleEditCustomer(customer)}
              formatPrice={formatPrice}
            />
          ))
        )}
      </div>

      {/* Customer List - Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <CardHeader>
            <CardTitle>Danh sách khách hàng</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredCustomers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Không tìm thấy khách hàng nào
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Tên khách hàng</th>
                      <th className="text-left py-3 px-2 font-medium">SĐT</th>
                      <th className="text-left py-3 px-2 font-medium">Địa chỉ</th>
                      <th className="text-right py-3 px-2 font-medium">Tổng mua</th>
                      <th className="text-right py-3 px-2 font-medium">Số lần mua</th>
                      <th className="text-right py-3 px-2 font-medium">Công nợ</th>
                      <th className="text-center py-3 px-2 font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((customer) => (
                      <CustomerRowDesktop
                        key={customer.id}
                        customer={customer}
                        isOwner={isOwner}
                        onView={() => handleViewCustomer(customer)}
                        onEdit={() => handleEditCustomer(customer)}
                        formatPrice={formatPrice}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


// === Sub-components ===

interface CustomerItemProps {
  customer: Customer;
  isOwner: boolean;
  onView: () => void;
  onEdit: () => void;
  formatPrice: (price: number) => string;
}

/** Card hiển thị khách hàng trên mobile */
function CustomerCardMobile({ customer, isOwner, onView, onEdit, formatPrice }: CustomerItemProps) {
  return (
    <Card
      className={customer.current_debt > 0 ? 'border-destructive/30' : ''}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            className="flex-1 min-w-0 text-left"
            onClick={onView}
          >
            <h3 className="font-medium text-base truncate">{customer.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {customer.phone}
            </p>
            {customer.address && (
              <p className="text-xs text-muted-foreground truncate">
                {customer.address}
              </p>
            )}
          </button>
          {customer.current_debt > 0 && (
            <Badge variant="destructive" className="shrink-0 text-xs">
              Nợ
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <p className="text-xs text-muted-foreground">Tổng mua</p>
            <p className="text-sm font-semibold">{formatPrice(customer.total_purchased)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Số lần</p>
            <p className="text-sm font-semibold">{customer.purchase_count}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Công nợ</p>
            <p className={`text-sm font-semibold ${customer.current_debt > 0 ? 'text-destructive' : ''}`}>
              {customer.current_debt > 0 ? formatPrice(customer.current_debt) : '0'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-3 pt-3 border-t">
          <Button size="sm" variant="outline" onClick={onView} className="flex-1">
            Xem chi tiết
          </Button>
          {isOwner && (
            <Button size="sm" variant="ghost" onClick={onEdit}>
              Sửa
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Row hiển thị khách hàng trên desktop table */
function CustomerRowDesktop({ customer, isOwner, onView, onEdit, formatPrice }: CustomerItemProps) {
  return (
    <tr className={`border-b last:border-b-0 ${customer.current_debt > 0 ? 'bg-destructive/5' : ''}`}>
      <td className="py-3 px-2">
        <button type="button" onClick={onView} className="text-left hover:underline">
          <p className="font-medium">{customer.name}</p>
          {customer.notes && (
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {customer.notes}
            </p>
          )}
        </button>
      </td>
      <td className="py-3 px-2 text-sm">{customer.phone}</td>
      <td className="py-3 px-2 text-sm text-muted-foreground truncate max-w-[150px]">
        {customer.address || '—'}
      </td>
      <td className="py-3 px-2 text-right text-sm font-medium">
        {formatPrice(customer.total_purchased)}
      </td>
      <td className="py-3 px-2 text-right text-sm">
        {customer.purchase_count}
      </td>
      <td className="py-3 px-2 text-right">
        {customer.current_debt > 0 ? (
          <Badge variant="destructive" className="text-xs">
            {formatPrice(customer.current_debt)}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">0</span>
        )}
      </td>
      <td className="py-3 px-2 text-center">
        <div className="flex items-center justify-center gap-1">
          <Button size="sm" variant="ghost" onClick={onView} className="h-8 text-xs">
            Xem
          </Button>
          {isOwner && (
            <Button size="sm" variant="ghost" onClick={onEdit} className="h-8 text-xs">
              Sửa
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
