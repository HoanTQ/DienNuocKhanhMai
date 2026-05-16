'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ProductSearch } from '@/components/shared/ProductSearch';
import {
  usePOSStore,
  getSubtotal,
  getDiscountAmount,
  getTotal,
} from '@/lib/stores/pos.store';
import type { Product, Customer, UserProfile } from '@/lib/types';
import { POSCartList } from '@/components/pos/POSCartList';
import { POSCustomerSelect } from '@/components/pos/POSCustomerSelect';
import { createClient } from '@/lib/supabase/client';

/**
 * Trang POS - Bán hàng tại quầy
 *
 * Mobile-first layout:
 * - Trên mobile: stack vertical (search → cart → payment)
 * - Trên desktop: 2 columns (search+cart | payment summary)
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.2, 5.3, 22.1
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

  const [addQuantity, setAddQuantity] = useState<number>(1);
  const [addUnit, setAddUnit] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  /** Fetch current user profile on mount to get max_discount_percent */
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

      if (profile) {
        setCurrentUser(profile as UserProfile);
      }
    };
    fetchUser();
  }, []);

  // Computed values
  const subtotal = getSubtotal(cartItems);
  const discountAmount = getDiscountAmount(subtotal, discountType, discountValue);
  const total = getTotal(subtotal, discountAmount);

  /** Xử lý khi chọn sản phẩm từ search */
  const handleSelectProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setAddUnit(product.base_unit);
    setAddQuantity(1);
  }, []);

  /** Thêm sản phẩm đã chọn vào giỏ */
  const handleAddToCart = useCallback(() => {
    if (!selectedProduct) return;
    addItem(selectedProduct, addQuantity, addUnit || selectedProduct.base_unit);
    setSelectedProduct(null);
    setAddQuantity(1);
    setAddUnit('');
  }, [selectedProduct, addQuantity, addUnit, addItem]);

  /** Thêm nhanh sản phẩm vào giỏ (1 đơn vị cơ bản) */
  const handleQuickAdd = useCallback((product: Product) => {
    addItem(product, 1, product.base_unit);
  }, [addItem]);

  /** Submit đơn hàng */
  const handleSubmitOrder = useCallback(async () => {
    const userId = currentUser?.id || 'unknown';
    const userMaxDiscount = currentUser?.role === 'staff'
      ? currentUser.max_discount_percent
      : undefined; // Owner has no discount limit
    await submitOrder(userId, userMaxDiscount);
  }, [submitOrder, currentUser]);

  /** Format giá tiền VND */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-4">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">Bán hàng</h1>
          <div className="flex items-center gap-2">
            {cartItems.length > 0 && (
              <Badge variant="default" className="text-sm">
                {cartItems.length} SP
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCart}
              disabled={cartItems.length === 0}
              aria-label="Xóa giỏ hàng"
            >
              Xóa giỏ
            </Button>
          </div>
        </div>
      </div>

      {/* Success message */}
      {lastOrderResult?.success && (
        <div className="mx-4 mt-3 p-4 bg-green-50 border border-green-200 rounded-lg" role="alert">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-green-800">Đơn hàng đã tạo thành công!</p>
              <p className="text-sm text-green-600 mt-1">
                Mã đơn: {lastOrderResult.order?.order_number}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={clearLastOrder}>
              Đóng
            </Button>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="ghost" size="sm" onClick={clearError}>
              ✕
            </Button>
          </div>
        </div>
      )}

      <div className="px-4 mt-4 space-y-4 lg:grid lg:grid-cols-5 lg:gap-6 lg:space-y-0">
        {/* Left column: Search + Cart */}
        <div className="lg:col-span-3 space-y-4">
          {/* Product Search/Scan */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tìm sản phẩm</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductSearch
                onSelectProduct={handleSelectProduct}
                placeholder="Quét mã vạch hoặc tìm tên sản phẩm..."
                showBarcodeScanner={true}
              />

              {/* Quick add panel when product is selected */}
              {selectedProduct && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{selectedProduct.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedProduct.brand} · {selectedProduct.specification}
                      </p>
                      <p className="text-sm font-semibold text-primary mt-1">
                        {formatPrice(selectedProduct.selling_price)}/{selectedProduct.base_unit}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedProduct(null)}
                      aria-label="Bỏ chọn sản phẩm"
                    >
                      ✕
                    </Button>
                  </div>

                  {/* Quantity + Unit input */}
                  <div className="flex items-end gap-2 mt-3">
                    <div className="flex-1">
                      <Label htmlFor="add-quantity" className="text-xs">
                        Số lượng
                      </Label>
                      <Input
                        id="add-quantity"
                        type="number"
                        min={0.01}
                        step="any"
                        value={addQuantity}
                        onChange={(e) => setAddQuantity(parseFloat(e.target.value) || 0)}
                        className="h-10 mt-1"
                      />
                    </div>
                    <div className="w-24">
                      <Label htmlFor="add-unit" className="text-xs">
                        Đơn vị
                      </Label>
                      <Input
                        id="add-unit"
                        type="text"
                        value={addUnit}
                        onChange={(e) => setAddUnit(e.target.value)}
                        placeholder={selectedProduct.base_unit}
                        className="h-10 mt-1"
                      />
                    </div>
                    <Button
                      size="lg"
                      onClick={handleAddToCart}
                      disabled={addQuantity <= 0}
                      className="h-10 px-6"
                    >
                      Thêm
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Hỗ trợ bán lẻ: nhập đơn vị nhỏ (mét, kg) từ đơn vị lớn (cuộn, bao)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cart List */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Giỏ hàng ({cartItems.length})
                </CardTitle>
                <span className="text-sm font-semibold text-primary">
                  {formatPrice(subtotal)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {cartItems.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <p className="text-sm">Chưa có sản phẩm nào</p>
                  <p className="text-xs mt-1">Quét mã vạch hoặc tìm kiếm để thêm</p>
                </div>
              ) : (
                <POSCartList
                  items={cartItems}
                  onRemove={removeItem}
                  onUpdateQuantity={updateItemQuantity}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Payment & Summary */}
        <div className="lg:col-span-2 space-y-4">
          {/* Discount */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Giảm giá</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Button
                  variant={discountType === 'fixed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDiscount('fixed', discountValue)}
                  className="flex-1"
                >
                  Số tiền (đ)
                </Button>
                <Button
                  variant={discountType === 'percentage' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDiscount('percentage', discountValue)}
                  className="flex-1"
                >
                  Phần trăm (%)
                </Button>
              </div>
              <Input
                type="number"
                min={0}
                max={discountType === 'percentage' ? 100 : undefined}
                step="any"
                value={discountValue || ''}
                onChange={(e) =>
                  setDiscount(discountType, parseFloat(e.target.value) || 0)
                }
                placeholder={
                  discountType === 'fixed' ? 'Nhập số tiền giảm...' : 'Nhập % giảm...'
                }
                className="h-10"
              />
              {discountAmount > 0 && (
                <p className="text-sm text-green-600 mt-2">
                  Giảm: -{formatPrice(discountAmount)}
                </p>
              )}
              {currentUser?.role === 'staff' && currentUser.max_discount_percent !== undefined && (
                <p className="text-xs text-muted-foreground mt-1">
                  Giới hạn: tối đa {currentUser.max_discount_percent}%
                </p>
              )}
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Thanh toán</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Payment method buttons */}
              <div>
                <Label className="text-xs text-muted-foreground">Hình thức</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                    size="lg"
                    onClick={() => setPaymentMethod('cash')}
                    className="flex-1 h-12"
                  >
                    💵 Tiền mặt
                  </Button>
                  <Button
                    variant={paymentMethod === 'transfer' ? 'default' : 'outline'}
                    size="lg"
                    onClick={() => setPaymentMethod('transfer')}
                    className="flex-1 h-12"
                  >
                    🏦 Chuyển khoản
                  </Button>
                </div>
              </div>

              {/* Credit sale toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Mua nợ</p>
                  <p className="text-xs text-muted-foreground">Ghi nhận công nợ khách hàng</p>
                </div>
                <Button
                  variant={isCredit ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsCredit(!isCredit)}
                >
                  {isCredit ? 'Có' : 'Không'}
                </Button>
              </div>

              {/* Customer selection for credit sales */}
              {isCredit && (
                <div>
                  <Label className="text-xs text-muted-foreground">Khách hàng</Label>
                  <POSCustomerSelect
                    selectedCustomer={customer}
                    onSelect={setCustomer}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Summary & Submit */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4">
              {/* Summary */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tạm tính</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Giảm giá</span>
                    <span className="text-green-600">-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-base font-bold">Tổng cộng</span>
                  <span className="text-xl font-bold text-primary">
                    {formatPrice(total)}
                  </span>
                </div>
              </div>

              {/* Payment info */}
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-xs">
                  {paymentMethod === 'cash' ? '💵 Tiền mặt' : '🏦 Chuyển khoản'}
                </Badge>
                {isCredit && (
                  <Badge variant="destructive" className="text-xs">
                    Nợ
                  </Badge>
                )}
                {customer && (
                  <Badge variant="outline" className="text-xs">
                    {customer.name}
                  </Badge>
                )}
              </div>

              {/* Submit button */}
              <Button
                size="lg"
                className="w-full mt-4 h-14 text-lg font-bold"
                onClick={handleSubmitOrder}
                disabled={cartItems.length === 0 || isSubmitting}
              >
                {isSubmitting ? 'Đang xử lý...' : `Thanh toán ${formatPrice(total)}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
