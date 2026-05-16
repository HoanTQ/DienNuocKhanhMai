'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Customer, DebtRecord } from '@/lib/types';

interface CustomerDetailProps {
  customer: Customer;
  userRole: 'owner' | 'staff';
  onBack: () => void;
  onEdit?: () => void;
}

interface OrderSummary {
  id: string;
  order_number: string;
  total: number;
  payment_method: string;
  is_credit: boolean;
  created_at: string;
  status: string;
}

/**
 * Chi tiết khách hàng: thông tin, lịch sử mua hàng, công nợ hiện tại.
 *
 * Validates: Requirements 9.2, 9.5
 */
export function CustomerDetail({ customer, userRole, onBack, onEdit }: CustomerDetailProps) {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingDebts, setLoadingDebts] = useState(true);

  const supabase = useMemo(() => createClient(), []);
  const isOwner = userRole === 'owner';

  /** Fetch lịch sử đơn hàng của khách */
  useEffect(() => {
    async function fetchOrders() {
      setLoadingOrders(true);
      const { data, error } = await supabase
        .from('sales_orders')
        .select('id, order_number, total, payment_method, is_credit, created_at, status')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setOrders(data);
      }
      setLoadingOrders(false);
    }

    fetchOrders();
  }, [customer.id, supabase]);

  /** Fetch công nợ hiện tại */
  useEffect(() => {
    async function fetchDebts() {
      setLoadingDebts(true);
      const { data, error } = await supabase
        .from('debt_records')
        .select('*')
        .eq('customer_id', customer.id)
        .in('status', ['pending', 'partial'])
        .order('created_at', { ascending: false });

      if (!error && data) {
        setDebts(data);
      }
      setLoadingDebts(false);
    }

    fetchDebts();
  }, [customer.id, supabase]);

  /** Format giá tiền VND */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  };

  /** Format ngày */
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Quay lại">
          ← Quay lại
        </Button>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold">{customer.name}</h1>
        </div>
        {isOwner && onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            Sửa
          </Button>
        )}
      </div>

      {/* Customer Info Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Thông tin khách hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Số điện thoại</p>
              <p className="text-sm font-medium">{customer.phone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Địa chỉ</p>
              <p className="text-sm font-medium">{customer.address || '—'}</p>
            </div>
            {customer.notes && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Ghi chú</p>
                <p className="text-sm">{customer.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 md:p-4 text-center">
            <p className="text-xs text-muted-foreground">Tổng giá trị mua</p>
            <p className="text-lg font-bold text-primary">
              {formatPrice(customer.total_purchased)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4 text-center">
            <p className="text-xs text-muted-foreground">Số lần mua</p>
            <p className="text-lg font-bold">{customer.purchase_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4 text-center">
            <p className="text-xs text-muted-foreground">Công nợ hiện tại</p>
            <p className={`text-lg font-bold ${customer.current_debt > 0 ? 'text-destructive' : ''}`}>
              {formatPrice(customer.current_debt)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Debt Status Section */}
      {customer.current_debt > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive">
              Công nợ chưa thanh toán
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDebts ? (
              <p className="text-sm text-muted-foreground">Đang tải...</p>
            ) : debts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Không có công nợ</p>
            ) : (
              <div className="space-y-2">
                {debts.map((debt) => (
                  <div
                    key={debt.id}
                    className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        Còn nợ: {formatPrice(debt.remaining)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tổng: {formatPrice(debt.amount)} · Đã trả: {formatPrice(debt.paid_amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ngày tạo: {formatDate(debt.created_at)}
                      </p>
                    </div>
                    <Badge
                      variant={debt.status === 'partial' ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {debt.status === 'partial' ? 'Trả một phần' : 'Chưa trả'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Purchase History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lịch sử mua hàng</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingOrders ? (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Chưa có đơn hàng nào
            </p>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{order.order_number}</p>
                      {order.is_credit && (
                        <Badge variant="destructive" className="text-xs">
                          Nợ
                        </Badge>
                      )}
                      {order.status === 'returned_partial' && (
                        <Badge variant="secondary" className="text-xs">
                          Trả một phần
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(order.created_at)} ·{' '}
                      {order.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                    </p>
                  </div>
                  <p className="text-sm font-semibold shrink-0 ml-2">
                    {formatPrice(order.total)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
