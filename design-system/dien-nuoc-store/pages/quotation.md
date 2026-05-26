# Page Override: Quotation (Báo giá)

> Overrides MASTER.md for the Quotation creation and printing screen

---

## Layout

### Desktop
- Split: Form tạo báo giá (trái) | Preview báo giá (phải, live update)
- Preview hiển thị đúng format in

### Mobile
- Single column: Form → Preview (scroll down) → Actions
- Nút "Xem trước" toggle hiển thị preview

## Tạo Báo giá

```
┌─────────────────────────────────┐
│ TẠO BÁO GIÁ                    │
├─────────────────────────────────┤
│ Khách hàng: [Tìm/Nhập tên___]  │
│ SĐT:        [0912 345 678___]  │
│ Ngày:        26/05/2026 (auto)  │
├─────────────────────────────────┤
│ SẢN PHẨM                       │
│ 🔍 Thêm sản phẩm...            │
│ ┌───────────────────────────────┐
│ │ Dây Cadivi 2.5mm              │
│ │ SL: [100] m × 45.000đ        │
│ │ Thành tiền: 4.500.000đ  [🗑] │
│ ├───────────────────────────────┤
│ │ Ống BM D21                    │
│ │ SL: [20] cây × 48.000đ       │
│ │ Thành tiền: 960.000đ    [🗑] │
│ └───────────────────────────────┘
├─────────────────────────────────┤
│ Ghi chú: [Giá có thể thay đổi] │
├─────────────────────────────────┤
│ TỔNG CỘNG: 5.460.000đ          │
├─────────────────────────────────┤
│ [Copy text] [In báo giá]       │
└─────────────────────────────────┘
```

## Preview / Print Format

```
┌─────────────────────────────────────┐
│         CỬA HÀNG ĐIỆN NƯỚC         │
│         [Tên cửa hàng]             │
│         [Địa chỉ]                  │
│         [SĐT]                      │
├─────────────────────────────────────┤
│         BÁO GIÁ                    │
│ Ngày: 26/05/2026                   │
│ Khách hàng: Anh Minh               │
│ SĐT: 0912 345 678                  │
├─────────────────────────────────────┤
│ STT │ Sản phẩm      │ SL  │ ĐG    │ TT       │
│  1  │ Dây Cadivi    │ 100m│45.000 │4.500.000 │
│  2  │ Ống BM D21    │ 20  │48.000 │  960.000 │
├─────────────────────────────────────┤
│                    TỔNG: 5.460.000đ │
├─────────────────────────────────────┤
│ Ghi chú: Giá có thể thay đổi      │
│ theo thời điểm mua hàng.           │
└─────────────────────────────────────┘
```

## Copy Text Format (gửi Zalo/SMS)

```
BÁO GIÁ - [Tên cửa hàng]
Ngày: 26/05/2026
Khách: Anh Minh

1. Dây Cadivi 2.5mm: 100m × 45.000 = 4.500.000đ
2. Ống BM D21: 20 cây × 48.000 = 960.000đ

TỔNG: 5.460.000đ

Ghi chú: Giá có thể thay đổi theo thời điểm mua hàng.
Liên hệ: [SĐT cửa hàng]
```

## Specific Rules

- **Tổng cộng:** font-mono, text-xl, bold, sticky bottom trên mobile
- **Thêm sản phẩm:** Search + quét mã vạch, auto-fill giá bán hiện tại
- **Giá có thể sửa:** Cho phép sửa giá trên báo giá (khác giá hệ thống)
- **Copy text:** Nút copy → clipboard, toast "Đã copy báo giá"
- **In:** Mở print dialog trình duyệt, format A5 hoặc A4
- **Lưu báo giá:** Tùy chọn lưu lại để tra cứu sau (không bắt buộc)
- **Chuyển thành đơn hàng:** Nút "Tạo đơn từ báo giá" → pre-fill POS
- **Print CSS:** Ẩn navigation, buttons; chỉ hiển thị nội dung báo giá
