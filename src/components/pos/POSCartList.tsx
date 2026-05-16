'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CartItem } from '@/services/pos.service';

interface POSCartListProps {
  items: CartItem[];
  onRemove: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
}

/**
 * Danh sách sản phẩm trong giỏ hàng POS.
 * Mobile-first: hiển thị compact, nút bấm lớn dễ thao tác.
 *
 * Validates: Requirements 3.3, 3.4, 5.3, 22.1
 */
export function POSCartList({ items, onRemove, onUpdateQuantity }: POSCartListProps) {
  /** Format giá tiền VND */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleQuantityChange = useCallback(
    (itemId: string, value: string) => {
      const qty = parseFloat(value);
      if (!isNaN(qty)) {
        onUpdateQuantity(itemId, qty);
      }
    },
    [onUpdateQuantity]
  );

  const handleIncrement = useCallback(
    (itemId: string, currentQty: number) => {
      onUpdateQuantity(itemId, currentQty + 1);
    },
    [onUpdateQuantity]
  );

  const handleDecrement = useCallback(
    (itemId: string, currentQty: number) => {
      if (currentQty > 1) {
        onUpdateQuantity(itemId, currentQty - 1);
      } else {
        onRemove(itemId);
      }
    },
    [onUpdateQuantity, onRemove]
  );

  return (
    <ul className="space-y-2" aria-label="Danh sách sản phẩm trong giỏ hàng">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
        >
          {/* Product info */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{item.product_name}</p>
            <p className="text-xs text-muted-foreground">
              {formatPrice(item.unit_price)}/{item.unit}
            </p>
          </div>

          {/* Quantity controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => handleDecrement(item.id, item.quantity)}
              aria-label={`Giảm số lượng ${item.product_name}`}
            >
              −
            </Button>
            <Input
              type="number"
              min={0.01}
              step="any"
              value={item.quantity}
              onChange={(e) => handleQuantityChange(item.id, e.target.value)}
              className="h-8 w-14 text-center text-sm px-1"
              aria-label={`Số lượng ${item.product_name}`}
            />
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => handleIncrement(item.id, item.quantity)}
              aria-label={`Tăng số lượng ${item.product_name}`}
            >
              +
            </Button>
          </div>

          {/* Line total */}
          <div className="text-right shrink-0 w-20">
            <p className="text-sm font-semibold">{formatPrice(item.line_total)}</p>
          </div>

          {/* Remove button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={() => onRemove(item.id)}
            aria-label={`Xóa ${item.product_name} khỏi giỏ hàng`}
          >
            ✕
          </Button>
        </li>
      ))}
    </ul>
  );
}
