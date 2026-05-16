'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Product, Category } from '@/lib/types';
import Link from 'next/link';

/**
 * Trang Danh sách Sản phẩm
 *
 * Hiển thị danh sách sản phẩm với tìm kiếm, lọc theo nhóm hàng.
 * Hỗ trợ thêm, sửa sản phẩm.
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 */
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  /**
   * Fetch danh sách sản phẩm
   */
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Lỗi tải danh sách sản phẩm:', error.message);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  }, [supabase]);

  /**
   * Fetch danh sách nhóm hàng
   */
  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Lỗi tải nhóm hàng:', error.message);
    } else {
      setCategories(data || []);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  /**
   * Xóa sản phẩm
   */
  const handleDelete = async (productId: string) => {
    if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;

    setDeletingId(productId);
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      console.error('Lỗi xóa sản phẩm:', error.message);
      alert('Không thể xóa sản phẩm. Vui lòng thử lại.');
    } else {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    }
    setDeletingId(null);
  };

  /**
   * Lấy tên nhóm hàng từ category_id
   */
  const getCategoryName = (categoryId: string): string => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || '—';
  };

  /**
   * Lấy nhóm chính (parent category)
   */
  const getMainCategory = (categoryId: string): string | null => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return null;
    if (!category.parent_id) return category.name;
    const parent = categories.find((c) => c.id === category.parent_id);
    return parent?.name || null;
  };

  /**
   * Nhóm hàng chính (không có parent)
   */
  const mainCategories = categories.filter((c) => !c.parent_id);

  /**
   * Lọc sản phẩm theo tìm kiếm và nhóm hàng
   */
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.specification.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.barcode && product.barcode.includes(searchQuery));

    const matchesCategory =
      !selectedCategory ||
      product.category_id === selectedCategory ||
      // Lọc theo nhóm chính: bao gồm cả nhóm phụ
      categories
        .filter((c) => c.parent_id === selectedCategory)
        .some((sub) => sub.id === product.category_id);

    return matchesSearch && matchesCategory;
  });

  /**
   * Format giá tiền VND
   */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải danh sách sản phẩm...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Quản lý Sản phẩm</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Danh mục sản phẩm ({products.length} SKU)
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <Link href="/products/pricing">
            <Button variant="outline" size="lg" className="w-full md:w-auto">
              Quản lý giá
            </Button>
          </Link>
          <Link href="/products/new">
            <Button size="lg" className="w-full md:w-auto">
              + Thêm sản phẩm
            </Button>
          </Link>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Tìm kiếm theo tên, thương hiệu, quy cách, mã vạch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
            aria-label="Tìm kiếm sản phẩm"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="h-12 rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Lọc theo nhóm hàng"
        >
          <option value="">Tất cả nhóm hàng</option>
          {mainCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tổng sản phẩm</p>
            <p className="text-xl md:text-2xl font-bold">{products.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Đang hiển thị</p>
            <p className="text-xl md:text-2xl font-bold">{filteredProducts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Nhóm hàng</p>
            <p className="text-xl md:text-2xl font-bold">{mainCategories.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Có mã vạch</p>
            <p className="text-xl md:text-2xl font-bold">
              {products.filter((p) => p.barcode).length}
            </p>
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
            <ProductCardMobile
              key={product.id}
              product={product}
              categoryName={getCategoryName(product.category_id)}
              mainCategory={getMainCategory(product.category_id)}
              formatPrice={formatPrice}
              onDelete={handleDelete}
              isDeleting={deletingId === product.id}
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
                      <th className="text-left py-3 px-2 font-medium">Sản phẩm</th>
                      <th className="text-left py-3 px-2 font-medium">Nhóm hàng</th>
                      <th className="text-left py-3 px-2 font-medium">Đơn vị</th>
                      <th className="text-right py-3 px-2 font-medium">Giá bán</th>
                      <th className="text-right py-3 px-2 font-medium">Tồn kho</th>
                      <th className="text-center py-3 px-2 font-medium">Loại giá</th>
                      <th className="text-center py-3 px-2 font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <ProductRowDesktop
                        key={product.id}
                        product={product}
                        categoryName={getCategoryName(product.category_id)}
                        mainCategory={getMainCategory(product.category_id)}
                        formatPrice={formatPrice}
                        onDelete={handleDelete}
                        isDeleting={deletingId === product.id}
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

interface ProductItemProps {
  product: Product;
  categoryName: string;
  mainCategory: string | null;
  formatPrice: (price: number) => string;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function ProductCardMobile({
  product,
  categoryName,
  mainCategory,
  formatPrice,
  onDelete,
  isDeleting,
}: ProductItemProps) {
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
          <Badge variant={product.price_type === 'fixed' ? 'secondary' : 'warning'} className="shrink-0 text-xs">
            {product.price_type === 'fixed' ? 'Cố định' : 'Biến động'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <p className="text-xs text-muted-foreground">Giá bán</p>
            <p className="text-base font-bold text-primary">
              {formatPrice(product.selling_price)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tồn kho</p>
            <p className="text-base font-bold">
              {product.current_stock}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                {product.base_unit}
              </span>
            </p>
          </div>
        </div>

        <div className="mt-2">
          <p className="text-xs text-muted-foreground">
            Nhóm: {mainCategory && mainCategory !== categoryName ? `${mainCategory} > ` : ''}
            {categoryName}
          </p>
          {product.barcode && (
            <p className="text-xs text-muted-foreground">Mã vạch: {product.barcode}</p>
          )}
        </div>

        <div className="flex gap-2 mt-3 pt-3 border-t">
          <Link href={`/products/${product.id}/edit`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              Sửa
            </Button>
          </Link>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(product.id)}
            disabled={isDeleting}
            className="shrink-0"
          >
            {isDeleting ? '...' : 'Xóa'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductRowDesktop({
  product,
  categoryName,
  mainCategory,
  formatPrice,
  onDelete,
  isDeleting,
}: ProductItemProps) {
  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/50">
      <td className="py-3 px-2">
        <div>
          <p className="font-medium">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            {product.brand} • {product.specification}
          </p>
          {product.barcode && (
            <p className="text-xs text-muted-foreground">Mã: {product.barcode}</p>
          )}
        </div>
      </td>
      <td className="py-3 px-2">
        <div>
          {mainCategory && mainCategory !== categoryName && (
            <p className="text-xs text-muted-foreground">{mainCategory}</p>
          )}
          <p className="text-sm">{categoryName}</p>
        </div>
      </td>
      <td className="py-3 px-2">{product.base_unit}</td>
      <td className="py-3 px-2 text-right font-medium">
        {formatPrice(product.selling_price)}
      </td>
      <td className="py-3 px-2 text-right">
        {product.current_stock} {product.base_unit}
      </td>
      <td className="py-3 px-2 text-center">
        <Badge variant={product.price_type === 'fixed' ? 'secondary' : 'warning'} className="text-xs">
          {product.price_type === 'fixed' ? 'Cố định' : 'Biến động'}
        </Badge>
      </td>
      <td className="py-3 px-2 text-center">
        <div className="flex items-center justify-center gap-1">
          <Link href={`/products/${product.id}/edit`}>
            <Button size="sm" variant="ghost" className="h-8 text-xs">
              Sửa
            </Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-destructive hover:text-destructive"
            onClick={() => onDelete(product.id)}
            disabled={isDeleting}
          >
            {isDeleting ? '...' : 'Xóa'}
          </Button>
        </div>
      </td>
    </tr>
  );
}
