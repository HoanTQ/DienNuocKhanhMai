'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Customer, DebtRecord } from '@/lib/types';

/**
 * Trang Quản lý Công nợ Khách hàng
 *
 * - Danh sách công nợ với phân loại tuổi nợ (ngắn hạn, trung hạn, dài hạn, nợ lớn)
 * - Thanh toán một phần hoặc toàn bộ
 * - Báo cáo tổng hợp công nợ
 * - Nhập liệu nhanh công nợ cuối ngày
 * - Tìm kiếm/lọc theo khách hàng
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */

// === Types ===

interface DebtWithCustomer extends DebtRecord {
  customer?: Customer;
}

type DebtAgeCategory = 'short-term' | 'medium-term' | 'long-term' | 'large';
type TabView = 'list' | 'quick-entry' | 'summary';

// === Constants ===

const LARGE_DEBT_THRESHOLD = 5_000_000; // 5 triệu VND

// === Utility Functions ===


/** Tính số ngày nợ từ ngày tạo */
function getDaysOutstanding(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/** Phân loại tuổi nợ theo yêu cầu */
function classifyDebtAge(debt: DebtRecord): DebtAgeCategory {
  // Nợ lớn: theo giá trị, bất kể tuổi nợ
  if (debt.remaining >= LARGE_DEBT_THRESHOLD) {
    return 'large';
  }
  const days = getDaysOutstanding(debt.created_at);
  if (days <= 3) return 'short-term';
  if (days <= 5) return 'medium-term';
  return 'long-term';
}

/** Lấy label tiếng Việt cho tuổi nợ */
function getAgeCategoryLabel(category: DebtAgeCategory): string {
  switch (category) {
    case 'short-term': return 'Ngắn hạn';
    case 'medium-term': return 'Trung hạn';
    case 'long-term': return 'Dài hạn';
    case 'large': return 'Nợ lớn';
  }
}

/** Lấy variant badge cho tuổi nợ */
function getAgeCategoryVariant(category: DebtAgeCategory): 'default' | 'warning' | 'destructive' | 'secondary' {
  switch (category) {
    case 'short-term': return 'secondary';
    case 'medium-term': return 'warning';
    case 'long-term': return 'destructive';
    case 'large': return 'destructive';
  }
}

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


// === Main Component ===

export default function DebtsPage() {
  const [debts, setDebts] = useState<DebtWithCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<DebtAgeCategory | 'all'>('all');
  const [activeTab, setActiveTab] = useState<TabView>('list');

  // Payment modal state
  const [payingDebt, setPayingDebt] = useState<DebtWithCustomer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Quick entry state
  const [quickCustomerId, setQuickCustomerId] = useState('');
  const [quickAmount, setQuickAmount] = useState<number>(0);
  const [quickNotes, setQuickNotes] = useState('');
  const [isSubmittingQuickEntry, setIsSubmittingQuickEntry] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  /** Fetch danh sách công nợ chưa thanh toán hết */
  const fetchDebts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('debt_records')
      .select(`
        *,
        customer:customers(*)
      `)
      .in('status', ['pending', 'partial'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Lỗi tải danh sách công nợ:', error.message);
    } else {
      setDebts((data || []) as DebtWithCustomer[]);
    }
    setLoading(false);
  }, [supabase]);

  /** Fetch danh sách khách hàng (cho quick entry) */
  const fetchCustomers = useCallback(async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Lỗi tải danh sách khách hàng:', error.message);
    } else {
      setCustomers(data || []);
    }
  }, [supabase]);

  useEffect(() => {
    fetchDebts();
    fetchCustomers();
  }, [fetchDebts, fetchCustomers]);


  /** Lọc công nợ theo tìm kiếm và phân loại */
  const filteredDebts = useMemo(() => {
    return debts.filter((debt) => {
      // Filter by search query (customer name or phone)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const customerName = debt.customer?.name?.toLowerCase() || '';
        const customerPhone = debt.customer?.phone?.toLowerCase() || '';
        if (!customerName.includes(query) && !customerPhone.includes(query)) {
          return false;
        }
      }
      // Filter by age category
      if (filterCategory !== 'all') {
        if (classifyDebtAge(debt) !== filterCategory) {
          return false;
        }
      }
      return true;
    });
  }, [debts, searchQuery, filterCategory]);

  /** Tính toán thống kê tổng hợp */
  const summaryStats = useMemo(() => {
    const totalDebt = debts.reduce((sum, d) => sum + d.remaining, 0);
    const shortTerm = debts.filter((d) => classifyDebtAge(d) === 'short-term');
    const mediumTerm = debts.filter((d) => classifyDebtAge(d) === 'medium-term');
    const longTerm = debts.filter((d) => classifyDebtAge(d) === 'long-term');
    const large = debts.filter((d) => classifyDebtAge(d) === 'large');

    return {
      totalDebt,
      totalRecords: debts.length,
      shortTerm: {
        count: shortTerm.length,
        total: shortTerm.reduce((sum, d) => sum + d.remaining, 0),
      },
      mediumTerm: {
        count: mediumTerm.length,
        total: mediumTerm.reduce((sum, d) => sum + d.remaining, 0),
      },
      longTerm: {
        count: longTerm.length,
        total: longTerm.reduce((sum, d) => sum + d.remaining, 0),
      },
      large: {
        count: large.length,
        total: large.reduce((sum, d) => sum + d.remaining, 0),
      },
    };
  }, [debts]);

  /** Xử lý thanh toán công nợ */
  const handleSubmitPayment = useCallback(async () => {
    if (!payingDebt || paymentAmount <= 0) return;
    if (paymentAmount > payingDebt.remaining) return;

    setIsSubmittingPayment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      // Insert payment record (database trigger will update debt balance)
      const { error } = await supabase
        .from('debt_payments')
        .insert({
          debt_record_id: payingDebt.id,
          amount: paymentAmount,
          payment_method: paymentMethod,
          notes: paymentNotes || null,
          created_by: user.id,
        });

      if (error) throw error;

      // Reset payment form and refresh data
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


  /** Xử lý nhập liệu nhanh công nợ cuối ngày */
  const handleQuickEntry = useCallback(async () => {
    if (!quickCustomerId || quickAmount <= 0) return;

    setIsSubmittingQuickEntry(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      // Create a debt record without linking to a specific order (quick entry)
      const { error } = await supabase
        .from('debt_records')
        .insert({
          customer_id: quickCustomerId,
          order_id: null,
          amount: quickAmount,
          paid_amount: 0,
          remaining: quickAmount,
          status: 'pending',
        });

      if (error) throw error;

      // Reset quick entry form and refresh
      setQuickCustomerId('');
      setQuickAmount(0);
      setQuickNotes('');
      await fetchDebts();
    } catch (err) {
      console.error('Lỗi nhập công nợ:', err);
      alert('Có lỗi xảy ra khi nhập công nợ. Vui lòng thử lại.');
    } finally {
      setIsSubmittingQuickEntry(false);
    }
  }, [quickCustomerId, quickAmount, quickNotes, supabase, fetchDebts]);

  /** Mở form thanh toán */
  const openPaymentForm = (debt: DebtWithCustomer) => {
    setPayingDebt(debt);
    setPaymentAmount(debt.remaining); // Default: thanh toán toàn bộ
    setPaymentMethod('cash');
    setPaymentNotes('');
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải danh sách công nợ...</p>
        </div>
      </div>
    );
  }


  // Payment modal overlay
  if (payingDebt) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setPayingDebt(null)}>
            ← Quay lại
          </Button>
          <h1 className="text-xl font-bold">Thanh toán công nợ</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thông tin nợ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Khách hàng</span>
              <span className="text-sm font-medium">{payingDebt.customer?.name || '—'}</span>
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
              <span className="text-sm text-muted-foreground">Ngày tạo nợ</span>
              <span className="text-sm">{formatDate(payingDebt.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tuổi nợ</span>
              <Badge variant={getAgeCategoryVariant(classifyDebtAge(payingDebt))}>
                {getAgeCategoryLabel(classifyDebtAge(payingDebt))} ({getDaysOutstanding(payingDebt.created_at)} ngày)
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thanh toán</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Số tiền thanh toán */}
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

            {/* Hình thức thanh toán */}
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

            {/* Ghi chú */}
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

            {/* Submit */}
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


  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Công nợ Khách hàng</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Theo dõi và quản lý công nợ theo tuổi nợ
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
            activeTab === 'quick-entry' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('quick-entry')}
        >
          Nhập nhanh
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
            <p className="text-xs text-muted-foreground">Tổng công nợ</p>
            <p className="text-lg md:text-xl font-bold text-destructive">
              {formatPrice(summaryStats.totalDebt)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summaryStats.totalRecords} khoản nợ
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Ngắn hạn (1-3 ngày)</p>
            <p className="text-lg md:text-xl font-bold">
              {formatPrice(summaryStats.shortTerm.total)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summaryStats.shortTerm.count} khoản
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Trung hạn (5 ngày)</p>
            <p className="text-lg md:text-xl font-bold text-yellow-600">
              {formatPrice(summaryStats.mediumTerm.total)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summaryStats.mediumTerm.count} khoản
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Dài hạn / Nợ lớn</p>
            <p className="text-lg md:text-xl font-bold text-destructive">
              {formatPrice(summaryStats.longTerm.total + summaryStats.large.total)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summaryStats.longTerm.count + summaryStats.large.count} khoản
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
                placeholder="Tìm theo tên hoặc SĐT khách hàng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
                aria-label="Tìm kiếm công nợ"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['all', 'short-term', 'medium-term', 'long-term', 'large'] as const).map((cat) => (
                <Button
                  key={cat}
                  variant={filterCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterCategory(cat)}
                  className="text-xs"
                >
                  {cat === 'all' ? 'Tất cả' : getAgeCategoryLabel(cat)}
                </Button>
              ))}
            </div>
          </div>

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
                <DebtCardMobile
                  key={debt.id}
                  debt={debt}
                  onPay={() => openPaymentForm(debt)}
                />
              ))
            )}
          </div>

          {/* Debt List - Desktop Table */}
          <div className="hidden md:block">
            <Card>
              <CardHeader>
                <CardTitle>Danh sách công nợ ({filteredDebts.length})</CardTitle>
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
                          <th className="text-left py-3 px-2 font-medium">Khách hàng</th>
                          <th className="text-right py-3 px-2 font-medium">Tổng nợ</th>
                          <th className="text-right py-3 px-2 font-medium">Đã trả</th>
                          <th className="text-right py-3 px-2 font-medium">Còn lại</th>
                          <th className="text-center py-3 px-2 font-medium">Tuổi nợ</th>
                          <th className="text-left py-3 px-2 font-medium">Ngày tạo</th>
                          <th className="text-center py-3 px-2 font-medium">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDebts.map((debt) => (
                          <DebtRowDesktop
                            key={debt.id}
                            debt={debt}
                            onPay={() => openPaymentForm(debt)}
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
      )}


      {/* Tab: Nhập nhanh công nợ cuối ngày */}
      {activeTab === 'quick-entry' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nhập nhanh công nợ cuối ngày</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ghi nhận nhanh các khoản nợ phát sinh trong ngày
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Chọn khách hàng */}
            <div>
              <Label htmlFor="quick-customer" className="text-sm">Khách hàng</Label>
              <select
                id="quick-customer"
                value={quickCustomerId}
                onChange={(e) => setQuickCustomerId(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">-- Chọn khách hàng --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {c.phone}
                  </option>
                ))}
              </select>
            </div>

            {/* Số tiền nợ */}
            <div>
              <Label htmlFor="quick-amount" className="text-sm">Số tiền nợ</Label>
              <Input
                id="quick-amount"
                type="number"
                min={1}
                value={quickAmount || ''}
                onChange={(e) => setQuickAmount(parseFloat(e.target.value) || 0)}
                className="mt-1"
                placeholder="Nhập số tiền..."
              />
            </div>

            {/* Ghi chú */}
            <div>
              <Label htmlFor="quick-notes" className="text-sm">Ghi chú (tùy chọn)</Label>
              <Input
                id="quick-notes"
                value={quickNotes}
                onChange={(e) => setQuickNotes(e.target.value)}
                className="mt-1"
                placeholder="Mô tả khoản nợ..."
              />
            </div>

            {/* Submit */}
            <Button
              size="lg"
              className="w-full h-12"
              onClick={handleQuickEntry}
              disabled={isSubmittingQuickEntry || !quickCustomerId || quickAmount <= 0}
            >
              {isSubmittingQuickEntry ? 'Đang lưu...' : 'Ghi nhận công nợ'}
            </Button>
          </CardContent>
        </Card>
      )}


      {/* Tab: Báo cáo tổng hợp */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Báo cáo tổng hợp công nợ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Tổng quan */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Tổng công nợ hiện tại</span>
                    <span className="text-xl font-bold text-destructive">
                      {formatPrice(summaryStats.totalDebt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summaryStats.totalRecords} khoản nợ từ {new Set(debts.map(d => d.customer_id)).size} khách hàng
                  </p>
                </div>

                {/* Chi tiết theo tuổi nợ */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Phân loại theo tuổi nợ</h4>

                  <SummaryRow
                    label="Ngắn hạn (1-3 ngày)"
                    count={summaryStats.shortTerm.count}
                    total={summaryStats.shortTerm.total}
                    variant="secondary"
                    percentage={summaryStats.totalDebt > 0
                      ? (summaryStats.shortTerm.total / summaryStats.totalDebt) * 100
                      : 0}
                  />
                  <SummaryRow
                    label="Trung hạn (4-5 ngày)"
                    count={summaryStats.mediumTerm.count}
                    total={summaryStats.mediumTerm.total}
                    variant="warning"
                    percentage={summaryStats.totalDebt > 0
                      ? (summaryStats.mediumTerm.total / summaryStats.totalDebt) * 100
                      : 0}
                  />
                  <SummaryRow
                    label="Dài hạn (6-30 ngày)"
                    count={summaryStats.longTerm.count}
                    total={summaryStats.longTerm.total}
                    variant="destructive"
                    percentage={summaryStats.totalDebt > 0
                      ? (summaryStats.longTerm.total / summaryStats.totalDebt) * 100
                      : 0}
                  />
                  <SummaryRow
                    label={`Nợ lớn (≥ ${formatPrice(LARGE_DEBT_THRESHOLD)})`}
                    count={summaryStats.large.count}
                    total={summaryStats.large.total}
                    variant="destructive"
                    percentage={summaryStats.totalDebt > 0
                      ? (summaryStats.large.total / summaryStats.totalDebt) * 100
                      : 0}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top khách hàng nợ nhiều nhất */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Khách hàng nợ nhiều nhất</CardTitle>
            </CardHeader>
            <CardContent>
              <TopDebtorsList debts={debts} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


// === Sub-components ===

interface DebtCardMobileProps {
  debt: DebtWithCustomer;
  onPay: () => void;
}

/** Card hiển thị công nợ trên mobile */
function DebtCardMobile({ debt, onPay }: DebtCardMobileProps) {
  const category = classifyDebtAge(debt);
  const days = getDaysOutstanding(debt.created_at);

  return (
    <Card className={category === 'long-term' || category === 'large' ? 'border-destructive/30' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-base truncate">
              {debt.customer?.name || 'Khách hàng'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {debt.customer?.phone || '—'} · {formatDate(debt.created_at)}
            </p>
          </div>
          <Badge variant={getAgeCategoryVariant(category)} className="shrink-0 text-xs">
            {getAgeCategoryLabel(category)} ({days}d)
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <p className="text-xs text-muted-foreground">Tổng nợ</p>
            <p className="text-sm font-semibold">{formatPrice(debt.amount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Đã trả</p>
            <p className="text-sm font-semibold text-green-600">
              {formatPrice(debt.paid_amount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Còn lại</p>
            <p className="text-sm font-bold text-destructive">
              {formatPrice(debt.remaining)}
            </p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t">
          <Button size="sm" onClick={onPay} className="w-full">
            Thanh toán
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface DebtRowDesktopProps {
  debt: DebtWithCustomer;
  onPay: () => void;
}

/** Row hiển thị công nợ trên desktop table */
function DebtRowDesktop({ debt, onPay }: DebtRowDesktopProps) {
  const category = classifyDebtAge(debt);
  const days = getDaysOutstanding(debt.created_at);

  return (
    <tr className={`border-b last:border-b-0 ${
      category === 'long-term' || category === 'large' ? 'bg-destructive/5' : ''
    }`}>
      <td className="py-3 px-2">
        <p className="font-medium">{debt.customer?.name || 'Khách hàng'}</p>
        <p className="text-xs text-muted-foreground">{debt.customer?.phone || '—'}</p>
      </td>
      <td className="py-3 px-2 text-right text-sm">{formatPrice(debt.amount)}</td>
      <td className="py-3 px-2 text-right text-sm text-green-600">
        {formatPrice(debt.paid_amount)}
      </td>
      <td className="py-3 px-2 text-right text-sm font-bold text-destructive">
        {formatPrice(debt.remaining)}
      </td>
      <td className="py-3 px-2 text-center">
        <Badge variant={getAgeCategoryVariant(category)} className="text-xs">
          {getAgeCategoryLabel(category)} ({days}d)
        </Badge>
      </td>
      <td className="py-3 px-2 text-sm text-muted-foreground">
        {formatDate(debt.created_at)}
      </td>
      <td className="py-3 px-2 text-center">
        <Button size="sm" variant="default" onClick={onPay} className="h-8 text-xs">
          Thanh toán
        </Button>
      </td>
    </tr>
  );
}


interface SummaryRowProps {
  label: string;
  count: number;
  total: number;
  variant: 'secondary' | 'warning' | 'destructive';
  percentage: number;
}

/** Row trong báo cáo tổng hợp */
function SummaryRow({ label, count, total, variant, percentage }: SummaryRowProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant={variant} className="text-xs shrink-0">{label}</Badge>
          <span className="text-xs text-muted-foreground">{count} khoản</span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              variant === 'destructive' ? 'bg-destructive' :
              variant === 'warning' ? 'bg-yellow-500' : 'bg-primary'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold">{formatPrice(total)}</p>
        <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
      </div>
    </div>
  );
}

interface TopDebtorsListProps {
  debts: DebtWithCustomer[];
}

/** Danh sách khách hàng nợ nhiều nhất */
function TopDebtorsList({ debts }: TopDebtorsListProps) {
  // Group debts by customer and sum remaining
  const customerDebts = useMemo(() => {
    const map = new Map<string, { customer: Customer | undefined; totalRemaining: number; count: number }>();

    debts.forEach((debt) => {
      const customerId = debt.customer_id;
      const existing = map.get(customerId);
      if (existing) {
        existing.totalRemaining += debt.remaining;
        existing.count += 1;
      } else {
        map.set(customerId, {
          customer: debt.customer,
          totalRemaining: debt.remaining,
          count: 1,
        });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.totalRemaining - a.totalRemaining)
      .slice(0, 10);
  }, [debts]);

  if (customerDebts.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-4">
        Không có dữ liệu công nợ
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {customerDebts.map((item, index) => (
        <div
          key={item.customer?.id || index}
          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-bold text-muted-foreground w-6 shrink-0">
              {index + 1}.
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {item.customer?.name || 'Khách hàng'}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.count} khoản nợ · {item.customer?.phone || '—'}
              </p>
            </div>
          </div>
          <span className="text-sm font-bold text-destructive shrink-0 ml-2">
            {formatPrice(item.totalRemaining)}
          </span>
        </div>
      ))}
    </div>
  );
}
