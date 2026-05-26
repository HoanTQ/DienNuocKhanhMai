# Design System Master File — Hệ thống Quản lý Cửa hàng Điện Nước

> **LOGIC:** When building a specific page, first check `design-system/dien-nuoc-store/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Hệ thống Quản lý Cửa hàng Điện Nước (Dien Nuoc Store)
**Generated:** 2026-05-26
**Category:** Retail POS + Inventory Management Dashboard
**Target Users:** Chủ cửa hàng & Nhân viên bán hàng (ít quen công nghệ)
**Platform:** Web Responsive (Mobile-first cho POS & tra cứu giá)

---

## Design Philosophy

| Principle | Rationale |
|-----------|-----------|
| **Mobile-first** | Nhân viên dùng điện thoại tra giá, quét mã vạch tại kệ hàng |
| **Flat Design + Clean** | Đơn giản, dễ hiểu, không gây rối mắt cho người ít quen công nghệ |
| **Large touch targets** | Tối thiểu 48x48px cho mọi nút bấm, hỗ trợ thao tác một tay |
| **Data-dense on desktop** | Chủ cửa hàng cần xem nhiều thông tin cùng lúc trên máy tính |
| **Minimal steps** | Mỗi tác vụ thường dùng (tạo đơn, tra giá) tối đa 3 bước |
| **Vietnamese-first** | Toàn bộ UI tiếng Việt, format tiền VNĐ, ngày dd/mm/yyyy |

---

## Global Rules

### Color Palette

| Role | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| Primary | `#2563EB` | `blue-600` | Navigation, headers, active states |
| Primary Light | `#DBEAFE` | `blue-100` | Selected rows, active tab background |
| Secondary | `#0891B2` | `cyan-600` | Links, secondary actions |
| Success/CTA | `#16A34A` | `green-600` | Confirm buttons, positive indicators (lãi, tồn kho đủ) |
| Warning | `#D97706` | `amber-600` | Cảnh báo tồn kho thấp, nợ sắp quá hạn |
| Danger | `#DC2626` | `red-600` | Xóa, lỗi, nợ quá hạn, tồn kho hết |
| Background | `#F8FAFC` | `slate-50` | Page background |
| Surface | `#FFFFFF` | `white` | Cards, modals, panels |
| Text Primary | `#1E293B` | `slate-800` | Body text, headings |
| Text Secondary | `#64748B` | `slate-500` | Labels, muted text, timestamps |
| Border | `#E2E8F0` | `slate-200` | Card borders, dividers, input borders |

**Rationale:** Blue primary conveys trust & professionalism. Green for positive actions (xác nhận bán, nhập hàng). Amber/Red for warnings/errors. High contrast for readability in cửa hàng (ánh sáng mạnh).

### Typography

- **Heading Font:** Inter
- **Body Font:** Inter
- **Monospace (giá, số liệu):** JetBrains Mono
- **Mood:** Professional, clean, readable, friendly
- **Why Inter:** Excellent Vietnamese diacritics support, highly readable at small sizes, free on Google Fonts

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
```

**Tailwind Config:**
```js
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'monospace'],
}
```

**Type Scale:**

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `text-xs` | 12px | 400 | Timestamps, badges |
| `text-sm` | 14px | 400-500 | Labels, table headers, secondary info |
| `text-base` | 16px | 400 | Body text, input text |
| `text-lg` | 18px | 500-600 | Card titles, section headers |
| `text-xl` | 20px | 600 | Page titles |
| `text-2xl` | 24px | 700 | Dashboard KPI numbers |
| `text-3xl` | 30px | 700 | Hero numbers (tổng doanh thu) |
| `price` | 18-24px | 600 | Giá bán — dùng font-mono, color success |

### Spacing System (8px base)

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `space-1` | 4px | `p-1` | Tight inline gaps |
| `space-2` | 8px | `p-2` | Icon gaps, badge padding |
| `space-3` | 12px | `p-3` | Input padding, small card padding |
| `space-4` | 16px | `p-4` | Standard card padding, list gaps |
| `space-5` | 20px | `p-5` | Section padding mobile |
| `space-6` | 24px | `p-6` | Section padding desktop |
| `space-8` | 32px | `p-8` | Large section gaps |
| `space-12` | 48px | `p-12` | Page-level spacing |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 4px | Badges, small elements |
| `rounded` | 6px | Inputs, small buttons |
| `rounded-lg` | 8px | Cards, large buttons |
| `rounded-xl` | 12px | Modals, panels |
| `rounded-full` | 9999px | Avatars, status dots |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle card lift |
| `shadow` | `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)` | Default cards |
| `shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Elevated cards, dropdowns |
| `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, popovers |

---

## Layout System

### Desktop (≥1024px)

```
┌─────────────────────────────────────────────────────┐
│  Top Navbar (fixed, h-16)                           │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │  Main Content Area                       │
│ (w-64)   │  (max-w-7xl, mx-auto, px-6)             │
│ collaps- │                                          │
│ ible     │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

