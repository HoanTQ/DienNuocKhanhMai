'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface ReceiptDetail {
  id: string;
  receipt_number: string;
  supplier_id: string;
  purchase_order_id: string | null;
  status: 'pending' | 'confirmed';
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  supplier?: { name: string; phone?: string };
}

interface ReceiptItem {
  id: string;
  product_id: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_payment?: number;
  discount_type?: 'percent' | 'fixed';
  discount_value?: number;
  product?: { name: string; barcode?: string };
}

interface PromotionalItem {
  id: string;
  product_id: string;
  quantity: number;
  unit: string;
  notes: string | null;
  product?: { name: string; barcode?: string };
}

interface DefectiveItem {
  id: string;
  product_id: string;
  quantity: number;
  unit: string;
  reason: string | null;
  status: string;
  product?: { name: string; barcode?: string };
}

/**
 * Trang chi tiết Phiếu nhập kho
 */
export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const receiptId = params.id as string;

  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [promotionalItems, setPromotionalItems] = useState<PromotionalItem[]>([]);
  const [defectiveItems, setDefectiveItems] = useState<DefectiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (receiptId) {
      fetchReceiptDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptId]);

  async function fetchReceiptDetail() {
    setLoading(true);
    setError(null);

    try {
      // Fetch receipt header
      const { data: receiptData, error: receiptError } = await supabase
        .from('goods_receipts')
        .select('*, supplier:suppliers(name, phone)')
        .eq('id', receiptId)
        .single();

      if (receiptError || !receiptData) {
        throw new Error(receiptError?.message || 'Không tìm thấy phiếu nhập');
      }
      setReceipt(receiptData);

      // Fetch receipt items
      const { data: itemsData, error: itemsError } = await supabase
        .from('goods_receipt_items')
        .select('*, product:products(name, barcode)')
        .eq('goods_receipt_id', receiptId);
      if (itemsError) console.error('Lỗi tải items:', itemsError.message);
      setItems(itemsData || []);

      // Fetch promotional items
      const { data: promoData, error: promoError } = await supabase
        .from('promotional_items')
        .select('*, product:products(name, barcode)')
        .eq('goods_receipt_id', receiptId);
      if (promoError) console.error('Lỗi tải promo:', promoError.message);
      setPromotionalItems(promoData || []);

      // Fetch defective items
      const { data: defectiveData, error: defectiveError } = await supabase
        .from('defective_items')
        .select('*, product:products(name, barcode)')
        .eq('goods_receipt_id', receiptId);
      if (defectiveError) console.error('Lỗi tải defective:', defectiveError.message);
      setDefectiveItems(defectiveData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!receipt || receipt.status === 'confirmed') return;

    setConfirming(true);
    const { error: updateError } = await supabase
      .from('goods_receipts')
      .update({ status: 'confirmed' })
      .eq('id', receiptId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setReceipt((prev) => (prev ? { ...prev, status: 'confirmed' } : prev));
    }
    setConfirming(false);
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const totalAmount = items.reduce(
    (sum, item) => sum + (item.total_payment ?? item.quantity * item.unit_price),
    0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải chi tiết phiếu nhập...</p>
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-destructive mb-4">{error || 'Không tìm thấy phiếu nhập'}</p>
            <Button variant="outline" onClick={() => router.push('/purchasing/receipts')}>
              Quay lại danh sách
            </Button>
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
          <h1 className="text-xl md:text-2xl font-bold">Chi tiết phiếu nhập</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {receipt.receipt_number}
          </p>
        </div>
        <div className="flex gap-2">
          {receipt.status === 'pending' && (
            <Button
              onClick={handleConfirm}
              disabled={confirming}
            >
              {confirming ? 'Đang xác nhận...' : 'Xác nhận nhập kho'}
            </Button>
          )}
          <Link href="/purchasing/receipts">
            <Button variant="outline">Quay lại</Button>
          </Link>
        </div>
      </div>

      {/* Receipt Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin phiếu nhập</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Mã phiếu</p>
              <p className="font-medium">{receipt.receipt_number}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nhà cung cấp</p>
              <p className="font-medium">{receipt.supplier?.name || '—'}</p>
              {receipt.supplier?.phone && (
                <p className="text-xs text-muted-foreground">{receipt.supplier.phone}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Trạng thái</p>
              <Badge variant={receipt.status === 'confirmed' ? 'default' : 'secondary'}>
                {receipt.status === 'confirmed' ? 'Đã xác nhận' : 'Chờ xác nhận'}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ngày tạo</p>
              <p className="font-medium">{formatDate(receipt.created_at)}</p>
            </div>
          </div>
          {receipt.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">Ghi chú</p>
              <p className="mt-1">{receipt.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Danh sách sản phẩm nhập</CardTitle>
            <p className="text-sm font-medium">
              Tổng: {formatPrice(totalAmount)}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Không có sản phẩm</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-2 font-medium">#</th>
                    <th className="py-2 px-2 font-medium">Sản phẩm</th>
                    <th className="py-2 px-2 font-medium text-right">SL</th>
                    <th className="py-2 px-2 font-medium">ĐVT</th>
                    <th className="py-2 px-2 font-medium text-right">Thành tiền</th>
                    <th className="py-2 px-2 font-medium text-right">Chiết khấu</th>
                    <th className="py-2 px-2 font-medium text-right">Thanh toán</th>
                    <th className="py-2 px-2 font-medium text-right">Giá vốn/sp</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const payment = item.total_payment ?? item.quantity * item.unit_price;
                    // Thành tiền = Thanh toán / (1 - CK%) hoặc Thanh toán + CK cố định
                    // Nếu không có discount info, thành tiền = SL × Giá NCC (cần query) hoặc fallback
                    let subtotal: number;
                    if (item.discount_value && item.discount_value > 0) {
                      if (item.discount_type === 'percent') {
                        // Thành tiền = Thanh toán / (1 - discount%)
                        subtotal = payment / (1 - item.discount_value / 100);
                      } else {
                        // Thành tiền = Thanh toán + CK cố định
                        subtotal = payment + item.discount_value;
                      }
                    } else {
                      // Không CK → Thành tiền = Thanh toán
                      subtotal = payment;
                    }
                    const discountLabel = item.discount_value && item.discount_value > 0
                      ? item.discount_type === 'percent'
                        ? `${item.discount_value}%`
                        : formatPrice(item.discount_value)
                      : '—';

                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2 px-2 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <p className="font-medium">{item.product?.name || '—'}</p>
                          {item.product?.barcode && (
                            <p className="text-xs text-muted-foreground">{item.product.barcode}</p>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right">{item.quantity}</td>
                        <td className="py-2 px-2">{item.unit}</td>
                        <td className="py-2 px-2 text-right">{formatPrice(subtotal)}</td>
                        <td className="py-2 px-2 text-right text-green-600">{discountLabel}</td>
                        <td className="py-2 px-2 text-right font-medium">
                          {formatPrice(payment)}
                        </td>
                        <td className="py-2 px-2 text-right text-orange-600">
                          {formatPrice(item.unit_price)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t font-medium">
                    <td colSpan={6} className="py-2 px-2 text-right">Tổng cộng:</td>
                    <td className="py-2 px-2 text-right">{formatPrice(totalAmount)}</td>
                    <td className="py-2 px-2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Promotional Items */}
      {promotionalItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hàng khuyến mãi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-2 font-medium">#</th>
                    <th className="py-2 px-2 font-medium">Sản phẩm</th>
                    <th className="py-2 px-2 font-medium text-right">SL</th>
                    <th className="py-2 px-2 font-medium">ĐVT</th>
                    <th className="py-2 px-2 font-medium">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {promotionalItems.map((item, idx) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2 px-2 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <p className="font-medium">{item.product?.name || '—'}</p>
                      </td>
                      <td className="py-2 px-2 text-right">{item.quantity}</td>
                      <td className="py-2 px-2">{item.unit}</td>
                      <td className="py-2 px-2 text-muted-foreground">{item.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Defective Items */}
      {defectiveItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hàng lỗi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-2 font-medium">#</th>
                    <th className="py-2 px-2 font-medium">Sản phẩm</th>
                    <th className="py-2 px-2 font-medium text-right">SL</th>
                    <th className="py-2 px-2 font-medium">ĐVT</th>
                    <th className="py-2 px-2 font-medium">Lý do</th>
                    <th className="py-2 px-2 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {defectiveItems.map((item, idx) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2 px-2 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <p className="font-medium">{item.product?.name || '—'}</p>
                      </td>
                      <td className="py-2 px-2 text-right">{item.quantity}</td>
                      <td className="py-2 px-2">{item.unit}</td>
                      <td className="py-2 px-2 text-muted-foreground">{item.reason || '—'}</td>
                      <td className="py-2 px-2">
                        <Badge variant={item.status === 'returned' ? 'default' : 'secondary'}>
                          {item.status === 'pending' && 'Chờ trả'}
                          {item.status === 'returned' && 'Đã trả'}
                          {item.status === 'resolved' && 'Đã xử lý'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
