# Design Document: Quản lý Giá nâng cao

## Overview

Mở rộng hệ thống nhập kho để hỗ trợ chiết khấu và tự động tính giá vốn. Nguyên tắc: giữ nguyên trigger WAC hiện có, tính `unit_price` ở application layer trước khi lưu, thêm fields mới vào `goods_receipt_items`.

## Database Changes

### Migration: Thêm cột vào `goods_receipt_items`

```sql
-- Thêm cột mới
ALTER TABLE goods_receipt_items 
  ADD COLUMN total_payment DECIMAL(15, 2),
  ADD COLUMN discount_type VARCHAR(10) DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  ADD COLUMN discount_value DECIMAL(15, 2) DEFAULT 0 CHECK (discount_value >= 0);

-- Cập nhật constraint: unit_price giờ có thể = 0 tạm thời (sẽ được tính từ total_payment)
-- Giữ nguyên constraint unit_price >= 0
```

### Schema sau thay đổi: `goods_receipt_items`

| Cột | Kiểu | Mô tả |
|-----|------|--------|
| id | UUID | PK |
| goods_receipt_id | UUID | FK → goods_receipts |
| product_id | UUID | FK → products |
| quantity | DECIMAL(15,3) | Số lượng nhập |
| unit | VARCHAR(50) | Đơn vị tính |
| unit_price | DECIMAL(15,2) | Giá vốn/sp = total_payment / quantity (tự tính) |
| total_payment | DECIMAL(15,2) | Tổng thanh toán sau CK (user nhập) |
| discount_type | VARCHAR(10) | 'percent' hoặc 'fixed' |
| discount_value | DECIMAL(15,2) | Giá trị CK (VD: 5 = 5%, hoặc 370000 = 370.000đ) |
| created_at | TIMESTAMPTZ | — |

### Quan hệ giữa các bảng giá

```
┌──────────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│ supplier_prices  │      │ goods_receipt_items   │      │ products        │
│                  │      │                      │      │                 │
│ unit_price       │─────▶│ (tham khảo)          │      │ weighted_avg_cost│◀── WAC trigger
│ (Giá NCC niêm   │      │ total_payment (nhập)  │      │ last_cost       │◀── Last import
│  yết, chưa CK)  │      │ discount_type/value   │      │ selling_price   │◀── Owner set
│                  │      │ quantity (nhập)       │      │                 │
│                  │      │ unit_price (tự tính)  │──────│                 │
└──────────────────┘      └──────────────────────┘      └─────────────────┘
                                    │
                                    ▼
                          ┌──────────────────────┐
                          │ price_history        │
                          │ (lịch sử giá vốn)   │
                          └──────────────────────┘
```

## Application Logic

### Tính `unit_price` (Application Layer — trước khi INSERT)

```typescript
// src/services/pricing.service.ts — thêm function mới

/**
 * Tính giá vốn trên mỗi đơn vị sản phẩm từ thông tin thanh toán
 * unit_price = total_payment / quantity
 */
export function calculateUnitPriceFromPayment(
  totalPayment: number,
  quantity: number
): number {
  if (quantity <= 0) throw new Error('Số lượng phải > 0');
  if (totalPayment < 0) throw new Error('Thanh toán không được âm');
  return totalPayment / quantity;
}

/**
 * Tính thanh toán từ thành tiền và chiết khấu
 * - percent: payment = subtotal × (1 - discount/100)
 * - fixed: payment = subtotal - discountValue
 */
export function calculatePaymentAfterDiscount(
  subtotal: number,
  discountType: 'percent' | 'fixed',
  discountValue: number
): number {
  if (discountType === 'percent') {
    if (discountValue < 0 || discountValue > 100) throw new Error('% CK phải từ 0-100');
    return subtotal * (1 - discountValue / 100);
  } else {
    if (discountValue < 0) throw new Error('CK không được âm');
    if (discountValue > subtotal) throw new Error('CK không được lớn hơn thành tiền');
    return subtotal - discountValue;
  }
}
```

### Flow xử lý khi tạo phiếu nhập kho

```
User nhập: [Sản phẩm] + [Số lượng] + [Chiết khấu (optional)] + [Thanh toán]

Application tính:
1. unit_price = total_payment / quantity
2. Validate: unit_price >= 0

INSERT vào goods_receipt_items:
  - product_id, quantity, unit
  - unit_price (đã tính)
  - total_payment (user nhập)
  - discount_type, discount_value

Khi confirm phiếu → Trigger hiện tại chạy:
  - WAC = (old_stock × old_wac + quantity × unit_price) / (old_stock + quantity)
  - last_cost = unit_price
  - price_history record created
```

## UI Changes

### 1. Form nhập kho (Goods Receipt Items)

**Trước:**
```
| Sản phẩm | Số lượng | Đơn vị | Đơn giá | 
```

**Sau:**
```
| Sản phẩm | SL | CK (% / VNĐ) | Thanh toán | Giá vốn/sp |
|          |    | [5] [%▼]      | 7.030.000  | → 351.500  |
```

- Giá NCC hiển thị dạng label tham khảo (không phải input)
- Giá vốn/sp hiển thị real-time khi đủ SL + Thanh toán
- Tổng thanh toán cuối phiếu

### 2. Trang chi tiết sản phẩm — Section giá (Owner only)

```
┌─────────────────────────────────┐
│ 💲 Thông tin giá                │
├─────────────────────────────────┤
│ Giá NCC:      370.000đ         │ ← từ supplier_prices (mới nhất)
│ Giá vốn TB:   351.500đ         │ ← products.weighted_avg_cost
│ Giá nhập GN:  351.500đ         │ ← products.last_cost  
│ Giá bán:      420.000đ         │ ← products.selling_price
│ ─────────────────────────────── │
│ Lợi nhuận:    68.500đ (19.5%)  │ ← selling_price - WAC
└─────────────────────────────────┘
```

## Không thay đổi

- ✅ Trigger `handle_receipt_stock_increase` — giữ nguyên (dùng `unit_price` từ `goods_receipt_items`)
- ✅ Trigger `handle_receipt_confirmation` — giữ nguyên
- ✅ Bảng `supplier_prices` — giữ nguyên cấu trúc và UI quản lý
- ✅ Bảng `price_history` — giữ nguyên
- ✅ View `products_staff_view` — giữ nguyên (đã ẩn WAC, last_cost)
- ✅ Pricing page (`/products/pricing`) — giữ nguyên

## Considerations

- **Backward compatibility**: Các phiếu nhập cũ có `unit_price` nhưng không có `total_payment` → cột mới nullable, không ảnh hưởng data cũ
- **Validation**: Application layer validate trước khi insert, trigger chỉ dùng `unit_price` nên không cần sửa
- **Rounding**: Khi `total_payment / quantity` không chia hết → làm tròn 2 chữ số thập phân (ROUND 2)
