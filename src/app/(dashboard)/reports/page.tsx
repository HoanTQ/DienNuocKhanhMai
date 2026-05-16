'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

/**
 * Trang Báo cáo Doanh thu & Lợi nhuận
 *
 * - Báo cáo doanh thu hàng ngày: tổng doanh thu, số đơn, công nợ phát sinh
 * - Báo cáo lợi nhuận gộp theo sản phẩm và nhóm hàng
 * - Biên lợi nhuận theo thời gian (date range selector)
 * - Chỉ Owner truy cập được (middleware đã chặn Staff)
 * - Giao diện tiếng Việt, mobile-first, responsive
 *
 * Validates: Requirements 18.1, 18.2, 18.3, 18.4
 */

// === Types ===

interface DailySalesSummary {
  sale_date: string;
  order_count: number;
  total_revenue: number;
  total_discounts: number;
  total_credit: number;
  cash_revenue: number;
  transfer_revenue: number;
}

interface ProductProfit {
  product_id: string;
  product_name: string;
  brand: string;
  category_name: string;
  category_id: string;
  quantity_sold: number;
  revenue: number;
  cost: number;
  gross_profit: number;
  margin_percent: number;
}

interface CategoryProfit {
  category_id: string;
  category_name: string;
  total_quantity_sold: number;
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
  margin_percent: number;
}

interface ProfitMarginOverTime {
  sale_date: string;
  revenue: number;
  cost: number;
  gross_profit: number;
  margin_percent: number;
}

type TabView = 'daily' | 'product' | 'category' | 'margin';

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

