'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ProductSearch } from '@/components/shared/ProductSearch';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
}

/**
 * Combobox khách hàng: vừa gõ tên (tự do), vừa có nút xổ danh sách khách đã có.
 * Chọn từ danh sách sẽ điền cả tên + SĐT. Vẫn cho nhập tay khách mới.
 */
function CustomerCombobox({
  name,
  phone,
  onNameChange,
  onSelectCustomer,
}: {
  name: string;
  phone: string;
  onNameChange: (v: string) => void;
  onSelectCustomer: (name: string, phone: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const loadCustomers = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone')
      .order('name', { ascending: true });
    if (!error && data) setCustomers(data as CustomerOption[]);
    setLoaded(true);
    setLoading(false);
  }, [supabase, loaded]);

  // Đóng khi click ra ngoài
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const toggleOpen = useCallback(async () => {
    if (!open) await loadCustomers();
    setOpen((v) => !v);
  }, [open, loadCustomers]);

  // Lọc theo tên đang gõ (nếu có)
  const filtered = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(name.trim()))
    );
  }, [customers, name]);

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Input
          id="customer-name"
          value={name}
          onChange={(e) => {
            onNameChange(e.target.value);
            if (!open) {
              loadCustomers();
              setOpen(true);
            }
          }}
          onFocus={() => {
            loadCustomers();
            setOpen(true);
          }}
          placeholder="Nhập hoặc chọn khách hàng..."
          className="mt-1 pr-10"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={toggleOpen}
          className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
          aria-label={open ? 'Đóng danh sách khách hàng' : 'Xem danh sách khách hàng'}
          aria-expanded={open}
          tabIndex={-1}
        >
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {open && (
        <ul
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-[240px] overflow-y-auto z-50"
          role="listbox"
          aria-label="Danh sách khách hàng"
        >
          {loading ? (
            <li className="p-3 text-sm text-muted-foreground text-center">Đang tải...</li>
          ) : filtered.length === 0 ? (
            <li className="p-3 text-sm text-muted-foreground text-center">
              {customers.length === 0 ? 'Chưa có khách hàng nào' : 'Không tìm thấy khách phù hợp'}
            </li>
          ) : (
            filtered.map((c) => (
              <li key={c.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2.5 hover:bg-accent active:bg-accent/80 transition-colors border-b border-border last:border-b-0 cursor-pointer"
                  onClick={() => {
                    onSelectCustomer(c.name, c.phone ?? '');
                    setOpen(false);
                  }}
                >
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {/* Giữ tham chiếu phone để không cảnh báo unused; phone hiển thị ở input riêng */}
      <input type="hidden" value={phone} readOnly />
    </div>
  );
}

/**
 * Trang Báo giá (Quotation Form)
 *
 * - Tạo báo giá: danh sách sản phẩm, đơn giá, số lượng, thành tiền, tổng cộng
 * - Hỗ trợ in báo giá ra giấy (window.print() với print-friendly CSS)
 * - Hỗ trợ xuất dạng text để copy gửi qua tin nhắn
 * - Giao diện tiếng Việt, mobile-first
 *
 * Validates: Requirements 20.1, 20.2, 20.3
 */

// === Types ===

interface QuotationItem {
  id: string;
  product_id: string;
  product_name: string;
  specification: string;
  unit: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

// === Utility Functions ===

/** Format giá tiền VND */
function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(price);
}

/** Format số lượng */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num);
}

/** Tạo ID ngẫu nhiên */
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/** Lấy ngày hiện tại dạng dd/mm/yyyy */
function getFormattedDate(): string {
  return new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// === Main Component ===

export default function QuotationPage() {
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);

  // === Computed Values ===

  const grandTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.line_total, 0);
  }, [items]);

  // === Handlers ===

  /** Thêm sản phẩm vào báo giá */
  const handleAddProduct = useCallback((product: Product) => {
    setItems((prev) => {
      // Kiểm tra sản phẩm đã có trong danh sách chưa
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        // Tăng số lượng nếu đã có
        return prev.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                line_total: (item.quantity + 1) * item.unit_price,
              }
            : item
        );
      }

      // Thêm mới
      const newItem: QuotationItem = {
        id: generateId(),
        product_id: product.id,
        product_name: product.name,
        specification: product.specification || '',
        unit: product.base_unit,
        quantity: 1,
        unit_price: product.selling_price,
        line_total: product.selling_price,
      };
      return [...prev, newItem];
    });
  }, []);

  /** Cập nhật số lượng */
  const handleQuantityChange = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, quantity, line_total: quantity * item.unit_price }
          : item
      )
    );
  }, []);

  /** Cập nhật đơn giá */
  const handlePriceChange = useCallback((itemId: string, unitPrice: number) => {
    if (unitPrice < 0) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, unit_price: unitPrice, line_total: item.quantity * unitPrice }
          : item
      )
    );
  }, []);

  /** Xóa sản phẩm khỏi báo giá */
  const handleRemoveItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  /** In báo giá */
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  /** Xuất dạng text và copy vào clipboard */
  const handleCopyText = useCallback(async () => {
    const lines: string[] = [];

    lines.push('═══ BÁO GIÁ ═══');
    lines.push(`Ngày: ${getFormattedDate()}`);

    if (customerName) {
      lines.push(`Khách hàng: ${customerName}`);
    }
    if (customerPhone) {
      lines.push(`SĐT: ${customerPhone}`);
    }

    lines.push('');
    lines.push('─────────────────');

    items.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.product_name}`);
      if (item.specification) {
        lines.push(`   ${item.specification}`);
      }
      lines.push(
        `   ${formatNumber(item.quantity)} ${item.unit} × ${formatPrice(item.unit_price)} = ${formatPrice(item.line_total)}`
      );
    });

    lines.push('─────────────────');
    lines.push(`TỔNG CỘNG: ${formatPrice(grandTotal)}`);

    if (notes) {
      lines.push('');
      lines.push(`Ghi chú: ${notes}`);
    }

    lines.push('');
    lines.push('═══════════════════');

    const text = lines.join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback cho trình duyệt không hỗ trợ clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [items, customerName, customerPhone, notes, grandTotal]);

  /** Xóa toàn bộ báo giá */
  const handleClear = useCallback(() => {
    setItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header - ẩn khi in */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Báo giá</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tạo báo giá cho khách hàng, in hoặc gửi qua tin nhắn
          </p>
        </div>
      </div>

      {/* Thông tin khách hàng - ẩn khi in */}
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Thông tin khách hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="customer-name" className="text-xs text-muted-foreground">
                Tên khách hàng
              </Label>
              <CustomerCombobox
                name={customerName}
                phone={customerPhone}
                onNameChange={setCustomerName}
                onSelectCustomer={(name, phone) => {
                  setCustomerName(name);
                  setCustomerPhone(phone);
                }}
              />
            </div>
            <div>
              <Label htmlFor="customer-phone" className="text-xs text-muted-foreground">
                Số điện thoại
              </Label>
              <Input
                id="customer-phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Nhập SĐT..."
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tìm kiếm sản phẩm - ẩn khi in */}
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Thêm sản phẩm</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductSearch
            onSelectProduct={handleAddProduct}
            placeholder="Tìm sản phẩm để thêm vào báo giá..."
            showBarcodeScanner={true}
          />
        </CardContent>
      </Card>

      {/* Danh sách sản phẩm báo giá */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Danh sách báo giá
              {items.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {items.length} sản phẩm
                </Badge>
              )}
            </CardTitle>
            {items.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="text-xs text-destructive hover:text-destructive print:hidden"
              >
                Xóa tất cả
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 print:hidden">
              Chưa có sản phẩm. Tìm kiếm và chọn sản phẩm để thêm vào báo giá.
            </p>
          ) : (
            <>
              {/* Print Header - chỉ hiện khi in */}
              <div className="hidden print:block mb-6">
                <h2 className="text-xl font-bold text-center mb-2">BÁO GIÁ</h2>
                <p className="text-sm text-center mb-4">Ngày: {getFormattedDate()}</p>
                {(customerName || customerPhone) && (
                  <div className="text-sm mb-4">
                    {customerName && <p>Khách hàng: {customerName}</p>}
                    {customerPhone && <p>SĐT: {customerPhone}</p>}
                  </div>
                )}
              </div>

              {/* Mobile Cards */}
              <div className="block md:hidden space-y-3 print:hidden">
                {items.map((item, index) => (
                  <QuotationItemCardMobile
                    key={item.id}
                    item={item}
                    index={index}
                    onQuantityChange={handleQuantityChange}
                    onPriceChange={handlePriceChange}
                    onRemove={handleRemoveItem}
                  />
                ))}
              </div>

              {/* Desktop Table + Print Table */}
              <div className="hidden md:block print:block overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium w-8">STT</th>
                      <th className="text-left py-3 px-2 font-medium">Sản phẩm</th>
                      <th className="text-left py-3 px-2 font-medium w-16">ĐVT</th>
                      <th className="text-right py-3 px-2 font-medium w-20">SL</th>
                      <th className="text-right py-3 px-2 font-medium w-28">Đơn giá</th>
                      <th className="text-right py-3 px-2 font-medium w-28">Thành tiền</th>
                      <th className="text-center py-3 px-2 font-medium w-10 print:hidden">Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/50 print:hover:bg-transparent">
                        <td className="py-3 px-2 text-center">{index + 1}</td>
                        <td className="py-3 px-2">
                          <p className="font-medium">{item.product_name}</p>
                          {item.specification && (
                            <p className="text-xs text-muted-foreground">{item.specification}</p>
                          )}
                        </td>
                        <td className="py-3 px-2">{item.unit}</td>
                        <td className="py-3 px-2 text-right">
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              handleQuantityChange(item.id, Number(e.target.value))
                            }
                            className="w-16 text-right h-8 text-sm print:hidden"
                            aria-label={`Số lượng ${item.product_name}`}
                          />
                          <span className="hidden print:inline">
                            {formatNumber(item.quantity)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            value={item.unit_price}
                            onChange={(e) =>
                              handlePriceChange(item.id, Number(e.target.value))
                            }
                            className="w-28 text-right h-8 text-sm print:hidden"
                            aria-label={`Đơn giá ${item.product_name}`}
                          />
                          <span className="hidden print:inline">
                            {formatPrice(item.unit_price)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right font-medium">
                          {formatPrice(item.line_total)}
                        </td>
                        <td className="py-3 px-2 text-center print:hidden">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(item.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            aria-label={`Xóa ${item.product_name}`}
                          >
                            ✕
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2">
                      <td colSpan={5} className="py-3 px-2 text-right font-bold text-base">
                        TỔNG CỘNG:
                      </td>
                      <td className="py-3 px-2 text-right font-bold text-base text-primary">
                        {formatPrice(grandTotal)}
                      </td>
                      <td className="print:hidden" />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile Total */}
              <div className="block md:hidden mt-4 pt-4 border-t-2 print:hidden">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base">TỔNG CỘNG:</span>
                  <span className="font-bold text-lg text-primary">
                    {formatPrice(grandTotal)}
                  </span>
                </div>
              </div>

              {/* Print Notes */}
              {notes && (
                <div className="hidden print:block mt-4 pt-4 border-t">
                  <p className="text-sm">
                    <span className="font-medium">Ghi chú:</span> {notes}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Ghi chú - ẩn khi in */}
      {items.length > 0 && (
        <Card className="print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ghi chú</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú thêm cho báo giá (tùy chọn)..."
            />
          </CardContent>
        </Card>
      )}

      {/* Action Buttons - ẩn khi in */}
      {items.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 print:hidden">
          <Button
            onClick={handlePrint}
            className="flex-1 h-12 text-base"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            In báo giá
          </Button>
          <Button
            variant="outline"
            onClick={handleCopyText}
            className="flex-1 h-12 text-base"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
            {copied ? '✓ Đã copy!' : 'Copy gửi tin nhắn'}
          </Button>
        </div>
      )}
    </div>
  );
}

// === Sub-components ===

interface QuotationItemCardMobileProps {
  item: QuotationItem;
  index: number;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onPriceChange: (itemId: string, unitPrice: number) => void;
  onRemove: (itemId: string) => void;
}

/** Card sản phẩm báo giá trên mobile */
function QuotationItemCardMobile({
  item,
  index,
  onQuantityChange,
  onPriceChange,
  onRemove,
}: QuotationItemCardMobileProps) {
  return (
    <div className="p-3 border rounded-lg space-y-3">
      {/* Header: STT + Tên + Xóa */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {index + 1}. {item.product_name}
          </p>
          {item.specification && (
            <p className="text-xs text-muted-foreground">{item.specification}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(item.id)}
          className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
          aria-label={`Xóa ${item.product_name}`}
        >
          ✕
        </Button>
      </div>

      {/* Inputs: SL + Đơn giá */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">
            Số lượng ({item.unit})
          </Label>
          <Input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => onQuantityChange(item.id, Number(e.target.value))}
            className="mt-1 h-9 text-sm"
            aria-label={`Số lượng ${item.product_name}`}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Đơn giá (đ)</Label>
          <Input
            type="number"
            min={0}
            value={item.unit_price}
            onChange={(e) => onPriceChange(item.id, Number(e.target.value))}
            className="mt-1 h-9 text-sm"
            aria-label={`Đơn giá ${item.product_name}`}
          />
        </div>
      </div>

      {/* Thành tiền */}
      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-xs text-muted-foreground">Thành tiền</span>
        <span className="text-sm font-bold text-primary">
          {formatPrice(item.line_total)}
        </span>
      </div>
    </div>
  );
}
