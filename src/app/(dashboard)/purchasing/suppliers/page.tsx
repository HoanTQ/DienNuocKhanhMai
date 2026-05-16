'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Supplier, SupplierPrice } from '@/lib/types';

// === Types ===

interface SupplierPriceWithProduct extends SupplierPrice {
  product?: { id: string; name: string; brand: string; specification: string; base_unit: string };
}

interface PriceComparisonRow {
  product_id: string;
  product_name: string;
  brand: string;
  specification: string;
  base_unit: string;
  prices: { supplier_id: string; supplier_name: string; unit_price: number; effective_date: string }[];
}

type ViewMode = 'list' | 'form' | 'prices' | 'compare' | 'import';

/**
 * Trang Quản lý Nhà cung cấp
 *
 * - CRUD nhà cung cấp: tên, SĐT, email, địa chỉ, ghi chú
 * - Lưu trữ bảng giá NCC
 * - Hỗ trợ import bảng giá từ file Excel
 * - So sánh giá từ nhiều NCC cho cùng sản phẩm
 *
 * Validates: Requirements 14.1, 14.2, 14.3
 */
export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const supabase = useMemo(() => createClient(), []);

  /** Fetch danh sách nhà cung cấp */
  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Lỗi tải danh sách NCC:', error.message);
    } else {
      setSuppliers(data || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  /** Tìm kiếm NCC */
  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      s.name.toLowerCase().includes(query) ||
      s.phone.toLowerCase().includes(query) ||
      (s.email || '').toLowerCase().includes(query)
    );
  });

  /** Xóa NCC */
  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa nhà cung cấp này?')) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) {
      alert('Lỗi xóa NCC: ' + error.message);
    } else {
      fetchSuppliers();
    }
  };

  // === Render based on view mode ===

  if (viewMode === 'form') {
    return (
      <div className="p-4 md:p-6">
        <SupplierForm
          supplier={editingSupplier}
          onSuccess={() => {
            setViewMode('list');
            setEditingSupplier(null);
            fetchSuppliers();
          }}
          onCancel={() => {
            setViewMode('list');
            setEditingSupplier(null);
          }}
        />
      </div>
    );
  }

  if (viewMode === 'prices' && selectedSupplier) {
    return (
      <div className="p-4 md:p-6">
        <SupplierPriceList
          supplier={selectedSupplier}
          onBack={() => {
            setViewMode('list');
            setSelectedSupplier(null);
          }}
        />
      </div>
    );
  }

  if (viewMode === 'compare') {
    return (
      <div className="p-4 md:p-6">
        <PriceComparison
          suppliers={suppliers}
          onBack={() => setViewMode('list')}
        />
      </div>
    );
  }

  if (viewMode === 'import') {
    return (
      <div className="p-4 md:p-6">
        <ExcelImport
          suppliers={suppliers}
          onSuccess={() => {
            setViewMode('list');
            fetchSuppliers();
          }}
          onBack={() => setViewMode('list')}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải danh sách nhà cung cấp...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Quản lý Nhà cung cấp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Thông tin NCC, bảng giá và so sánh giá
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setEditingSupplier(null);
              setViewMode('form');
            }}
            className="flex-1 sm:flex-none"
          >
            + Thêm NCC
          </Button>
          <Button
            variant="outline"
            onClick={() => setViewMode('compare')}
            className="flex-1 sm:flex-none"
          >
            So sánh giá
          </Button>
          <Button
            variant="outline"
            onClick={() => setViewMode('import')}
            className="flex-1 sm:flex-none"
          >
            Import Excel
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex-1">
        <Input
          placeholder="Tìm kiếm theo tên, SĐT, email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
          aria-label="Tìm kiếm nhà cung cấp"
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tổng NCC</p>
            <p className="text-xl md:text-2xl font-bold">{suppliers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Đang hiển thị</p>
            <p className="text-xl md:text-2xl font-bold">{filteredSuppliers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Supplier List - Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {filteredSuppliers.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Không tìm thấy nhà cung cấp nào
            </CardContent>
          </Card>
        ) : (
          filteredSuppliers.map((supplier) => (
            <Card key={supplier.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-base truncate">{supplier.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{supplier.phone}</p>
                    {supplier.email && (
                      <p className="text-xs text-muted-foreground truncate">{supplier.email}</p>
                    )}
                    {supplier.address && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{supplier.address}</p>
                    )}
                  </div>
                </div>
                {supplier.notes && (
                  <p className="text-xs text-muted-foreground mt-2 italic truncate">
                    {supplier.notes}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedSupplier(supplier);
                      setViewMode('prices');
                    }}
                    className="flex-1"
                  >
                    Bảng giá
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingSupplier(supplier);
                      setViewMode('form');
                    }}
                  >
                    Sửa
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => handleDeleteSupplier(supplier.id)}
                  >
                    Xóa
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Supplier List - Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <CardHeader>
            <CardTitle>Danh sách nhà cung cấp</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredSuppliers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Không tìm thấy nhà cung cấp nào
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Tên NCC</th>
                      <th className="text-left py-3 px-2 font-medium">SĐT</th>
                      <th className="text-left py-3 px-2 font-medium">Email</th>
                      <th className="text-left py-3 px-2 font-medium">Địa chỉ</th>
                      <th className="text-left py-3 px-2 font-medium">Ghi chú</th>
                      <th className="text-center py-3 px-2 font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map((supplier) => (
                      <tr key={supplier.id} className="border-b last:border-b-0 hover:bg-muted/50">
                        <td className="py-3 px-2 font-medium">{supplier.name}</td>
                        <td className="py-3 px-2">{supplier.phone}</td>
                        <td className="py-3 px-2 text-muted-foreground">{supplier.email || '—'}</td>
                        <td className="py-3 px-2 text-muted-foreground truncate max-w-[200px]">
                          {supplier.address || '—'}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground truncate max-w-[150px]">
                          {supplier.notes || '—'}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() => {
                                setSelectedSupplier(supplier);
                                setViewMode('prices');
                              }}
                            >
                              Bảng giá
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() => {
                                setEditingSupplier(supplier);
                                setViewMode('form');
                              }}
                            >
                              Sửa
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs text-destructive"
                              onClick={() => handleDeleteSupplier(supplier.id)}
                            >
                              Xóa
                            </Button>
                          </div>
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
    </div>
  );
}