- Sidebar: collapsible (w-64 → w-16), chứa navigation chính
- Top navbar: logo, search, notifications bell, user menu
- Content: max-w-7xl, padding px-6

### Tablet (768px–1023px)

```
┌─────────────────────────────────────────────────────┐
│  Top Navbar (fixed, h-14)                           │
├─────────────────────────────────────────────────────┤
│  Main Content Area (full width, px-4)               │
│                                                     │
│  Bottom Tab Bar (fixed, h-16) — 5 tabs max          │
└─────────────────────────────────────────────────────┘
```

- Sidebar ẩn, mở bằng hamburger menu
- Bottom tab bar cho navigation chính

### Mobile (< 768px)

```
┌─────────────────────────────────────────────────────┐
│  Top Navbar (fixed, h-14, compact)                  │
├─────────────────────────────────────────────────────┤
│  Main Content Area (full width, px-3)               │
│                                                     │
│  Bottom Tab Bar (fixed, h-16) — 5 tabs max          │
└─────────────────────────────────────────────────────┘
```

- Bottom tab bar: Bán hàng | Tồn kho | Tra giá | Thông báo | Menu
- Nút bấm tối thiểu 48x48px
- Swipe gestures cho navigation giữa các tab

---

## Component Specs

### Buttons

```css
/* Primary Button — Xác nhận, Lưu, Thanh toán */
.btn-primary {
  background: #2563EB;
  color: white;
  padding: 14px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 16px;
  min-height: 48px;
  min-width: 48px;
  transition: background-color 200ms ease;
  cursor: pointer;
}
.btn-primary:hover { background: #1D4ED8; }
.btn-primary:active { background: #1E40AF; }

/* Success Button — Thanh toán, Xác nhận bán */
.btn-success {
  background: #16A34A;
  color: white;
  padding: 14px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 16px;
  min-height: 48px;
  transition: background-color 200ms ease;
  cursor: pointer;
}
.btn-success:hover { background: #15803D; }

/* Danger Button — Xóa, Hủy đơn */
.btn-danger {
  background: #DC2626;
  color: white;
  padding: 14px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 16px;
  min-height: 48px;
  transition: background-color 200ms ease;
  cursor: pointer;
}

/* Ghost Button — Secondary actions */
.btn-ghost {
  background: transparent;
  color: #2563EB;
  border: 1.5px solid #2563EB;
  padding: 14px 24px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 16px;
  min-height: 48px;
  transition: all 200ms ease;
  cursor: pointer;
}
.btn-ghost:hover { background: #DBEAFE; }
```

### Cards (KPI, Product, Order)

```css
.card {
  background: white;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 16px;
  transition: box-shadow 200ms ease;
}
.card:hover {
  box-shadow: 0 4px 6px rgba(0,0,0,0.07);
}

/* KPI Card — Doanh thu, Số đơn, Tồn kho */
.card-kpi {
  background: white;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 20px;
}
.card-kpi .kpi-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 700;
  color: #1E293B;
}
.card-kpi .kpi-label {
  font-size: 14px;
  color: #64748B;
  margin-top: 4px;
}
```

### Inputs & Search

```css
.input {
  padding: 14px 16px;
  border: 1.5px solid #E2E8F0;
  border-radius: 6px;
  font-size: 16px; /* Prevents iOS zoom */
  min-height: 48px;
  width: 100%;
  transition: border-color 200ms ease;
}
.input:focus {
  border-color: #2563EB;
  outline: none;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
.input::placeholder {
  color: #94A3B8;
}

/* Search bar — prominent on mobile */
.search-bar {
  padding: 14px 16px 14px 44px; /* space for search icon */
  border: 1.5px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  min-height: 48px;
  background: white;
}
```

### Tables (Desktop) → Cards (Mobile)

```css
/* Desktop: Data table */
.table { width: 100%; border-collapse: collapse; }
.table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748B;
  border-bottom: 1px solid #E2E8F0;
}
.table td {
  padding: 12px 16px;
  font-size: 14px;
  border-bottom: 1px solid #F1F5F9;
}
.table tr:hover { background: #F8FAFC; }

/* Mobile: Convert to card list */
@media (max-width: 767px) {
  .table-responsive {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}
```

### Modals & Bottom Sheets

```css
/* Desktop: Center modal */
.modal-overlay {
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
}
.modal {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 20px 25px rgba(0,0,0,0.15);
  max-width: 480px;
  width: 90%;
}

/* Mobile: Bottom sheet (slide up) */
@media (max-width: 767px) {
  .modal {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    border-radius: 16px 16px 0 0;
    max-width: 100%;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    animation: slideUp 250ms ease;
  }
}
```

### Navigation — Bottom Tab Bar (Mobile)

```css
.bottom-tabs {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: white;
  border-top: 1px solid #E2E8F0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 50;
}
.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 48px;
  min-height: 48px;
  justify-content: center;
  cursor: pointer;
}
.tab-item.active { color: #2563EB; }
.tab-item:not(.active) { color: #64748B; }
```

### Notification Badge

```css
.notification-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #DC2626;
  color: white;
  font-size: 11px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
```

### Price Display

