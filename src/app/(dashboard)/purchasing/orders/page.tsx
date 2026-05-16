'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Supplier, PurchaseOrder, PurchaseOrderItem } from '@/lib/types';

// === Types ===

interface PurchaseOrderRow {
  id: string;
  supplier_id: string;
  status: PurchaseOrder['status'];
  notes: string | null;
  created_by: string;
  created_at: string;
  supplier?: { name: string };
  purchase_order_items?: PurchaseOrderItemRow[];
}

interface PurchaseOrderItemRow {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  received_quantity: number;
  line_total: number;
  product?: { id: string; name: string; brand: string; specification: string; base_unit: string; current_stock: number };
}

interface ProductOption {
  id: string;
  name: string;
  brand: string;
  specification: string;
  base_unit: string;
  current_stock: number;
  selling_price: number;
}

interface OrderItemDraft {
  product_id: string;
  product_name: string;
  brand: string;
  specification: string;
  unit: string;
  quantity: number;
  unit_cost: number;
  current_stock: number;
}

interface PendingOrderWarning {
  product_id: string;
  product_name: string;
  order_id: string;
  quantity: number;
  status: string;
  created_at: string;
}

type ViewMode = 'list' | 'form' | 'detail';
type StatusFilter = 'all' | 'draft' | 'pending' | 'received' | 'partial';

/**
 * Trang Quản lý Đơn đặt hàng (Purchase Orders)
 *
 * - Tạo đơn đặt hàng: chọn NCC, danh sách sản phẩm, số lượng, ghi chú
 * - Hiển thị tồn kho hiện tại của từng sản phẩm trong đơn
 * - Cảnh báo nếu có đơn đặt hàng đang chờ cho cùng sản phẩm
 * - Nhiều Owner xem chung danh sách đơn đặt hàng
 *
 * Validates: Requirements 14.4, 14.5, 14.6, 14.7
 */
