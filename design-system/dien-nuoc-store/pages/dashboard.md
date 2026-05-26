# Page Override: Dashboard (Tổng quan)

> Overrides MASTER.md for the main Dashboard screen (Chủ cửa hàng only)

---

## Layout

### Desktop
```
┌──────────────────────────────────────────────────────────┐
│  KPI Row (4 cards)                                        │
│  [Doanh thu hôm nay] [Số đơn] [Công nợ] [Tồn kho cảnh báo] │
├──────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌────────────────────────┐ │
│  │ Đơn hàng gần đây (table)│  │ Thông báo mới nhất     │ │
│  │                         │  │ • Tồn kho thấp: ...    │ │
│  │                         │  │ • Nợ quá hạn: ...      │ │
│  └─────────────────────────┘  └────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│  [Sản phẩm bán chạy]         [Hàng tồn lâu]             │
└──────────────────────────────────────────────────────────┘
```

### Mobile
- KPI cards: 2 columns grid
- Đơn hàng gần đây: card list (3 items max + "Xem tất cả")
- Thông báo: collapsed, chỉ hiện badge count

## KPI Cards

| KPI | Icon | Color accent | Format |
|-----|------|-------------|--------|
| Doanh thu hôm nay | `banknote` | green-600 | `X.XXX.XXXđ` |
| Số đơn hôm nay | `shopping-cart` | blue-600 | Integer |
| Công nợ phải thu | `alert-circle` | amber-600 | `X.XXX.XXXđ` |
| Tồn kho cảnh báo | `package` | red-600 | `X sản phẩm` |

## Specific Rules

- KPI values: font-mono, text-2xl (desktop), text-xl (mobile)
- KPI cards clickable → navigate to detail page
- Refresh data: auto every 60 seconds, manual pull-to-refresh on mobile
- Chỉ Chủ_cửa_hàng mới thấy Dashboard (Nhân viên vào thẳng POS)
