'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Product, PriceHistory, UserProfile } from '@/lib/types';
import PriceHistoryTimeline from '@/components/products/PriceHistoryTimeline';
import PriceEditDialog from '@/components/products/PriceEditDialog';

/**
 * Trang Quản lý Giá vốn và Giá bán
 *
 * - Owner: Xem WAC, Last Cost, cài đặt giá bán, xem lịch sử giá
 * - Staff: Chỉ thấy giá bán (sử dụng products_staff_view)
 *
 * Validates: Requirements 8.1, 8.3, 8.4, 8.5, 8.6
 */
export default function PricingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  /**
   * Fetch user profile to determine role
   */
  const fetchUserProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      setUserProfile(data as UserProfile);
    }
  }, [supabase]);

  /**
   * Fetch products - Owner sees full data, Staff sees only staff view
   */
  const fetchProducts = useCallback(async () => {
    setLoading(true);

    if (userProfile?.role === 'staff') {
      // Staff: use products_staff_view (hides cost columns)
      const { data, error } = await supabase
        .from('products_staff_view')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data) {
        setProducts(data as Product[]);
      }
    } else {
      // Owner: full access to products table
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data) {
        setProducts(data as Product[]);
      }
    }

    setLoading(false);
  }, [supabase, userProfile?.role]);

  /**
   * Fetch price history for a specific product
   */
  const fetchPriceHistory = useCallback(async (productId: string) => {
    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPriceHistory(data as PriceHistory[]);
    }
  }, [supabase]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  useEffect(() => {
    if (userProfile) {
      fetchProducts();
    }
  }, [userProfile, fetchProducts]);

  /**
   * Handle viewing price history for a product
   */
  const handleViewHistory = async (product: Product) => {
    setSelectedProduct(product);
    await fetchPriceHistory(product.id);
    setShowHistory(true);
  };

  /**
   * Handle opening edit dialog for selling price
   */
  const handleEditPrice = (product: Product) => {
    setSelectedProduct(product);
    setShowEditDialog(true);
  };

  /**
   * Handle saving updated selling price
   */
  const handleSavePrice = async (productId: string, newPrice: number, newPriceType: 'fixed' | 'variable') => {
    const { error } = await supabase
      .from('products')
      .update({
        selling_price: newPrice,
        price_type: newPriceType,
      })
      .eq('id', productId);

    if (error) {
      throw new Error(error.message);
    }

    // Update local state
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, selling_price: newPrice, price_type: newPriceType }
          : p
      )
    );

    setShowEditDialog(false);
  };

  /**
   * Filter products by search query
   */
  const filteredProducts = products.filter((product) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.brand.toLowerCase().includes(query) ||
      product.specification.toLowerCase().includes(query) ||
      (product.barcode && product.barcode.includes(searchQuery))
    );
  });

  /**
   * Format price in VND
   */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const isOwner = userProfile?.role === 'owner';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải thông tin giá...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">
            {isOwner ? 'Quản lý Giá vốn & Giá bán' : 'Bảng giá bán'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isOwner
              ? 'Xem giá vốn, cài đặt giá bán, lịch sử giá nhập'
              : 'Tra cứu giá bán sản phẩm'}
          </p>
        </div>
      </div>

      {/* Search */}
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
      </div>

      {/* Summary Cards - Owner only */}
      {isOwner && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <Card>
            <CardContent className="p-3 md:p-4">
              <p className="text-xs text-muted-foreground">Tổng sản phẩm</p>
              <p className="text-xl md:text-2xl font-bold">{products.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4">
              <p className="text-xs text-muted-foreground">Giá cố định</p>
              <p className="text-xl md:text-2xl font-bold">
                {products.filter((p) => p.price_type === 'fixed').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4">
              <p className="text-xs text-muted-foreground">Giá biến động</p>
              <p className="text-xl md:text-2xl font-bold">
                {products.filter((p) => p.price_type === 'variable').length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Product Pricing List - Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Không tìm thấy sản phẩm nào
            </CardContent>
          </Card>
        ) : (
          filteredProducts.map((product) => (
            <PricingCardMobile
              key={product.id}
              product={product}
              isOwner={isOwner}
              formatPrice={formatPrice}
              onEditPrice={handleEditPrice}
              onViewHistory={handleViewHistory}
            />
          ))
        )}
      </div>

      {/* Product Pricing List - Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <CardHeader>
            <CardTitle>
              {isOwner ? 'Bảng giá vốn & giá bán' : 'Bảng giá bán'}
            </CardTitle>
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
                      <th className="text-left py-3 px-2 font-medium">Sản phẩm</th>
                      {isOwner && (
                        <>
                          <th className="text-right py-3 px-2 font-medium">Giá vốn TB (WAC)</th>
                          <th className="text-right py-3 px-2 font-medium">Giá nhập cuối</th>
                        </>
                      )}
                      <th className="text-right py-3 px-2 font-medium">Giá bán</th>
                      {isOwner && (
                        <th className="text-right py-3 px-2 font-medium">Biên lợi nhuận</th>
                      )}
                      <th className="text-center py-3 px-2 font-medium">Loại giá</th>
                      <th className="text-center py-3 px-2 font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <PricingRowDesktop
                        key={product.id}
                        product={product}
                        isOwner={isOwner}
                        formatPrice={formatPrice}
                        onEditPrice={handleEditPrice}
                        onViewHistory={handleViewHistory}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Price History Modal */}
      {showHistory && selectedProduct && (
        <PriceHistoryTimeline
          product={selectedProduct}
          priceHistory={priceHistory}
          formatPrice={formatPrice}
          onClose={() => {
            setShowHistory(false);
            setSelectedProduct(null);
            setPriceHistory([]);
          }}
        />
      )}

      {/* Price Edit Dialog */}
      {showEditDialog && selectedProduct && (
        <PriceEditDialog
          product={selectedProduct}
          onSave={handleSavePrice}
          onClose={() => {
            setShowEditDialog(false);
            setSelectedProduct(null);
          }}
        />
      )}
    </div>
  );
}

