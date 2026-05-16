'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

interface ReceiptRow {
  id: string;
  supplier_id: string;
  purchase_order_id: string | null;
  status: 'pending' | 'confirmed';
  created_by: string;
  created_at: string;
  supplier?: { name: string };
}

/**
 * Trang danh sách Phiếu nhập kho
 *
 * Hiển thị tất cả phiếu nhập kho, cho phép lọc theo trạng thái,
 * tìm kiếm theo NCC, và tạo phiếu mới.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
export default function GoodsReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed'>('all');

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchReceipts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('goods_receipts')
      .select('*, supplier:suppliers(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Lỗi tải danh sách phiếu nhập:', error.message);
    } else {
      setReceipts(data || []);
    }
    setLoading(false);
  }

  const filteredReceipts = receipts.filter((r) => {
    const matchesSearch =
      !searchQuery ||
      (r.supplier?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = receipts.filter((r) => r.status === 'pending').length;
  const confirmedCount = receipts.filter((r) => r.status === 'confirmed').length;

  /** Format ngày giờ */
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải danh sách phiếu nhập...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Phiếu nhập kho</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý nhập hàng từ nhà cung cấp
          </p>
        </div>
        <Link href="/purchasing/receipts/new">
          <Button size="lg" className="w-full md:w-auto">
            + Tạo phiếu nhập mới
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Tổng phiếu</p>
            <p className="text-xl md:text-2xl font-bold">{receipts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Chờ xác nhận</p>
            <p className="text-xl md:text-2xl font-bold text-yellow-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-xs text-muted-foreground">Đã xác nhận</p>
            <p className="text-xl md:text-2xl font-bold text-green-600">{confirmedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Tìm theo tên nhà cung cấp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
            aria-label="Tìm kiếm phiếu nhập"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('all')}
          >
            Tất cả
          </Button>
          <Button
            variant={filterStatus === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('pending')}
          >
            Chờ xác nhận
          </Button>
          <Button
            variant={filterStatus === 'confirmed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('confirmed')}
          >
            Đã xác nhận
          </Button>
        </div>
      </div>

      {/* Receipt List - Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {filteredReceipts.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Không tìm thấy phiếu nhập nào
            </CardContent>
          </Card>
        ) : (
          filteredReceipts.map((receipt) => (
            <Card key={receipt.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-base truncate">
                      {receipt.supplier?.name || 'NCC không xác định'}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(receipt.created_at)}
                    </p>
                    {receipt.purchase_order_id && (
                      <p className="text-xs text-muted-foreground">
                        Đơn đặt hàng: {receipt.purchase_order_id.slice(0, 8)}...
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={receipt.status === 'confirmed' ? 'success' : 'secondary'}
                    className="shrink-0 text-xs"
                  >
                    {receipt.status === 'confirmed' ? 'Đã xác nhận' : 'Chờ xác nhận'}
                  </Badge>
                </div>
                <div className="mt-3 flex justify-end">
                  <Link href={`/purchasing/receipts/${receipt.id}`}>
                    <Button variant="outline" size="sm">
                      Xem chi tiết
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Receipt List - Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <CardHeader>
            <CardTitle>Danh sách phiếu nhập</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredReceipts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Không tìm thấy phiếu nhập nào
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Nhà cung cấp</th>
                      <th className="text-left py-3 px-2 font-medium">Ngày tạo</th>
                      <th className="text-left py-3 px-2 font-medium">Đơn đặt hàng</th>
                      <th className="text-center py-3 px-2 font-medium">Trạng thái</th>
                      <th className="text-center py-3 px-2 font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReceipts.map((receipt) => (
                      <tr key={receipt.id} className="border-b last:border-b-0 hover:bg-muted/50">
                        <td className="py-3 px-2 font-medium">
                          {receipt.supplier?.name || 'NCC không xác định'}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {formatDate(receipt.created_at)}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {receipt.purchase_order_id
                            ? receipt.purchase_order_id.slice(0, 8) + '...'
                            : '—'}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Badge
                            variant={receipt.status === 'confirmed' ? 'success' : 'secondary'}
                            className="text-xs"
                          >
                            {receipt.status === 'confirmed' ? 'Đã xác nhận' : 'Chờ xác nhận'}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Link href={`/purchasing/receipts/${receipt.id}`}>
                            <Button variant="ghost" size="sm">
                              Xem
                            </Button>
                          </Link>
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
