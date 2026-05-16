'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

/**
 * Trang Báo cáo Tồn kho & Công nợ
 *
 * 1. Báo cáo tồn kho theo nhóm hàng và thương hiệu
 * 2. Báo cáo hàng tồn lâu (vượt ngưỡng thời gian)
 * 3. Tổng giá trị tồn kho (sum of current_stock × weighted_avg_cost)
 * 4. Báo cáo công nợ khách hàng theo tuổi nợ
 * 5. Báo cáo công nợ NCC và tình trạng thanh toán
 *
 * Chỉ Owner truy cập được (middleware đã chặn Staff)
 * Giao diện tiếng Việt, mobile-first, responsive
 *
 * Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5
 */

// === Types ===

interface InventoryByCategory {
  category_id: string;
  category_name: string;
  product_count: number;
  total_stock: number;
  total_value: number;
}

interface InventoryByBrand {
  brand: string;
  product_count: number;
  total_stock: number;
  total_value: number;
}

interface StaleStockProduct {
  id: string;
  name: string;
  brand: string;
  category_name: string;
  base_unit: string;
  current_stock: number;
  weighted_avg_cost: number;
  stock_value: number;
  last_stocked_at: string | null;
  days_since_last_stock: number | null;
}

interface CustomerDebtByAge {
  age_category: 'short-term' | 'medium-term' | 'long-term' | 'large';
  customer_count: number;
  total_remaining: number;
  debt_count: number;
}

interface CustomerDebtDetail {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  total_remaining: number;
  debt_count: number;
  oldest_debt_days: number;
  age_category: string;
}

interface SupplierDebtSummary {
  supplier_id: string;
  supplier_name: string;
  supplier_phone: string;
  total_amount: number;
  total_paid: number;
  total_remaining: number;
  pending_count: number;
  partial_count: number;
  paid_count: number;
}

type TabView = 'inventory-category' | 'stale-stock' | 'inventory-value' | 'customer-debt' | 'supplier-debt';

// === Constants ===

const DEFAULT_STALE_DAYS_THRESHOLD = 30;
const LARGE_DEBT_THRESHOLD = 5_000_000; // 5 triệu VND

// === Utility Functions ===

function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(price);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Chưa nhập';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getAgeCategoryLabel(category: string): string {
  switch (category) {
    case 'short-term': return 'Ngắn hạn (1-3 ngày)';
    case 'medium-term': return 'Trung hạn (4-5 ngày)';
    case 'long-term': return 'Dài hạn (6-30 ngày)';
    case 'large': return 'Nợ lớn';
    case 'overdue': return 'Quá hạn (>30 ngày)';
    default: return category;
  }
}

function getAgeBadgeVariant(category: string): 'default' | 'secondary' | 'destructive' {
  switch (category) {
    case 'short-term': return 'secondary';
    case 'medium-term': return 'default';
    case 'long-term': return 'destructive';
    case 'large': return 'destructive';
    case 'overdue': return 'destructive';
    default: return 'secondary';
  }
}

// === Main Component ===

