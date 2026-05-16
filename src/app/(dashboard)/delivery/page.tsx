'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Transporter, SalesOrder } from '@/lib/types';

/**
 * Trang Giao hàng bên thứ 3 (Delivery Module)
 *
 * Cho phép:
 * 1. CRUD danh mục người vận chuyển (tên, SĐT)
 * 2. Gắn cờ đơn hàng giao qua bên thứ 3 + chọn người vận chuyển
 * 3. Ghi nhận thời điểm giao cho bên vận chuyển
 * 4. Tra cứu đơn hàng theo người vận chuyển
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4
 */

// === Types ===

interface TransporterFormData {
  name: string;
  phone: string;
}

interface OrderWithTransporter extends SalesOrder {
  transporter?: Transporter | null;
  customer?: { name: string; phone: string } | null;
}

type TabType = 'transporters' | 'assign' | 'search';

// === Utility Functions ===

function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// === Main Component ===

export default function DeliveryPage() {
  const [activeTab, setActiveTab] = useState<TabType>('transporters');

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Giao hàng bên thứ 3</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quản lý người vận chuyển và theo dõi đơn hàng giao ngoài
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg overflow-x-auto">
        <button
          onClick={() => setActiveTab('transporters')}
          className={`flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'transporters'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          👤 Người vận chuyển
        </button>
        <button
          onClick={() => setActiveTab('assign')}
          className={`flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'assign'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          🚚 Gắn giao hàng
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'search'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          🔍 Tra cứu
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'transporters' && <TransporterManagement />}
      {activeTab === 'assign' && <DeliveryAssignment />}
      {activeTab === 'search' && <DeliverySearch />}
    </div>
  );
}


// === Tab 1: Quản lý Người vận chuyển (CRUD) ===

