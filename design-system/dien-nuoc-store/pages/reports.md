# Page Override: Reports (Báo cáo)

> Overrides MASTER.md for the Reporting screens
> Chỉ Chủ cửa hàng truy cập được

---

## Layout

### Desktop
- Left sidebar (within content): menu báo cáo
- Right: nội dung báo cáo với filters + charts/tables

### Mobile
- Top: dropdown chọn loại báo cáo
- Date range picker
- Content: cards + simplified charts

## Loại báo cáo & Navigation

| Báo cáo | Icon | Mô tả ngắn |
|----------|------|-------------|
| Doanh thu | `trending-up` | Doanh thu theo ngày/tuần/tháng |
| Lợi nhuận | `bar-chart-3` | Lãi gộp theo SP/nhóm hàng |
| Tồn kho | `package` | Giá trị tồn, hàng tồn lâu |
| Công nợ | `credit-card` | Nợ KH + NCC theo tuổi nợ |
| Sản phẩm | `shopping-bag` | SP bán chạy, SP không bán |

## Báo cáo Doanh thu

```
┌─────────────────────────────────────────┐
│ Doanh thu          [Hôm nay ▾] [Xuất]  │
├─────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Doanh thu│ │ Số đơn   │ │ TB/đơn   │ │
│ │15.200.000│ │ 23       │ │ 660.870  │ │
│ └──────────┘ └──────────┘ └──────────┘ │
├─────────────────────────────────────────┤
│ [===== Bar chart doanh thu 7 ngày ====] │
├─────────────────────────────────────────┤
│ Đơn hàng hôm nay (table)               │
│ #  Khách    Tổng tiền   Thanh toán     │
│ 1  Anh Minh 450.000đ   Tiền mặt       │
│ 2  Chị Lan  1.200.000đ Chuyển khoản   │
│ ...                                     │
└─────────────────────────────────────────┘
```

## Báo cáo Lợi nhuận

- Bar chart: Lợi nhuận gộp theo nhóm hàng (Điện, Nước, Sơn)
- Table: Top 10 SP lãi nhiều nhất / lỗ nhiều nhất
- Columns: [SP, Giá bán TB, Giá vốn TB, Biên LN, Số lượng bán]
- Highlight đỏ nếu biên lợi nhuận < 10%

## Báo cáo Tồn kho

- Pie chart: Giá trị tồn kho theo nhóm
- Table: Hàng tồn lâu (sort by tuổi lưu kho giảm dần)
- Columns: [SP, Tồn kho, Giá trị, Ngày nhập cuối, Tuổi lưu kho]
- Highlight amber nếu tuổi lưu kho > 90 ngày

## Date Range Picker

- Preset buttons: Hôm nay | 7 ngày | 30 ngày | Tháng này | Tùy chọn
- Custom range: 2 date inputs (từ ngày — đến ngày)
- Format: dd/mm/yyyy
- Mobile: bottom sheet với calendar picker

## Charts

- **Library:** Recharts (React) hoặc Chart.js
- **Style:** Clean, minimal gridlines, rounded bars
- **Colors:** Dùng palette từ MASTER (blue-600, green-600, amber-600)
- **Responsive:** Charts co giãn theo container width
- **Touch:** Tap on bar/point → show tooltip with value
- **No animation on load** nếu `prefers-reduced-motion`

## Export

- Nút "Xuất" ở top right mỗi báo cáo
- Options: Excel (.xlsx) | PDF
- Tên file: `[loại-báo-cáo]_[từ-ngày]_[đến-ngày].xlsx`

## Specific Rules

- **Số tiền lớn:** Rút gọn trên mobile (15.2tr thay vì 15.200.000đ)
- **KPI cards:** font-mono, text-2xl, bold
- **Negative values (lỗ):** Red text, prefix dấu "-"
- **Loading:** Skeleton cho charts (rectangle placeholder), skeleton rows cho tables
- **Empty state:** "Chưa có dữ liệu trong khoảng thời gian này"
- **Auto-refresh:** Không auto-refresh báo cáo (chỉ refresh khi user thay đổi filter)
