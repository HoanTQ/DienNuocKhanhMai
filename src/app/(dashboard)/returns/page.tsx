'use client';

import { useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { SalesOrder, SalesOrderItem, Customer } from '@/lib/types';

/**
 * Trang Trả hàng (Returns Module)
 *
 * Cho phép:
 * 1. Tìm đơn bán hàng gốc theo mã đơn
 * 2. Hiển thị danh sách sản phẩm trong đơn với số lượng đã trả
 * 3. Chọn sản phẩm trả, nhập số lượng và lý do
 * 4. Xác nhận trả: cập nhật returned_quantity, tạo stock_movement, cập nhật customer
 * 5. Đánh dấu hàng lỗi → gom vào danh sách chờ trả NCC
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5
 */

// === Types ===

interface OrderItemWithProduct extends SalesOrderItem {
  product?: {
    id: string;
    name: string;
    brand: string;
    specification: string;
    base_unit: string;
  };
}

interface OrderWithDetails extends Omit<SalesOrder, 'items'> {
  items: OrderItemWithProduct[];
  customer?: Customer | null;
}

interface ReturnItem {
  orderItemId: string;
  productId: string;
  productName: string;
  quantity: number;
  maxQuantity: number;
  unitPrice: number;
  unit: string;
  reason: string;
  isDefective: boolean;
}

// === Utility Functions ===

function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}


// === Main Component ===