// === Sub-components ===

interface PricingItemProps {
  product: Product;
  isOwner: boolean;
  formatPrice: (price: number) => string;
  onEditPrice: (product: Product) => void;
  onViewHistory: (product: Product) => void;
}

function PricingCardMobile({
  product,
  isOwner,
  formatPrice,
  onEditPrice,
  onViewHistory,
}: PricingItemProps) {
  const margin = product.weighted_avg_cost > 0
    ? ((product.selling_price - product.weighted_avg_cost) / product.selling_price * 100).toFixed(1)
    : null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-base truncate">{product.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {product.brand} • {product.specification}
            </p>
          </div>
          <Badge
            variant={product.price_type === 'fixed' ? 'secondary' : 'warning'}
            className="shrink-0 text-xs"
          >
            {product.price_type === 'fixed' ? 'Cố định' : 'Biến động'}
          </Badge>
        </div>

        <div className={`grid ${isOwner ? 'grid-cols-2' : 'grid-cols-1'} gap-3 mt-3`}>
          {isOwner && (
            <>
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
            </>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Giá bán</p>
            <p className="text-base font-bold text-primary">
              {formatPrice(product.selling_price)}
            </p>
          </div>
          {isOwner && margin && (
            <div>
              <p className="text-xs text-muted-foreground">Biên lợi nhuận</p>
              <p className={`text-sm font-semibold ${Number(margin) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {margin}%
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-3 pt-3 border-t">
          {isOwner && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onEditPrice(product)}
              >
                Cài đặt giá
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => onViewHistory(product)}
              >
                Lịch sử
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PricingRowDesktop({
  product,
  isOwner,
  formatPrice,
  onEditPrice,
  onViewHistory,
}: PricingItemProps) {
  const margin = product.weighted_avg_cost > 0
    ? ((product.selling_price - product.weighted_avg_cost) / product.selling_price * 100).toFixed(1)
    : null;

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/50">
      <td className="py-3 px-2">
        <div>
          <p className="font-medium">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            {product.brand} • {product.specification}
          </p>
        </div>
      </td>
      {isOwner && (
        <>
          <td className="py-3 px-2 text-right">
            <span className="text-orange-600 font-medium">
              {product.weighted_avg_cost > 0
                ? formatPrice(product.weighted_avg_cost)
                : '—'}
            </span>
          </td>
          <td className="py-3 px-2 text-right">
            <span className="text-blue-600 font-medium">
              {product.last_cost > 0
                ? formatPrice(product.last_cost)
                : '—'}
            </span>
          </td>
        </>
      )}
      <td className="py-3 px-2 text-right font-bold text-primary">
        {formatPrice(product.selling_price)}
      </td>
      {isOwner && (
        <td className="py-3 px-2 text-right">
          {margin ? (
            <span className={`font-medium ${Number(margin) > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {margin}%
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}
      <td className="py-3 px-2 text-center">
        <Badge
          variant={product.price_type === 'fixed' ? 'secondary' : 'warning'}
          className="text-xs"
        >
          {product.price_type === 'fixed' ? 'Cố định' : 'Biến động'}
        </Badge>
      </td>
      <td className="py-3 px-2 text-center">
        <div className="flex items-center justify-center gap-1">
          {isOwner && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => onEditPrice(product)}
              >
                Cài đặt giá
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => onViewHistory(product)}
              >
                Lịch sử
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