export default function InventoryDebtReportsPage() {
  const [activeTab, setActiveTab] = useState<TabView>('inventory-category');
  const [loading, setLoading] = useState(true);

  // Inventory by category/brand
  const [inventoryByCategory, setInventoryByCategory] = useState<InventoryByCategory[]>([]);
  const [inventoryByBrand, setInventoryByBrand] = useState<InventoryByBrand[]>([]);

  // Stale stock
  const [staleProducts, setStaleProducts] = useState<StaleStockProduct[]>([]);
  const [staleDaysThreshold, setStaleDaysThreshold] = useState(DEFAULT_STALE_DAYS_THRESHOLD);

  // Total inventory value
  const [totalInventoryValue, setTotalInventoryValue] = useState(0);
  const [totalProductCount, setTotalProductCount] = useState(0);
  const [totalStockUnits, setTotalStockUnits] = useState(0);

  // Customer debt by age
  const [customerDebtByAge, setCustomerDebtByAge] = useState<CustomerDebtByAge[]>([]);
  const [customerDebtDetails, setCustomerDebtDetails] = useState<CustomerDebtDetail[]>([]);

  // Supplier debt
  const [supplierDebts, setSupplierDebts] = useState<SupplierDebtSummary[]>([]);

  const supabase = useMemo(() => createClient(), []);

  // === Data Fetching ===

  /** Fetch báo cáo tồn kho theo nhóm hàng */
  const fetchInventoryByCategory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, current_stock, weighted_avg_cost, category_id, category:categories(name)')
      .eq('is_active', true)
      .gt('current_stock', 0);

    if (error) {
      console.error('Lỗi tải tồn kho theo nhóm:', error.message);
      setLoading(false);
      return;
    }

    // Aggregate by category
    const categoryMap = new Map<string, InventoryByCategory>();
    for (const product of data || []) {
      const cat = product.category as any;
      const categoryId = product.category_id || 'uncategorized';
      const categoryName = cat?.name || 'Chưa phân loại';
      const stockValue = product.current_stock * product.weighted_avg_cost;

      const existing = categoryMap.get(categoryId);
      if (existing) {
        existing.product_count += 1;
        existing.total_stock += product.current_stock;
        existing.total_value += stockValue;
      } else {
        categoryMap.set(categoryId, {
          category_id: categoryId,
          category_name: categoryName,
          product_count: 1,
          total_stock: product.current_stock,
          total_value: stockValue,
        });
      }
    }

    setInventoryByCategory(
      Array.from(categoryMap.values()).sort((a, b) => b.total_value - a.total_value)
    );
    setLoading(false);
  }, [supabase]);

  /** Fetch báo cáo tồn kho theo thương hiệu */
  const fetchInventoryByBrand = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, brand, current_stock, weighted_avg_cost')
      .eq('is_active', true)
      .gt('current_stock', 0);

    if (error) {
      console.error('Lỗi tải tồn kho theo thương hiệu:', error.message);
      return;
    }

    // Aggregate by brand
    const brandMap = new Map<string, InventoryByBrand>();
    for (const product of data || []) {
      const brand = product.brand || 'Không rõ';
      const stockValue = product.current_stock * product.weighted_avg_cost;

      const existing = brandMap.get(brand);
      if (existing) {
        existing.product_count += 1;
        existing.total_stock += product.current_stock;
        existing.total_value += stockValue;
      } else {
        brandMap.set(brand, {
          brand,
          product_count: 1,
          total_stock: product.current_stock,
          total_value: stockValue,
        });
      }
    }

    setInventoryByBrand(
      Array.from(brandMap.values()).sort((a, b) => b.total_value - a.total_value)
    );
  }, [supabase]);

  /** Fetch hàng tồn lâu */
  const fetchStaleStock = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, brand, current_stock, weighted_avg_cost, base_unit, last_stocked_at, category_id, category:categories(name)')
      .eq('is_active', true)
      .gt('current_stock', 0);

    if (error) {
      console.error('Lỗi tải hàng tồn lâu:', error.message);
      setLoading(false);
      return;
    }

    const now = new Date();
    const staleItems: StaleStockProduct[] = [];

    for (const product of data || []) {
      const cat = product.category as any;
      let daysSinceLastStock: number | null = null;

      if (product.last_stocked_at) {
        const lastStocked = new Date(product.last_stocked_at);
        daysSinceLastStock = Math.floor((now.getTime() - lastStocked.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Include products that exceed threshold or have never been stocked
      if (daysSinceLastStock === null || daysSinceLastStock >= staleDaysThreshold) {
        staleItems.push({
          id: product.id,
          name: product.name,
          brand: product.brand,
          category_name: cat?.name || 'Chưa phân loại',
          base_unit: product.base_unit,
          current_stock: product.current_stock,
          weighted_avg_cost: product.weighted_avg_cost,
          stock_value: product.current_stock * product.weighted_avg_cost,
          last_stocked_at: product.last_stocked_at,
          days_since_last_stock: daysSinceLastStock,
        });
      }
    }

    // Sort by days since last stock (longest first), nulls first
    staleItems.sort((a, b) => {
      if (a.days_since_last_stock === null && b.days_since_last_stock === null) return 0;
      if (a.days_since_last_stock === null) return -1;
      if (b.days_since_last_stock === null) return 1;
      return b.days_since_last_stock - a.days_since_last_stock;
    });

    setStaleProducts(staleItems);
    setLoading(false);
  }, [supabase, staleDaysThreshold]);

  /** Fetch tổng giá trị tồn kho */
  const fetchTotalInventoryValue = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, current_stock, weighted_avg_cost')
      .eq('is_active', true)
      .gt('current_stock', 0);

    if (error) {
      console.error('Lỗi tải giá trị tồn kho:', error.message);
      setLoading(false);
      return;
    }

    let totalValue = 0;
    let totalUnits = 0;
    for (const product of data || []) {
      totalValue += product.current_stock * product.weighted_avg_cost;
      totalUnits += product.current_stock;
    }

    setTotalInventoryValue(totalValue);
    setTotalProductCount((data || []).length);
    setTotalStockUnits(totalUnits);
    setLoading(false);
  }, [supabase]);

  /** Fetch công nợ khách hàng theo tuổi nợ */
  const fetchCustomerDebtByAge = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('debt_records')
      .select('id, customer_id, amount, paid_amount, remaining, status, created_at, customer:customers(name, phone)')
      .neq('status', 'paid');

    if (error) {
      console.error('Lỗi tải công nợ khách hàng:', error.message);
      setLoading(false);
      return;
    }

    const now = new Date();

    // Classify debts by age
    const ageMap = new Map<string, CustomerDebtByAge>();
    const customerMap = new Map<string, CustomerDebtDetail>();

    for (const debt of data || []) {
      const customer = debt.customer as any;
      const daysOutstanding = Math.floor((now.getTime() - new Date(debt.created_at).getTime()) / (1000 * 60 * 60 * 24));

      // Determine age category
      let ageCategory: string;
      if (debt.remaining >= LARGE_DEBT_THRESHOLD) {
        ageCategory = 'large';
      } else if (daysOutstanding <= 3) {
        ageCategory = 'short-term';
      } else if (daysOutstanding <= 5) {
        ageCategory = 'medium-term';
      } else {
        ageCategory = 'long-term';
      }

      // Aggregate by age category
      const existingAge = ageMap.get(ageCategory);
      if (existingAge) {
        existingAge.total_remaining += debt.remaining;
        existingAge.debt_count += 1;
      } else {
        ageMap.set(ageCategory, {
          age_category: ageCategory as CustomerDebtByAge['age_category'],
          customer_count: 0, // Will be calculated after
          total_remaining: debt.remaining,
          debt_count: 1,
        });
      }

      // Aggregate by customer
      const customerId = debt.customer_id;
      const existingCustomer = customerMap.get(customerId);
      if (existingCustomer) {
        existingCustomer.total_remaining += debt.remaining;
        existingCustomer.debt_count += 1;
        existingCustomer.oldest_debt_days = Math.max(existingCustomer.oldest_debt_days, daysOutstanding);
        existingCustomer.age_category = ageCategory;
      } else {
        customerMap.set(customerId, {
          customer_id: customerId,
          customer_name: customer?.name || 'Không rõ',
          customer_phone: customer?.phone || '',
          total_remaining: debt.remaining,
          debt_count: 1,
          oldest_debt_days: daysOutstanding,
          age_category: ageCategory,
        });
      }
    }

    // Count unique customers per age category
    const customersByAge = new Map<string, Set<string>>();
    for (const debt of data || []) {
      const daysOutstanding = Math.floor((now.getTime() - new Date(debt.created_at).getTime()) / (1000 * 60 * 60 * 24));
      let ageCategory: string;
      if (debt.remaining >= LARGE_DEBT_THRESHOLD) {
        ageCategory = 'large';
      } else if (daysOutstanding <= 3) {
        ageCategory = 'short-term';
      } else if (daysOutstanding <= 5) {
        ageCategory = 'medium-term';
      } else {
        ageCategory = 'long-term';
      }

      if (!customersByAge.has(ageCategory)) {
        customersByAge.set(ageCategory, new Set());
      }
      customersByAge.get(ageCategory)!.add(debt.customer_id);
    }

    Array.from(customersByAge.entries()).forEach(([category, customers]) => {
      const ageEntry = ageMap.get(category);
      if (ageEntry) {
        ageEntry.customer_count = customers.size;
      }
    });

    setCustomerDebtByAge(Array.from(ageMap.values()));
    setCustomerDebtDetails(
      Array.from(customerMap.values()).sort((a, b) => b.total_remaining - a.total_remaining)
    );
    setLoading(false);
  }, [supabase]);

  /** Fetch công nợ NCC */
  const fetchSupplierDebts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('supplier_debts')
      .select('id, supplier_id, amount, paid_amount, remaining, status, supplier:suppliers(name, phone)');

    if (error) {
      console.error('Lỗi tải công nợ NCC:', error.message);
      setLoading(false);
      return;
    }

    // Aggregate by supplier
    const supplierMap = new Map<string, SupplierDebtSummary>();

    for (const debt of data || []) {
      const supplier = debt.supplier as any;
      const supplierId = debt.supplier_id;
      const existing = supplierMap.get(supplierId);

      if (existing) {
        existing.total_amount += debt.amount;
        existing.total_paid += debt.paid_amount;
        existing.total_remaining += debt.remaining;
        if (debt.status === 'pending') existing.pending_count += 1;
        else if (debt.status === 'partial') existing.partial_count += 1;
        else if (debt.status === 'paid') existing.paid_count += 1;
      } else {
        supplierMap.set(supplierId, {
          supplier_id: supplierId,
          supplier_name: supplier?.name || 'Không rõ',
          supplier_phone: supplier?.phone || '',
          total_amount: debt.amount,
          total_paid: debt.paid_amount,
          total_remaining: debt.remaining,
          pending_count: debt.status === 'pending' ? 1 : 0,
          partial_count: debt.status === 'partial' ? 1 : 0,
          paid_count: debt.status === 'paid' ? 1 : 0,
        });
      }
    }

    setSupplierDebts(
      Array.from(supplierMap.values()).sort((a, b) => b.total_remaining - a.total_remaining)
    );
    setLoading(false);
  }, [supabase]);

  // === Effects ===

  useEffect(() => {
    switch (activeTab) {
      case 'inventory-category':
        fetchInventoryByCategory();
        fetchInventoryByBrand();
        break;
      case 'stale-stock':
        fetchStaleStock();
        break;
      case 'inventory-value':
        fetchTotalInventoryValue();
        fetchInventoryByCategory();
        break;
      case 'customer-debt':
        fetchCustomerDebtByAge();
        break;
      case 'supplier-debt':
        fetchSupplierDebts();
        break;
    }
  }, [activeTab, fetchInventoryByCategory, fetchInventoryByBrand, fetchStaleStock, fetchTotalInventoryValue, fetchCustomerDebtByAge, fetchSupplierDebts]);

  // === Computed Values ===

  const totalCategoryValue = useMemo(() => {
    return inventoryByCategory.reduce((sum, c) => sum + c.total_value, 0);
  }, [inventoryByCategory]);

  const totalStaleValue = useMemo(() => {
    return staleProducts.reduce((sum, p) => sum + p.stock_value, 0);
  }, [staleProducts]);

  const totalCustomerDebt = useMemo(() => {
    return customerDebtByAge.reduce((sum, d) => sum + d.total_remaining, 0);
  }, [customerDebtByAge]);

  const totalSupplierDebt = useMemo(() => {
    return supplierDebts.reduce((sum, s) => sum + s.total_remaining, 0);
  }, [supplierDebts]);

  // === Render ===

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Báo cáo Tồn kho & Công nợ</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Phân tích tồn kho theo nhóm, hàng tồn lâu, và tình trạng công nợ
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg overflow-x-auto">
        <TabButton
          active={activeTab === 'inventory-category'}
          onClick={() => setActiveTab('inventory-category')}
          label="Theo nhóm"
        />
        <TabButton
          active={activeTab === 'stale-stock'}
          onClick={() => setActiveTab('stale-stock')}
          label="Tồn lâu"
        />
        <TabButton
          active={activeTab === 'inventory-value'}
          onClick={() => setActiveTab('inventory-value')}
          label="Giá trị"
        />
        <TabButton
          active={activeTab === 'customer-debt'}
          onClick={() => setActiveTab('customer-debt')}
          label="Nợ KH"
        />
        <TabButton
          active={activeTab === 'supplier-debt'}
          onClick={() => setActiveTab('supplier-debt')}
          label="Nợ NCC"
        />
      </div>

      {/* Tab Content */}
      {activeTab === 'inventory-category' && (
        <InventoryCategoryTab
          byCategory={inventoryByCategory}
          byBrand={inventoryByBrand}
          totalValue={totalCategoryValue}
          loading={loading}
        />
      )}

      {activeTab === 'stale-stock' && (
        <StaleStockTab
          products={staleProducts}
          totalValue={totalStaleValue}
          threshold={staleDaysThreshold}
          onThresholdChange={setStaleDaysThreshold}
          onRefresh={fetchStaleStock}
          loading={loading}
        />
      )}

      {activeTab === 'inventory-value' && (
        <InventoryValueTab
          totalValue={totalInventoryValue}
          productCount={totalProductCount}
          totalUnits={totalStockUnits}
          byCategory={inventoryByCategory}
          loading={loading}
        />
      )}

      {activeTab === 'customer-debt' && (
        <CustomerDebtTab
          byAge={customerDebtByAge}
          details={customerDebtDetails}
          totalDebt={totalCustomerDebt}
          loading={loading}
        />
      )}

      {activeTab === 'supplier-debt' && (
        <SupplierDebtTab
          suppliers={supplierDebts}
          totalDebt={totalSupplierDebt}
          loading={loading}
        />
      )}
    </div>
  );
}