/** Format phần trăm */
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Lấy ngày hôm nay dạng YYYY-MM-DD */
function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/** Lấy ngày 30 ngày trước dạng YYYY-MM-DD */
function get30DaysAgo(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

// === Main Component ===

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabView>('daily');
  const [loading, setLoading] = useState(true);

  // Daily revenue state
  const [dailySummaries, setDailySummaries] = useState<DailySalesSummary[]>([]);

  // Product profit state
  const [productProfits, setProductProfits] = useState<ProductProfit[]>([]);
  const [productSortBy, setProductSortBy] = useState<'profit' | 'margin' | 'revenue'>('profit');

  // Category profit state
  const [categoryProfits, setCategoryProfits] = useState<CategoryProfit[]>([]);

  // Profit margin over time state
  const [marginData, setMarginData] = useState<ProfitMarginOverTime[]>([]);
  const [dateFrom, setDateFrom] = useState(get30DaysAgo());
  const [dateTo, setDateTo] = useState(getToday());

  const supabase = useMemo(() => createClient(), []);

  // === Data Fetching ===

  /** Fetch báo cáo doanh thu hàng ngày từ view */
  const fetchDailySummary = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('daily_sales_summary_view')
      .select('*')
      .order('sale_date', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Lỗi tải báo cáo doanh thu:', error.message);
    } else {
      setDailySummaries((data || []) as DailySalesSummary[]);
    }
    setLoading(false);
  }, [supabase]);

  /** Fetch lợi nhuận gộp theo sản phẩm */
  const fetchProductProfits = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales_order_items')
      .select(`
        product_id,
        quantity,
        unit_price,
        line_total,
        product:products(name, brand, category_id, weighted_avg_cost, category:categories(name))
      `)
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo + 'T23:59:59');

    if (error) {
      console.error('Lỗi tải lợi nhuận sản phẩm:', error.message);
      setLoading(false);
      return;
    }

    // Aggregate by product
    const productMap = new Map<string, ProductProfit>();

    for (const item of data || []) {
      const product = item.product as any;
      if (!product) continue;

      const productId = item.product_id;
      const existing = productMap.get(productId);
      const itemRevenue = item.line_total;
      const itemCost = (product.weighted_avg_cost || 0) * item.quantity;

      if (existing) {
        existing.quantity_sold += item.quantity;
        existing.revenue += itemRevenue;
        existing.cost += itemCost;
        existing.gross_profit = existing.revenue - existing.cost;
        existing.margin_percent = existing.revenue > 0
          ? (existing.gross_profit / existing.revenue) * 100
          : 0;
      } else {
        const grossProfit = itemRevenue - itemCost;
        productMap.set(productId, {
          product_id: productId,
          product_name: product.name || '',
          brand: product.brand || '',
          category_name: product.category?.name || 'Chưa phân loại',
          category_id: product.category_id || '',
          quantity_sold: item.quantity,
          revenue: itemRevenue,
          cost: itemCost,
          gross_profit: grossProfit,
          margin_percent: itemRevenue > 0 ? (grossProfit / itemRevenue) * 100 : 0,
        });
      }
    }

    setProductProfits(Array.from(productMap.values()));
    setLoading(false);
  }, [supabase, dateFrom, dateTo]);

  /** Fetch lợi nhuận gộp theo nhóm hàng */
  const fetchCategoryProfits = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales_order_items')
      .select(`
        quantity,
        line_total,
        product:products(weighted_avg_cost, category_id, category:categories(id, name))
      `)
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo + 'T23:59:59');

    if (error) {
      console.error('Lỗi tải lợi nhuận nhóm hàng:', error.message);
      setLoading(false);
      return;
    }

    // Aggregate by category
    const categoryMap = new Map<string, CategoryProfit>();

    for (const item of data || []) {
      const product = item.product as any;
      if (!product) continue;

      const categoryId = product.category_id || 'uncategorized';
      const categoryName = product.category?.name || 'Chưa phân loại';
      const existing = categoryMap.get(categoryId);
      const itemRevenue = item.line_total;
      const itemCost = (product.weighted_avg_cost || 0) * item.quantity;

      if (existing) {
        existing.total_quantity_sold += item.quantity;
        existing.total_revenue += itemRevenue;
        existing.total_cost += itemCost;
        existing.gross_profit = existing.total_revenue - existing.total_cost;
        existing.margin_percent = existing.total_revenue > 0
          ? (existing.gross_profit / existing.total_revenue) * 100
          : 0;
      } else {
        const grossProfit = itemRevenue - itemCost;
        categoryMap.set(categoryId, {
          category_id: categoryId,
          category_name: categoryName,
          total_quantity_sold: item.quantity,
          total_revenue: itemRevenue,
          total_cost: itemCost,
          gross_profit: grossProfit,
          margin_percent: itemRevenue > 0 ? (grossProfit / itemRevenue) * 100 : 0,
        });
      }
    }

    setCategoryProfits(Array.from(categoryMap.values()));
    setLoading(false);
  }, [supabase, dateFrom, dateTo]);

  /** Fetch biên lợi nhuận theo thời gian */
  const fetchMarginOverTime = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales_order_items')
      .select(`
        created_at,
        quantity,
        line_total,
        product:products(weighted_avg_cost)
      `)
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo + 'T23:59:59')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Lỗi tải biên lợi nhuận:', error.message);
      setLoading(false);
      return;
    }

    // Aggregate by date
    const dateMap = new Map<string, ProfitMarginOverTime>();

    for (const item of data || []) {
      const product = item.product as any;
      if (!product) continue;

      const saleDate = item.created_at.split('T')[0];
      const existing = dateMap.get(saleDate);
      const itemRevenue = item.line_total;
      const itemCost = (product.weighted_avg_cost || 0) * item.quantity;

      if (existing) {
        existing.revenue += itemRevenue;
        existing.cost += itemCost;
        existing.gross_profit = existing.revenue - existing.cost;
        existing.margin_percent = existing.revenue > 0
          ? (existing.gross_profit / existing.revenue) * 100
          : 0;
      } else {
        const grossProfit = itemRevenue - itemCost;
        dateMap.set(saleDate, {
          sale_date: saleDate,
          revenue: itemRevenue,
          cost: itemCost,
          gross_profit: grossProfit,
          margin_percent: itemRevenue > 0 ? (grossProfit / itemRevenue) * 100 : 0,
        });
      }
    }

    setMarginData(Array.from(dateMap.values()));
    setLoading(false);
  }, [supabase, dateFrom, dateTo]);

  // === Effects ===

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDailySummary();
    } else if (activeTab === 'product') {
      fetchProductProfits();
    } else if (activeTab === 'category') {
      fetchCategoryProfits();
    } else if (activeTab === 'margin') {
      fetchMarginOverTime();
    }
  }, [activeTab, fetchDailySummary, fetchProductProfits, fetchCategoryProfits, fetchMarginOverTime]);

  // === Computed Values ===

  /** Tổng hợp doanh thu hôm nay */
  const todaySummary = useMemo(() => {
    const today = getToday();
    return dailySummaries.find((s) => s.sale_date === today) || null;
  }, [dailySummaries]);

  /** Sắp xếp sản phẩm theo tiêu chí */
  const sortedProductProfits = useMemo(() => {
    return [...productProfits].sort((a, b) => {
      switch (productSortBy) {
        case 'profit':
          return b.gross_profit - a.gross_profit;
        case 'margin':
          return b.margin_percent - a.margin_percent;
        case 'revenue':
          return b.revenue - a.revenue;
        default:
          return 0;
      }
    });
  }, [productProfits, productSortBy]);

  /** Sắp xếp nhóm hàng theo lợi nhuận */
  const sortedCategoryProfits = useMemo(() => {
    return [...categoryProfits].sort((a, b) => b.gross_profit - a.gross_profit);
  }, [categoryProfits]);

  /** Tổng lợi nhuận gộp tất cả sản phẩm */
  const totalGrossProfit = useMemo(() => {
    return productProfits.reduce((sum, p) => sum + p.gross_profit, 0);
  }, [productProfits]);

  /** Tổng doanh thu tất cả sản phẩm */
  const totalRevenue = useMemo(() => {
    return productProfits.reduce((sum, p) => sum + p.revenue, 0);
  }, [productProfits]);

  // === Loading State ===

  if (loading && dailySummaries.length === 0 && productProfits.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải báo cáo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Báo cáo Doanh thu & Lợi nhuận</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Phân tích doanh thu, lợi nhuận gộp theo sản phẩm và nhóm hàng
          </p>
        </div>
        <a
          href="/reports/inventory"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Báo cáo Tồn kho & Công nợ →
        </a>
        <a
          href="/reports/quotation"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Báo giá →
        </a>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg overflow-x-auto">
        <button
          type="button"
          className={`flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'daily' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('daily')}
        >
          Doanh thu
        </button>
        <button
          type="button"
          className={`flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'product' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('product')}
        >
          Theo SP
        </button>
        <button
          type="button"
          className={`flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'category' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('category')}
        >
          Theo nhóm
        </button>
        <button
          type="button"
          className={`flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'margin' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('margin')}
        >
          Biên LN
        </button>
      </div>

      {/* Date Range Selector (for product, category, margin tabs) */}
      {activeTab !== 'daily' && (
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="date-from" className="text-xs text-muted-foreground">Từ ngày</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="date-to" className="text-xs text-muted-foreground">Đến ngày</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (activeTab === 'product') fetchProductProfits();
                  else if (activeTab === 'category') fetchCategoryProfits();
                  else if (activeTab === 'margin') fetchMarginOverTime();
                }}
                className="w-full sm:w-auto"
              >
                Xem báo cáo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === Tab: Doanh thu hàng ngày === */}
      {activeTab === 'daily' && (
        <DailyRevenueTab
          todaySummary={todaySummary}
          dailySummaries={dailySummaries}
          loading={loading}
        />
      )}

      {/* === Tab: Lợi nhuận theo sản phẩm === */}
      {activeTab === 'product' && (
        <ProductProfitTab
          products={sortedProductProfits}
          totalGrossProfit={totalGrossProfit}
          totalRevenue={totalRevenue}
          sortBy={productSortBy}
          onSortChange={setProductSortBy}
          loading={loading}
        />
      )}

      {/* === Tab: Lợi nhuận theo nhóm hàng === */}
      {activeTab === 'category' && (
        <CategoryProfitTab
          categories={sortedCategoryProfits}
          loading={loading}
        />
      )}

      {/* === Tab: Biên lợi nhuận theo thời gian === */}
      {activeTab === 'margin' && (
        <ProfitMarginTab
          marginData={marginData}
          loading={loading}
        />
      )}
    </div>
  );
}


