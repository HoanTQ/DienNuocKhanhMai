'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Supplier, SupplierDebt, SupplierPayment } from '@/lib/types';

/**
 * Trang Quản lý Công nợ Nhà cung cấp
 *
 * - Theo dõi trạng thái thanh toán (đã trả/chưa trả) cho từng hóa đơn nhập
 * - Hỗ trợ ghi nhận Nợ gối đầu: liên kết đơn cũ với đơn mới
 * - Ghi nhận lịch sử thanh toán cho từng NCC
 * - Báo cáo tổng hợp công nợ NCC
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4
 */

// === Types ===

interface SupplierDebtWithDetails extends SupplierDebt {
  supplier?: Supplier;
  goods_receipt?: { id: string; created_at: string };
  linked_receipt?: { id: string; created_at: string };
}

interface PaymentWithUser extends SupplierPayment {
  user?: { full_name: string };
}

type TabView = 'list' | 'payment-history' | 'summary';
type FilterStatus = 'all' | 'pending' | 'partial' | 'paid';

// === Utility Functions ===

/** Format giá tiền VND */
function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(price);
}

/** Format ngày tháng */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Format ngày giờ */
function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Lấy label trạng thái */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'Chưa trả';
    case 'partial': return 'Trả một phần';
    case 'paid': return 'Đã trả';
    default: return status;
  }
}

/** Lấy variant badge cho trạng thái */
function getStatusVariant(status: string): 'default' | 'warning' | 'destructive' | 'secondary' {
  switch (status) {
    case 'paid': return 'default';
    case 'partial': return 'warning';
    case 'pending': return 'destructive';
    default: return 'secondary';
  }
}


// === Main Component ===

