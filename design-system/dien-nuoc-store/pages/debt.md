# Page Override: Debt (Công nợ)

> Overrides MASTER.md for the Accounts Receivable & Payable screen

---

## Layout

### Desktop
- Tab navigation: [Công nợ Khách hàng] | [Công nợ NCC]
- Summary bar: Tổng nợ phải thu | Nợ quá hạn | Nợ trong hạn
- Data table with grouping by tuổi nợ

### Mobile
- Segment control top: KH | NCC
- Summary cards (2 cols): Tổng nợ | Quá hạn
- List grouped by tuổi nợ with sticky section headers

```
┌─────────────────────────────────┐
│ [Khách hàng]  [NCC]            │ ← segment control
├─────────────────────────────────┤
│ Tổng nợ phải thu: 45.000.000đ  │
│ Quá hạn: 12.000.000đ           │ ← red text
├─────────────────────────────────┤
│ ── NỢ QUÁ HẠN (> 1 tháng) ──  │ ← sticky header, red bg
│ ┌─────────────────────────────┐ │
│ │ Anh Tuấn      8.000.000đ   │ │
│ │ Nợ từ: 15/04  (41 ngày)    │ │
│ │              [Nhắc nợ] [TT] │ │
│ └─────────────────────────────┘ │
│ ── NỢ TRUNG HẠN (5 ngày) ──   │ ← sticky header, amber bg
│ ┌─────────────────────────────┐ │
│ │ Chị Lan       2.500.000đ   │ │
│ │ Nợ từ: 21/05  (5 ngày)     │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

## Tuổi nợ Color Coding

| Nhóm | Thời gian | Header BG | Text Color | Priority |
|------|-----------|-----------|------------|----------|
| Quá hạn | > 1 tháng | `red-50` | `red-700` | Hiển thị đầu tiên |
| Dài hạn | 1 tháng | `orange-50` | `orange-700` | 2nd |
| Trung hạn | 5 ngày | `amber-50` | `amber-700` | 3rd |
| Ngắn hạn | 1-3 ngày | `green-50` | `green-700` | 4th |

## Specific Rules

- **Số tiền nợ:** font-mono, bold, size lg
- **Tuổi nợ (số ngày):** hiển thị rõ ràng bên cạnh ngày bắt đầu nợ
- **Nút Thu tiền (TT):** mở bottom sheet/modal ghi nhận thanh toán
  - Fields: Số tiền thu, Hình thức (tiền mặt/CK), Ghi chú
  - Cho phép thu một phần
- **Nút Nhắc nợ:** Phase 2+ (placeholder, disabled)
- **Sort mặc định:** Quá hạn lâu nhất lên đầu
- **Quick action swipe (mobile):** Swipe right → Thu tiền
- **NCC tab:** Hiển thị hóa đơn chưa trả, grouped by NCC
  - Hỗ trợ đánh dấu "Đã trả" cho từng hóa đơn
  - Hiển thị tổng nợ NCC

## Nhập liệu nhanh cuối ngày

- Nút "Nhập nhanh cuối ngày" ở top right
- Mở form đơn giản: chọn khách → nhập số tiền nợ → lưu
- Hỗ trợ nhập liên tục (sau khi lưu, form reset, focus lại ô khách hàng)
