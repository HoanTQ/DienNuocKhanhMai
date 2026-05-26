# Page Override: Delivery (Giao hàng qua bên thứ 3)

> Overrides MASTER.md for the 3rd-party delivery tracking screen
> Không quản lý trạng thái giao hàng — chỉ gắn cờ và tra cứu

---

## Layout

### Desktop
- Tab: [Đơn đang giao] | [Danh mục Người vận chuyển]
- Table: [Mã đơn, Khách hàng, Người VC, Thời điểm giao, Tổng tiền]

### Mobile
- Segment: Đang giao | Người VC
- Card list

## Gắn cờ giao hàng (từ màn hình POS/Đơn hàng)

Khi đơn hàng cần giao, hiển thị bottom sheet:

```
┌─────────────────────────────────┐
│ GIAO HÀNG QUA BÊN THỨ 3        │
├─────────────────────────────────┤
│ Chọn người vận chuyển:          │
│ ┌─────────────────────────────┐ │
│ │ ● Anh Tùng (xe ba gác)     │ │ ← radio select
│ │   0909 111 222              │ │
│ ├─────────────────────────────┤ │
│ │ ○ Grab Express              │ │
│ │   App                       │ │
│ ├─────────────────────────────┤ │
│ │ ○ + Thêm người VC mới      │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ [Hủy]         [Xác nhận giao]  │
└─────────────────────────────────┘
```

## Danh sách đơn đang giao

```
┌─────────────────────────────────┐
│ #BH-0156 — Anh Minh            │
│ Giao bởi: Anh Tùng (xe ba gác) │
│ Lúc: 14:30 hôm nay             │
│ Tổng: 450.000đ                  │
│                     [Gọi VC 📞] │
└─────────────────────────────────┘
```

## Danh mục Người vận chuyển

```
┌─────────────────────────────────┐
│ Người vận chuyển     [Thêm]    │
├─────────────────────────────────┤
│ Anh Tùng                        │
│ Xe ba gác | 0909 111 222        │
│ Đã giao: 45 đơn     [Sửa] [📞]│
├─────────────────────────────────┤
│ Grab Express                    │
│ App | —                         │
│ Đã giao: 12 đơn     [Sửa]     │
└─────────────────────────────────┘
```

### Form thêm người VC

| Field | Type | Required |
|-------|------|----------|
| Tên | Text | ✅ |
| Số điện thoại | Phone | ❌ |
| Ghi chú | Text | ❌ (ví dụ: "xe ba gác", "chỉ giao Q7") |

## Specific Rules

- **Không quản lý trạng thái:** Không có "đang giao", "đã giao", "thất bại"
- **Chỉ gắn cờ:** Đơn hàng được flag + ghi nhận người VC + thời điểm
- **SĐT người VC:** Clickable → gọi điện (`tel:` link)
- **Tra cứu:** Filter đơn theo người VC, theo ngày
- **Mục đích:** Chỉ để biết "đơn nào đưa cho ai đi giao" khi cần tra cứu
- **Cả Chủ và Nhân viên** đều có thể gắn cờ giao hàng
