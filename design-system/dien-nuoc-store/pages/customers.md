# Page Override: Customers (Quản lý Khách hàng)

> Overrides MASTER.md for the Customer management screen

---

## Layout

### Desktop
- Top bar: Search + Filter (Loại khách) + [Thêm khách hàng]
- Data table: [Tên, SĐT, Loại khách, Công nợ hiện tại, Lần mua gần nhất, Ghi chú]
- Click row → mở Customer Detail panel (slide-in từ phải, width 480px)

### Mobile
- Search bar sticky top
- Filter chips: Tất cả | Thợ/Nhà thầu | Đại lý | Khách lẻ
- Card list format:

```
┌─────────────────────────────────┐
│ Anh Minh — Thợ điện             │
│ 0912 345 678                    │
│ Nợ: 2.500.000đ (5 ngày)        │ ← amber nếu sắp quá hạn
│ Mua gần nhất: 24/05/2026       │
└─────────────────────────────────┘
```

## Customer Detail Panel

```
┌─────────────────────────────────┐
│ ← Quay lại        [Sửa] [...]  │
├─────────────────────────────────┤
│ Anh Minh                        │
│ Thợ điện khu vực Quận 7         │ ← ghi chú
│ 0912 345 678                    │
├─────────────────────────────────┤
│ CÔNG NỢ HIỆN TẠI               │
│ 2.500.000đ         [Thu nợ]    │
├─────────────────────────────────┤
│ LỊCH SỬ MUA HÀNG              │
│ ┌─────────────────────────────┐ │
│ │ 24/05 — 450.000đ (đã TT)   │ │
│ │ 20/05 — 2.500.000đ (nợ)    │ │
│ │ 15/05 — 180.000đ (đã TT)   │ │
│ └─────────────────────────────┘ │
│ Tổng đã mua: 15.200.000đ       │
│ Số lần mua: 12                  │
└─────────────────────────────────┘
```

## Specific Rules

- **Loại khách hàng badges:**
  - Khách lẻ: `bg-slate-100 text-slate-600`
  - Thợ/Nhà thầu: `bg-blue-100 text-blue-700`
  - Đại lý: `bg-purple-100 text-purple-700`
- **Công nợ display:** font-mono, color theo tuổi nợ (green = 0, amber = sắp hạn, red = quá hạn)
- **SĐT:** clickable → gọi điện trên mobile (`tel:` link)
- **Tìm kiếm:** theo tên hoặc SĐT, debounce 300ms
- **Thêm khách hàng:** bottom sheet (mobile) / modal (desktop), fields tối thiểu: Tên + SĐT
- **Nhân viên:** chỉ xem, ẩn nút Sửa/Xóa/Thu nợ
