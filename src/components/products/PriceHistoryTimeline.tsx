'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Product, PriceHistory } from '@/lib/types';

interface PriceHistoryTimelineProps {
  product: Product;
  priceHistory: PriceHistory[];
  formatPrice: (price: number) => string;
  onClose: () => void;
}

/**
 * Component hiển thị lịch sử giá nhập theo thời gian cho một sản phẩm.
 *
 * Hiển thị timeline với:
 * - Ngày nhập
 * - Giá nhập (unit_cost)
 * - Số lượng nhập
 * - Nhà cung cấp (nếu có)
 *
 * Validates: Requirements 8.5
 */
export default function PriceHistoryTimeline({
  product,
  priceHistory,
  formatPrice,
  onClose,
}: PriceHistoryTimelineProps) {
  /**
   * Format date to Vietnamese locale
   */
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  /**
   * Calculate price change percentage compared to previous entry
   */
  const getPriceChange = (index: number): { value: number; direction: 'up' | 'down' | 'same' } | null => {
    if (index >= priceHistory.length - 1) return null;
    const current = priceHistory[index].unit_cost;
    const previous = priceHistory[index + 1].unit_cost;
    if (previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same',
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Lịch sử giá nhập</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {product.name} • {product.brand}
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

          {/* Current prices summary */}
          <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-muted/50 rounded-md">
            <div>
              <p className="text-xs text-muted-foreground">Giá vốn TB (WAC)</p>
              <p className="text-sm font-bold text-orange-600">
                {product.weighted_avg_cost > 0
                  ? formatPrice(product.weighted_avg_cost)
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Giá nhập cuối</p>
              <p className="text-sm font-bold text-blue-600">
                {product.last_cost > 0
                  ? formatPrice(product.last_cost)
                  : '—'}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto">
          {priceHistory.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Chưa có lịch sử giá nhập</p>
              <p className="text-xs text-muted-foreground mt-1">
                Lịch sử sẽ được ghi nhận khi có phiếu nhập kho
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />

              {/* Timeline items */}
              <div className="space-y-4">
                {priceHistory.map((entry, index) => {
                  const priceChange = getPriceChange(index);
                  return (
                    <div key={entry.id} className="relative pl-8">
                      {/* Timeline dot */}
                      <div className={`absolute left-1.5 top-2 w-3 h-3 rounded-full border-2 ${
                        index === 0
                          ? 'bg-primary border-primary'
                          : 'bg-background border-muted-foreground'
                      }`} />

                      {/* Content */}
                      <div className="p-3 rounded-md border bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">
                              {formatPrice(entry.unit_cost)}
                              <span className="text-xs text-muted-foreground ml-1">
                                / {product.base_unit}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              SL: {entry.quantity} {product.base_unit}
                            </p>
                          </div>
                          {priceChange && priceChange.direction !== 'same' && (
                            <span className={`text-xs font-medium ${
                              priceChange.direction === 'up'
                                ? 'text-red-600'
                                : 'text-green-600'
                            }`}>
                              {priceChange.direction === 'up' ? '↑' : '↓'}
                              {priceChange.value.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(entry.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
