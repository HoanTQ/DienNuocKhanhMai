# Page Override: Returns & Warranty (Trả hàng & Bảo hành)

> Overrides MASTER.md for the Returns/Warranty screen

---

## Layout

### Desktop
- Tab: [Trả hàng dư] | [Bảo hành/Đổi hàng] | [Hàng lỗi chờ trả NCC]
- Table with action buttons

### Mobile
- Segment control: Trả hàng | Bảo hành | Lỗi→NCC
- Card list

## Trả hàng dư

### Flow

1. Tìm đơn bán hàng gốc (theo mã đơn, tên khách, hoặc ngày)
2. Chọn sản phẩm cần trả
3. Nhập số lượng trả
4. Xác nhận → trừ trên đơn gốc + cộng tồn kho

```
┌─────────────────────────────────┐
│ 🔍 Tìm đơn hàng gốc...         │
├─────────────────────────────────┤
│ Đơn #BH-0123 — Anh Minh        │
│ 24/05/2026 — 450.000đ          │
├─────────────────────────────────┤
│ Dây Cadivi 2.5mm                │
│ Đã mua: 100m                   │
│ Trả lại: [30] m                │ ← input
│ Hoàn tiền: 135.000đ            │ ← auto-calculate
├─────────────────────────────────┤
│ [Hủy]              [Xác nhận]  │
└─────────────────────────────────┘
```

## Bảo hành / Đổi hàng

### Flow

1. Tìm đơn bán hàng gốc
2. Chọn sản phẩm lỗi
3. Chọn hình thức: Đổi mới | Hoàn tiền
4. Nhập lý do
5. Xác nhận → trừ doanh thu + gom hàng lỗi

### Form

```
┌─────────────────────────────────┐
│ SẢN PHẨM LỖI                   │
│ Máy khoan Bosch GSB 550         │
│ Đơn gốc: #BH-0098 (20/05)      │
├─────────────────────────────────┤
│ Hình thức: (●) Đổi mới  ( ) Hoàn tiền │
│ Lý do: [Không hoạt động___]    │
├─────────────────────────────────┤
│ [Hủy]              [Xác nhận]  │
└─────────────────────────────────┘
```

## Hàng lỗi chờ trả NCC

- Table/List: [SP, Số lượng, Lý do, Ngày nhận lỗi, NCC]
- Grouped by NCC
- Nút "Đã trả NCC" → đánh dấu đã xử lý, ghi nhận ngày trả

```
┌─────────────────────────────────┐
│ ── Cadivi (3 sản phẩm) ──      │
│ ┌─────────────────────────────┐ │
│ │ Dây 2.5mm — 1 cuộn         │ │
│ │ Lỗi: Đứt ruột              │ │
│ │ Nhận: 20/05    [Đã trả NCC]│ │
│ └─────────────────────────────┘ │
│ ── Bình Minh (1 sản phẩm) ──   │
│ ...                             │
└─────────────────────────────────┘
```

## Specific Rules

- **Tìm đơn gốc:** Hỗ trợ quét mã vạch sản phẩm → tìm đơn gần nhất chứa SP đó
- **Auto-calculate hoàn tiền:** Số lượng trả × đơn giá trên đơn gốc
- **Lý do bắt buộc** cho bảo hành/đổi hàng
- **Hàng lỗi:** Badge count hiển thị trên tab "Lỗi→NCC" nếu có hàng chờ
- **Permission:** Nhân viên được trả hàng dư, chỉ Chủ được xử lý bảo hành/hoàn tiền