// === Shared Sub-components ===

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={`flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
        active ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// === Tab 1: Inventory by Category & Brand ===

interface InventoryCategoryTabProps {
  byCategory: InventoryByCategory[];
  byBrand: InventoryByBrand[];
  totalValue: number;
  loading: boolean;
}

function InventoryCategoryTab({ byCategory, byBrand, totalValue, loading }: InventoryCategoryTabProps) {
  const [viewMode, setViewMode] = useState<'category' | 'brand'>('category');

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tổng giá trị tồn kho</p>
            <p className="text-lg md:text-2xl font-bold text-blue-600">{formatPrice(totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Số nhóm hàng</p>
            <p className="text-lg md:text-2xl font-bold">{byCategory.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Số thương hiệu</p>
            <p className="text-lg md:text-2xl font-bold">{byBrand.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* View Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={viewMode === 'category' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('category')}
        >
          Theo nhóm hàng
        </Button>
        <Button
          variant={viewMode === 'brand' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('brand')}
        >
          Theo thương hiệu
        </Button>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {viewMode === 'category'
              ? `Tồn kho theo nhóm hàng (${byCategory.length} nhóm)`
              : `Tồn kho theo thương hiệu (${byBrand.length} thương hiệu)`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Đang tải...</p>
          ) : viewMode === 'category' ? (
            byCategory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu tồn kho</p>
            ) : (
              <div className="space-y-3">
                {byCategory.map((cat) => (
                  <InventoryRow
                    key={cat.category_id}
                    label={cat.category_name}
                    productCount={cat.product_count}
                    totalStock={cat.total_stock}
                    totalValue={cat.total_value}
                    sharePercent={totalValue > 0 ? (cat.total_value / totalValue) * 100 : 0}
                  />
                ))}
              </div>
            )
          ) : (
            byBrand.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu tồn kho</p>
            ) : (
              <div className="space-y-3">
                {byBrand.map((brand) => (
                  <InventoryRow
                    key={brand.brand}
                    label={brand.brand}
                    productCount={brand.product_count}
                    totalStock={brand.total_stock}
                    totalValue={brand.total_value}
                    sharePercent={totalValue > 0 ? (brand.total_value / totalValue) * 100 : 0}
                  />
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InventoryRow({
  label,
  productCount,
  totalStock,
  totalValue,
  sharePercent,
}: {
  label: string;
  productCount: number;
  totalStock: number;
  totalValue: number;
  sharePercent: number;
}) {
  return (
    <div className="p-3 border rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="secondary" className="text-xs">{productCount} SP</Badge>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-blue-500 rounded-full h-2 transition-all"
          style={{ width: `${Math.min(sharePercent, 100)}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Tồn kho</p>
          <p className="text-xs font-medium">{formatNumber(totalStock)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Giá trị</p>
          <p className="text-xs font-medium text-blue-600">{formatPrice(totalValue)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Tỷ trọng</p>
          <p className="text-xs font-medium">{sharePercent.toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
}

// === Tab 2: Stale Stock ===

interface StaleStockTabProps {
  products: StaleStockProduct[];
  totalValue: number;
  threshold: number;
  onThresholdChange: (value: number) => void;
  onRefresh: () => void;
  loading: boolean;
}

function StaleStockTab({ products, totalValue, threshold, onThresholdChange, onRefresh, loading }: StaleStockTabProps) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Số SP tồn lâu</p>
            <p className="text-lg md:text-2xl font-bold text-orange-600">{products.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Giá trị tồn lâu</p>
            <p className="text-lg md:text-2xl font-bold text-orange-600">{formatPrice(totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Ngưỡng (ngày)</p>
            <p className="text-lg md:text-2xl font-bold">{threshold}</p>
          </CardContent>
        </Card>
      </div>

      {/* Threshold Control */}
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="stale-threshold" className="text-xs text-muted-foreground">
                Ngưỡng hàng tồn lâu (ngày)
              </Label>
              <Input
                id="stale-threshold"
                type="number"
                min={1}
                max={365}
                value={threshold}
                onChange={(e) => onThresholdChange(Number(e.target.value) || DEFAULT_STALE_DAYS_THRESHOLD)}
                className="mt-1"
              />
            </div>
            <Button size="sm" onClick={onRefresh} className="w-full sm:w-auto">
              Áp dụng
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stale Products List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Hàng tồn lâu ≥ {threshold} ngày ({products.length} SP)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Đang tải...</p>
          ) : products.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Không có hàng tồn lâu vượt ngưỡng {threshold} ngày
            </p>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="block md:hidden space-y-3">
                {products.slice(0, 30).map((product) => (
                  <StaleProductCardMobile key={product.id} product={product} />
                ))}
                {products.length > 30 && (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    Hiển thị 30/{products.length} sản phẩm
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
                      <th className="text-right py-3 px-2 font-medium">Tồn kho</th>
                      <th className="text-right py-3 px-2 font-medium">Giá trị</th>
                      <th className="text-right py-3 px-2 font-medium">Ngày tồn</th>
                      <th className="text-right py-3 px-2 font-medium">Nhập lần cuối</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium truncate max-w-[200px]">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.brand}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-xs">{product.category_name}</td>
                        <td className="py-3 px-2 text-right">
                          {formatNumber(product.current_stock)} {product.base_unit}
                        </td>
                        <td className="py-3 px-2 text-right text-orange-600">
                          {formatPrice(product.stock_value)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Badge variant="destructive" className="text-xs">
                            {product.days_since_last_stock !== null ? `${product.days_since_last_stock} ngày` : 'N/A'}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-right text-xs text-muted-foreground">
                          {formatDate(product.last_stocked_at)}
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

function StaleProductCardMobile({ product }: { product: StaleStockProduct }) {
  return (
    <div className="p-3 border rounded-lg space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{product.name}</p>
          <p className="text-xs text-muted-foreground">{product.brand} · {product.category_name}</p>
        </div>
        <Badge variant="destructive" className="text-xs shrink-0">
          {product.days_since_last_stock !== null ? `${product.days_since_last_stock} ngày` : 'N/A'}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Tồn kho</p>
          <p className="text-xs font-medium">{formatNumber(product.current_stock)} {product.base_unit}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Giá trị</p>
          <p className="text-xs font-medium text-orange-600">{formatPrice(product.stock_value)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Nhập cuối</p>
          <p className="text-xs font-medium">{formatDate(product.last_stocked_at)}</p>
        </div>
      </div>
    </div>
  );
}


// === Tab 3: Total Inventory Value ===

interface InventoryValueTabProps {
  totalValue: number;
  productCount: number;
  totalUnits: number;
  byCategory: InventoryByCategory[];
  loading: boolean;
}

function InventoryValueTab({ totalValue, productCount, totalUnits, byCategory, loading }: InventoryValueTabProps) {
  const avgValuePerProduct = productCount > 0 ? totalValue / productCount : 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tổng giá trị tồn kho</p>
            <p className="text-lg md:text-2xl font-bold text-blue-600">{formatPrice(totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Số sản phẩm có tồn</p>
            <p className="text-lg md:text-2xl font-bold">{productCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tổng số lượng tồn</p>
            <p className="text-lg md:text-2xl font-bold">{formatNumber(totalUnits)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Giá trị TB/SP</p>
            <p className="text-lg md:text-2xl font-bold">{formatPrice(avgValuePerProduct)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Value Distribution by Category */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phân bổ giá trị tồn kho theo nhóm hàng</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Đang tải...</p>
          ) : byCategory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu tồn kho</p>
          ) : (
            <div className="space-y-3">
              {byCategory.map((cat) => {
                const sharePercent = totalValue > 0 ? (cat.total_value / totalValue) * 100 : 0;
                return (
                  <div key={cat.category_id} className="flex items-center gap-3">
                    <span className="text-sm w-32 truncate shrink-0">{cat.category_name}</span>
                    <div className="flex-1 bg-muted rounded-full h-6 relative">
                      <div
                        className="bg-blue-500 rounded-full h-6 transition-all flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(sharePercent, 3)}%` }}
                      >
                        {sharePercent > 15 && (
                          <span className="text-[10px] text-white font-medium">
                            {formatPrice(cat.total_value)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right shrink-0">
                      {sharePercent.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// === Tab 4: Customer Debt by Age ===

interface CustomerDebtTabProps {
  byAge: CustomerDebtByAge[];
  details: CustomerDebtDetail[];
  totalDebt: number;
  loading: boolean;
}

function CustomerDebtTab({ byAge, details, totalDebt, loading }: CustomerDebtTabProps) {
  const totalCustomers = details.length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tổng công nợ KH</p>
            <p className="text-lg md:text-2xl font-bold text-orange-600">{formatPrice(totalDebt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Số KH đang nợ</p>
            <p className="text-lg md:text-2xl font-bold">{totalCustomers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Nợ TB/KH</p>
            <p className="text-lg md:text-2xl font-bold">
              {totalCustomers > 0 ? formatPrice(totalDebt / totalCustomers) : formatPrice(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Debt by Age Category */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phân loại theo tuổi nợ</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Đang tải...</p>
          ) : byAge.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Không có công nợ khách hàng</p>
          ) : (
            <div className="space-y-3">
              {byAge.map((age) => (
                <div key={age.age_category} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={getAgeBadgeVariant(age.age_category)} className="text-xs">
                        {getAgeCategoryLabel(age.age_category)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {age.customer_count} KH · {age.debt_count} khoản
                      </span>
                    </div>
                    <span className="text-sm font-bold text-orange-600">
                      {formatPrice(age.total_remaining)}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-orange-500 rounded-full h-2 transition-all"
                      style={{ width: `${totalDebt > 0 ? (age.total_remaining / totalDebt) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Debt Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chi tiết công nợ khách hàng ({details.length} KH)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Đang tải...</p>
          ) : details.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Không có công nợ</p>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="block md:hidden space-y-3">
                {details.slice(0, 20).map((customer) => (
                  <CustomerDebtCardMobile key={customer.customer_id} customer={customer} />
                ))}
                {details.length > 20 && (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    Hiển thị 20/{details.length} khách hàng
                  </p>
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Khách hàng</th>
                      <th className="text-left py-3 px-2 font-medium">SĐT</th>
                      <th className="text-right py-3 px-2 font-medium">Số khoản nợ</th>
                      <th className="text-right py-3 px-2 font-medium">Tổng nợ</th>
                      <th className="text-right py-3 px-2 font-medium">Nợ lâu nhất</th>
                      <th className="text-center py-3 px-2 font-medium">Phân loại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((customer) => (
                      <tr key={customer.customer_id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2 font-medium">{customer.customer_name}</td>
                        <td className="py-3 px-2 text-muted-foreground">{customer.customer_phone}</td>
                        <td className="py-3 px-2 text-right">{customer.debt_count}</td>
                        <td className="py-3 px-2 text-right font-medium text-orange-600">
                          {formatPrice(customer.total_remaining)}
                        </td>
                        <td className="py-3 px-2 text-right">{customer.oldest_debt_days} ngày</td>
                        <td className="py-3 px-2 text-center">
                          <Badge variant={getAgeBadgeVariant(customer.age_category)} className="text-xs">
                            {getAgeCategoryLabel(customer.age_category)}
                          </Badge>
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

function CustomerDebtCardMobile({ customer }: { customer: CustomerDebtDetail }) {
  return (
    <div className="p-3 border rounded-lg space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{customer.customer_name}</p>
          <p className="text-xs text-muted-foreground">{customer.customer_phone}</p>
        </div>
        <Badge variant={getAgeBadgeVariant(customer.age_category)} className="text-xs shrink-0">
          {getAgeCategoryLabel(customer.age_category)}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Tổng nợ</p>
          <p className="text-xs font-medium text-orange-600">{formatPrice(customer.total_remaining)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Số khoản</p>
          <p className="text-xs font-medium">{customer.debt_count}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Lâu nhất</p>
          <p className="text-xs font-medium">{customer.oldest_debt_days} ngày</p>
        </div>
      </div>
    </div>
  );
}

// === Tab 5: Supplier Debt ===

interface SupplierDebtTabProps {
  suppliers: SupplierDebtSummary[];
  totalDebt: number;
  loading: boolean;
}

function SupplierDebtTab({ suppliers, totalDebt, loading }: SupplierDebtTabProps) {
  const totalPaid = suppliers.reduce((sum, s) => sum + s.total_paid, 0);
  const totalAmount = suppliers.reduce((sum, s) => sum + s.total_amount, 0);
  const paymentRate = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tổng nợ NCC còn lại</p>
            <p className="text-lg md:text-2xl font-bold text-red-600">{formatPrice(totalDebt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Đã thanh toán</p>
            <p className="text-lg md:text-2xl font-bold text-green-600">{formatPrice(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tổng phát sinh</p>
            <p className="text-lg md:text-2xl font-bold">{formatPrice(totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tỷ lệ thanh toán</p>
            <p className="text-lg md:text-2xl font-bold text-blue-600">{paymentRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Debt List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Công nợ theo NCC ({suppliers.length} NCC)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Đang tải...</p>
          ) : suppliers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Không có công nợ NCC</p>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="block md:hidden space-y-3">
                {suppliers.map((supplier) => (
                  <SupplierDebtCardMobile key={supplier.supplier_id} supplier={supplier} />
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Nhà cung cấp</th>
                      <th className="text-left py-3 px-2 font-medium">SĐT</th>
                      <th className="text-right py-3 px-2 font-medium">Tổng phát sinh</th>
                      <th className="text-right py-3 px-2 font-medium">Đã trả</th>
                      <th className="text-right py-3 px-2 font-medium">Còn nợ</th>
                      <th className="text-center py-3 px-2 font-medium">Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((supplier) => (
                      <tr key={supplier.supplier_id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2 font-medium">{supplier.supplier_name}</td>
                        <td className="py-3 px-2 text-muted-foreground">{supplier.supplier_phone}</td>
                        <td className="py-3 px-2 text-right">{formatPrice(supplier.total_amount)}</td>
                        <td className="py-3 px-2 text-right text-green-600">
                          {formatPrice(supplier.total_paid)}
                        </td>
                        <td className="py-3 px-2 text-right font-medium text-red-600">
                          {formatPrice(supplier.total_remaining)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <SupplierPaymentStatus supplier={supplier} />
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

function SupplierDebtCardMobile({ supplier }: { supplier: SupplierDebtSummary }) {
  const paymentPercent = supplier.total_amount > 0
    ? (supplier.total_paid / supplier.total_amount) * 100
    : 0;

  return (
    <div className="p-3 border rounded-lg space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{supplier.supplier_name}</p>
          <p className="text-xs text-muted-foreground">{supplier.supplier_phone}</p>
        </div>
        <SupplierPaymentStatus supplier={supplier} />
      </div>
      {/* Payment progress bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-green-500 rounded-full h-2 transition-all"
          style={{ width: `${Math.min(paymentPercent, 100)}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Phát sinh</p>
          <p className="text-xs font-medium">{formatPrice(supplier.total_amount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Đã trả</p>
          <p className="text-xs font-medium text-green-600">{formatPrice(supplier.total_paid)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Còn nợ</p>
          <p className="text-xs font-medium text-red-600">{formatPrice(supplier.total_remaining)}</p>
        </div>
      </div>
      <div className="flex gap-1 flex-wrap">
        {supplier.pending_count > 0 && (
          <Badge variant="destructive" className="text-[10px]">
            {supplier.pending_count} chưa trả
          </Badge>
        )}
        {supplier.partial_count > 0 && (
          <Badge variant="default" className="text-[10px]">
            {supplier.partial_count} trả 1 phần
          </Badge>
        )}
        {supplier.paid_count > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {supplier.paid_count} đã trả
          </Badge>
        )}
      </div>
    </div>
  );
}

function SupplierPaymentStatus({ supplier }: { supplier: SupplierDebtSummary }) {
  if (supplier.total_remaining === 0) {
    return <Badge variant="secondary" className="text-xs">Đã trả hết</Badge>;
  }
  if (supplier.pending_count > 0 && supplier.partial_count === 0 && supplier.paid_count === 0) {
    return <Badge variant="destructive" className="text-xs">Chưa trả</Badge>;
  }
  return <Badge variant="default" className="text-xs">Đang trả</Badge>;
}