export default function ReturnsPage() {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Order state
  const [order, setOrder] = useState<OrderWithDetails | null>(null);

  // Return items state
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Defective items list (pending NCC return)
  const [defectiveList, setDefectiveList] = useState<Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit: string;
    reason: string;
    created_at: string;
    receipt_number: string | null;
    supplier_name: string | null;
  }>>([]);
  const [showDefectiveList, setShowDefectiveList] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  /** Tìm đơn hàng theo mã đơn */
  const handleSearchOrder = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setOrder(null);
    setReturnItems([]);
    setSubmitSuccess(false);
    setSubmitError(null);

    try {
      const query = searchQuery.trim();

      // If query starts with GR-, search in goods_receipts and show defective items
      if (query.toUpperCase().startsWith('GR-')) {
        const { data: receiptData, error: receiptError } = await supabase
          .from('goods_receipts')
          .select('id, receipt_number, supplier:suppliers(name)')
          .eq('receipt_number', query)
          .single();

        if (receiptError || !receiptData) {
          setSearchError('Không tìm thấy phiếu nhập với mã này. Vui lòng kiểm tra lại.');
          return;
        }

        // Fetch defective items for this receipt
        const { data: defData } = await supabase
          .from('defective_items')
          .select('*, product:products(name)')
          .eq('goods_receipt_id', receiptData.id)
          .order('created_at', { ascending: false });

        if (defData && defData.length > 0) {
          const supplier = receiptData.supplier as { name: string } | null;
          setDefectiveList(
            defData.map((item: Record<string, unknown>) => ({
              id: item.id as string,
              product_name: (item.product as { name: string } | null)?.name || 'Sản phẩm',
              quantity: item.quantity as number,
              unit: item.unit as string,
              reason: item.reason as string,
              created_at: item.created_at as string,
              receipt_number: receiptData.receipt_number,
              supplier_name: supplier?.name || null,
            }))
          );
          setShowDefectiveList(true);
        } else {
          setSearchError('Phiếu nhập này không có hàng lỗi nào.');
        }
        return;
      }

      // Otherwise, search in sales_orders
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customer:customers(*),
          items:sales_order_items(
            *,
            product:products(id, name, brand, specification, base_unit)
          )
        `)
        .eq('order_number', query)
        .single();

      if (error || !data) {
        setSearchError('Không tìm thấy đơn hàng với mã này. Vui lòng kiểm tra lại.');
        return;
      }

      setOrder(data as unknown as OrderWithDetails);
    } catch {
      setSearchError('Có lỗi xảy ra khi tìm kiếm. Vui lòng thử lại.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, supabase]);

  /** Thêm sản phẩm vào danh sách trả */
  const addReturnItem = useCallback((item: OrderItemWithProduct) => {
    const maxReturnable = item.quantity - item.returned_quantity;
    if (maxReturnable <= 0) return;

    // Check if already added
    if (returnItems.some((ri) => ri.orderItemId === item.id)) return;

    setReturnItems((prev) => [
      ...prev,
      {
        orderItemId: item.id,
        productId: item.product_id,
        productName: item.product?.name || 'Sản phẩm',
        quantity: 1,
        maxQuantity: maxReturnable,
        unitPrice: item.unit_price,
        unit: item.unit,
        reason: '',
        isDefective: false,
      },
    ]);
  }, [returnItems]);

  /** Xóa sản phẩm khỏi danh sách trả */
  const removeReturnItem = useCallback((orderItemId: string) => {
    setReturnItems((prev) => prev.filter((ri) => ri.orderItemId !== orderItemId));
  }, []);

  /** Cập nhật số lượng trả */
  const updateReturnQuantity = useCallback((orderItemId: string, quantity: number) => {
    setReturnItems((prev) =>
      prev.map((ri) =>
        ri.orderItemId === orderItemId
          ? { ...ri, quantity: Math.min(Math.max(1, quantity), ri.maxQuantity) }
          : ri
      )
    );
  }, []);

  /** Cập nhật lý do trả */
  const updateReturnReason = useCallback((orderItemId: string, reason: string) => {
    setReturnItems((prev) =>
      prev.map((ri) =>
        ri.orderItemId === orderItemId ? { ...ri, reason } : ri
      )
    );
  }, []);

  /** Toggle đánh dấu hàng lỗi */
  const toggleDefective = useCallback((orderItemId: string) => {
    setReturnItems((prev) =>
      prev.map((ri) =>
        ri.orderItemId === orderItemId ? { ...ri, isDefective: !ri.isDefective } : ri
      )
    );
  }, []);

  /** Tính tổng tiền trả */
  const totalReturnAmount = useMemo(() => {
    return returnItems.reduce((sum, ri) => sum + ri.quantity * ri.unitPrice, 0);
  }, [returnItems]);


  /** Xác nhận trả hàng */
  const handleSubmitReturn = useCallback(async () => {
    if (returnItems.length === 0 || !order) return;

    // Validate: all items must have a reason
    const missingReason = returnItems.find((ri) => !ri.reason.trim());
    if (missingReason) {
      setSubmitError('Vui lòng nhập lý do trả/đổi cho tất cả sản phẩm.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      // Process each return item
      for (const returnItem of returnItems) {
        // 1. Update returned_quantity on sales_order_items
        const orderItem = order.items.find((i) => i.id === returnItem.orderItemId);
        if (!orderItem) continue;

        const newReturnedQty = orderItem.returned_quantity + returnItem.quantity;

        const { error: updateItemError } = await supabase
          .from('sales_order_items')
          .update({ returned_quantity: newReturnedQty })
          .eq('id', returnItem.orderItemId);

        if (updateItemError) {
          throw new Error(`Lỗi cập nhật số lượng trả: ${updateItemError.message}`);
        }

        // 2. Create stock_movement (type: 'return') to add back to inventory
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            product_id: returnItem.productId,
            movement_type: 'return',
            quantity: returnItem.quantity,
            unit: returnItem.unit,
            reference_id: order.id,
            reference_type: 'return',
            notes: `Trả hàng: ${returnItem.reason}`,
            created_by: user.id,
          });

        if (movementError) {
          throw new Error(`Lỗi tạo stock movement: ${movementError.message}`);
        }

        // 3. Update product current_stock (add back returned quantity)
        const { data: product } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', returnItem.productId)
          .single();

        if (product) {
          const { error: stockError } = await supabase
            .from('products')
            .update({ current_stock: product.current_stock + returnItem.quantity })
            .eq('id', returnItem.productId);

          if (stockError) {
            throw new Error(`Lỗi cập nhật tồn kho: ${stockError.message}`);
          }
        }

        // 4. If defective, add to defective_items for NCC return
        if (returnItem.isDefective) {
          const { error: defectiveError } = await supabase
            .from('defective_items')
            .insert({
              product_id: returnItem.productId,
              quantity: returnItem.quantity,
              unit: returnItem.unit,
              reason: returnItem.reason,
              status: 'pending',
              goods_receipt_id: null,
            });

          if (defectiveError) {
            console.error('Lỗi ghi nhận hàng lỗi:', defectiveError.message);
          }
        }
      }

      // 5. Update customer total_purchased (subtract return amount)
      if (order.customer_id && order.customer) {
        const newTotalPurchased = Math.max(0, order.customer.total_purchased - totalReturnAmount);
        const { error: customerError } = await supabase
          .from('customers')
          .update({ total_purchased: newTotalPurchased })
          .eq('id', order.customer_id);

        if (customerError) {
          console.error('Lỗi cập nhật doanh thu khách hàng:', customerError.message);
        }
      }

      // 6. Update order status to 'returned_partial'
      const { error: orderError } = await supabase
        .from('sales_orders')
        .update({ status: 'returned_partial' })
        .eq('id', order.id);

      if (orderError) {
        console.error('Lỗi cập nhật trạng thái đơn hàng:', orderError.message);
      }

      // Success
      setSubmitSuccess(true);
      setReturnItems([]);
      setOrder(null);
      setSearchQuery('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [returnItems, order, supabase, totalReturnAmount]);

  /** Fetch danh sách hàng lỗi chờ trả NCC */
  const fetchDefectiveItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('defective_items')
      .select(`
        id,
        quantity,
        unit,
        reason,
        status,
        created_at,
        goods_receipt_id,
        product:products(name),
        goods_receipt:goods_receipts(receipt_number, supplier:suppliers(name))
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDefectiveList(
        data.map((item: Record<string, unknown>) => {
          const receipt = item.goods_receipt as { receipt_number: string; supplier: { name: string } | null } | null;
          return {
            id: item.id as string,
            product_name: (item.product as { name: string } | null)?.name || 'Sản phẩm',
            quantity: item.quantity as number,
            unit: item.unit as string,
            reason: item.reason as string,
            created_at: item.created_at as string,
            receipt_number: receipt?.receipt_number || null,
            supplier_name: receipt?.supplier?.name || null,
          };
        })
      );
    }
    setShowDefectiveList(true);
  }, [supabase]);

  /** Đánh dấu hàng lỗi đã trả NCC */
  const markAsReturned = useCallback(async (itemId: string) => {
    const { error } = await supabase
      .from('defective_items')
      .update({ status: 'returned', returned_at: new Date().toISOString() })
      .eq('id', itemId);

    if (!error) {
      setDefectiveList((prev) => prev.filter((item) => item.id !== itemId));
    }
  }, [supabase]);

  /** Đánh dấu tất cả hàng lỗi đã trả NCC */
  const markAllAsReturned = useCallback(async () => {
    const ids = defectiveList.map((item) => item.id);
    if (ids.length === 0) return;

    const { error } = await supabase
      .from('defective_items')
      .update({ status: 'returned', returned_at: new Date().toISOString() })
      .in('id', ids);

    if (!error) {
      setDefectiveList([]);
    }
  }, [defectiveList, supabase]);


  // === Render ===

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Trả hàng</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Xử lý trả hàng dư, đổi hàng lỗi
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchDefectiveItems}
        >
          📋 Hàng lỗi chờ trả NCC
        </Button>
      </div>

      {/* Success message */}
      {submitSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg" role="alert">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-green-800">Trả hàng thành công!</p>
              <p className="text-sm text-green-600 mt-1">
                Tồn kho và doanh thu đã được cập nhật.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSubmitSuccess(false)}>
              Đóng
            </Button>
          </div>
        </div>
      )}

      {/* Error message */}
      {submitError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-700">{submitError}</p>
            <Button variant="ghost" size="sm" onClick={() => setSubmitError(null)}>
              ✕
            </Button>
          </div>
        </div>
      )}

      {/* Search Order */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tìm đơn hàng gốc</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Nhập mã đơn hàng (SO-...) hoặc phiếu nhập (GR-...)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchOrder()}
              className="flex-1"
              aria-label="Mã đơn hàng"
            />
            <Button
              onClick={handleSearchOrder}
              disabled={isSearching || !searchQuery.trim()}
              className="px-6"
            >
              {isSearching ? 'Đang tìm...' : 'Tìm'}
            </Button>
          </div>
          {searchError && (
            <p className="text-sm text-red-600 mt-2">{searchError}</p>
          )}
        </CardContent>
      </Card>

      {/* Order Details */}
      {order && (
        <>
          {/* Order Info */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Đơn hàng: {order.order_number}
                </CardTitle>
                <Badge variant={order.status === 'returned_partial' ? 'destructive' : 'default'}>
                  {order.status === 'returned_partial' ? 'Đã trả một phần' : 'Hoàn thành'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Ngày tạo:</span>
                  <p className="font-medium">{formatDate(order.created_at)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tổng tiền:</span>
                  <p className="font-medium">{formatPrice(order.total)}</p>
                </div>
                {order.customer && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Khách hàng:</span>
                    <p className="font-medium">
                      {order.customer.name} - {order.customer.phone}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Thanh toán:</span>
                  <p className="font-medium">
                    {order.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Sản phẩm trong đơn ({order.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item) => {
                const maxReturnable = item.quantity - item.returned_quantity;
                const isAdded = returnItems.some((ri) => ri.orderItemId === item.id);

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border ${
                      isAdded ? 'border-primary/50 bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {item.product?.name || 'Sản phẩm'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.product?.brand} · {item.product?.specification}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs">
                          <span>
                            SL mua: <strong>{item.quantity} {item.unit}</strong>
                          </span>
                          <span>
                            Đã trả: <strong className="text-orange-600">{item.returned_quantity}</strong>
                          </span>
                          <span>
                            Có thể trả: <strong className="text-green-600">{maxReturnable}</strong>
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Đơn giá: {formatPrice(item.unit_price)}
                        </p>
                      </div>
                      <Button
                        variant={isAdded ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => isAdded ? removeReturnItem(item.id) : addReturnItem(item)}
                        disabled={maxReturnable <= 0 && !isAdded}
                        className="shrink-0"
                      >
                        {isAdded ? 'Bỏ chọn' : maxReturnable <= 0 ? 'Đã trả hết' : 'Chọn trả'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}


      {/* Return Items Form */}
      {returnItems.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Sản phẩm trả ({returnItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {returnItems.map((ri) => (
              <div key={ri.orderItemId} className="p-3 bg-muted/50 rounded-lg space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{ri.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      Đơn giá: {formatPrice(ri.unitPrice)} · Thành tiền: {formatPrice(ri.quantity * ri.unitPrice)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeReturnItem(ri.orderItemId)}
                    aria-label="Xóa sản phẩm trả"
                  >
                    ✕
                  </Button>
                </div>

                {/* Quantity */}
                <div className="flex items-center gap-3">
                  <Label className="text-xs shrink-0 w-16">Số lượng:</Label>
                  <Input
                    type="number"
                    min={1}
                    max={ri.maxQuantity}
                    value={ri.quantity}
                    onChange={(e) =>
                      updateReturnQuantity(ri.orderItemId, parseInt(e.target.value) || 1)
                    }
                    className="h-9 w-24"
                  />
                  <span className="text-xs text-muted-foreground">
                    / {ri.maxQuantity} {ri.unit}
                  </span>
                </div>

                {/* Reason */}
                <div>
                  <Label className="text-xs">Lý do trả/đổi *</Label>
                  <Input
                    value={ri.reason}
                    onChange={(e) => updateReturnReason(ri.orderItemId, e.target.value)}
                    placeholder="VD: Hàng dư, hàng lỗi, sai quy cách..."
                    className="mt-1 h-9"
                  />
                </div>

                {/* Defective checkbox */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`defective-${ri.orderItemId}`}
                    checked={ri.isDefective}
                    onChange={() => toggleDefective(ri.orderItemId)}
                  />
                  <Label
                    htmlFor={`defective-${ri.orderItemId}`}
                    className="text-xs text-muted-foreground cursor-pointer"
                  >
                    Hàng lỗi (gom vào danh sách chờ trả NCC)
                  </Label>
                </div>
              </div>
            ))}

            {/* Summary & Submit */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Tổng tiền trả:</span>
                <span className="text-lg font-bold text-destructive">
                  -{formatPrice(totalReturnAmount)}
                </span>
              </div>

              {returnItems.some((ri) => ri.isDefective) && (
                <p className="text-xs text-orange-600">
                  ⚠️ {returnItems.filter((ri) => ri.isDefective).length} sản phẩm sẽ được gom vào danh sách hàng lỗi chờ trả NCC
                </p>
              )}

              <Button
                size="lg"
                className="w-full h-12"
                onClick={handleSubmitReturn}
                disabled={isSubmitting || returnItems.length === 0}
              >
                {isSubmitting ? 'Đang xử lý...' : `Xác nhận trả hàng (${formatPrice(totalReturnAmount)})`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Defective Items List (pending NCC return) */}
      {showDefectiveList && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Hàng lỗi chờ trả NCC</CardTitle>
              <div className="flex gap-2">
                {defectiveList.length > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    className="cursor-pointer"
                    onClick={markAllAsReturned}
                  >
                    Đã trả tất cả
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDefectiveList(false)}
                >
                  Đóng
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {defectiveList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Không có hàng lỗi chờ trả NCC
              </p>
            ) : (
              <div className="space-y-3">
                {defectiveList.map((item) => (
                  <div key={item.id} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          SL: {item.quantity} {item.unit} · Lý do: {item.reason}
                        </p>
                        {item.receipt_number && (
                          <p className="text-xs text-muted-foreground">
                            Phiếu nhập: {item.receipt_number}
                          </p>
                        )}
                        {item.supplier_name && (
                          <p className="text-xs text-blue-600 font-medium">
                            NCC: {item.supplier_name}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Ngày: {formatDate(item.created_at)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 cursor-pointer"
                        onClick={() => markAsReturned(item.id)}
                      >
                        Đã trả
                      </Button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Tổng: {defectiveList.length} mặt hàng lỗi chờ trả NCC
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