export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderRow | null>(null);

  const supabase = useMemo(() => createClient(), []);

  /** Fetch danh sách đơn đặt hàng */
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(name), purchase_order_items(*, product:products(id, name, brand, specification, base_unit, current_stock))')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Lỗi tải danh sách đơn đặt hàng:', error.message);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  /** Lọc đơn hàng */
  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      !searchQuery.trim() ||
      (o.supplier?.name || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      (o.notes || '').toLowerCase().includes(searchQuery.toLowerCase().trim());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  /** Đếm theo trạng thái */
  const statusCounts = useMemo(() => ({
    all: orders.length,
    draft: orders.filter((o) => o.status === 'draft').length,
    pending: orders.filter((o) => o.status === 'pending').length,
    received: orders.filter((o) => o.status === 'received').length,
    partial: orders.filter((o) => o.status === 'partial').length,
  }), [orders]);

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

  /** Format giá tiền VND */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  };

  /** Tính tổng tiền đơn hàng */
  const getOrderTotal = (order: PurchaseOrderRow): number => {
    return (order.purchase_order_items || []).reduce((sum, item) => sum + item.line_total, 0);
  };

  /** Badge màu theo trạng thái */
  const getStatusBadge = (status: PurchaseOrder['status']) => {
    const config: Record<PurchaseOrder['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Nháp', variant: 'secondary' },
      pending: { label: 'Đang chờ', variant: 'default' },
      received: { label: 'Đã nhận', variant: 'outline' },
      partial: { label: 'Nhận một phần', variant: 'destructive' },
    };
    const { label, variant } = config[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  // === View: Form tạo đơn đặt hàng ===
  if (viewMode === 'form') {
    return (
      <div className="p-4 md:p-6">
        <PurchaseOrderForm
          onSuccess={() => {
            setViewMode('list');
            fetchOrders();
          }}
          onCancel={() => setViewMode('list')}
        />
      </div>
    );
  }

  // === View: Chi tiết đơn đặt hàng ===
  if (viewMode === 'detail' && selectedOrder) {
    return (
      <div className="p-4 md:p-6">
        <PurchaseOrderDetail
          order={selectedOrder}
          onBack={() => {
            setViewMode('list');
            setSelectedOrder(null);
          }}
          onStatusChange={() => {
            fetchOrders();
            setViewMode('list');
            setSelectedOrder(null);
          }}
        />
      </div>
    );
  }

  // === View: Loading ===
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải danh sách đơn đặt hàng...</p>
        </div>
      </div>
    );
  }

  // === View: Danh sách đơn đặt hàng ===
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Đơn đặt hàng</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý đơn đặt hàng từ nhà cung cấp
          </p>
        </div>
        <Button
          onClick={() => setViewMode('form')}
          className="w-full sm:w-auto"
        >
          + Tạo đơn đặt hàng
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: 'all', label: 'Tất cả' },
          { key: 'draft', label: 'Nháp' },
          { key: 'pending', label: 'Đang chờ' },
          { key: 'received', label: 'Đã nhận' },
          { key: 'partial', label: 'Nhận một phần' },
        ] as { key: StatusFilter; label: string }[]).map(({ key, label }) => (
          <Button
            key={key}
            variant={statusFilter === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(key)}
            className="text-xs"
          >
            {label} ({statusCounts[key]})
          </Button>
        ))}
      </div>

      {/* Search */}
      <Input
        placeholder="Tìm kiếm theo NCC, ghi chú..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full"
        aria-label="Tìm kiếm đơn đặt hàng"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Tổng đơn</p>
            <p className="text-xl font-bold">{statusCounts.all}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Đang chờ</p>
            <p className="text-xl font-bold text-blue-600">{statusCounts.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Đã nhận</p>
            <p className="text-xl font-bold text-green-600">{statusCounts.received}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Nhận một phần</p>
            <p className="text-xl font-bold text-orange-600">{statusCounts.partial}</p>
          </CardContent>
        </Card>
      </div>

      {/* Order List - Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Không tìm thấy đơn đặt hàng nào
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card
              key={order.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setSelectedOrder(order);
                setViewMode('detail');
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-base truncate">
                      {order.supplier?.name || 'NCC không xác định'}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    {(order.purchase_order_items || []).length} sản phẩm
                  </span>
                  <span className="text-sm font-semibold">
                    {formatPrice(getOrderTotal(order))}
                  </span>
                </div>
                {order.notes && (
                  <p className="text-xs text-muted-foreground mt-2 italic truncate">
                    {order.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Order List - Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <CardHeader>
            <CardTitle>Danh sách đơn đặt hàng</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Không tìm thấy đơn đặt hàng nào
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">NCC</th>
                      <th className="text-left py-3 px-2 font-medium">Ngày tạo</th>
                      <th className="text-center py-3 px-2 font-medium">Số SP</th>
                      <th className="text-right py-3 px-2 font-medium">Tổng tiền</th>
                      <th className="text-center py-3 px-2 font-medium">Trạng thái</th>
                      <th className="text-left py-3 px-2 font-medium">Ghi chú</th>
                      <th className="text-center py-3 px-2 font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="border-b last:border-b-0 hover:bg-muted/50">
                        <td className="py-3 px-2 font-medium">
                          {order.supplier?.name || '—'}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {formatDate(order.created_at)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {(order.purchase_order_items || []).length}
                        </td>
                        <td className="py-3 px-2 text-right font-semibold">
                          {formatPrice(getOrderTotal(order))}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {getStatusBadge(order.status)}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground truncate max-w-[200px]">
                          {order.notes || '—'}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() => {
                              setSelectedOrder(order);
                              setViewMode('detail');
                            }}
                          >
                            Chi tiết
                          </Button>
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
  );
}


// ============================================================
// Sub-component: PurchaseOrderForm (Tạo đơn đặt hàng mới)
// ============================================================

interface PurchaseOrderFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function PurchaseOrderForm({ onSuccess, onCancel }: PurchaseOrderFormProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [items, setItems] = useState<OrderItemDraft[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingWarnings, setPendingWarnings] = useState<PendingOrderWarning[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  /** Fetch suppliers và products */
  useEffect(() => {
    async function fetchData() {
      const [suppliersRes, productsRes] = await Promise.all([
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('products').select('id, name, brand, specification, base_unit, current_stock, selling_price').order('name'),
      ]);

      if (suppliersRes.data) setSuppliers(suppliersRes.data);
      if (productsRes.data) setProducts(productsRes.data);
    }
    fetchData();
  }, [supabase]);

  /** Kiểm tra đơn đặt hàng đang chờ cho sản phẩm */
  const checkPendingOrders = useCallback(async (productIds: string[]) => {
    if (productIds.length === 0) {
      setPendingWarnings([]);
      return;
    }

    const { data } = await supabase
      .from('purchase_order_items')
      .select('product_id, quantity, purchase_order_id, purchase_orders!inner(id, status, created_at)')
      .in('product_id', productIds)
      .in('purchase_orders.status', ['draft', 'pending']);

    if (data && data.length > 0) {
      const warnings: PendingOrderWarning[] = data.map((item: Record<string, unknown>) => {
        const po = item.purchase_orders as Record<string, unknown> | null;
        const product = products.find((p) => p.id === item.product_id);
        return {
          product_id: item.product_id as string,
          product_name: product?.name || 'Sản phẩm',
          order_id: (po?.id as string) || '',
          quantity: item.quantity as number,
          status: (po?.status as string) || '',
          created_at: (po?.created_at as string) || '',
        };
      });
      setPendingWarnings(warnings);
    } else {
      setPendingWarnings([]);
    }
  }, [supabase, products]);

  /** Khi thêm/xóa sản phẩm, kiểm tra pending orders */
  useEffect(() => {
    const productIds = items.map((i) => i.product_id);
    checkPendingOrders(productIds);
  }, [items, checkPendingOrders]);

  /** Lọc sản phẩm theo tìm kiếm */
  const filteredProducts = products.filter((p) => {
    if (!productSearch.trim()) return true;
    const query = productSearch.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(query) ||
      p.brand.toLowerCase().includes(query) ||
      p.specification.toLowerCase().includes(query)
    );
  });

  /** Thêm sản phẩm vào đơn */
  const addProduct = (product: ProductOption) => {
    // Kiểm tra trùng
    if (items.some((i) => i.product_id === product.id)) {
      setError('Sản phẩm đã có trong đơn');
      return;
    }

    setItems([
      ...items,
      {
        product_id: product.id,
        product_name: product.name,
        brand: product.brand,
        specification: product.specification,
        unit: product.base_unit,
        quantity: 1,
        unit_cost: 0,
        current_stock: product.current_stock,
      },
    ]);
    setProductSearch('');
    setShowProductDropdown(false);
    setError('');
  };

  /** Cập nhật số lượng */
  const updateItemQuantity = (index: number, quantity: number) => {
    const updated = [...items];
    updated[index].quantity = Math.max(1, quantity);
    setItems(updated);
  };

  /** Cập nhật đơn giá */
  const updateItemCost = (index: number, cost: number) => {
    const updated = [...items];
    updated[index].unit_cost = Math.max(0, cost);
    setItems(updated);
  };

  /** Xóa sản phẩm khỏi đơn */
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  /** Tính tổng tiền */
  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);

  /** Format giá tiền VND */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  };

  /** Submit đơn đặt hàng */
  const handleSubmit = async (status: 'draft' | 'pending') => {
    setError('');

    if (!selectedSupplierId) {
      setError('Vui lòng chọn nhà cung cấp');
      return;
    }
    if (items.length === 0) {
      setError('Vui lòng thêm ít nhất 1 sản phẩm');
      return;
    }

    setSaving(true);

    // Lấy user hiện tại
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
      setSaving(false);
      return;
    }

    // Tạo đơn đặt hàng
    const { data: orderData, error: orderError } = await supabase
      .from('purchase_orders')
      .insert({
        supplier_id: selectedSupplierId,
        status,
        notes: notes.trim() || null,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (orderError || !orderData) {
      setError('Lỗi tạo đơn đặt hàng: ' + (orderError?.message || 'Không xác định'));
      setSaving(false);
      return;
    }

    // Tạo các items
    const orderItems = items.map((item) => ({
      purchase_order_id: orderData.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit: item.unit,
      unit_cost: item.unit_cost,
      received_quantity: 0,
      line_total: item.quantity * item.unit_cost,
    }));

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(orderItems);

    if (itemsError) {
      setError('Lỗi thêm sản phẩm vào đơn: ' + itemsError.message);
      // Rollback: xóa đơn đã tạo
      await supabase.from('purchase_orders').delete().eq('id', orderData.id);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSuccess();
  };

  return (
    <div className="space-y-4 md:space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={onCancel} className="mb-2 -ml-2 text-sm">
            ← Quay lại
          </Button>
          <h1 className="text-xl md:text-2xl font-bold">Tạo đơn đặt hàng mới</h1>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Pending Order Warnings */}
      {pendingWarnings.length > 0 && (
        <div className="p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm space-y-1">
          <p className="font-medium">⚠️ Cảnh báo: Có đơn đặt hàng đang chờ cho sản phẩm trong đơn</p>
          {pendingWarnings.map((w, idx) => (
            <p key={idx} className="text-xs">
              • <strong>{w.product_name}</strong>: {w.quantity} đơn vị (trạng thái: {w.status === 'draft' ? 'Nháp' : 'Đang chờ'})
            </p>
          ))}
        </div>
      )}

      {/* Chọn NCC */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nhà cung cấp</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="order-supplier">Chọn nhà cung cấp *</Label>
            <select
              id="order-supplier"
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              required
            >
              <option value="">-- Chọn NCC --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.phone})
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Danh sách sản phẩm */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sản phẩm trong đơn</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tìm kiếm và thêm sản phẩm */}
          <div className="relative">
            <Label htmlFor="product-search">Thêm sản phẩm</Label>
            <Input
              id="product-search"
              placeholder="Tìm theo tên, thương hiệu, quy cách..."
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setShowProductDropdown(true);
              }}
              onFocus={() => setShowProductDropdown(true)}
              className="mt-1"
              aria-label="Tìm kiếm sản phẩm để thêm vào đơn"
            />
            {/* Dropdown kết quả tìm kiếm */}
            {showProductDropdown && productSearch.trim() && (
              <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Không tìm thấy sản phẩm</p>
                ) : (
                  filteredProducts.slice(0, 10).map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="w-full text-left p-3 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                      onClick={() => addProduct(product)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.brand} - {product.specification} ({product.base_unit})
                          </p>
                        </div>
                        <div className="text-right ml-2 shrink-0">
                          <p className="text-xs text-muted-foreground">
                            Tồn: <span className={product.current_stock <= 0 ? 'text-destructive font-medium' : ''}>{product.current_stock}</span>
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Click outside to close dropdown */}
          {showProductDropdown && (
            <div
              className="fixed inset-0 z-0"
              onClick={() => setShowProductDropdown(false)}
              aria-hidden="true"
            />
          )}

          {/* Danh sách items đã thêm */}
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Chưa có sản phẩm nào. Tìm kiếm và thêm sản phẩm ở trên.
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => {
                const hasPendingWarning = pendingWarnings.some((w) => w.product_id === item.product_id);
                return (
                  <div
                    key={item.product_id}
                    className={`p-3 border rounded-md space-y-2 ${hasPendingWarning ? 'border-yellow-300 bg-yellow-50/50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.brand} - {item.specification}
                        </p>
                        <p className="text-xs mt-1">
                          Tồn kho: <span className={item.current_stock <= 0 ? 'text-destructive font-semibold' : 'font-semibold'}>{item.current_stock}</span> {item.unit}
                        </p>
                        {hasPendingWarning && (
                          <p className="text-xs text-yellow-700 mt-1">
                            ⚠️ Có đơn đang chờ cho SP này
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-7 text-xs shrink-0"
                        onClick={() => removeItem(index)}
                      >
                        Xóa
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Số lượng</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Đơn giá (VNĐ)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="100"
                          value={item.unit_cost}
                          onChange={(e) => updateItemCost(index, parseFloat(e.target.value) || 0)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-right text-muted-foreground">
                      Thành tiền: <span className="font-semibold">{formatPrice(item.quantity * item.unit_cost)}</span>
                    </p>
                  </div>
                );
              })}

              {/* Tổng tiền */}
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-sm font-medium">Tổng cộng ({items.length} sản phẩm)</span>
                <span className="text-lg font-bold">{formatPrice(totalAmount)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ghi chú */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ghi chú</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ghi chú cho đơn đặt hàng (tùy chọn)..."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px] resize-y"
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={() => handleSubmit('draft')}
          variant="outline"
          disabled={saving}
          className="flex-1"
        >
          {saving ? 'Đang lưu...' : 'Lưu nháp'}
        </Button>
        <Button
          onClick={() => handleSubmit('pending')}
          disabled={saving}
          className="flex-1"
        >
          {saving ? 'Đang lưu...' : 'Gửi đơn đặt hàng'}
        </Button>
      </div>
    </div>
  );
}


// ============================================================
// Sub-component: PurchaseOrderDetail (Chi tiết đơn đặt hàng)
// ============================================================

interface PurchaseOrderDetailProps {
  order: PurchaseOrderRow;
  onBack: () => void;
  onStatusChange: () => void;
}

function PurchaseOrderDetail({ order, onBack, onStatusChange }: PurchaseOrderDetailProps) {
  const [updating, setUpdating] = useState(false);

  const supabase = useMemo(() => createClient(), []);

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

  /** Badge màu theo trạng thái */
  const getStatusBadge = (status: PurchaseOrder['status']) => {
    const config: Record<PurchaseOrder['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Nháp', variant: 'secondary' },
      pending: { label: 'Đang chờ', variant: 'default' },
      received: { label: 'Đã nhận', variant: 'outline' },
      partial: { label: 'Nhận một phần', variant: 'destructive' },
    };
    const { label, variant } = config[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  /** Cập nhật trạng thái đơn */
  const updateStatus = async (newStatus: PurchaseOrder['status']) => {
    setUpdating(true);
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: newStatus })
      .eq('id', order.id);

    if (error) {
      alert('Lỗi cập nhật trạng thái: ' + error.message);
    } else {
      onStatusChange();
    }
    setUpdating(false);
  };

  /** Xóa đơn (chỉ cho draft) */
  const deleteOrder = async () => {
    if (!confirm('Bạn có chắc muốn xóa đơn đặt hàng này?')) return;

    setUpdating(true);
    // Xóa items trước
    await supabase.from('purchase_order_items').delete().eq('purchase_order_id', order.id);
    // Xóa đơn
    const { error } = await supabase.from('purchase_orders').delete().eq('id', order.id);

    if (error) {
      alert('Lỗi xóa đơn: ' + error.message);
    } else {
      onStatusChange();
    }
    setUpdating(false);
  };

  const totalAmount = (order.purchase_order_items || []).reduce((sum, item) => sum + item.line_total, 0);

  return (
    <div className="space-y-4 md:space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Button variant="ghost" onClick={onBack} className="mb-2 -ml-2 text-sm">
          ← Quay lại
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold">Chi tiết đơn đặt hàng</h1>
          {getStatusBadge(order.status)}
        </div>
      </div>

      {/* Thông tin chung */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin đơn hàng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Nhà cung cấp:</span>
              <span className="ml-2 font-medium">{order.supplier?.name || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ngày tạo:</span>
              <span className="ml-2">{formatDate(order.created_at)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Tổng tiền:</span>
              <span className="ml-2 font-semibold">{formatPrice(totalAmount)}</span>
            </div>
            {order.notes && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Ghi chú:</span>
                <span className="ml-2 italic">{order.notes}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Danh sách sản phẩm */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Sản phẩm ({(order.purchase_order_items || []).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(order.purchase_order_items || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Không có sản phẩm
            </p>
          ) : (
            <div className="space-y-3">
              {(order.purchase_order_items || []).map((item) => (
                <div key={item.id} className="p-3 border rounded-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.product?.name || 'Sản phẩm không xác định'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.product?.brand} - {item.product?.specification}
                      </p>
                    </div>
                    <p className="text-sm font-semibold shrink-0">
                      {formatPrice(item.line_total)}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">SL đặt:</span>
                      <span className="ml-1 font-medium">{item.quantity} {item.unit}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Đơn giá:</span>
                      <span className="ml-1">{formatPrice(item.unit_cost)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tồn kho:</span>
                      <span className={`ml-1 font-medium ${(item.product?.current_stock || 0) <= 0 ? 'text-destructive' : ''}`}>
                        {item.product?.current_stock ?? '—'}
                      </span>
                    </div>
                  </div>
                  {item.received_quantity > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      Đã nhận: {item.received_quantity} {item.unit}
                    </p>
                  )}
                </div>
              ))}

              {/* Tổng */}
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-sm font-medium">Tổng cộng</span>
                <span className="text-lg font-bold">{formatPrice(totalAmount)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-2">
            {order.status === 'draft' && (
              <>
                <Button
                  onClick={() => updateStatus('pending')}
                  disabled={updating}
                  className="flex-1"
                >
                  Gửi đơn (Chuyển sang Đang chờ)
                </Button>
                <Button
                  variant="destructive"
                  onClick={deleteOrder}
                  disabled={updating}
                  className="flex-1 sm:flex-none"
                >
                  Xóa đơn
                </Button>
              </>
            )}
            {order.status === 'pending' && (
              <>
                <Button
                  onClick={() => updateStatus('received')}
                  disabled={updating}
                  className="flex-1"
                >
                  Đánh dấu Đã nhận đủ
                </Button>
                <Button
                  variant="outline"
                  onClick={() => updateStatus('partial')}
                  disabled={updating}
                  className="flex-1"
                >
                  Nhận một phần
                </Button>
                <Button
                  variant="outline"
                  onClick={() => updateStatus('draft')}
                  disabled={updating}
                  className="flex-1 sm:flex-none"
                >
                  Chuyển về Nháp
                </Button>
              </>
            )}
            {order.status === 'partial' && (
              <Button
                onClick={() => updateStatus('received')}
                disabled={updating}
                className="flex-1"
              >
                Đánh dấu Đã nhận đủ
              </Button>
            )}
            {order.status === 'received' && (
              <p className="text-sm text-muted-foreground text-center w-full">
                Đơn hàng đã hoàn thành
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
