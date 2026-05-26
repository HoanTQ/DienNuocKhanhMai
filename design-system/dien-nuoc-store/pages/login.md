# Page Override: Login (Đăng nhập)

> Overrides MASTER.md for the Login/Authentication screen

---

## Layout

- Centered card, max-width 400px
- No sidebar, no bottom tabs
- Background: subtle gradient hoặc solid `slate-50`
- Logo cửa hàng ở top center

```
┌─────────────────────────────────┐
│                                 │
│         [LOGO]                  │
│   Hệ thống Quản lý Cửa hàng   │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Số điện thoại               │ │
│ │ [0912 345 678_____________] │ │
│ │                             │ │
│ │ Mật khẩu                   │ │
│ │ [••••••••••___________] 👁  │ │
│ │                             │ │
│ │ ☑ Ghi nhớ đăng nhập        │ │
│ │                             │ │
│ │ [      ĐĂNG NHẬP      ]    │ │ ← full-width, h-14, primary
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ Quên mật khẩu? Liên hệ chủ CH  │
│                                 │
└─────────────────────────────────┘
```

## Specific Rules

- **Input SĐT:** type="tel", inputmode="numeric", auto-format (0912 345 678)
- **Input mật khẩu:** Toggle show/hide (eye icon), min 6 ký tự
- **Nút Đăng nhập:** Full-width, h-14 (56px), font-size 16px, primary blue
- **Ghi nhớ đăng nhập:** Checkbox, default checked
- **Error states:**
  - Sai mật khẩu: "Số điện thoại hoặc mật khẩu không đúng" (red text below form)
  - Tài khoản bị khóa: "Tài khoản đã bị khóa. Liên hệ chủ cửa hàng." (red banner)
  - Lần thứ 4 sai: "Còn 1 lần thử. Sau đó tài khoản sẽ bị khóa." (amber warning)
- **Loading state:** Nút đăng nhập → spinner + disabled, text "Đang đăng nhập..."
- **Quên mật khẩu:** Không có flow tự reset (Phase 1). Hiển thị text "Liên hệ chủ cửa hàng"
- **After login redirect:**
  - Chủ cửa hàng → Dashboard
  - Nhân viên → POS (Bán hàng)
- **Mobile:** Form chiếm full viewport height (centered vertically), keyboard không che nút Đăng nhập
- **No registration:** Chỉ Chủ cửa hàng tạo tài khoản cho nhân viên (trong Settings)

## Security UX

- Không hiển thị "SĐT không tồn tại" (tránh enumeration)
- Luôn dùng message chung: "Số điện thoại hoặc mật khẩu không đúng"
- Sau 5 lần sai → khóa 15 phút (hiển thị countdown)
- HTTPS indicator không cần hiển thị (browser tự handle)
