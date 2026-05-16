'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Customer } from '@/lib/types';

interface CustomerFormProps {
  customer: Customer | null; // null = thêm mới, có giá trị = sửa
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Form thêm/sửa khách hàng.
 * Fields: tên, SĐT, địa chỉ, ghi chú.
 * Chỉ Owner mới truy cập được form này.
 *
 * Validates: Requirements 9.1, 9.4
 */
export function CustomerForm({ customer, onSuccess, onCancel }: CustomerFormProps) {
  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [notes, setNotes] = useState(customer?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!customer;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Vui lòng nhập tên khách hàng');
      return;
    }
    if (!phone.trim()) {
      setError('Vui lòng nhập số điện thoại');
      return;
    }

    setSaving(true);
    const supabase = createClient();

    try {
      const customerData = {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim() || null,
        notes: notes.trim() || null,
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', customer.id);

        if (updateError) {
          setError('Lỗi cập nhật khách hàng: ' + updateError.message);
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from('customers')
          .insert({
            ...customerData,
            total_purchased: 0,
            purchase_count: 0,
            current_debt: 0,
          });

        if (insertError) {
          setError('Lỗi thêm khách hàng: ' + insertError.message);
          return;
        }
      }

      onSuccess();
    } catch {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>{isEditing ? 'Sửa khách hàng' : 'Thêm khách hàng mới'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="customer-name">Tên khách hàng *</Label>
            <Input
              id="customer-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên khách hàng"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-phone">Số điện thoại *</Label>
            <Input
              id="customer-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Nhập số điện thoại"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-address">Địa chỉ</Label>
            <Input
              id="customer-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Nhập địa chỉ giao hàng"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-notes">Ghi chú</Label>
            <textarea
              id="customer-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Đặc điểm, thói quen thanh toán..."
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? 'Đang lưu...' : isEditing ? 'Cập nhật' : 'Thêm khách hàng'}
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
