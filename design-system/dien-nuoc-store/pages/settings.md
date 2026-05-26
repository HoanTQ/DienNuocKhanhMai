# Page Override: Settings (Cài đặt & Quản lý Người dùng)

> Overrides MASTER.md for Settings, User Management, and Audit Log
> Chỉ Chủ cửa hàng truy cập được

---

## Layout

### Desktop
- Left menu: [Thông tin cửa hàng] | [Người dùng] | [Phân quyền] | [Thông báo] | [Nhật ký]
- Right: content area

### Mobile
- List menu → navigate to sub-pages
- Back button to return

## Menu Items

```
┌─────────────────────────────────┐
│ CÀI ĐẶT                        │
├─────────────────────────────────┤
│ 🏪 Thông tin cửa hàng      >   │
│ 👤 Quản lý người dùng      >   │
│ 🔔 Cài đặt thông báo       >   │
│ 📋 Nhật ký hoạt động       >   │
│ 🔒 Đổi mật khẩu            >   │
│ ↪️ Đăng xuất                    │
└─────────────────────────────────┘
```
*(Icons above are for illustration — use Lucide SVG in implementation)*

## Quản lý Người dùng

```
┌─────────────────────────────────┐
│ Người dùng          [Thêm]     │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 👤 Nguyễn Văn A             │ │
│ │    Chủ cửa hàng             │ │
│ │    0912 345 678             │ │
│ │    Đang hoạt động ●         │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 👤 Trần Thị B               │ │
│ │    Nhân viên bán hàng       │ │
│ │    0987 654 321             │ │
│ │    Đang hoạt động ●         │ │
│ │              [Khóa] [Sửa]  │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### Thêm người dùng

| Field | Type | Required |
|-------|------|----------|
| Họ tên | Text | ✅ |
| Số điện thoại | Phone | ✅ (dùng làm username) |
| Mật khẩu | Password | ✅ |
| Vai trò | Select | ✅ (Chủ cửa hàng / Nhân viên) |

## Cài đặt Thông báo

Toggle switches cho từng loại:

```
┌─────────────────────────────────┐
│ CÀI ĐẶT THÔNG BÁO             │
├─────────────────────────────────┤
│ Tồn kho thấp           [====]  │ ← toggle on
│ Công nợ quá hạn         [====]  │
│ Đơn hàng NCC đã đến     [====]  │
│ Giá NCC thay đổi        [====]  │
│ Hàng tồn lâu            [====]  │
├─────────────────────────────────┤
│ PUSH NOTIFICATION (Phase 3)     │
│ Bật push notification    [----] │ ← toggle off / disabled
└─────────────────────────────────┘
```

## Nhật ký Hoạt động (Audit Log)

```
┌─────────────────────────────────────────────────────┐
│ Nhật ký hoạt động                                    │
│ [Hôm nay ▾] [Tất cả người dùng ▾] [Tất cả loại ▾] │
├─────────────────────────────────────────────────────┤
│ 14:30 — Trần Thị B                                  │
│ Tạo đơn bán hàng #BH-0156 (450.000đ)               │
├─────────────────────────────────────────────────────┤
│ 14:15 — Nguyễn Văn A                                │
│ Thay đổi giá bán: Dây Cadivi 2.5mm (43.000→45.000) │
├─────────────────────────────────────────────────────┤
│ 13:50 — Trần Thị B                                  │
│ Điều chỉnh tồn kho: Ống BM D21 (50→48, lý do: lỗi)│
├─────────────────────────────────────────────────────┤
│ ...                                                  │
└─────────────────────────────────────────────────────┘
```

### Filters

| Filter | Options |
|--------|---------|
| Thời gian | Hôm nay, 7 ngày, 30 ngày, Tùy chọn |
| Người dùng | Tất cả, [danh sách users] |
| Loại thao tác | Tất cả, Đơn hàng, Giá, Tồn kho, Sản phẩm, Người dùng |

### Log Entry Format

```
[Thời gian] — [Người thực hiện]
[Loại thao tác]: [Chi tiết thay đổi]
```

## Specific Rules

- **Toggle switches:** min-width 48px, clear on/off state
- **Audit log:** Read-only, không cho phép xóa
- **Pagination audit log:** 50 entries/page
- **Khóa tài khoản:** Confirm dialog trước khi khóa
- **Đổi mật khẩu:** Yêu cầu nhập mật khẩu cũ + mật khẩu mới 2 lần
- **Đăng xuất:** Confirm dialog "Bạn có chắc muốn đăng xuất?"
- **Responsive:** Settings menu → full page navigation trên mobile