export default function SupplierDebtsPage() {
  const [debts, setDebts] = useState<SupplierDebtWithDetails[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterSupplierId, setFilterSupplierId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<TabView>('list');

  // Payment form state
  const [payingDebt, setPayingDebt] = useState<SupplierDebtWithDetails | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Linked order (nợ gối đầu) state
  const [linkingDebt, setLinkingDebt] = useState<SupplierDebtWithDetails | null>(null);
  const [linkedReceiptId, setLinkedReceiptId] = useState('');
  const [availableReceipts, setAvailableReceipts] = useState<{ id: string; created_at: string; supplier_name: string }[]>([]);
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);

  // Payment history state
  const [selectedSupplierForHistory, setSelectedSupplierForHistory] = useState<string>('');
  const [paymentHistory, setPaymentHistory] = useState<PaymentWithUser[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  /** Fetch danh sách công nợ NCC */
  const fetchDebts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('supplier_debts')
      .select(`
        *,
        supplier:suppliers(*),
        goods_receipt:goods_receipts(id, created_at)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Lỗi tải danh sách công nợ NCC:', error.message);
    } else {
      setDebts((data || []) as SupplierDebtWithDetails[]);
    }
    setLoading(false);
  }, [supabase]);

  /** Fetch danh sách NCC */
  const fetchSuppliers = useCallback(async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Lỗi tải danh sách NCC:', error.message);
    } else {
      setSuppliers(data || []);
    }
  }, [supabase]);

  useEffect(() => {
    fetchDebts();
    fetchSuppliers();
  }, [fetchDebts, fetchSuppliers]);

  /** Lọc công nợ */
  const filteredDebts = useMemo(() => {
    return debts.filter((debt) => {
      // Filter by search (supplier name)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const supplierName = debt.supplier?.name?.toLowerCase() || '';
        if (!supplierName.includes(query)) return false;
      }
      // Filter by status
      if (filterStatus !== 'all' && debt.status !== filterStatus) return false;
      // Filter by supplier
      if (filterSupplierId !== 'all' && debt.supplier_id !== filterSupplierId) return false;
      return true;
    });
  }, [debts, searchQuery, filterStatus, filterSupplierId]);

  /** Tính toán thống kê tổng hợp */
  const summaryStats = useMemo(() => {
    const totalDebt = debts.reduce((sum, d) => sum + d.remaining, 0);
    const totalAmount = debts.reduce((sum, d) => sum + d.amount, 0);
    const totalPaid = debts.reduce((sum, d) => sum + d.paid_amount, 0);
    const pendingDebts = debts.filter((d) => d.status === 'pending');
    const partialDebts = debts.filter((d) => d.status === 'partial');
    const paidDebts = debts.filter((d) => d.status === 'paid');
    const linkedDebts = debts.filter((d) => d.linked_order_id);

    // Group by supplier
    const bySupplier = new Map<string, { name: string; total: number; remaining: number; count: number }>();
    debts.forEach((d) => {
      const key = d.supplier_id;
      const existing = bySupplier.get(key);
      if (existing) {
        existing.total += d.amount;
        existing.remaining += d.remaining;
        existing.count += 1;
      } else {
        bySupplier.set(key, {
          name: d.supplier?.name || 'NCC không xác định',
          total: d.amount,
          remaining: d.remaining,
          count: 1,
        });
      }
    });

    return {
      totalAmount,
      totalPaid,
      totalDebt,
      totalRecords: debts.length,
      pending: { count: pendingDebts.length, total: pendingDebts.reduce((s, d) => s + d.remaining, 0) },
      partial: { count: partialDebts.length, total: partialDebts.reduce((s, d) => s + d.remaining, 0) },
      paid: { count: paidDebts.length, total: paidDebts.reduce((s, d) => s + d.amount, 0) },
      linked: { count: linkedDebts.length },
      bySupplier: Array.from(bySupplier.values()).sort((a, b) => b.remaining - a.remaining),
    };
  }, [debts]);


  /** Xử lý thanh toán công nợ NCC */
  const handleSubmitPayment = useCallback(async () => {
    if (!payingDebt || paymentAmount <= 0) return;
    if (paymentAmount > payingDebt.remaining) return;

    setIsSubmittingPayment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      // Insert payment record
      const { error } = await supabase
        .from('supplier_payments')
        .insert({
          supplier_debt_id: payingDebt.id,
          amount: paymentAmount,
          payment_method: paymentMethod,
          notes: paymentNotes || null,
          created_by: user.id,
        });

      if (error) throw error;

      // Update debt record
      const newPaidAmount = payingDebt.paid_amount + paymentAmount;
      const newRemaining = payingDebt.amount - newPaidAmount;
      const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

      const { error: updateError } = await supabase
        .from('supplier_debts')
        .update({
          paid_amount: newPaidAmount,
          remaining: newRemaining,
          status: newStatus,
        })
        .eq('id', payingDebt.id);

      if (updateError) throw updateError;

      // Reset and refresh
      setPayingDebt(null);
      setPaymentAmount(0);
      setPaymentNotes('');
      await fetchDebts();
    } catch (err) {
      console.error('Lỗi thanh toán:', err);
      alert('Có lỗi xảy ra khi thanh toán. Vui lòng thử lại.');
    } finally {
      setIsSubmittingPayment(false);
    }
  }, [payingDebt, paymentAmount, paymentMethod, paymentNotes, supabase, fetchDebts]);

  /** Mở form liên kết nợ gối đầu */
  const openLinkForm = useCallback(async (debt: SupplierDebtWithDetails) => {
    setLinkingDebt(debt);
    setLinkedReceiptId('');

    // Fetch available receipts from same supplier (excluding current one)
    const { data, error } = await supabase
      .from('goods_receipts')
      .select('id, created_at, supplier:suppliers(name)')
      .eq('supplier_id', debt.supplier_id)
      .neq('id', debt.goods_receipt_id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setAvailableReceipts(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.map((r: any) => ({
          id: r.id,
          created_at: r.created_at,
          supplier_name: Array.isArray(r.supplier) ? r.supplier[0]?.name || '' : r.supplier?.name || '',
        }))
      );
    }
  }, [supabase]);

  /** Xử lý liên kết nợ gối đầu */
  const handleSubmitLink = useCallback(async () => {
    if (!linkingDebt || !linkedReceiptId) return;

    setIsSubmittingLink(true);
    try {
      const { error } = await supabase
        .from('supplier_debts')
        .update({ linked_order_id: linkedReceiptId })
        .eq('id', linkingDebt.id);

      if (error) throw error;

      setLinkingDebt(null);
      setLinkedReceiptId('');
      await fetchDebts();
    } catch (err) {
      console.error('Lỗi liên kết:', err);
      alert('Có lỗi xảy ra khi liên kết đơn hàng. Vui lòng thử lại.');
    } finally {
      setIsSubmittingLink(false);
    }
  }, [linkingDebt, linkedReceiptId, supabase, fetchDebts]);

  /** Fetch lịch sử thanh toán cho NCC */
  const fetchPaymentHistory = useCallback(async (supplierId: string) => {
    setLoadingHistory(true);
    setSelectedSupplierForHistory(supplierId);

    const { data, error } = await supabase
      .from('supplier_payments')
      .select(`
        *,
        supplier_debt:supplier_debts!inner(supplier_id),
        user:users(full_name)
      `)
      .eq('supplier_debt.supplier_id', supplierId)
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback: fetch all payments and filter client-side
      const debtIds = debts
        .filter((d) => d.supplier_id === supplierId)
        .map((d) => d.id);

      if (debtIds.length > 0) {
        const { data: fallbackData } = await supabase
          .from('supplier_payments')
          .select('*, user:users(full_name)')
          .in('supplier_debt_id', debtIds)
          .order('created_at', { ascending: false });

        setPaymentHistory((fallbackData || []) as PaymentWithUser[]);
      } else {
        setPaymentHistory([]);
      }
    } else {
      setPaymentHistory((data || []) as PaymentWithUser[]);
    }
    setLoadingHistory(false);
  }, [supabase, debts]);

  /** Mở form thanh toán */
  const openPaymentForm = (debt: SupplierDebtWithDetails) => {
    setPayingDebt(debt);
    setPaymentAmount(debt.remaining);
    setPaymentMethod('cash');
    setPaymentNotes('');
  };


  // === Loading state ===
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải danh sách công nợ NCC...</p>
        </div>
      </div>
    );
  }

  // === Payment form overlay ===
  if (payingDebt) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setPayingDebt(null)}>
            ← Quay lại
          </Button>
          <h1 className="text-xl font-bold">Thanh toán công nợ NCC</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thông tin công nợ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Nhà cung cấp</span>
              <span className="text-sm font-medium">{payingDebt.supplier?.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Phiếu nhập</span>
              <span className="text-sm">{payingDebt.goods_receipt_id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tổng nợ ban đầu</span>
              <span className="text-sm">{formatPrice(payingDebt.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Đã thanh toán</span>
              <span className="text-sm text-green-600">{formatPrice(payingDebt.paid_amount)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-sm font-medium">Còn lại</span>
              <span className="text-base font-bold text-destructive">
                {formatPrice(payingDebt.remaining)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Ngày tạo</span>
              <span className="text-sm">{formatDate(payingDebt.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Trạng thái</span>
              <Badge variant={getStatusVariant(payingDebt.status)}>
                {getStatusLabel(payingDebt.status)}
              </Badge>
            </div>
            {payingDebt.linked_order_id && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Nợ gối đầu</span>
                <Badge variant="secondary">Đã liên kết</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thanh toán</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="payment-amount" className="text-sm">Số tiền thanh toán</Label>
              <Input
                id="payment-amount"
                type="number"
                min={1}
                max={payingDebt.remaining}
                value={paymentAmount || ''}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                className="mt-1"
                placeholder="Nhập số tiền..."
              />
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentAmount(payingDebt.remaining)}
                >
                  Toàn bộ ({formatPrice(payingDebt.remaining)})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentAmount(Math.round(payingDebt.remaining / 2))}
                >
                  50%
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-sm">Hình thức</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPaymentMethod('cash')}
                  className="flex-1"
                >
                  💵 Tiền mặt
                </Button>
                <Button
                  variant={paymentMethod === 'transfer' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPaymentMethod('transfer')}
                  className="flex-1"
                >
                  🏦 Chuyển khoản
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="payment-notes" className="text-sm">Ghi chú (tùy chọn)</Label>
              <Input
                id="payment-notes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="mt-1"
                placeholder="Ghi chú thanh toán..."
              />
            </div>

            <Button
              size="lg"
              className="w-full h-12"
              onClick={handleSubmitPayment}
              disabled={
                isSubmittingPayment ||
                paymentAmount <= 0 ||
                paymentAmount > payingDebt.remaining
              }
            >
              {isSubmittingPayment
                ? 'Đang xử lý...'
                : `Xác nhận thanh toán ${formatPrice(paymentAmount)}`}
            </Button>
            {paymentAmount > 0 && paymentAmount < payingDebt.remaining && (
              <p className="text-xs text-muted-foreground text-center">
                Sau thanh toán, còn lại: {formatPrice(payingDebt.remaining - paymentAmount)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }


  // === Link form overlay (Nợ gối đầu) ===
  if (linkingDebt) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLinkingDebt(null)}>
            ← Quay lại
          </Button>
          <h1 className="text-xl font-bold">Liên kết Nợ gối đầu</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thông tin nợ hiện tại</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Nhà cung cấp</span>
              <span className="text-sm font-medium">{linkingDebt.supplier?.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Phiếu nhập</span>
              <span className="text-sm">{linkingDebt.goods_receipt_id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Số tiền nợ</span>
              <span className="text-sm font-bold text-destructive">{formatPrice(linkingDebt.remaining)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chọn đơn hàng mới để liên kết</CardTitle>
            <p className="text-xs text-muted-foreground">
              Nợ gối đầu: bán hết đơn cũ → nhập đơn mới → trả tiền đơn cũ
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableReceipts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Không có phiếu nhập khác từ NCC này
              </p>
            ) : (
              <>
                <div>
                  <Label htmlFor="linked-receipt" className="text-sm">Phiếu nhập liên kết</Label>
                  <select
                    id="linked-receipt"
                    value={linkedReceiptId}
                    onChange={(e) => setLinkedReceiptId(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="">-- Chọn phiếu nhập --</option>
                    {availableReceipts.map((r) => (
                      <option key={r.id} value={r.id}>
                        Phiếu {r.id.slice(0, 8)}... - {formatDate(r.created_at)}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  size="lg"
                  className="w-full h-12"
                  onClick={handleSubmitLink}
                  disabled={isSubmittingLink || !linkedReceiptId}
                >
                  {isSubmittingLink ? 'Đang liên kết...' : 'Xác nhận liên kết nợ gối đầu'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }


  // === Main page render ===
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Công nợ Nhà cung cấp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Theo dõi thanh toán và nợ gối đầu cho từng NCC
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg">
        <button
          type="button"
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'list' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('list')}
        >
          Danh sách nợ
        </button>
        <button
          type="button"
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'payment-history' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('payment-history')}
        >
          Lịch sử TT
        </button>
        <button
          type="button"
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'summary' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('summary')}
        >
          Tổng hợp
        </button>
      </div>

      {/* Summary Cards (always visible) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tổng nợ còn lại</p>
            <p className="text-lg md:text-xl font-bold text-destructive">
              {formatPrice(summaryStats.totalDebt)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summaryStats.totalRecords} hóa đơn
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Chưa trả</p>
            <p className="text-lg md:text-xl font-bold text-destructive">
              {formatPrice(summaryStats.pending.total)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summaryStats.pending.count} hóa đơn
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Trả một phần</p>
            <p className="text-lg md:text-xl font-bold text-yellow-600">
              {formatPrice(summaryStats.partial.total)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summaryStats.partial.count} hóa đơn
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Đã trả đủ</p>
            <p className="text-lg md:text-xl font-bold text-green-600">
              {formatPrice(summaryStats.paid.total)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summaryStats.paid.count} hóa đơn
            </p>
          </CardContent>
        </Card>
      </div>


      {/* Tab: Danh sách nợ */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Search & Filter */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Input
                placeholder="Tìm theo tên nhà cung cấp..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
                aria-label="Tìm kiếm công nợ NCC"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['all', 'pending', 'partial', 'paid'] as const).map((status) => (
                <Button
                  key={status}
                  variant={filterStatus === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus(status)}
                  className="text-xs"
                >
                  {status === 'all' ? 'Tất cả' : getStatusLabel(status)}
                </Button>
              ))}
            </div>
          </div>

          {/* Supplier filter */}
          {suppliers.length > 0 && (
            <div>
              <select
                value={filterSupplierId}
                onChange={(e) => setFilterSupplierId(e.target.value)}
                className="w-full sm:w-auto h-9 px-3 rounded-md border border-input bg-background text-sm"
                aria-label="Lọc theo nhà cung cấp"
              >
                <option value="all">Tất cả NCC</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Debt List - Mobile Cards */}
          <div className="block md:hidden space-y-3">
            {filteredDebts.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  Không tìm thấy khoản nợ nào
                </CardContent>
              </Card>
            ) : (
              filteredDebts.map((debt) => (
                <SupplierDebtCardMobile
                  key={debt.id}
                  debt={debt}
                  onPay={() => openPaymentForm(debt)}
                  onLink={() => openLinkForm(debt)}
                />
              ))
            )}
          </div>

          {/* Debt List - Desktop Table */}
          <div className="hidden md:block">
            <Card>
              <CardHeader>
                <CardTitle>Danh sách công nợ NCC ({filteredDebts.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredDebts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Không tìm thấy khoản nợ nào
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" role="table">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">Nhà cung cấp</th>
                          <th className="text-left py-3 px-2 font-medium">Phiếu nhập</th>
                          <th className="text-right py-3 px-2 font-medium">Tổng nợ</th>
                          <th className="text-right py-3 px-2 font-medium">Đã trả</th>
                          <th className="text-right py-3 px-2 font-medium">Còn lại</th>
                          <th className="text-center py-3 px-2 font-medium">Trạng thái</th>
                          <th className="text-center py-3 px-2 font-medium">Gối đầu</th>
                          <th className="text-center py-3 px-2 font-medium">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDebts.map((debt) => (
                          <tr key={debt.id} className="border-b last:border-b-0 hover:bg-muted/50">
                            <td className="py-3 px-2 font-medium">
                              {debt.supplier?.name || '—'}
                            </td>
                            <td className="py-3 px-2 text-muted-foreground text-xs">
                              {debt.goods_receipt_id.slice(0, 8)}...
                              <br />
                              <span className="text-xs">{formatDate(debt.created_at)}</span>
                            </td>
                            <td className="py-3 px-2 text-right">{formatPrice(debt.amount)}</td>
                            <td className="py-3 px-2 text-right text-green-600">
                              {formatPrice(debt.paid_amount)}
                            </td>
                            <td className="py-3 px-2 text-right font-semibold text-destructive">
                              {formatPrice(debt.remaining)}
                            </td>
                            <td className="py-3 px-2 text-center">
                              <Badge variant={getStatusVariant(debt.status)} className="text-xs">
                                {getStatusLabel(debt.status)}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-center">
                              {debt.linked_order_id ? (
                                <Badge variant="secondary" className="text-xs">Có</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-3 px-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {debt.status !== 'paid' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    onClick={() => openPaymentForm(debt)}
                                  >
                                    Thanh toán
                                  </Button>
                                )}
                                {!debt.linked_order_id && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    onClick={() => openLinkForm(debt)}
                                  >
                                    Liên kết
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}


      {/* Tab: Lịch sử thanh toán */}
      {activeTab === 'payment-history' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lịch sử thanh toán theo NCC</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="history-supplier" className="text-sm">Chọn nhà cung cấp</Label>
                <select
                  id="history-supplier"
                  value={selectedSupplierForHistory}
                  onChange={(e) => {
                    if (e.target.value) {
                      fetchPaymentHistory(e.target.value);
                    } else {
                      setSelectedSupplierForHistory('');
                      setPaymentHistory([]);
                    }
                  }}
                  className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">-- Chọn NCC để xem lịch sử --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {loadingHistory && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              )}

              {!loadingHistory && selectedSupplierForHistory && paymentHistory.length === 0 && (
                <p className="text-center text-muted-foreground py-6">
                  Chưa có lịch sử thanh toán cho NCC này
                </p>
              )}

              {!loadingHistory && paymentHistory.length > 0 && (
                <div className="space-y-3">
                  {/* Summary for this supplier */}
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Tổng đã thanh toán</span>
                      <span className="text-lg font-bold text-green-600">
                        {formatPrice(paymentHistory.reduce((sum, p) => sum + p.amount, 0))}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {paymentHistory.length} lần thanh toán
                    </p>
                  </div>

                  {/* Payment list */}
                  {paymentHistory.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-600">
                          +{formatPrice(payment.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(payment.created_at)}
                          {payment.user?.full_name && ` • ${payment.user.full_name}`}
                        </p>
                        {payment.notes && (
                          <p className="text-xs text-muted-foreground italic mt-0.5">
                            {payment.notes}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {payment.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}


      {/* Tab: Báo cáo tổng hợp */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Báo cáo tổng hợp công nợ NCC</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Tổng quan */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Tổng giá trị hóa đơn</span>
                    <span className="text-lg font-bold">
                      {formatPrice(summaryStats.totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Đã thanh toán</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatPrice(summaryStats.totalPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-sm font-medium">Còn nợ</span>
                    <span className="text-xl font-bold text-destructive">
                      {formatPrice(summaryStats.totalDebt)}
                    </span>
                  </div>
                  {summaryStats.totalAmount > 0 && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${(summaryStats.totalPaid / summaryStats.totalAmount) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground text-center">
                    Đã thanh toán {summaryStats.totalAmount > 0
                      ? Math.round((summaryStats.totalPaid / summaryStats.totalAmount) * 100)
                      : 0}%
                  </p>
                </div>

                {/* Phân loại theo trạng thái */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Phân loại theo trạng thái</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs">Chưa trả</Badge>
                      </div>
                      <p className="text-lg font-bold mt-2">{summaryStats.pending.count}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(summaryStats.pending.total)}
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge variant="warning" className="text-xs">Trả một phần</Badge>
                      </div>
                      <p className="text-lg font-bold mt-2">{summaryStats.partial.count}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(summaryStats.partial.total)}
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-xs">Đã trả đủ</Badge>
                      </div>
                      <p className="text-lg font-bold mt-2">{summaryStats.paid.count}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(summaryStats.paid.total)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Nợ gối đầu */}
                <div className="p-3 border rounded-lg">
                  <h4 className="text-sm font-medium">Nợ gối đầu</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Số hóa đơn đã liên kết nợ gối đầu
                  </p>
                  <p className="text-lg font-bold mt-2">{summaryStats.linked.count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Công nợ theo NCC */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Công nợ theo Nhà cung cấp</CardTitle>
            </CardHeader>
            <CardContent>
              {summaryStats.bySupplier.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">
                  Chưa có dữ liệu công nợ
                </p>
              ) : (
                <div className="space-y-3">
                  {summaryStats.bySupplier.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.count} hóa đơn · Tổng: {formatPrice(item.total)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-destructive">
                          {formatPrice(item.remaining)}
                        </p>
                        <p className="text-xs text-muted-foreground">còn nợ</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


// === Sub-components ===

interface SupplierDebtCardMobileProps {
  debt: SupplierDebtWithDetails;
  onPay: () => void;
  onLink: () => void;
}

/** Card hiển thị công nợ NCC trên mobile */
function SupplierDebtCardMobile({ debt, onPay, onLink }: SupplierDebtCardMobileProps) {
  return (
    <Card className={debt.status === 'pending' ? 'border-destructive/30' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-base truncate">
              {debt.supplier?.name || 'NCC không xác định'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Phiếu: {debt.goods_receipt_id.slice(0, 8)}... · {formatDate(debt.created_at)}
            </p>
          </div>
          <Badge variant={getStatusVariant(debt.status)} className="shrink-0 text-xs">
            {getStatusLabel(debt.status)}
          </Badge>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Tổng nợ</p>
            <p className="text-sm font-medium">{formatPrice(debt.amount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Đã trả</p>
            <p className="text-sm font-medium text-green-600">{formatPrice(debt.paid_amount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Còn lại</p>
            <p className="text-sm font-bold text-destructive">{formatPrice(debt.remaining)}</p>
          </div>
        </div>

        {debt.linked_order_id && (
          <div className="mt-2">
            <Badge variant="secondary" className="text-xs">
              🔗 Nợ gối đầu
            </Badge>
          </div>
        )}

        <div className="flex gap-2 mt-3 pt-3 border-t">
          {debt.status !== 'paid' && (
            <Button size="sm" onClick={onPay} className="flex-1">
              Thanh toán
            </Button>
          )}
          {!debt.linked_order_id && (
            <Button size="sm" variant="outline" onClick={onLink} className="flex-1">
              Liên kết gối đầu
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
