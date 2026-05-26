# Page Override: Notifications (Thông báo)

> Overrides MASTER.md for the Notification center

---

## Layout

### Desktop
- Dropdown panel từ bell icon (width 400px, max-height 480px)
- Link "Xem tất cả" → full page notifications

### Mobile
- Full page (navigate từ bottom tab)
- Pull-to-refresh

## Notification Bell (All screens)

```css
/* Bell icon in navbar */
.notification-bell {
  position: relative;
  min-width: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* Badge: red dot with count */
.notification-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  background: #DC2626;
  color: white;
  font-size: 11px;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  border-radius: 9999px;
  padding: 0 5px;
}
```

## Notification List

```
┌─────────────────────────────────┐
│ Thông báo        [Đánh dấu tất cả đã đọc] │
├─────────────────────────────────┤
│ ● Tồn kho thấp                 │ ← unread = blue dot
│   Dây Cadivi 1.5mm còn 2 cuộn  │
│   10 phút trước                │
├─────────────────────────────────┤
│   Công nợ quá hạn              │ ← read = no dot
│   Anh Tuấn nợ 8tr (41 ngày)   │
│   2 giờ trước                  │
├─────────────────────────────────┤
│ ● Giá NCC thay đổi             │
│   Cadivi cập nhật bảng giá mới │
│   Hôm qua                      │
└─────────────────────────────────┘
```

## Notification Types & Icons

| Type | Icon | Color | Action khi tap |
|------|------|-------|----------------|
| Tồn kho thấp | `package` | amber-600 | → Trang đặt hàng (pre-fill SP) |
| Công nợ quá hạn | `alert-circle` | red-600 | → Chi tiết công nợ khách |
| Đơn hàng NCC đã đến | `truck` | green-600 | → Phiếu nhập kho |
| Giá NCC thay đổi | `trending-up` | blue-600 | → Bảng giá NCC |
| Hàng tồn lâu | `clock` | slate-500 | → Tồn kho (filter tồn lâu) |

## Specific Rules

- **Unread indicator:** Blue dot (w-2 h-2) bên trái notification
- **Tap action:** Đánh dấu đã đọc + navigate đến màn hình liên quan
- **Swipe left (mobile):** Xóa notification
- **Filter tabs:** Tất cả | Tồn kho | Công nợ | Nhập hàng
- **Timestamp format:**
  - < 1 giờ: "X phút trước"
  - < 24 giờ: "X giờ trước"
  - < 7 ngày: "Hôm qua", "2 ngày trước"
  - ≥ 7 ngày: "dd/mm/yyyy"
- **Empty state:** "Không có thông báo mới" + illustration
- **Max display:** 50 notifications, older ones archived
- **Chỉ Chủ cửa hàng** nhận thông báo (Nhân viên không có tab Thông báo, thay bằng tab khác)
