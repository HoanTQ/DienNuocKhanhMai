# Page Override: Price Lookup (Tra cứu giá)

> Overrides MASTER.md for the barcode scan / price lookup screen
> This is the MOST USED screen by Nhân viên on mobile

---

## Layout (Mobile-first — primary use case)

```
┌─────────────────────────────────┐
│  [📷 Quét mã vạch]              │ ← Large button, top center
├─────────────────────────────────┤
│  🔍 Tìm theo tên / mã...       │ ← Search input
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────────┐│
│  │  TÊN SẢN PHẨM              ││ ← Large, bold
│  │  Thương hiệu | Quy cách    ││
│  │                             ││
│  │  GIÁ BÁN: 45.000đ          ││ ← Very large, green, mono
│  │                             ││
│  │  Tồn kho: 15 cuộn          ││
│  │  Đơn vị: mét (1 cuộn=100m) ││
│  │                             ││
│  │  [THÊM VÀO ĐƠN]           ││ ← Optional quick-add
│  └─────────────────────────────┘│
│                                 │
└─────────────────────────────────┘
```

## Specific Rules

- **Giá bán:** `text-3xl` (30px), font-mono, font-bold, color green-600
- **Camera button:** Full-width, h-14, icon + text "Quét mã vạch", primary color
- **Result display:** Immediately after scan/search, no page navigation
- **One-hand operation:** All interactive elements reachable with thumb (bottom 2/3 of screen)
- **Auto-focus:** Search input auto-focused when page opens (if no camera)
- **Recent lookups:** Show last 5 products looked up below search (quick re-access)

## Performance Requirements

- Barcode scan → result: < 1 second
- Text search → results: < 2 seconds (debounce 300ms)
- Camera permission: request once, remember choice

## Accessibility

- Price text: minimum 30px, high contrast (green on white)
- Camera button: large, clearly labeled, works without camera (fallback to manual search)
- Voice search: not required Phase 1, consider Phase 3