// ============================================================
// Sub-component: SupplierForm (Thêm/Sửa NCC)
// ============================================================

interface SupplierFormProps {
  supplier: Supplier | null;
  onSuccess: () => void;
  onCancel: () => void;
}

function SupplierForm({ supplier, onSuccess, onCancel }: SupplierFormProps) {
  const [name, setName] = useState(supplier?.name || '');
  const [phone, setPhone] = useState(supplier?.phone || '');
  const [email, setEmail] = useState(supplier?.email || '');
  const [address, setAddress] = useState(supplier?.address || '');
  const [notes, setNotes] = useState(supplier?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const supabase = useMemo(() => createClient(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Vui lòng nhập tên nhà cung cấp');
      return;
    }
    if (!phone.trim()) {
      setError('Vui lòng nhập số điện thoại');
      return;
    }

    setSaving(true);

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    };

    if (supplier) {
      // Update
      const { error: updateError } = await supabase
        .from('suppliers')
        .update(payload)
        .eq('id', supplier.id);

      if (updateError) {
        setError('Lỗi cập nhật: ' + updateError.message);
        setSaving(false);
        return;
      }
    } else {
      // Create
      const { error: insertError } = await supabase
        .from('suppliers')
        .insert(payload);

      if (insertError) {
        setError('Lỗi thêm NCC: ' + insertError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSuccess();
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>{supplier ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp mới'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="supplier-name">Tên nhà cung cấp *</Label>
            <Input
              id="supplier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên NCC"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier-phone">Số điện thoại *</Label>
            <Input
              id="supplier-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Nhập SĐT"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier-email">Email</Label>
            <Input
              id="supplier-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email (tùy chọn)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier-address">Địa chỉ</Label>
            <Input
              id="supplier-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Nhập địa chỉ (tùy chọn)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier-notes">Ghi chú</Label>
            <textarea
              id="supplier-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú thêm (tùy chọn)"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] resize-y"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? 'Đang lưu...' : supplier ? 'Cập nhật' : 'Thêm NCC'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Hủy
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


// ============================================================
// Sub-component: SupplierPriceList (Bảng giá NCC)
// ============================================================

interface SupplierPriceListProps {
  supplier: Supplier;
  onBack: () => void;
}

interface ProductOption {
  id: string;
  name: string;
  brand: string;
  specification: string;
  base_unit: string;
}

function SupplierPriceList({ supplier, onBack }: SupplierPriceListProps) {
  const [prices, setPrices] = useState<SupplierPriceWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [priceNotes, setPriceNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('supplier_prices')
      .select('*, product:products(id, name, brand, specification, base_unit)')
      .eq('supplier_id', supplier.id)
      .order('effective_date', { ascending: false });

    if (error) {
      console.error('Lỗi tải bảng giá:', error.message);
    } else {
      setPrices(data || []);
    }
    setLoading(false);
  }, [supabase, supplier.id]);

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, brand, specification, base_unit')
      .order('name', { ascending: true });
    setProducts(data || []);
  }, [supabase]);

  useEffect(() => {
    fetchPrices();
    fetchProducts();
  }, [fetchPrices, fetchProducts]);

  /** Thêm giá mới */
  const handleAddPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !unitPrice) return;

    setSaving(true);
    const { error } = await supabase.from('supplier_prices').insert({
      supplier_id: supplier.id,
      product_id: selectedProductId,
      unit_price: parseFloat(unitPrice),
      notes: priceNotes.trim() || null,
      effective_date: new Date().toISOString(),
    });

    if (error) {
      alert('Lỗi thêm giá: ' + error.message);
    } else {
      setSelectedProductId('');
      setUnitPrice('');
      setPriceNotes('');
      setShowAddForm(false);
      fetchPrices();
    }
    setSaving(false);
  };

  /** Xóa giá */
  const handleDeletePrice = async (id: string) => {
    if (!confirm('Xóa giá này?')) return;
    const { error } = await supabase.from('supplier_prices').delete().eq('id', id);
    if (error) {
      alert('Lỗi xóa: ' + error.message);
    } else {
      fetchPrices();
    }
  };

  /** Format giá tiền VND */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Button variant="ghost" onClick={onBack} className="mb-2 -ml-2 text-sm">
            ← Quay lại
          </Button>
          <h1 className="text-xl md:text-2xl font-bold">Bảng giá: {supplier.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {supplier.phone} {supplier.email ? `• ${supplier.email}` : ''}
          </p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Đóng' : '+ Thêm giá'}
        </Button>
      </div>

      {/* Add Price Form */}
      {showAddForm && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleAddPrice} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="price-product">Sản phẩm</Label>
                  <select
                    id="price-product"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    required
                  >
                    <option value="">Chọn sản phẩm...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - {p.brand} ({p.specification})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="price-value">Đơn giá (VNĐ)</Label>
                  <Input
                    id="price-value"
                    type="number"
                    min="0"
                    step="100"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="Nhập đơn giá"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="price-notes">Ghi chú</Label>
                  <Input
                    id="price-notes"
                    value={priceNotes}
                    onChange={(e) => setPriceNotes(e.target.value)}
                    placeholder="Ghi chú (tùy chọn)"
                  />
                </div>
              </div>
              <Button type="submit" disabled={saving} size="sm">
                {saving ? 'Đang lưu...' : 'Lưu giá'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Price List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : prices.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Chưa có bảng giá nào cho NCC này
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="block md:hidden space-y-3">
            {prices.map((price) => (
              <Card key={price.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">
                        {price.product?.name || 'Sản phẩm không xác định'}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {price.product?.brand} - {price.product?.specification}
                      </p>
                    </div>
                    <Badge className="shrink-0 text-xs font-semibold">
                      {formatPrice(price.unit_price)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">
                      Ngày: {formatDate(price.effective_date)}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive h-7 text-xs"
                      onClick={() => handleDeletePrice(price.id)}
                    >
                      Xóa
                    </Button>
                  </div>
                  {price.notes && (
                    <p className="text-xs text-muted-foreground italic mt-1">{price.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block">
            <Card>
              <CardHeader>
                <CardTitle>Bảng giá ({prices.length} sản phẩm)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Sản phẩm</th>
                        <th className="text-left py-3 px-2 font-medium">Thương hiệu</th>
                        <th className="text-left py-3 px-2 font-medium">Quy cách</th>
                        <th className="text-right py-3 px-2 font-medium">Đơn giá</th>
                        <th className="text-left py-3 px-2 font-medium">Ngày hiệu lực</th>
                        <th className="text-left py-3 px-2 font-medium">Ghi chú</th>
                        <th className="text-center py-3 px-2 font-medium">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prices.map((price) => (
                        <tr key={price.id} className="border-b last:border-b-0 hover:bg-muted/50">
                          <td className="py-3 px-2 font-medium">
                            {price.product?.name || '—'}
                          </td>
                          <td className="py-3 px-2 text-muted-foreground">
                            {price.product?.brand || '—'}
                          </td>
                          <td className="py-3 px-2 text-muted-foreground">
                            {price.product?.specification || '—'}
                          </td>
                          <td className="py-3 px-2 text-right font-semibold">
                            {formatPrice(price.unit_price)}
                          </td>
                          <td className="py-3 px-2 text-muted-foreground">
                            {formatDate(price.effective_date)}
                          </td>
                          <td className="py-3 px-2 text-muted-foreground truncate max-w-[150px]">
                            {price.notes || '—'}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs text-destructive"
                              onClick={() => handleDeletePrice(price.id)}
                            >
                              Xóa
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}


// ============================================================
// Sub-component: PriceComparison (So sánh giá nhiều NCC)
// ============================================================

interface PriceComparisonProps {
  suppliers: Supplier[];
  onBack: () => void;
}

function PriceComparison({ suppliers, onBack }: PriceComparisonProps) {
  const [comparisonData, setComparisonData] = useState<PriceComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchComparisonData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchComparisonData() {
    setLoading(true);

    // Fetch all supplier prices with product and supplier info
    const { data, error } = await supabase
      .from('supplier_prices')
      .select(`
        *,
        product:products(id, name, brand, specification, base_unit),
        supplier:suppliers(id, name)
      `)
      .order('effective_date', { ascending: false });

    if (error) {
      console.error('Lỗi tải dữ liệu so sánh:', error.message);
      setLoading(false);
      return;
    }

    // Group by product, keeping only latest price per supplier-product pair
    const productMap = new Map<string, PriceComparisonRow>();
    const seenPairs = new Set<string>();

    for (const item of data || []) {
      const product = item.product as { id: string; name: string; brand: string; specification: string; base_unit: string } | null;
      const supplier = item.supplier as { id: string; name: string } | null;
      if (!product || !supplier) continue;

      const pairKey = `${product.id}-${supplier.id}`;
      // Only keep the latest price per supplier-product pair
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      if (!productMap.has(product.id)) {
        productMap.set(product.id, {
          product_id: product.id,
          product_name: product.name,
          brand: product.brand,
          specification: product.specification,
          base_unit: product.base_unit,
          prices: [],
        });
      }

      productMap.get(product.id)!.prices.push({
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        unit_price: item.unit_price,
        effective_date: item.effective_date,
      });
    }

    // Only show products with prices from 2+ suppliers
    const comparison = Array.from(productMap.values())
      .filter((row) => row.prices.length >= 2)
      .sort((a, b) => a.product_name.localeCompare(b.product_name));

    setComparisonData(comparison);
    setLoading(false);
  }

  const filteredData = comparisonData.filter((row) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      row.product_name.toLowerCase().includes(query) ||
      row.brand.toLowerCase().includes(query) ||
      row.specification.toLowerCase().includes(query)
    );
  });

  /** Format giá tiền VND */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" onClick={onBack} className="mb-2 -ml-2 text-sm">
          ← Quay lại
        </Button>
        <h1 className="text-xl md:text-2xl font-bold">So sánh giá NCC</h1>
        <p className="text-sm text-muted-foreground mt-1">
          So sánh giá từ nhiều nhà cung cấp cho cùng sản phẩm
        </p>
      </div>

      {/* Search */}
      <Input
        placeholder="Tìm sản phẩm để so sánh..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full"
        aria-label="Tìm kiếm sản phẩm so sánh giá"
      />

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredData.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            {comparisonData.length === 0
              ? 'Chưa có sản phẩm nào có giá từ 2 NCC trở lên để so sánh'
              : 'Không tìm thấy sản phẩm phù hợp'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredData.map((row) => {
            const minPrice = Math.min(...row.prices.map((p) => p.unit_price));
            return (
              <Card key={row.product_id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {row.product_name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {row.brand} • {row.specification} • ĐVT: {row.base_unit}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {row.prices
                      .sort((a, b) => a.unit_price - b.unit_price)
                      .map((price) => (
                        <div
                          key={price.supplier_id}
                          className={`flex items-center justify-between p-2 rounded-md ${
                            price.unit_price === minPrice
                              ? 'bg-green-50 border border-green-200'
                              : 'bg-muted/30'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{price.supplier_name}</span>
                            {price.unit_price === minPrice && (
                              <Badge variant="success" className="text-xs">
                                Giá tốt nhất
                              </Badge>
                            )}
                          </div>
                          <span className={`text-sm font-semibold ${
                            price.unit_price === minPrice ? 'text-green-700' : ''
                          }`}>
                            {formatPrice(price.unit_price)}
                          </span>
                        </div>
                      ))}
                  </div>
                  {row.prices.length >= 2 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Chênh lệch: {formatPrice(Math.max(...row.prices.map((p) => p.unit_price)) - minPrice)}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ============================================================
// Sub-component: ExcelImport (Import bảng giá từ Excel)
// ============================================================

interface ExcelImportProps {
  suppliers: Supplier[];
  onSuccess: () => void;
  onBack: () => void;
}

interface ParsedPriceRow {
  productName: string;
  unitPrice: number;
  notes?: string;
  valid: boolean;
  error?: string;
}

function ExcelImport({ suppliers, onSuccess, onBack }: ExcelImportProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedPriceRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState('');
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = useMemo(() => createClient(), []);

  /** Parse CSV/Excel file (basic CSV parsing) */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParseError('');
    setParsedData([]);
    setImportResult(null);

    // Support CSV format (basic Excel export)
    if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      setParseError('Vui lòng chọn file CSV hoặc Excel (.csv, .xlsx, .xls)');
      return;
    }

    try {
      const text = await selectedFile.text();
      const lines = text.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        setParseError('File phải có ít nhất 1 dòng header và 1 dòng dữ liệu');
        return;
      }

      // Skip header row, parse data rows
      const rows: ParsedPriceRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 2) {
          rows.push({ productName: cols[0] || '', unitPrice: 0, valid: false, error: 'Thiếu cột đơn giá' });
          continue;
        }

        const productName = cols[0];
        const unitPrice = parseFloat(cols[1]);
        const notes = cols[2] || undefined;

        if (!productName) {
          rows.push({ productName: '', unitPrice: 0, valid: false, error: 'Thiếu tên sản phẩm' });
        } else if (isNaN(unitPrice) || unitPrice < 0) {
          rows.push({ productName, unitPrice: 0, valid: false, error: 'Đơn giá không hợp lệ' });
        } else {
          rows.push({ productName, unitPrice, notes, valid: true });
        }
      }

      setParsedData(rows);
    } catch {
      setParseError('Lỗi đọc file. Vui lòng kiểm tra định dạng file.');
    }
  };

  /** Import parsed data to database */
  const handleImport = async () => {
    if (!selectedSupplierId) {
      setParseError('Vui lòng chọn nhà cung cấp');
      return;
    }

    const validRows = parsedData.filter((r) => r.valid);
    if (validRows.length === 0) {
      setParseError('Không có dữ liệu hợp lệ để import');
      return;
    }

    setImporting(true);
    let success = 0;
    let failed = 0;

    for (const row of validRows) {
      // Find product by name (fuzzy match)
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .ilike('name', `%${row.productName}%`)
        .limit(1);

      if (!products || products.length === 0) {
        failed++;
        continue;
      }

      const { error } = await supabase.from('supplier_prices').insert({
        supplier_id: selectedSupplierId,
        product_id: products[0].id,
        unit_price: row.unitPrice,
        notes: row.notes || null,
        effective_date: new Date().toISOString(),
      });

      if (error) {
        failed++;
      } else {
        success++;
      }
    }

    setImportResult({ success, failed });
    setImporting(false);

    if (success > 0) {
      setTimeout(() => onSuccess(), 2000);
    }
  };

  const validCount = parsedData.filter((r) => r.valid).length;
  const invalidCount = parsedData.filter((r) => !r.valid).length;

  /** Format giá tiền VND */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" onClick={onBack} className="mb-2 -ml-2 text-sm">
          ← Quay lại
        </Button>
        <h1 className="text-xl md:text-2xl font-bold">Import bảng giá từ Excel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload file CSV/Excel để cập nhật bảng giá hàng loạt
        </p>
      </div>

      {/* Instructions */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium text-sm mb-2">Hướng dẫn định dạng file:</h3>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>File CSV với 3 cột: <strong>Tên sản phẩm, Đơn giá, Ghi chú</strong></li>
            <li>Dòng đầu tiên là header (sẽ bị bỏ qua)</li>
            <li>Tên sản phẩm phải khớp với sản phẩm đã có trong hệ thống</li>
            <li>Đơn giá là số (VNĐ), không có dấu phẩy ngăn cách hàng nghìn</li>
          </ul>
          <div className="mt-3 p-2 bg-muted rounded text-xs font-mono">
            Tên sản phẩm,Đơn giá,Ghi chú<br />
            Ống nhựa PVC D21,15000,Giá mới T1/2024<br />
            Dây điện Cadivi 2.5mm,85000,
          </div>
        </CardContent>
      </Card>

      {/* Supplier Selection & File Upload */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-supplier">Nhà cung cấp *</Label>
            <select
              id="import-supplier"
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              required
            >
              <option value="">Chọn nhà cung cấp...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-file">File bảng giá *</Label>
            <Input
              id="import-file"
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
          </div>

          {parseError && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {parseError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parsed Data Preview */}
      {parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Xem trước dữ liệu ({validCount} hợp lệ, {invalidCount} lỗi)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm" role="table">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium">Tên sản phẩm</th>
                    <th className="text-right py-2 px-2 font-medium">Đơn giá</th>
                    <th className="text-left py-2 px-2 font-medium">Ghi chú</th>
                    <th className="text-center py-2 px-2 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.map((row, idx) => (
                    <tr key={idx} className={`border-b last:border-b-0 ${!row.valid ? 'bg-destructive/5' : ''}`}>
                      <td className="py-2 px-2">{row.productName || '—'}</td>
                      <td className="py-2 px-2 text-right">
                        {row.valid ? formatPrice(row.unitPrice) : '—'}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{row.notes || '—'}</td>
                      <td className="py-2 px-2 text-center">
                        {row.valid ? (
                          <Badge variant="success" className="text-xs">OK</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">{row.error}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex gap-3">
              <Button
                onClick={handleImport}
                disabled={importing || validCount === 0 || !selectedSupplierId}
              >
                {importing ? 'Đang import...' : `Import ${validCount} dòng`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Result */}
      {importResult && (
        <Card>
          <CardContent className="p-4">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">
                {importResult.success > 0 ? '✓ Import thành công!' : 'Import thất bại'}
              </p>
              <p className="text-sm text-muted-foreground">
                Thành công: {importResult.success} | Thất bại: {importResult.failed}
              </p>
              {importResult.failed > 0 && (
                <p className="text-xs text-muted-foreground">
                  Các dòng thất bại có thể do tên sản phẩm không khớp trong hệ thống
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
