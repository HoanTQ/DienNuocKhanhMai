'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { ShoppingCart, Minus, Plus, Trash2, Banknote, Building, Percent, Hash } from 'lucide-react';
import { ProductSearch } from '@/components/shared/ProductSearch';
import {
  usePOSStore,
  getSubtotal,
  getDiscountAmount,
  getTotal,
} from '@/lib/stores/pos.store';
import type { Product, UnitConversion, UserProfile } from '@/lib/types';
import { POSCustomerSelect } from '@/components/pos/POSCustomerSelect';
import { createClient } from '@/lib/supabase/client';
import { convertUnit } from '@/services/pricing.service';

/**
 * POS Page — Approach 2: Compact dropdown overlay + scrollable cart
 *
 * - Search bar sticky top
 * - Dropdown max 220px (3-4 items), auto-close on select
 * - Cart scrolls independently below
 * - Payment summary fixed bottom
 * - Desktop: split view (search+cart left | payment right)
 * - Hỗ trợ bán theo đơn vị quy đổi (cuộn, thùng...) với giá tự tính
 */
export default function POSPage() {
  const {
    cartItems,
    customer,
    discountType,
    discountValue,
    paymentMethod,
    isCredit,
    isSubmitting,
    lastOrderResult,
    error,
    addItem,
    removeItem,
    updateItemQuantity,
    setDiscount,
    setCustomer,
    setPaymentMethod,
    setIsCredit,
    clearCart,
    submitOrder,
    clearError,
    clearLastOrder,
  } = usePOSStore();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Unit selection modal state
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [productConversions, setProductConversions] = useState<UnitConversion[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [addQuantity, setAddQuantity] = useState<number>(1);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      if (profile) setCurrentUser(profile as UserProfile);
    };
    fetchUser();
  }, [supabase]);

  const subtotal = getSubtotal(cartItems);
  const discountAmount = getDiscountAmount(subtotal, discountType, discountValue);
  const total = getTotal(subtotal, discountAmount);

  /**
   * Khi chọn sản phẩm từ search, fetch conversions để hiển thị cho chọn đơn vị.
   * Nếu sản phẩm không có quy đổi → thêm trực tiếp với base_unit.
   */
  const handleProductSelected = useCallback(async (product: Product) => {
    // Fetch unit conversions for this product
    const { data: conversions } = await supabase
      .from('unit_conversions')
      .select('*')
      .eq('product_id', product.id)
      .order('level', { ascending: true });

    if (!conversions || conversions.length === 0) {
      // No conversions → add directly with base_unit
      addItem(product, 1, product.base_unit);
    } else {
      // Show unit selection
      setPendingProduct(product);
      setProductConversions(conversions);
      setSelectedUnit(product.base_unit);
      setAddQuantity(1);
    }
  }, [supabase, addItem]);

  /**
   * Tính giá bán theo đơn vị được chọn.
   * Ưu tiên: selling_price riêng (nếu có) > tự tính từ base_price × conversion_rate
   */
  const getUnitPrice = useCallback((product: Product, unit: string, conversions: UnitConversion[]): number => {
    if (unit === product.base_unit) {
      return product.selling_price;
    }

    // Tìm conversion có selling_price riêng cho đơn vị này
    const convWithPrice = conversions.find(
      (c) => c.from_unit === unit && c.selling_price != null && c.selling_price > 0
    );
    if (convWithPrice && convWithPrice.selling_price) {
      return convWithPrice.selling_price;
    }

    // Fallback: tự tính = base_price × conversion_rate
    try {
      const rateToBase = convertUnit(1, unit, product.base_unit, conversions);
      return product.selling_price * rateToBase;
    } catch {
      return product.selling_price;
    }
  }, []);

  /** Xác nhận thêm sản phẩm với đơn vị đã chọn */
  const handleConfirmAddItem = useCallback(() => {
    if (!pendingProduct) return;
    const unitPrice = getUnitPrice(pendingProduct, selectedUnit, productConversions);
    // Override selling_price with calculated unit price
    addItem({ ...pendingProduct, selling_price: unitPrice }, addQuantity, selectedUnit);
    setPendingProduct(null);
    setProductConversions([]);
  }, [pendingProduct, selectedUnit, addQuantity, productConversions, addItem, getUnitPrice]);

  /** Đóng modal chọn đơn vị */
  const handleCancelUnitSelection = useCallback(() => {
    setPendingProduct(null);
    setProductConversions([]);
  }, []);

  /** Lấy danh sách đơn vị có thể bán (base + tất cả from_unit) */
  const availableUnits = useMemo(() => {
    if (!pendingProduct) return [];
    const units = new Set<string>();
    units.add(pendingProduct.base_unit);
    productConversions.forEach((c) => {
      units.add(c.from_unit);
      units.add(c.to_unit);
    });
    return Array.from(units);
  }, [pendingProduct, productConversions]);

  const handleSubmitOrder = useCallback(async () => {
    const userId = currentUser?.id || 'unknown';
    const userMaxDiscount = currentUser?.role === 'staff'
      ? currentUser.max_discount_percent
      : undefined;
    await submitOrder(userId, userMaxDiscount);
  }, [submitOrder, currentUser]);

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-4rem)]">

      {/* === Left Panel: Search + Cart === */}
      <div className="flex-1 flex flex-col lg:border-r border-border overflow-hidden">

        {/* Search Bar - Sticky top with compact dropdown */}
        <div className="flex-shrink-0 bg-white border-b border-border p-3 lg:p-4 z-10">
          <ProductSearch
            onSelectProduct={handleProductSelected}
            placeholder="Quét mã vạch hoặc tìm sản phẩm..."
            showBarcodeScanner={true}
          />
        </div>

        {/* Success Message */}
        {lastOrderResult?.success && (
          <div className="mx-3 lg:mx-4 mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex-shrink-0" role="alert">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-green-800 text-sm">Đơn hàng thành công!</p>
                <p className="text-xs text-green-600 mt-0.5">Mã: {lastOrderResult.order?.order_number}</p>
              </div>
              <button onClick={clearLastOrder} className="text-green-600 hover:text-green-800 p-1 cursor-pointer">✕</button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mx-3 lg:mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex-shrink-0" role="alert">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-700">{error}</p>
              <button onClick={clearError} className="text-red-500 hover:text-red-700 p-1 cursor-pointer">✕</button>
            </div>
          </div>
        )}

        {/* Cart Items - Scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 lg:p-4">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">Giỏ hàng trống</p>
              <p className="text-xs mt-1">Quét mã vạch hoặc tìm kiếm để thêm sản phẩm</p>
            </div>
          ) : (
            <>
              {/* Cart header */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Giỏ hàng ({cartItems.length} sản phẩm)
                </h2>
                <button
                  onClick={clearCart}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                >
                  Xóa tất cả
                </button>
              </div>

              {/* Cart items */}
              <ul className="space-y-2">
                {cartItems.map((item) => (
                  <li
                    key={item.id}
                    className="p-3 border border-border rounded-lg"
                  >
                    {/* Row 1: Product name + line total + delete */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {item.product_name}
                        </p>
                        {/* Thương hiệu + Quy cách badges */}
                        {(item.brand || item.specification) && (
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {item.brand && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0" aria-hidden="true">
                                  <path d="M8.5 2.687a.5.5 0 0 0-1 0v.403a3.251 3.251 0 0 0-2.592 2.175l-.089.267a3.25 3.25 0 0 0 1.164 3.582l.639.466a1.75 1.75 0 0 1 .627 1.93l-.095.286A3.25 3.25 0 0 0 10.23 14.7l.089-.267a3.25 3.25 0 0 0-1.164-3.582l-.639-.466a1.75 1.75 0 0 1-.627-1.93l.095-.286a1.75 1.75 0 0 1 1.396-1.172V5.5h1a.5.5 0 0 0 0-1h-1V2.687Z"/>
                                </svg>
                                {item.brand}
                              </span>
                            )}
                            {item.specification && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0" aria-hidden="true">
                                  <path fillRule="evenodd" d="M4.5 2A2.5 2.5 0 0 0 2 4.5v2.879a2.5 2.5 0 0 0 .732 1.767l4.5 4.5a2.5 2.5 0 0 0 3.536 0l2.878-2.878a2.5 2.5 0 0 0 0-3.536l-4.5-4.5A2.5 2.5 0 0 0 7.38 2H4.5ZM5 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd"/>
                                </svg>
                                {item.specification}
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="font-mono">{formatPrice(item.unit_price)}</span>/{item.unit}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Row 2: Quantity controls + line total */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (item.quantity > 1) updateItemQuantity(item.id, item.quantity - 1);
                            else removeItem(item.id);
                          }}
                          className="w-9 h-9 flex items-center justify-center rounded-md border border-border hover:bg-muted transition-colors cursor-pointer"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          type="number"
                          min={0.01}
                          step="any"
                          value={item.quantity}
                          onChange={(e) => {
                            const qty = parseFloat(e.target.value);
                            if (!isNaN(qty) && qty > 0) updateItemQuantity(item.id, qty);
                          }}
                          className="w-14 h-9 text-center text-sm font-medium border border-border rounded-md focus:border-primary focus:outline-none"
                        />
                        <button
                          onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                          className="w-9 h-9 flex items-center justify-center rounded-md border border-border hover:bg-muted transition-colors cursor-pointer"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-lg font-bold font-mono text-foreground">
                        {formatPrice(item.line_total)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Mobile: Mini payment bar fixed bottom (shows total + pay button) */}
        {cartItems.length > 0 && (
          <div className="lg:hidden flex-shrink-0 border-t border-border p-3 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Tổng cộng</span>
              <span className="text-lg font-bold font-mono">{formatPrice(total)}</span>
            </div>
            <button
              onClick={handleSubmitOrder}
              disabled={isSubmitting}
              className="w-full h-12 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Đang xử lý...' : `Thanh toán ${formatPrice(total)}`}
            </button>
          </div>
        )}
      </div>

      {/* === Right Panel: Payment (Desktop only) === */}
      <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] flex-col bg-white overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Discount */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Giảm giá</label>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setDiscount('fixed', discountValue)}
                className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  discountType === 'fixed' ? 'border-primary bg-accent text-primary' : 'border-border text-muted-foreground'
                }`}
              >
                <Hash className="h-3.5 w-3.5" /> Số tiền
              </button>
              <button
                onClick={() => setDiscount('percentage', discountValue)}
                className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  discountType === 'percentage' ? 'border-primary bg-accent text-primary' : 'border-border text-muted-foreground'
                }`}
              >
                <Percent className="h-3.5 w-3.5" /> %
              </button>
            </div>
            <input
              type="number"
              min={0}
              max={discountType === 'percentage' ? 100 : undefined}
              value={discountValue || ''}
              onChange={(e) => setDiscount(discountType, parseFloat(e.target.value) || 0)}
              placeholder={discountType === 'fixed' ? 'Nhập số tiền giảm...' : 'Nhập % giảm...'}
              className="w-full h-10 mt-2 px-3 rounded-lg border border-border text-sm focus:border-primary focus:outline-none"
            />
            {discountAmount > 0 && (
              <p className="text-xs text-green-600 mt-1.5 font-medium">Giảm: -{formatPrice(discountAmount)}</p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Thanh toán</label>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`flex-1 h-12 rounded-lg border text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                  paymentMethod === 'cash' ? 'border-primary bg-accent text-primary' : 'border-border text-muted-foreground'
                }`}
              >
                <Banknote className="h-4 w-4" /> Tiền mặt
              </button>
              <button
                onClick={() => setPaymentMethod('transfer')}
                className={`flex-1 h-12 rounded-lg border text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                  paymentMethod === 'transfer' ? 'border-primary bg-accent text-primary' : 'border-border text-muted-foreground'
                }`}
              >
                <Building className="h-4 w-4" /> Chuyển khoản
              </button>
            </div>
          </div>

          {/* Credit toggle */}
          <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
            <div>
              <p className="text-sm font-medium">Mua nợ</p>
              <p className="text-xs text-muted-foreground">Ghi nhận công nợ</p>
            </div>
            <button
              onClick={() => setIsCredit(!isCredit)}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${isCredit ? 'bg-primary' : 'bg-border'}`}
              role="switch"
              aria-checked={isCredit}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isCredit ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {isCredit && <POSCustomerSelect selectedCustomer={customer} onSelect={setCustomer} />}
        </div>

        {/* Desktop Payment Summary */}
        <div className="border-t border-border p-4 bg-white flex-shrink-0">
          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tạm tính ({cartItems.length} SP)</span>
              <span className="font-mono">{formatPrice(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Giảm giá</span>
                <span className="text-green-600 font-mono">-{formatPrice(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="font-semibold">Tổng cộng</span>
              <span className="text-xl font-bold font-mono">{formatPrice(total)}</span>
            </div>
          </div>
          <button
            onClick={handleSubmitOrder}
            disabled={cartItems.length === 0 || isSubmitting}
            className="w-full h-14 rounded-lg bg-green-600 text-white text-base font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang xử lý...
              </>
            ) : (
              `Thanh toán ${formatPrice(total)}`
            )}
          </button>
        </div>
      </div>

      {/* === Unit Selection Modal === */}
      {pendingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCancelUnitSelection}
          />
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-[90%] max-w-sm mx-4 overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-base">Chọn đơn vị bán</h3>
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {pendingProduct.name} — {pendingProduct.brand}
              </p>
            </div>
            <div className="p-4 space-y-4">
              {/* Unit buttons */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Đơn vị
                </label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {availableUnits.map((unit) => {
                    const price = getUnitPrice(pendingProduct, unit, productConversions);
                    return (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => setSelectedUnit(unit)}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                          selectedUnit === unit
                            ? 'border-primary bg-accent text-primary'
                            : 'border-border text-foreground hover:border-primary/50'
                        }`}
                      >
                        <span>{unit}</span>
                        <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                          {formatPrice(price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Số lượng
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setAddQuantity(Math.max(0.01, addQuantity - 1))}
                    className="w-10 h-10 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    min={0.01}
                    step="any"
                    value={addQuantity}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v > 0) setAddQuantity(v);
                    }}
                    className="w-20 h-10 text-center text-base font-medium border border-border rounded-lg focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setAddQuantity(addQuantity + 1)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Preview */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Đơn giá:</span>
                  <span className="font-mono font-medium">
                    {formatPrice(getUnitPrice(pendingProduct, selectedUnit, productConversions))}/{selectedUnit}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Thành tiền:</span>
                  <span className="font-mono font-semibold text-primary">
                    {formatPrice(addQuantity * getUnitPrice(pendingProduct, selectedUnit, productConversions))}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-border flex gap-3">
              <button
                type="button"
                onClick={handleCancelUnitSelection}
                className="flex-1 h-11 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmAddItem}
                className="flex-1 h-11 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Thêm vào giỏ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