// === Sub-components ===

// --- Daily Revenue Tab ---

interface DailyRevenueTabProps {
  todaySummary: DailySalesSummary | null;
  dailySummaries: DailySalesSummary[];
  loading: boolean;
}

function DailyRevenueTab({ todaySummary, dailySummaries, loading }: DailyRevenueTabProps) {
  return (
    <div className="space-y-4">
      {/* Today's Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Doanh thu hôm nay</p>
            <p className="text-lg md:text-2xl font-bold text-green-600">
              {todaySummary ? formatPrice(todaySummary.total_revenue) : formatPrice(0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Số đơn hôm nay</p>
            <p className="text-lg md:text-2xl font-bold">
              {todaySummary ? todaySummary.order_count : 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Công nợ phát sinh</p>
            <p className="text-lg md:text-2xl font-bold text-orange-600">
              {todaySummary ? formatPrice(todaySummary.total_credit) : formatPrice(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Revenue List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Doanh thu 30 ngày gần nhất</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Đang tải...</p>
          ) : dailySummaries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Chưa có dữ liệu doanh thu
            </p>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="block md:hidden space-y-3">
                {dailySummaries.map((summary) => (
                  <DailySummaryCardMobile key={summary.sale_date} summary={summary} />
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Ngày</th>
                      <th className="text-right py-3 px-2 font-medium">Doanh thu</th>
                      <th className="text-right py-3 px-2 font-medium">Số đơn</th>
                      <th className="text-right py-3 px-2 font-medium">Tiền mặt</th>
                      <th className="text-right py-3 px-2 font-medium">Chuyển khoản</th>
                      <th className="text-right py-3 px-2 font-medium">Công nợ</th>
                      <th className="text-right py-3 px-2 font-medium">Giảm giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySummaries.map((summary) => (
                      <tr key={summary.sale_date} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2">{formatDate(summary.sale_date)}</td>
                        <td className="py-3 px-2 text-right font-medium text-green-600">
                          {formatPrice(summary.total_revenue)}
                        </td>
                        <td className="py-3 px-2 text-right">{summary.order_count}</td>
                        <td className="py-3 px-2 text-right">{formatPrice(summary.cash_revenue)}</td>
                        <td className="py-3 px-2 text-right">{formatPrice(summary.transfer_revenue)}</td>
                        <td className="py-3 px-2 text-right text-orange-600">
                          {formatPrice(summary.total_credit)}
                        </td>
                        <td className="py-3 px-2 text-right text-muted-foreground">
                          {formatPrice(summary.total_discounts)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Card doanh thu ngày trên mobile */
function DailySummaryCardMobile({ summary }: { summary: DailySalesSummary }) {
  return (
    <div className="p-3 border rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{formatDate(summary.sale_date)}</span>
        <Badge variant="secondary">{summary.order_count} đơn</Badge>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Doanh thu</span>
        <span className="text-sm font-bold text-green-600">{formatPrice(summary.total_revenue)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Công nợ</span>
        <span className="text-sm text-orange-600">{formatPrice(summary.total_credit)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Tiền mặt / CK</span>
        <span className="text-xs">
          {formatPrice(summary.cash_revenue)} / {formatPrice(summary.transfer_revenue)}
        </span>
      </div>
    </div>
  );
}


// --- Product Profit Tab ---

interface ProductProfitTabProps {
  products: ProductProfit[];
  totalGrossProfit: number;
  totalRevenue: number;
  sortBy: 'profit' | 'margin' | 'revenue';
  onSortChange: (sort: 'profit' | 'margin' | 'revenue') => void;
  loading: boolean;
}

function ProductProfitTab({
  products,
  totalGrossProfit,
  totalRevenue,
  sortBy,
  onSortChange,
  loading,
}: ProductProfitTabProps) {
  const overallMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tổng doanh thu</p>
            <p className="text-lg md:text-2xl font-bold">{formatPrice(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Lợi nhuận gộp</p>
            <p className="text-lg md:text-2xl font-bold text-green-600">
              {formatPrice(totalGrossProfit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Biên LN trung bình</p>
            <p className="text-lg md:text-2xl font-bold text-blue-600">
              {formatPercent(overallMargin)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sort Controls */}
      <div className="flex gap-1 flex-wrap">
        <Button
          variant={sortBy === 'profit' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSortChange('profit')}
          className="text-xs"
        >
          Lợi nhuận cao nhất
        </Button>
        <Button
          variant={sortBy === 'margin' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSortChange('margin')}
          className="text-xs"
        >
          Biên LN cao nhất
        </Button>
        <Button
          variant={sortBy === 'revenue' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSortChange('revenue')}
          className="text-xs"
        >
          Doanh thu cao nhất
        </Button>
      </div>

      {/* Product List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Lợi nhuận gộp theo sản phẩm ({products.length} SP)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Đang tải...</p>
          ) : products.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Chưa có dữ liệu bán hàng trong khoảng thời gian này
            </p>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="block md:hidden space-y-3">
                {products.slice(0, 20).map((product) => (
                  <ProductProfitCardMobile key={product.product_id} product={product} />
                ))}
                {products.length > 20 && (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    Hiển thị 20/{products.length} sản phẩm
                  </p>
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Sản phẩm</th>
                      <th className="text-left py-3 px-2 font-medium">Nhóm</th>
                      <th className="text-right py-3 px-2 font-medium">SL bán</th>
                      <th className="text-right py-3 px-2 font-medium">Doanh thu</th>
                      <th className="text-right py-3 px-2 font-medium">Giá vốn</th>
                      <th className="text-right py-3 px-2 font-medium">Lợi nhuận</th>
                      <th className="text-right py-3 px-2 font-medium">Biên LN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.product_id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium truncate max-w-[200px]">{product.product_name}</p>
                            <p className="text-xs text-muted-foreground">{product.brand}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-xs">{product.category_name}</td>
                        <td className="py-3 px-2 text-right">{product.quantity_sold}</td>
                        <td className="py-3 px-2 text-right">{formatPrice(product.revenue)}</td>
                        <td className="py-3 px-2 text-right text-muted-foreground">
                          {formatPrice(product.cost)}
                        </td>
                        <td className="py-3 px-2 text-right font-medium text-green-600">
                          {formatPrice(product.gross_profit)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <MarginBadge margin={product.margin_percent} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Card lợi nhuận sản phẩm trên mobile */
function ProductProfitCardMobile({ product }: { product: ProductProfit }) {
  return (
    <div className="p-3 border rounded-lg space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{product.product_name}</p>
          <p className="text-xs text-muted-foreground">{product.brand} · {product.category_name}</p>
        </div>
        <MarginBadge margin={product.margin_percent} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Doanh thu</p>
          <p className="text-xs font-medium">{formatPrice(product.revenue)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Lợi nhuận</p>
          <p className="text-xs font-medium text-green-600">{formatPrice(product.gross_profit)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">SL bán</p>
          <p className="text-xs font-medium">{product.quantity_sold}</p>
        </div>
      </div>
    </div>
  );
}


// --- Category Profit Tab ---

interface CategoryProfitTabProps {
  categories: CategoryProfit[];
  loading: boolean;
}

function CategoryProfitTab({ categories, loading }: CategoryProfitTabProps) {
  const totalRevenue = categories.reduce((sum, c) => sum + c.total_revenue, 0);
  const totalProfit = categories.reduce((sum, c) => sum + c.gross_profit, 0);
  const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tổng doanh thu</p>
            <p className="text-lg md:text-2xl font-bold">{formatPrice(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tổng lợi nhuận gộp</p>
            <p className="text-lg md:text-2xl font-bold text-green-600">{formatPrice(totalProfit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Biên LN trung bình</p>
            <p className="text-lg md:text-2xl font-bold text-blue-600">{formatPercent(overallMargin)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Category List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Lợi nhuận gộp theo nhóm hàng ({categories.length} nhóm)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Đang tải...</p>
          ) : categories.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Chưa có dữ liệu bán hàng trong khoảng thời gian này
            </p>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => (
                <CategoryProfitRow key={category.category_id} category={category} totalRevenue={totalRevenue} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Row hiển thị lợi nhuận nhóm hàng */
function CategoryProfitRow({ category, totalRevenue }: { category: CategoryProfit; totalRevenue: number }) {
  const revenueShare = totalRevenue > 0 ? (category.total_revenue / totalRevenue) * 100 : 0;

  return (
    <div className="p-3 border rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{category.category_name}</span>
          <Badge variant="secondary" className="text-xs">
            {category.total_quantity_sold} SP bán
          </Badge>
        </div>
        <MarginBadge margin={category.margin_percent} />
      </div>

      {/* Progress bar showing revenue share */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary rounded-full h-2 transition-all"
          style={{ width: `${Math.min(revenueShare, 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Doanh thu</p>
          <p className="text-xs font-medium">{formatPrice(category.total_revenue)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Lợi nhuận</p>
          <p className="text-xs font-medium text-green-600">{formatPrice(category.gross_profit)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Tỷ trọng DT</p>
          <p className="text-xs font-medium">{formatPercent(revenueShare)}</p>
        </div>
      </div>
    </div>
  );
}


// --- Profit Margin Over Time Tab ---

interface ProfitMarginTabProps {
  marginData: ProfitMarginOverTime[];
  loading: boolean;
}

function ProfitMarginTab({ marginData, loading }: ProfitMarginTabProps) {
  const avgMargin = marginData.length > 0
    ? marginData.reduce((sum, d) => sum + d.margin_percent, 0) / marginData.length
    : 0;

  const maxMarginDay = marginData.length > 0
    ? marginData.reduce((max, d) => d.margin_percent > max.margin_percent ? d : max, marginData[0])
    : null;

  const minMarginDay = marginData.length > 0
    ? marginData.reduce((min, d) => d.margin_percent < min.margin_percent ? d : min, marginData[0])
    : null;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Biên LN trung bình</p>
            <p className="text-lg md:text-2xl font-bold text-blue-600">
              {formatPercent(avgMargin)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Biên LN cao nhất</p>
            <p className="text-lg md:text-2xl font-bold text-green-600">
              {maxMarginDay ? formatPercent(maxMarginDay.margin_percent) : '—'}
            </p>
            {maxMarginDay && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(maxMarginDay.sale_date)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Biên LN thấp nhất</p>
            <p className="text-lg md:text-2xl font-bold text-orange-600">
              {minMarginDay ? formatPercent(minMarginDay.margin_percent) : '—'}
            </p>
            {minMarginDay && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(minMarginDay.sale_date)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Margin Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Biên lợi nhuận theo ngày ({marginData.length} ngày)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Đang tải...</p>
          ) : marginData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Chưa có dữ liệu trong khoảng thời gian này
            </p>
          ) : (
            <>
              {/* Visual Bar Chart (simple CSS-based) */}
              <div className="space-y-1 mb-4">
                {marginData.map((day) => (
                  <MarginBarRow key={day.sale_date} day={day} maxMargin={maxMarginDay?.margin_percent || 100} />
                ))}
              </div>

              {/* Detailed Table (Desktop) */}
              <div className="hidden md:block overflow-x-auto border-t pt-4">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">Ngày</th>
                      <th className="text-right py-2 px-2 font-medium">Doanh thu</th>
                      <th className="text-right py-2 px-2 font-medium">Giá vốn</th>
                      <th className="text-right py-2 px-2 font-medium">Lợi nhuận</th>
                      <th className="text-right py-2 px-2 font-medium">Biên LN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marginData.map((day) => (
                      <tr key={day.sale_date} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 px-2">{formatDate(day.sale_date)}</td>
                        <td className="py-2 px-2 text-right">{formatPrice(day.revenue)}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{formatPrice(day.cost)}</td>
                        <td className="py-2 px-2 text-right font-medium text-green-600">
                          {formatPrice(day.gross_profit)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <MarginBadge margin={day.margin_percent} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Row hiển thị biên LN dạng bar chart */
function MarginBarRow({ day, maxMargin }: { day: ProfitMarginOverTime; maxMargin: number }) {
  const barWidth = maxMargin > 0 ? (day.margin_percent / maxMargin) * 100 : 0;
  const barColor = day.margin_percent >= 30
    ? 'bg-green-500'
    : day.margin_percent >= 15
      ? 'bg-blue-500'
      : 'bg-orange-500';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-muted-foreground shrink-0">
        {new Date(day.sale_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
      </span>
      <div className="flex-1 bg-muted rounded-full h-4 relative">
        <div
          className={`${barColor} rounded-full h-4 transition-all flex items-center justify-end pr-1`}
          style={{ width: `${Math.max(barWidth, 5)}%` }}
        >
          {barWidth > 20 && (
            <span className="text-[10px] text-white font-medium">
              {formatPercent(day.margin_percent)}
            </span>
          )}
        </div>
      </div>
      {barWidth <= 20 && (
        <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0">
          {formatPercent(day.margin_percent)}
        </span>
      )}
    </div>
  );
}

// --- Shared Components ---

/** Badge hiển thị biên lợi nhuận với màu sắc */
function MarginBadge({ margin }: { margin: number }) {
  const variant: 'default' | 'secondary' | 'destructive' = margin >= 30
    ? 'default'
    : margin >= 15
      ? 'secondary'
      : 'destructive';

  return (
    <Badge variant={variant} className="text-xs">
      {formatPercent(margin)}
    </Badge>
  );
}
