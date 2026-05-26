'use client';

import { useState, useCallback, useEffect } from 'react';
import { ShoppingCart, Minus, Plus, Trash2, Banknote, Building, Percent, Hash } from 'lucide-react';
import { ProductSearch } from '@/components/shared/ProductSearch';
import {
  usePOSStore,
  getSubtotal,
  getDiscountAmount,
  getTotal,
} from '@/lib/stores/pos.store';
import type { Product, UserProfile } from '@/lib/types';
import { POSCustomerSelect } from '@/components/pos/POSCustomerSelect';
import { createClient } from '@/lib/supabase/client';

/**
 * POS Page — Approach 2: Compact dropdown overlay + scrollable cart
 *
 * - Search bar sticky top
 * - Dropdown max 220px (3-4 items), auto-close on select
 * - Cart scrolls independently below
 * - Payment summary fixed bottom
 * - Desktop: split view (search+cart left | payment right)
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

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
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
  }, []);

  const subtotal = getSubtotal(cartItems);
  const discountAmount = getDiscountAmount(subtotal, discountType, discountValue);
  const total = getTotal(subtotal, discountAmount);

  const handleQuickAdd = useCallback((product: Product) => {
    addItem(product, 1, product.base_unit);
  }, [addItem]);

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
            onSelectProduct={handleQuickAdd}
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
                        <p className="text-xs text-muted-foreground mt-0.5">
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
                      <p className="text-base font-semibold font-mono text-foreground">
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
    </div>
  );
}
