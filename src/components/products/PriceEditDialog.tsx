'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { Product } from '@/lib/types';

interface PriceEditDialogProps {
  product: Product;
  onSave: (productId: string, newPrice: number, newTradePrice: number | null) => Promise<void>;
  onClose: () => void;
}

/**
 * Dialog cho Owner cài đặt giá bán và loại giá cho một sản phẩm.
 *
 * Hiển thị:
 * - Giá vốn TB (WAC) và Giá nhập cuối để tham khảo
 * - Input giá bán mới
 * - Chọn loại giá (cố định / biến động)
 * - Biên lợi nhuận dự kiến
 *
 * Validates: Requirements 8.3, 8.4
 */
export default function PriceEditDialog({
  product,
  onSave,
  onClose,
}: PriceEditDialogProps) {
  const [sellingPrice, setSellingPrice] = useState<number>(product.selling_price);
  const [tradePrice, setTradePrice] = useState<number | null>(product.trade_price ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Calculate profit margin based on WAC
   */
  const getMargin = (): string | null => {
    if (product.weighted_avg_cost <= 0 || sellingPrice <= 0) return null;
    const margin = ((sellingPrice - product.weighted_avg_cost) / sellingPrice) * 100;
    return margin.toFixed(1);
  };

  /**
   * Calculate profit per unit
   */
  const getProfitPerUnit = (): number | null => {
    if (product.weighted_avg_cost <= 0) return null;
    return sellingPrice - product.weighted_avg_cost;
  };

  const margin = getMargin();
  const profitPerUnit = getProfitPerUnit();

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (sellingPrice < 0) {
      setError('Giá bán không được âm');
      return;
    }
    if (tradePrice != null && tradePrice < 0) {
      setError('Giá thợ/thầu không được âm');
      return;
    }

    setSaving(true);
    try {
      await onSave(product.id, sellingPrice, tradePrice);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Format price in VND
   */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Cài đặt giá bán</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {product.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {product.brand} • {product.specification}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="shrink-0"
              aria-label="Đóng"
            >
              ✕
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Reference prices */}
            <div className="p-3 bg-muted/50 rounded-md space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Giá vốn tham khảo
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Giá vốn TB (WAC)</p>
                  <p className="text-sm font-semibold text-orange-600">
                    {product.weighted_avg_cost > 0
                      ? formatPrice(product.weighted_avg_cost)
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Giá nhập cuối</p>
                  <p className="text-sm font-semibold text-blue-600">
                    {product.last_cost > 0
                      ? formatPrice(product.last_cost)
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Selling price input */}
            <div className="space-y-2">
              <Label htmlFor="selling_price">
                Giá bán (VNĐ) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="selling_price"
                type="number"
                min="0"
                value={sellingPrice || ''}
                onChange={(e) => setSellingPrice(Number(e.target.value))}
                placeholder="Nhập giá bán"
                aria-invalid={!!error}
              />
            </div>

            {/* Trade price input */}
            <div className="space-y-2">
              <Label htmlFor="trade_price">Giá thợ/thầu (VNĐ)</Label>
              <Input
                id="trade_price"
                type="number"
                min="0"
                value={tradePrice ?? ''}
                onChange={(e) =>
                  setTradePrice(e.target.value === '' ? null : Number(e.target.value))
                }
                placeholder="Để trống nếu không có giá sỉ"
              />
              <p className="text-xs text-muted-foreground">
                Giá bán cho thợ/nhà thầu. Để trống nếu bán đồng giá lẻ.
              </p>
            </div>

            {/* Profit margin preview */}
            {(margin || profitPerUnit !== null) && (
              <div className="p-3 rounded-md border space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Lợi nhuận dự kiến
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {margin && (
                    <div>
                      <p className="text-xs text-muted-foreground">Biên lợi nhuận</p>
                      <p className={`text-sm font-bold ${Number(margin) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {margin}%
                      </p>
                    </div>
                  )}
                  {profitPerUnit !== null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Lãi / đơn vị</p>
                      <p className={`text-sm font-bold ${profitPerUnit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPrice(profitPerUnit)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={saving}
                className="flex-1"
              >
                {saving ? 'Đang lưu...' : 'Lưu giá bán'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onClose}
                className="shrink-0"
              >
                Hủy
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
