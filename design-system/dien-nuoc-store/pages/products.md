# Page Override: Products (Quản lý Danh mục Sản phẩm)

> Overrides MASTER.md for the Product catalog management screen

---

## Layout

### Desktop
- Top bar: Search + Filter (Nhóm hàng, Thương hiệu) + [Thêm SP] + [Import Excel]
- Data table: [Ảnh, Tên SP, Nhóm, Thương hiệu, Quy cách, ĐVT, Giá bán, Tồn kho]
- Click row → Product Detail page

### Mobile
- Search sticky top
- Filter chips: Tất cả | Điện | Nước | Sơn
- Grid view (2 cols) hoặc List view (toggle)

```
Grid view:
┌──────────┐ ┌──────────┐
│ [ảnh]    │ │ [ảnh]    │
│ Cadivi   │ │ Bình Minh│
│ 2.5mm    │ │ D21      │
│ 45.000đ  │ │ 12.000đ  │
└──────────┘ └──────────┘

List view:
┌─────────────────────────────────┐
│ [img] Dây điện Cadivi 2.5mm     │
│       Điện | Cuộn (100m)        │
│       45.000đ/m    Tồn: 15     │
└─────────────────────────────────┘
```

## Product Detail Page

```
┌─────────────────────────────────┐
│ ← Quay lại    [Sửa] [Xóa]     │
├─────────────────────────────────┤
│ [Ảnh sản phẩm — nếu có]        │
├─────────────────────────────────┤
│ Dây điện Cadivi 2.5mm           │ ← text-xl, bold
│ Nhóm: Điện | TH: Cadivi        │
├─────────────────────────────────┤
│ ĐƠN VỊ QUY ĐỔI                │
│ Cấp 1: Cuộn                    │
│ Cấp 2: Mét (1 cuộn = 100m)     │
├─────────────────────────────────┤
│ GIÁ (chỉ Chủ thấy)            │
│ Giá bán: 45.000đ/m             │
│ Giá vốn TB: 38.000đ/m          │
│ Giá vốn cuối: 40.000đ/m        │
│ Biên LN: 12.5%                  │
├─────────────────────────────────┤
│ TỒN KHO                        │
│ 15 cuộn (1.500m)               │
│ Mức tối thiểu: 5 cuộn          │
├─────────────────────────────────┤
│ LỊCH SỬ GIÁ NHẬP              │
│ 25/05: 40.000đ (Cadivi HCM)    │
│ 10/05: 38.000đ (Cadivi HCM)    │
│ 28/04: 38.500đ (Cadivi HN)     │
└─────────────────────────────────┘
```

## Form Thêm/Sửa Sản phẩm

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Tên sản phẩm | Text | ✅ | |
| Nhóm hàng | Select | ✅ | Điện / Nước / Sơn / Khác |
| Thương hiệu | Select + Add new | ✅ | Autocomplete từ danh sách có sẵn |
| Quy cách | Text | ✅ | Ví dụ: "2.5mm", "D21 4m" |
| Đơn vị tính cơ bản | Select | ✅ | m, kg, cái, cuộn, bao, bộ... |
| Đơn vị quy đổi cấp 2 | Text + Number | ❌ | Ví dụ: "Cuộn" = 100 "Mét" |
| Đơn vị quy đổi cấp 3 | Text + Number | ❌ | |
| Mã vạch | Text / Scan | ❌ | Hỗ trợ quét camera |
| Hình ảnh | Upload | ❌ | 1 ảnh, max 2MB |
| Giá bán | Number | ✅ | Format tiền VNĐ |
| Mức tồn kho tối thiểu | Number | ❌ | Để cảnh báo |

### Form Layout
- Single column trên mobile
- 2 columns trên desktop (thông tin cơ bản trái, giá + tồn kho phải)
- Nút Lưu: sticky bottom trên mobile

## Import Excel

- Nút "Import từ Excel" → upload file
- Preview table trước khi confirm (hiển thị 10 rows đầu)
- Highlight rows lỗi (thiếu field bắt buộc, trùng tên)
- Summary: "X sản phẩm mới, Y cập nhật, Z lỗi"
- Confirm → import

## Specific Rules

- **Ảnh sản phẩm:** Placeholder icon nếu không có ảnh (icon `package`)
- **Giá bán:** Chỉ Chủ cửa hàng sửa được, Nhân viên chỉ xem
- **Giá vốn:** Ẩn hoàn toàn với Nhân viên
- **Mã vạch:** Hiển thị barcode visual nhỏ bên cạnh mã số
- **Search:** Tìm theo tên, thương hiệu, quy cách, mã vạch
- **Sort:** Mặc định theo tên A-Z, hỗ trợ sort theo tồn kho, giá
- **Pagination:** 20 items/page
- **View toggle (mobile):** Grid / List, lưu preference