function TransporterManagement() {
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TransporterFormData>({ name: '', phone: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  /** Fetch danh sách người vận chuyển */
  const fetchTransporters = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('transporters')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      setTransporters(data as Transporter[]);
    }
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchTransporters();
  }, [fetchTransporters]);

  /** Mở form thêm mới */
  const handleAdd = useCallback(() => {
    setEditingId(null);
    setFormData({ name: '', phone: '' });
    setFormError(null);
    setShowForm(true);
  }, []);

  /** Mở form chỉnh sửa */
  const handleEdit = useCallback((transporter: Transporter) => {
    setEditingId(transporter.id);
    setFormData({ name: transporter.name, phone: transporter.phone });
    setFormError(null);
    setShowForm(true);
  }, []);

  /** Lưu (thêm hoặc sửa) */
  const handleSave = useCallback(async () => {
    // Validate
    if (!formData.name.trim()) {
      setFormError('Vui lòng nhập tên người vận chuyển.');
      return;
    }
    if (!formData.phone.trim()) {
      setFormError('Vui lòng nhập số điện thoại.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingId) {
        // Update
        const { error } = await supabase
          .from('transporters')
          .update({
            name: formData.name.trim(),
            phone: formData.phone.trim(),
          })
          .eq('id', editingId);

        if (error) throw new Error(error.message);
      } else {
        // Insert
        const { error } = await supabase
          .from('transporters')
          .insert({
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            is_active: true,
          });

        if (error) throw new Error(error.message);
      }

      setShowForm(false);
      setFormData({ name: '', phone: '' });
      setEditingId(null);
      await fetchTransporters();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  }, [formData, editingId, supabase, fetchTransporters]);

  /** Toggle trạng thái active */
  const handleToggleActive = useCallback(async (transporter: Transporter) => {
    const { error } = await supabase
      .from('transporters')
      .update({ is_active: !transporter.is_active })
      .eq('id', transporter.id);

    if (!error) {
      await fetchTransporters();
    }
  }, [supabase, fetchTransporters]);

  /** Xóa người vận chuyển */
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa người vận chuyển này?')) return;

    const { error } = await supabase
      .from('transporters')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchTransporters();
    }
  }, [supabase, fetchTransporters]);

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end">
        <Button onClick={handleAdd} size="sm">
          + Thêm người vận chuyển
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {editingId ? 'Sửa người vận chuyển' : 'Thêm người vận chuyển'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="transporter-name" className="text-xs">
                Tên người vận chuyển *
              </Label>
              <Input
                id="transporter-name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="VD: Nguyễn Văn A"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="transporter-phone" className="text-xs">
                Số điện thoại *
              </Label>
              <Input
                id="transporter-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="VD: 0901234567"
                className="mt-1"
              />
            </div>

            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm mới'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
                className="flex-1"
              >
                Hủy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Đang tải...
        </p>
      ) : transporters.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              Chưa có người vận chuyển nào. Nhấn &quot;Thêm người vận chuyển&quot; để bắt đầu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {transporters.map((transporter) => (
            <Card key={transporter.id}>
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">
                        {transporter.name}
                      </p>
                      <Badge
                        variant={transporter.is_active ? 'success' : 'secondary'}
                        className="shrink-0"
                      >
                        {transporter.is_active ? 'Hoạt động' : 'Ngưng'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      📞 {transporter.phone}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(transporter)}
                      title={transporter.is_active ? 'Ngưng hoạt động' : 'Kích hoạt'}
                    >
                      {transporter.is_active ? '⏸️' : '▶️'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(transporter)}
                      title="Sửa"
                    >
                      ✏️
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(transporter.id)}
                      title="Xóa"
                    >
                      🗑️
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


// === Tab 2: Gắn cờ giao hàng cho đơn hàng ===

function DeliveryAssignment() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderWithTransporter | null>(null);

  // Transporter selection
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [selectedTransporterId, setSelectedTransporterId] = useState<string>('');

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  /** Fetch danh sách người vận chuyển active */
  useEffect(() => {
    async function loadTransporters() {
      const { data } = await supabase
        .from('transporters')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (data) {
        setTransporters(data as Transporter[]);
      }
    }
    loadTransporters();
  }, [supabase]);

  /** Tìm đơn hàng theo mã đơn */
  const handleSearchOrder = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setOrder(null);
    setSubmitSuccess(false);
    setSubmitError(null);

    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          transporter:transporters(*),
          customer:customers(name, phone)
        `)
        .eq('order_number', searchQuery.trim())
        .single();

      if (error || !data) {
        setSearchError('Không tìm thấy đơn hàng với mã này.');
        return;
      }

      const orderData = data as unknown as OrderWithTransporter;
      setOrder(orderData);
      setSelectedTransporterId(orderData.transporter_id || '');
    } catch {
      setSearchError('Có lỗi xảy ra khi tìm kiếm.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, supabase]);

  /** Gắn cờ giao hàng bên thứ 3 */
  const handleAssignDelivery = useCallback(async () => {
    if (!order || !selectedTransporterId) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const deliveryTime = new Date().toISOString();

      const { error } = await supabase
        .from('sales_orders')
        .update({
          transporter_id: selectedTransporterId,
          is_third_party_delivery: true,
          delivery_time: deliveryTime,
        })
        .eq('id', order.id);

      if (error) throw new Error(error.message);

      setSubmitSuccess(true);
      setOrder(null);
      setSearchQuery('');
      setSelectedTransporterId('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [order, selectedTransporterId, supabase]);

  /** Bỏ gắn cờ giao hàng */
  const handleRemoveDelivery = useCallback(async () => {
    if (!order) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { error } = await supabase
        .from('sales_orders')
        .update({
          transporter_id: null,
          is_third_party_delivery: false,
          delivery_time: null,
        })
        .eq('id', order.id);

      if (error) throw new Error(error.message);

      setSubmitSuccess(true);
      setOrder(null);
      setSearchQuery('');
      setSelectedTransporterId('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [order, supabase]);

  return (
    <div className="space-y-4">
      {/* Success message */}
      {submitSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg" role="alert">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-green-800">Cập nhật thành công!</p>
              <p className="text-sm text-green-600 mt-1">
                Thông tin giao hàng đã được ghi nhận.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSubmitSuccess(false)}>
              Đóng
            </Button>
          </div>
        </div>
      )}

      {/* Error message */}
      {submitError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-700">{submitError}</p>
            <Button variant="ghost" size="sm" onClick={() => setSubmitError(null)}>
              ✕
            </Button>
          </div>
        </div>
      )}

      {/* Search Order */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tìm đơn hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Nhập mã đơn hàng (VD: ORD-001)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchOrder()}
              className="flex-1"
              aria-label="Mã đơn hàng"
            />
            <Button
              onClick={handleSearchOrder}
              disabled={isSearching || !searchQuery.trim()}
              className="px-6"
            >
              {isSearching ? 'Đang tìm...' : 'Tìm'}
            </Button>
          </div>
          {searchError && (
            <p className="text-sm text-red-600 mt-2">{searchError}</p>
          )}
        </CardContent>
      </Card>

      {/* Order Details & Assignment */}
      {order && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Đơn hàng: {order.order_number}
              </CardTitle>
              {order.is_third_party_delivery && (
                <Badge variant="warning">🚚 Đang giao</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Order info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Ngày tạo:</span>
                <p className="font-medium">{formatDate(order.created_at)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tổng tiền:</span>
                <p className="font-medium">{formatPrice(order.total)}</p>
              </div>
              {order.customer && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Khách hàng:</span>
                  <p className="font-medium">
                    {order.customer.name} - {order.customer.phone}
                  </p>
                </div>
              )}
              {order.is_third_party_delivery && order.transporter && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Người vận chuyển hiện tại:</span>
                  <p className="font-medium">
                    {order.transporter.name} - {order.transporter.phone}
                  </p>
                </div>
              )}
              {order.delivery_time && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Thời điểm giao:</span>
                  <p className="font-medium">{formatDate(order.delivery_time)}</p>
                </div>
              )}
            </div>

            {/* Assign transporter */}
            <div className="border-t pt-4 space-y-3">
              <Label className="text-sm font-medium">
                {order.is_third_party_delivery
                  ? 'Đổi người vận chuyển'
                  : 'Gắn giao hàng bên thứ 3'}
              </Label>

              <select
                value={selectedTransporterId}
                onChange={(e) => setSelectedTransporterId(e.target.value)}
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Chọn người vận chuyển"
              >
                <option value="">-- Chọn người vận chuyển --</option>
                {transporters.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.phone})
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <Button
                  onClick={handleAssignDelivery}
                  disabled={isSubmitting || !selectedTransporterId}
                  className="flex-1"
                >
                  {isSubmitting
                    ? 'Đang xử lý...'
                    : order.is_third_party_delivery
                    ? '🔄 Cập nhật người vận chuyển'
                    : '🚚 Gắn giao hàng'}
                </Button>
                {order.is_third_party_delivery && (
                  <Button
                    variant="destructive"
                    onClick={handleRemoveDelivery}
                    disabled={isSubmitting}
                  >
                    Bỏ giao hàng
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


// === Tab 3: Tra cứu đơn hàng theo người vận chuyển ===

function DeliverySearch() {
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [selectedTransporterId, setSelectedTransporterId] = useState<string>('');
  const [orders, setOrders] = useState<OrderWithTransporter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  /** Fetch danh sách người vận chuyển */
  useEffect(() => {
    async function loadTransporters() {
      const { data } = await supabase
        .from('transporters')
        .select('*')
        .order('name');

      if (data) {
        setTransporters(data as Transporter[]);
      }
    }
    loadTransporters();
  }, [supabase]);

  /** Tra cứu đơn hàng theo người vận chuyển */
  const handleSearch = useCallback(async () => {
    if (!selectedTransporterId) return;

    setIsLoading(true);
    setHasSearched(true);

    const { data, error } = await supabase
      .from('sales_orders')
      .select(`
        *,
        transporter:transporters(*),
        customer:customers(name, phone)
      `)
      .eq('transporter_id', selectedTransporterId)
      .eq('is_third_party_delivery', true)
      .order('delivery_time', { ascending: false });

    if (!error && data) {
      setOrders(data as unknown as OrderWithTransporter[]);
    } else {
      setOrders([]);
    }

    setIsLoading(false);
  }, [selectedTransporterId, supabase]);

  /** Tìm tên người vận chuyển đang chọn */
  const selectedTransporter = useMemo(
    () => transporters.find((t) => t.id === selectedTransporterId),
    [transporters, selectedTransporterId]
  );

  return (
    <div className="space-y-4">
      {/* Search controls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tra cứu theo người vận chuyển</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={selectedTransporterId}
            onChange={(e) => setSelectedTransporterId(e.target.value)}
            className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Chọn người vận chuyển"
          >
            <option value="">-- Chọn người vận chuyển --</option>
            {transporters.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.phone})
              </option>
            ))}
          </select>

          <Button
            onClick={handleSearch}
            disabled={isLoading || !selectedTransporterId}
            className="w-full"
          >
            {isLoading ? 'Đang tìm...' : '🔍 Tra cứu đơn hàng'}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {hasSearched && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedTransporter && (
                <>
                  Kết quả cho: <strong>{selectedTransporter.name}</strong>
                </>
              )}
            </p>
            <Badge variant="secondary">{orders.length} đơn</Badge>
          </div>

          {/* Order list */}
          {orders.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-sm text-muted-foreground text-center">
                  Không tìm thấy đơn hàng nào cho người vận chuyển này.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-3 md:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {order.order_number}
                          </p>
                          <Badge variant="warning" className="text-xs shrink-0">
                            🚚 Giao ngoài
                          </Badge>
                        </div>
                        {order.customer && (
                          <p className="text-xs text-muted-foreground mt-1">
                            KH: {order.customer.name} - {order.customer.phone}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                          <span>
                            Tổng: <strong className="text-foreground">{formatPrice(order.total)}</strong>
                          </span>
                          {order.delivery_time && (
                            <span>
                              Giao lúc: <strong className="text-foreground">{formatDate(order.delivery_time)}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
