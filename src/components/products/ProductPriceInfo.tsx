'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Product } from '@/lib/types';

interface SupplierPriceData {
  unit_price: number;
  effective_date: string;
  supplier: { name: string } | null;
}

interface ProductPriceInfoProps {
  product: Product;
}

/**
 * Component hiển thị tổng quan giá của sản phẩm (Owner only)
 *
 * Hiển thị:
 * - Giá NCC (từ supplier_prices — giá mới nhất)
 * - Giá vốn TB (WAC)
 * - Giá nhập gần nhất (last_cost)
 * - Giá bán
 * - Lợi nhuận dự kiến (số tiền + %)
 *
 * Validates: Price Management Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */
export default function ProductPriceInfo({ product }: ProductPriceInfoProps) {
  const [supplierPrice, setSupplierPrice] = useState<SupplierPriceData | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function fetchSupplierPrice() {
      // Lấy giá NCC mới nhất cho sản phẩm này
      const { data } = await supabase
        .from('supplier_prices')
        .select('unit_price, effective_date, supplier:suppliers(name)')
        .eq('product_id', product.id)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setSupplierPrice(data as SupplierPriceData);
      }
      setLoading(false);
    }

    fetchSupplierPrice();
  }, [product.id, supabase]);

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Tính lợi nhuận
  const wac = product.weighted_avg_cost;
  const sellingPrice = product.selling_price;
  const hasWac = wac > 0;
  const profitAmount = hasWac ? sellingPrice - wac : null;
  const profitPercent = hasWac && wac > 0
    ? ((sellingPrice - wac) / wac * 100).toFixed(1)
    : null;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          Thông tin giá
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Giá NCC */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Giá NCC</span>
          <div className="text-right">
            {supplierPrice ? (
              <>
                <span className="text-sm font-semibold text-blue-600">
                  {formatPrice(supplierPrice.unit_price)}
                </span>
                {supplierPrice.supplier && (
                  <p className="text-xs text-muted-foreground">
                    {(supplierPrice.supplier as { name: string }).name}
                  </p>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Chưa có</span>
            )}
          </div>
        </div>

        {/* Giá vốn TB */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Giá vốn TB (WAC)</span>
          <span className="text-sm font-semibold text-orange-600">
            {hasWac ? formatPrice(wac) : 'Chưa có giá vốn'}
          </span>
        </div>

        {/* Giá nhập gần nhất */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Giá nhập GN</span>
          <span className="text-sm font-semibold text-slate-600">
            {product.last_cost > 0 ? formatPrice(product.last_cost) : '—'}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Giá bán */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Giá bán</span>
          <span className="text-sm font-bold text-primary">
            {sellingPrice > 0 ? formatPrice(sellingPrice) : '—'}
          </span>
        </div>

        {/* Lợi nhuận */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Lợi nhuận</span>
          {profitAmount !== null ? (
            <div className="text-right">
              <span className={`text-sm font-bold ${profitAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPrice(profitAmount)}
              </span>
              {profitPercent && (
                <span className={`text-xs ml-1 ${profitAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ({profitPercent}%)
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
