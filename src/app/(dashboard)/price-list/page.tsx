'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Trang Bảng giá bán (staff + owner)
 *
 * Chỉ hiển thị giá bán và giá sỉ (trade_price) — KHÔNG có giá vốn.
 * Dữ liệu lấy từ products_staff_view (view đã loại bỏ weighted_avg_cost/last_cost),
 * nên kể cả owner mở trang này cũng chỉ thấy giá bán — đúng mục đích "bảng giá bán".
 *
 * Staff được phép truy cập route /price-list (xem middleware).
 */

interface PriceRow {
  id: string;
  name: string;
  brand: string;
  specification: string;
  base_unit: string;
  barcode: string | null;
  sku: string | null;
  selling_price: number;
  trade_price: number | null;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(price);
}

export default function PriceListPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    // Dùng view staff: chỉ có cột an toàn, không có giá vốn.
    const { data, error } = await supabase
      .from('products_staff_view')
      .select('id, name, brand, specification, base_unit, barcode, sku, selling_price, trade_price')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Lỗi tải bảng giá:', error.message);
      setRows([]);
    } else {
      setRows((data as PriceRow[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.brand.toLowerCase().includes(q) ||
        r.specification.toLowerCase().includes(q) ||
        (r.barcode && r.barcode.includes(searchQuery)) ||
        (r.sku && r.sku.toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Bảng giá bán</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tra cứu giá bán lẻ và giá sỉ (thợ/thầu)
        </p>
      </div>

      {/* Search */}
      <Input
        placeholder="Tìm theo tên, thương hiệu, quy cách, SKU, mã vạch..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full h-12"
        aria-label="Tìm kiếm sản phẩm"
      />

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Đang tải bảng giá...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="block md:hidden space-y-3">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  Không tìm thấy sản phẩm nào
                </CardContent>
              </Card>
            ) : (
              filtered.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-base truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {r.brand} • {r.specification}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {r.base_unit}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Giá bán lẻ</p>
                        <p className="text-base font-bold text-primary">
                          {formatPrice(r.selling_price)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Giá thợ/thầu</p>
                        <p className="text-sm font-semibold">
                          {r.trade_price != null && r.trade_price > 0
                            ? formatPrice(r.trade_price)
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <CardHeader>
                <CardTitle>Bảng giá ({filtered.length} sản phẩm)</CardTitle>
              </CardHeader>
              <CardContent>
                {filtered.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Không tìm thấy sản phẩm nào
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" role="table">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">Sản phẩm</th>
                          <th className="text-left py-3 px-2 font-medium w-20">ĐVT</th>
                          <th className="text-right py-3 px-2 font-medium w-32">Giá bán lẻ</th>
                          <th className="text-right py-3 px-2 font-medium w-32">Giá thợ/thầu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r) => (
                          <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/50">
                            <td className="py-3 px-2">
                              <p className="font-medium">{r.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {r.brand} • {r.specification}
                              </p>
                            </td>
                            <td className="py-3 px-2 text-muted-foreground">{r.base_unit}</td>
                            <td className="py-3 px-2 text-right font-bold text-primary">
                              {formatPrice(r.selling_price)}
                            </td>
                            <td className="py-3 px-2 text-right font-medium">
                              {r.trade_price != null && r.trade_price > 0
                                ? formatPrice(r.trade_price)
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
