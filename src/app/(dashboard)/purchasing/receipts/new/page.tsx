'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ProductSearch } from '@/components/shared/ProductSearch';
import type { Product, Supplier } from '@/lib/types';
import { useRouter } from 'next/navigation';

// === Local Types ===

interface ReceiptItemDraft {
  id: string;
  product: Product;
  quantity: number;
  unit_cost: number;
  ordered_quantity?: number; // Số lượng đặt (từ PO)
}

interface PromotionalItemDraft {
  id: string;
  product: Product;
  quantity: number;
  unit: string;
  notes: string;
}

interface DefectiveItemDraft {
  id: string;
  product: Product;
  quantity: number;
  unit: string;
  reason: string;
}

/**
 * Trang tạo Phiếu nhập kho mới
 *
 * Form nhập kho bao gồm:
 * - Chọn nhà cung cấp
 * - Danh sách sản phẩm với số lượng và đơn giá nhập
 * - So sánh số lượng đặt vs thực nhận
 * - Ghi nhận hàng khuyến mãi kèm theo
 * - Ghi nhận hàng lỗi để trả NCC
 * - Xác nhận: auto cộng tồn kho, tính lại WAC, cập nhật last_cost
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
export default function NewGoodsReceiptPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Form state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [items, setItems] = useState<ReceiptItemDraft[]>([]);
  const [promotionalItems, setPromotionalItems] = useState<PromotionalItemDraft[]>([]);
  const [defectiveItems, setDefectiveItems] = useState<DefectiveItemDraft[]>([]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [activeSection, setActiveSection] = useState<'items' | 'promo' | 'defective'>('items');

  // Fetch suppliers on mount
  useEffect(() => {
    async function loadSuppliers() {
      const { data, error: err } = await supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });
      if (!err && data) {
        setSuppliers(data);
      }
      setLoadingSuppliers(false);
    }
    loadSuppliers();
  }, [supabase]);

  // Filtered suppliers for search
  const filteredSuppliers = suppliers.filter(
    (s) =>
      !supplierSearch ||
      s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.phone.includes(supplierSearch)
  );

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  // === Item Management ===

  const handleAddProduct = useCallback((product: Product) => {
    setItems((prev) => {
      // Check if product already in list
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) return prev;
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          product,
          quantity: 1,
          unit_cost: product.last_cost || 0,
          ordered_quantity: undefined,
        },
      ];
    });
  }, []);

  const handleRemoveItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  const handleUpdateItem = useCallback(
    (itemId: string, field: 'quantity' | 'unit_cost' | 'ordered_quantity', value: number) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, [field]: value } : item
        )
      );
    },
    []
  );

  // === Promotional Items ===

  const handleAddPromoProduct = useCallback((product: Product) => {
    setPromotionalItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        product,
        quantity: 1,
        unit: product.base_unit,
        notes: '',
      },
    ]);
  }, []);

  const handleRemovePromoItem = useCallback((itemId: string) => {
    setPromotionalItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  const handleUpdatePromoItem = useCallback(
    (itemId: string, field: 'quantity' | 'notes', value: string | number) => {
      setPromotionalItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, [field]: value } : item
        )
      );
    },
    []
  );

  // === Defective Items ===

  const handleAddDefectiveProduct = useCallback((product: Product) => {
    setDefectiveItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        product,
        quantity: 1,
        unit: product.base_unit,
        reason: '',
      },
    ]);
  }, []);

  const handleRemoveDefectiveItem = useCallback((itemId: string) => {
    setDefectiveItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  const handleUpdateDefectiveItem = useCallback(
    (itemId: string, field: 'quantity' | 'reason', value: string | number) => {
      setDefectiveItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, [field]: value } : item
        )
      );
    },
    []
  );

  // === Calculations ===

  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_cost,
    0
  );

  // === Submit ===

  const handleSaveDraft = async () => {
    await handleSubmit('pending');
  };

  const handleConfirm = async () => {
    await handleSubmit('confirmed');
  };

  async function handleSubmit(status: 'pending' | 'confirmed') {
    if (!selectedSupplierId) {
      setError('Vui lòng chọn nhà cung cấp');
      return;
    }
    if (items.length === 0) {
      setError('Vui lòng thêm ít nhất 1 sản phẩm');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create goods_receipt
      const { data: receipt, error: receiptError } = await supabase
        .from('goods_receipts')
        .insert({
          supplier_id: selectedSupplierId,
          status,
          created_by: 'current-user-id', // TODO: get from auth context
        })
        .select()
        .single();

      if (receiptError || !receipt) {
        throw new Error(receiptError?.message || 'Không thể tạo phiếu nhập');
      }

      // 2. Insert goods_receipt_items
      const receiptItems = items.map((item) => ({
        goods_receipt_id: receipt.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit: item.product.base_unit,
        unit_cost: item.unit_cost,
        line_total: item.quantity * item.unit_cost,
      }));

      const { error: itemsError } = await supabase
        .from('goods_receipt_items')
        .insert(receiptItems);

      if (itemsError) {
        throw new Error(itemsError.message || 'Không thể lưu danh sách sản phẩm');
      }

      // 3. Insert promotional_items (if any)
      if (promotionalItems.length > 0) {
        const promoData = promotionalItems.map((item) => ({
          goods_receipt_id: receipt.id,
          product_id: item.product.id,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes || null,
        }));

        const { error: promoError } = await supabase
          .from('promotional_items')
          .insert(promoData);

        if (promoError) {
          console.error('Lỗi lưu hàng khuyến mãi:', promoError.message);
        }
      }

      // 4. Insert defective_items (if any)
      if (defectiveItems.length > 0) {
        const defectiveData = defectiveItems.map((item) => ({
          goods_receipt_id: receipt.id,
          product_id: item.product.id,
          quantity: item.quantity,
          unit: item.unit,
          reason: item.reason,
          status: 'pending_return',
        }));

        const { error: defectiveError } = await supabase
          .from('defective_items')
          .insert(defectiveData);

        if (defectiveError) {
          console.error('Lỗi lưu hàng lỗi:', defectiveError.message);
        }
      }

      // Note: When status = 'confirmed', database triggers automatically:
      // - Increase stock (current_stock += quantity)
      // - Recalculate WAC
      // - Update last_cost
      // - Create price_history record

      setSuccess(true);
      setTimeout(() => {
        router.push('/purchasing/receipts');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Format giá tiền VND */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-green-700">Tạo phiếu nhập thành công!</h2>
          <p className="text-sm text-muted-foreground mt-2">Đang chuyển hướng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Tạo phiếu nhập kho</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nhập hàng từ nhà cung cấp
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          Quay lại
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Supplier Selection */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Nhà cung cấp</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedSupplier ? (
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div>
                <p className="font-medium">{selectedSupplier.name}</p>
                <p className="text-sm text-muted-foreground">{selectedSupplier.phone}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSupplierId('')}
              >
                Đổi NCC
              </Button>
            </div>
          ) : (
            <div>
              <Input
                placeholder="Tìm nhà cung cấp theo tên hoặc SĐT..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="mb-3"
                aria-label="Tìm nhà cung cấp"
              />
              {loadingSuppliers ? (
                <p className="text-sm text-muted-foreground">Đang tải...</p>
              ) : filteredSuppliers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Không tìm thấy NCC</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredSuppliers.map((supplier) => (
                    <button
                      key={supplier.id}
                      type="button"
                      className="w-full text-left p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors"
                      onClick={() => {
                        setSelectedSupplierId(supplier.id);
                        setSupplierSearch('');
                      }}
                    >
                      <p className="font-medium text-sm">{supplier.name}</p>
                      <p className="text-xs text-muted-foreground">{supplier.phone}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Button
          variant={activeSection === 'items' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('items')}
        >
          Sản phẩm nhập ({items.length})
        </Button>
        <Button
          variant={activeSection === 'promo' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('promo')}
        >
          Hàng KM ({promotionalItems.length})
        </Button>
        <Button
          variant={activeSection === 'defective' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('defective')}
        >
          Hàng lỗi ({defectiveItems.length})
        </Button>
      </div>

      {/* Main Items Section */}
      {activeSection === 'items' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Danh sách sản phẩm nhập</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Product Search */}
            <ProductSearch
              onSelectProduct={handleAddProduct}
              placeholder="Tìm sản phẩm để thêm vào phiếu nhập..."
              showBarcodeScanner={true}
            />

            {/* Items List */}
            {items.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <p className="text-sm">Chưa có sản phẩm nào</p>
                <p className="text-xs mt-1">Tìm kiếm hoặc quét mã vạch để thêm</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <ReceiptItemRow
                    key={item.id}
                    item={item}
                    onUpdate={handleUpdateItem}
                    onRemove={handleRemoveItem}
                    formatPrice={formatPrice}
                  />
                ))}
              </div>
            )}

            {/* Total */}
            {items.length > 0 && (
              <div className="pt-3 border-t flex justify-between items-center">
                <span className="font-medium">Tổng tiền nhập:</span>
                <span className="text-xl font-bold text-primary">
                  {formatPrice(totalAmount)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Promotional Items Section */}
      {activeSection === 'promo' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hàng khuyến mãi kèm theo</CardTitle>
            <p className="text-xs text-muted-foreground">
              Ví dụ: mua 10 tặng 1 — ghi nhận hàng tặng kèm
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProductSearch
              onSelectProduct={handleAddPromoProduct}
              placeholder="Tìm sản phẩm khuyến mãi..."
              showBarcodeScanner={false}
            />

            {promotionalItems.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <p className="text-sm">Chưa có hàng khuyến mãi</p>
              </div>
            ) : (
              <div className="space-y-3">
                {promotionalItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 border rounded-lg space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.product.brand} · {item.product.specification}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePromoItem(item.id)}
                        aria-label="Xóa hàng khuyến mãi"
                      >
                        ✕
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-24">
                        <Label className="text-xs">Số lượng</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdatePromoItem(item.id, 'quantity', parseInt(e.target.value) || 1)
                          }
                          className="h-9 mt-1"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Ghi chú</Label>
                        <Input
                          type="text"
                          value={item.notes}
                          onChange={(e) =>
                            handleUpdatePromoItem(item.id, 'notes', e.target.value)
                          }
                          placeholder="VD: Mua 10 tặng 1"
                          className="h-9 mt-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Defective Items Section */}
      {activeSection === 'defective' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hàng lỗi trả NCC</CardTitle>
            <p className="text-xs text-muted-foreground">
              Ghi nhận hàng lỗi để trả nhà cung cấp trong đợt giao tiếp theo
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProductSearch
              onSelectProduct={handleAddDefectiveProduct}
              placeholder="Tìm sản phẩm lỗi..."
              showBarcodeScanner={false}
            />

            {defectiveItems.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <p className="text-sm">Chưa có hàng lỗi</p>
              </div>
            ) : (
              <div className="space-y-3">
                {defectiveItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 border border-red-200 bg-red-50/50 rounded-lg space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.product.brand} · {item.product.specification}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDefectiveItem(item.id)}
                        aria-label="Xóa hàng lỗi"
                      >
                        ✕
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-24">
                        <Label className="text-xs">Số lượng</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateDefectiveItem(
                              item.id,
                              'quantity',
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="h-9 mt-1"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Lý do lỗi</Label>
                        <Input
                          type="text"
                          value={item.reason}
                          onChange={(e) =>
                            handleUpdateDefectiveItem(item.id, 'reason', e.target.value)
                          }
                          placeholder="VD: Hàng bể, hàng hết hạn..."
                          className="h-9 mt-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sticky Footer - Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 md:static md:border-t-0 md:p-0">
        <div className="flex gap-3 max-w-screen-xl mx-auto">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={handleSaveDraft}
            disabled={isSubmitting || items.length === 0}
          >
            {isSubmitting ? 'Đang lưu...' : 'Lưu nháp'}
          </Button>
          <Button
            size="lg"
            className="flex-1"
            onClick={handleConfirm}
            disabled={isSubmitting || items.length === 0 || !selectedSupplierId}
          >
            {isSubmitting ? 'Đang xử lý...' : 'Xác nhận nhập kho'}
          </Button>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-2 md:mt-1">
          Xác nhận sẽ tự động cộng tồn kho và cập nhật giá vốn
        </p>
      </div>
    </div>
  );
}

// === Sub-components ===

interface ReceiptItemRowProps {
  item: ReceiptItemDraft;
  onUpdate: (id: string, field: 'quantity' | 'unit_cost' | 'ordered_quantity', value: number) => void;
  onRemove: (id: string) => void;
  formatPrice: (price: number) => string;
}

/**
 * Row hiển thị một sản phẩm trong phiếu nhập
 * Bao gồm so sánh số lượng đặt vs thực nhận
 */
function ReceiptItemRow({ item, onUpdate, onRemove, formatPrice }: ReceiptItemRowProps) {
  const lineTotal = item.quantity * item.unit_cost;
  const hasOrderedQty = item.ordered_quantity !== undefined && item.ordered_quantity > 0;
  const qtyDiff = hasOrderedQty ? item.quantity - (item.ordered_quantity || 0) : 0;

  return (
    <div className="p-3 border rounded-lg space-y-2">
      {/* Product info + remove */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{item.product.name}</p>
          <p className="text-xs text-muted-foreground">
            {item.product.brand} · {item.product.specification} · {item.product.base_unit}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(item.id)}
          aria-label={`Xóa ${item.product.name}`}
        >
          ✕
        </Button>
      </div>

      {/* Quantity, Unit Cost, Ordered Qty */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">SL thực nhận</Label>
          <Input
            type="number"
            min={0.01}
            step="any"
            value={item.quantity}
            onChange={(e) => onUpdate(item.id, 'quantity', parseFloat(e.target.value) || 0)}
            className="h-9 mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Đơn giá nhập (đ)</Label>
          <Input
            type="number"
            min={0}
            step="any"
            value={item.unit_cost}
            onChange={(e) => onUpdate(item.id, 'unit_cost', parseFloat(e.target.value) || 0)}
            className="h-9 mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">SL đặt (PO)</Label>
          <Input
            type="number"
            min={0}
            step="any"
            value={item.ordered_quantity || ''}
            onChange={(e) =>
              onUpdate(item.id, 'ordered_quantity', parseFloat(e.target.value) || 0)
            }
            placeholder="—"
            className="h-9 mt-1"
          />
        </div>
      </div>

      {/* Line total + comparison */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {hasOrderedQty && (
            <Badge
              variant={qtyDiff === 0 ? 'success' : qtyDiff > 0 ? 'secondary' : 'destructive'}
              className="text-xs"
            >
              {qtyDiff === 0
                ? 'Đủ hàng'
                : qtyDiff > 0
                ? `Thừa ${qtyDiff}`
                : `Thiếu ${Math.abs(qtyDiff)}`}
            </Badge>
          )}
        </div>
        <span className="text-sm font-semibold text-primary">
          {formatPrice(lineTotal)}
        </span>
      </div>
    </div>
  );
}
