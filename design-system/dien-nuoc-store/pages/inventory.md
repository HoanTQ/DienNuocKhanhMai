# Page Override: Inventory (Tồn kho)

> Overrides MASTER.md for the Inventory management screen

---

## Layout

### Desktop
- Filter bar (top): Nhóm hàng | Thương hiệu | Trạng thái tồn kho | Search
- Data table: columns = [Tên SP, Quy cách, Tồn kho, Đơn vị, Giá bán, Trạng thái]
- Bulk actions bar (khi chọn nhiều): [Cập nhật giá] [Xuất Excel]

### Mobile
- Search bar sticky top
- Filter: horizontal scrollable chips (Tất cả | Điện | Nước | Sơn | Cảnh báo)
- Product list: card format

```
┌─────────────────────────────────┐
│ Dây điện Cadivi 2.5mm           │
│ Cuộn (100m)                     │
│ Tồn: 15 cuộn    Giá: 450.000đ  │
│ ● Bình thường                   │ ← green dot
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ Ống nước Bình Minh D21          │
│ Cây (4m)                        │
│ Tồn: 3 cây      Giá: 48.000đ   │
│ ⚠ Sắp hết                      │ ← amber dot + text
└─────────────────────────────────┘
```

## Status Indicators

| Status | Color | Dot | Label |
|--------|-------|-----|-------|
| Đủ hàng | green-600 | `●` | Bình thường |
| Sắp hết (≤ min) | amber-600 | `⚠` | Sắp hết |
| Hết hàng (= 0) | red-600 | `✕` | Hết hàng |
| Tồn lâu (> threshold) | slate-400 | `◐` | Tồn lâu |

## Specific Rules

- Số lượng tồn kho: font-mono, bold
- Sản phẩm hết hàng: row background `red-50`
- Sản phẩm sắp hết: row background `amber-50`
- Click vào sản phẩm → mở detail (lịch sử nhập, giá vốn — chỉ Chủ)
- Sort: mặc định theo trạng thái (hết hàng lên đầu)
- Pagination: 20 items/page, hiển thị tổng số