```css
.price {
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  font-weight: 600;
  color: #16A34A;
}
.price-large {
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 700;
  color: #1E293B;
}
/* Format: 10.000đ — dùng dấu chấm phân cách hàng nghìn */
```

---

## Iconography

- **Icon set:** Lucide Icons (consistent, clean, MIT license)
- **Size:** 20px (default), 24px (navigation), 16px (inline/small)
- **Stroke width:** 1.5px (default), 2px (active/selected)
- **Color:** Inherit from parent text color

**Key icons mapping:**

| Function | Icon name |
|----------|-----------|
| Bán hàng | `shopping-cart` |
| Tồn kho | `package` |
| Tra giá / Quét mã | `scan-barcode` |
| Thông báo | `bell` |
| Menu | `menu` |
| Tìm kiếm | `search` |
| Thêm sản phẩm | `plus` |
| Xóa | `trash-2` |
| Chỉnh sửa | `pencil` |
| Lưu | `check` |
| Quay lại | `arrow-left` |
| Khách hàng | `users` |
| Báo cáo | `bar-chart-3` |
| Cài đặt | `settings` |
| Đăng xuất | `log-out` |
| Tiền/Thanh toán | `banknote` |
| Nhập hàng | `truck` |
| NCC | `building-2` |

---

## Responsive Breakpoints

| Breakpoint | Tailwind | Target |
|------------|----------|--------|
| < 640px | `sm:` | Điện thoại nhỏ |
| 640-767px | `md:` | Điện thoại lớn |
| 768-1023px | `lg:` | Tablet |
| 1024-1279px | `xl:` | Laptop |
| ≥ 1280px | `2xl:` | Desktop |

### Responsive Behavior

| Component | Mobile (< 768px) | Tablet (768-1023px) | Desktop (≥ 1024px) |
|-----------|-------------------|---------------------|---------------------|
| Navigation | Bottom tab bar | Bottom tab bar | Sidebar (collapsible) |
| Tables | Card list | Scrollable table | Full table |
| Modals | Bottom sheet | Center modal | Center modal |
| KPI cards | 2 columns | 3 columns | 4 columns |
| Search | Full width, sticky top | Full width | Inline in navbar |
| Sidebar | Hidden (hamburger) | Hidden (hamburger) | Visible (collapsible) |

---

## Loading & Empty States

### Skeleton Loading
```css
.skeleton {
  background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### Empty States
- Illustration (simple SVG, not emoji) + descriptive text + CTA button
- Example: "Chưa có sản phẩm nào" + [Thêm sản phẩm đầu tiên]

---

## Currency & Number Formatting

| Type | Format | Example |
|------|--------|---------|
| Tiền VNĐ | `X.XXX đ` (dấu chấm phân cách nghìn) | `10.000đ`, `1.500.000đ` |
| Số lượng | Số nguyên hoặc 1-2 decimal | `100`, `2.5` |
| Phần trăm | `X%` | `5%`, `12.5%` |
| Ngày | `dd/mm/yyyy` | `26/05/2026` |
| Giờ | `HH:mm` (24h) | `14:30` |

---

## Accessibility

- Minimum touch target: **48x48px** (larger than standard 44px for non-tech users)
- Color contrast: **4.5:1** minimum (WCAG AA)
- Font size minimum: **14px** (never smaller)
- Input font size: **16px** (prevents iOS auto-zoom)
- Focus ring: `ring-2 ring-blue-500 ring-offset-2`
- `prefers-reduced-motion`: disable all animations
- All form inputs must have visible labels (no placeholder-only)
- Error messages: red text + icon, positioned below input

---

## Anti-Patterns (NEVER Do)

| ❌ Don't | ✅ Do Instead |
|----------|---------------|
| Emojis as icons | SVG icons from Lucide |
| Tiny buttons (< 48px) | Min 48x48px touch targets |
| Placeholder-only inputs | Visible labels always |
| Complex multi-step wizards | Single-page forms, max 3 steps |
| Auto-hiding navigation | Always-visible bottom tabs on mobile |
| Ornate decorations | Clean, flat, functional |
| Dark mode (Phase 1) | Light mode only — cửa hàng sáng |
| Infinite scroll for critical data | Pagination with clear counts |
| Hover-only interactions | Touch-friendly alternatives |
| Small font for prices | Large, monospace, high contrast |

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use Lucide SVG)
- [ ] All clickable elements have `cursor-pointer`
- [ ] All touch targets ≥ 48x48px
- [ ] Hover states with smooth transitions (200ms)
- [ ] Text contrast ≥ 4.5:1
- [ ] Focus states visible (ring-2)
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive tested: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars/tab bars
- [ ] No horizontal scroll on mobile
- [ ] Input font-size ≥ 16px (no iOS zoom)
- [ ] Prices formatted with JetBrains Mono, dấu chấm phân cách nghìn
- [ ] Vietnamese text renders correctly (diacritics)
- [ ] Bottom safe area respected (env(safe-area-inset-bottom))
- [ ] Loading states shown for async operations (skeleton/spinner)
- [ ] Empty states have helpful message + CTA
