'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Product } from '@/lib/types';

interface ProductWithAge extends Product {
  last_stocked_at?: string | null;
  stock_age_days: number | null;
}

/**
 * Trang Quản lý Tồn kho
 *
 * Hiển thị danh sách SKU với tồn kho realtime, cảnh báo tồn kho thấp,
 * cho phép cài đặt mức tồn kho tối thiểu.
 *
 * Validates: Requirements 1.1, 1.4, 1.5, 1.7, 5.1, 5.2, 5.7
 */
export default function InventoryPage() {
  const [products, setProducts] = useState<ProductWithAge[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMinStock, setEditingMinStock] = useState<string | null>(null);
  const [minStockValue, setMinStockValue] = useState<string>('');
  const [savingMinStock, setSavingMinStock] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClient(), []);

  /**
   * Tính tuổi lưu kho (số ngày kể từ lần nhập gần nhất)
   */
  const calculateStockAge = (lastStockedAt: string | null): number | null => {
    if (!lastStockedAt) return null;
    const lastDate = new Date(lastStockedAt);
    const now = new Date();
    const diffMs = now.getTime() - lastDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  /**
   * Fetch danh sách sản phẩm với thông tin tồn kho
   */
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Lỗi tải danh sách sản phẩm:', error.message);
      setLoading(false);
      return;
    }

    const productsWithAge: ProductWithAge[] = (data || []).map((product) => ({
      ...product,
      stock_age_days: calculateStockAge(product.last_stocked_at ?? null),
    }));

    setProducts(productsWithAge);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Subscribe Supabase Realtime cho cập nhật tồn kho
   */
  useEffect(() => {
    fetchProducts();

    const channel = supabase
      .channel('inventory-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedProduct = payload.new as Product & { last_stocked_at?: string | null };
            setProducts((prev) =>
              prev.map((p) =>
                p.id === updatedProduct.id
                  ? {
                      ...updatedProduct,
                      stock_age_days: calculateStockAge(
                        updatedProduct.last_stocked_at ?? null
                      ),
                    }
                  : p
              )
            );
          } else if (payload.eventType === 'INSERT') {
            const newProduct = payload.new as Product & { last_stocked_at?: string | null };
            setProducts((prev) => [
              ...prev,
              {
                ...newProduct,
                stock_age_days: calculateStockAge(newProduct.last_stocked_at ?? null),
              },
            ]);
          } else if (payload.eventType === 'DELETE') {
            const deletedProduct = payload.old as { id: string };
            setProducts((prev) => prev.filter((p) => p.id !== deletedProduct.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProducts, supabase]);

  /**
   * Cập nhật mức tồn kho tối thiểu cho SKU
   */
  const handleSaveMinStock = async (productId: string) => {
    const newMinStock = parseFloat(minStockValue);
    if (isNaN(newMinStock) || newMinStock < 0) {
      return;
    }

    setSavingMinStock(true);
    const { error } = await supabase
      .from('products')
      .update({ min_stock_level: newMinStock })
      .eq('id', productId);

    if (error) {
      console.error('Lỗi cập nhật mức tối thiểu:', error.message);
    } else {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, min_stock_level: newMinStock } : p
        )
      );
    }

    setSavingMinStock(false);
    setEditingMinStock(null);
    setMinStockValue('');
  };

  /**
   * Bắt đầu chỉnh sửa mức tối thiểu
   */
  const startEditMinStock = (product: ProductWithAge) => {
    setEditingMinStock(product.id);
    setMinStockValue(product.min_stock_level.toString());
  };

  /**
   * Hủy chỉnh sửa
   */
  const cancelEditMinStock = () => {
    setEditingMinStock(null);
    setMinStockValue('');
  };

  /**
   * Kiểm tra sản phẩm có tồn kho thấp không
   */
  const isLowStock = (product: ProductWithAge): boolean => {
    return product.current_stock <= product.min_stock_level;
  };

  /**
   * Lọc sản phẩm theo tìm kiếm và bộ lọc
   */
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.specification.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = !filterLowStock || isLowStock(product);

    return matchesSearch && matchesFilter;
  });

  const lowStockCount = products.filter(isLowStock).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải dữ liệu tồn kho...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Quản lý Tồn kho</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Theo dõi tồn kho realtime cho từng SKU
          </p>
        </div>
        {lowStockCount > 0 && (
          <Badge variant="destructive" className="self-start md:self-auto text-sm px-3 py-1">
            ⚠️ {lowStockCount} sản phẩm tồn kho thấp
          </Badge>
        )}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Tìm kiếm theo tên, thương hiệu, quy cách..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
            aria-label="Tìm kiếm sản phẩm"
          />
        </div>
        <Button
          variant={filterLowStock ? 'destructive' : 'outline'}
          onClick={() => setFilterLowStock(!filterLowStock)}
          className="shrink-0"
          aria-pressed={filterLowStock}
        >
          {filterLowStock ? 'Bỏ lọc' : 'Lọc tồn kho thấp'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tổng SKU</p>
            <p className="text-xl md:text-2xl font-bold">{products.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tồn kho thấp</p>
            <p className="text-xl md:text-2xl font-bold text-destructive">
              {lowStockCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Hết hàng</p>
            <p className="text-xl md:text-2xl font-bold text-destructive">
              {products.filter((p) => p.current_stock === 0).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Đang hiển thị</p>
            <p className="text-xl md:text-2xl font-bold">{filteredProducts.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Product List - Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Không tìm thấy sản phẩm nào
            </CardContent>
          </Card>
        ) : (
          filteredProducts.map((product) => (
            <InventoryCardMobile
              key={product.id}
              product={product}
              isLowStock={isLowStock(product)}
              isEditing={editingMinStock === product.id}
              minStockValue={minStockValue}
              savingMinStock={savingMinStock}
              onStartEdit={() => startEditMinStock(product)}
              onCancelEdit={cancelEditMinStock}
              onSave={() => handleSaveMinStock(product.id)}
              onMinStockChange={setMinStockValue}
            />
          ))
        )}
      </div>

      {/* Product List - Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <CardHeader>
            <CardTitle>Danh sách sản phẩm</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Không tìm thấy sản phẩm nào
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Tên sản phẩm</th>
                      <th className="text-right py-3 px-2 font-medium">Tồn kho</th>
                      <th className="text-left py-3 px-2 font-medium">Đơn vị</th>
                      <th className="text-right py-3 px-2 font-medium">Mức tối thiểu</th>
                      <th className="text-right py-3 px-2 font-medium">Tuổi lưu kho</th>
                      <th className="text-center py-3 px-2 font-medium">Trạng thái</th>
                      <th className="text-center py-3 px-2 font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <InventoryRowDesktop
                        key={product.id}
                        product={product}
                        isLowStock={isLowStock(product)}
                        isEditing={editingMinStock === product.id}
                        minStockValue={minStockValue}
                        savingMinStock={savingMinStock}
                        onStartEdit={() => startEditMinStock(product)}
                        onCancelEdit={cancelEditMinStock}
                        onSave={() => handleSaveMinStock(product.id)}
                        onMinStockChange={setMinStockValue}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// === Sub-components ===

interface InventoryItemProps {
  product: ProductWithAge;
  isLowStock: boolean;
  isEditing: boolean;
  minStockValue: string;
  savingMinStock: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onMinStockChange: (value: string) => void;
}

/**
 * Card hiển thị sản phẩm trên mobile
 */
function InventoryCardMobile({
  product,
  isLowStock: lowStock,
  isEditing,
  minStockValue,
  savingMinStock,
  onStartEdit,
  onCancelEdit,
  onSave,
  onMinStockChange,
}: InventoryItemProps) {
  return (
    <Card className={lowStock ? 'border-destructive/50 bg-destructive/5' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-base truncate">{product.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {product.brand} • {product.specification}
            </p>
          </div>
          {lowStock && (
            <Badge variant="destructive" className="shrink-0 text-xs">
              Thấp
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <p className="text-xs text-muted-foreground">Tồn kho</p>
            <p className={`text-lg font-bold ${lowStock ? 'text-destructive' : ''}`}>
              {product.current_stock}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                {product.base_unit}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tuổi lưu kho</p>
            <p className="text-lg font-bold">
              {product.stock_age_days !== null ? (
                <>
                  {product.stock_age_days}
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ngày
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </p>
          </div>
        </div>

        {/* Min stock level */}
        <div className="mt-3 pt-3 border-t">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <label htmlFor={`min-stock-${product.id}`} className="text-xs text-muted-foreground shrink-0">
                Mức tối thiểu:
              </label>
              <Input
                id={`min-stock-${product.id}`}
                type="number"
                min="0"
                value={minStockValue}
                onChange={(e) => onMinStockChange(e.target.value)}
                className="h-9 w-24 text-sm"
                aria-label="Nhập mức tồn kho tối thiểu"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSave();
                  if (e.key === 'Escape') onCancelEdit();
                }}
                autoFocus
              />
              <Button
                size="sm"
                onClick={onSave}
                disabled={savingMinStock}
                className="h-9"
              >
                {savingMinStock ? '...' : 'Lưu'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onCancelEdit}
                className="h-9"
              >
                Hủy
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Mức tối thiểu:{' '}
                <span className="font-medium text-foreground">
                  {product.min_stock_level} {product.base_unit}
                </span>
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={onStartEdit}
                className="h-8 text-xs"
              >
                Sửa
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Row hiển thị sản phẩm trên desktop table
 */
function InventoryRowDesktop({
  product,
  isLowStock: lowStock,
  isEditing,
  minStockValue,
  savingMinStock,
  onStartEdit,
  onCancelEdit,
  onSave,
  onMinStockChange,
}: InventoryItemProps) {
  return (
    <tr
      className={`border-b last:border-b-0 ${
        lowStock ? 'bg-destructive/5' : ''
      }`}
    >
      <td className="py-3 px-2">
        <div>
          <p className="font-medium">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            {product.brand} • {product.specification}
          </p>
        </div>
      </td>
      <td className={`py-3 px-2 text-right font-bold ${lowStock ? 'text-destructive' : ''}`}>
        {product.current_stock}
      </td>
      <td className="py-3 px-2">{product.base_unit}</td>
      <td className="py-3 px-2 text-right">
        {isEditing ? (
          <div className="flex items-center justify-end gap-1">
            <Input
              type="number"
              min="0"
              value={minStockValue}
              onChange={(e) => onMinStockChange(e.target.value)}
              className="h-8 w-20 text-sm text-right"
              aria-label="Nhập mức tồn kho tối thiểu"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave();
                if (e.key === 'Escape') onCancelEdit();
              }}
              autoFocus
            />
            <Button size="sm" onClick={onSave} disabled={savingMinStock} className="h-8 px-2">
              {savingMinStock ? '...' : '✓'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelEdit} className="h-8 px-2">
              ✕
            </Button>
          </div>
        ) : (
          <span>{product.min_stock_level}</span>
        )}
      </td>
      <td className="py-3 px-2 text-right">
        {product.stock_age_days !== null ? (
          <span>
            {product.stock_age_days} ngày
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-3 px-2 text-center">
        {lowStock ? (
          <Badge variant="destructive" className="text-xs">
            Tồn kho thấp
          </Badge>
        ) : product.current_stock === 0 ? (
          <Badge variant="destructive" className="text-xs">
            Hết hàng
          </Badge>
        ) : (
          <Badge variant="success" className="text-xs">
            Bình thường
          </Badge>
        )}
      </td>
      <td className="py-3 px-2 text-center">
        {!isEditing && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onStartEdit}
            className="h-8 text-xs"
          >
            Cài đặt mức TT
          </Button>
        )}
      </td>
    </tr>
  );
}
