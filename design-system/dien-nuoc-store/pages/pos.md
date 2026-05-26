# Page Override: POS (Bán hàng tại quầy)

> Overrides MASTER.md for the POS/Sales screen

---

## Layout Override

### Mobile (Primary use case)
- **Full-screen mode** — hide bottom tab bar khi đang tạo đơn
- Search bar sticky top (luôn hiển thị)
- Product list: scrollable, mỗi item hiển thị: tên + giá + nút [+]
- Cart summary: fixed bottom, hiển thị tổng tiền + nút [Thanh toán]

```
┌─────────────────────────────────┐
│ 🔍 Tìm sản phẩm / Quét mã     │ ← sticky top
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ Dây điện Cadivi 2.5mm       │ │
│ │ 45.000đ/m     [- 1 +]      │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Ống nước Bình Minh D21      │ │
│ │ 12.000đ/cây   [- 2 +]      │ │
│ └─────────────────────────────┘ │
│         ... scrollable ...       │
├─────────────────────────────────┤
│ 3 sản phẩm    Tổng: 69.000đ   │ ← fixed bottom
│ [Giảm giá]         [THANH TOÁN]│
└─────────────────────────────────┘
```

### Desktop
- Split view: Danh sách sản phẩm (trái 60%) | Giỏ hàng (phải 40%)
- Giỏ hàng luôn hiển thị, không cần scroll

## Specific Rules

- **Nút Thanh toán:** Luôn visible, size lớn (h-14), màu success green, full-width trên mobile
- **Quantity controls:** Nút [−] [+] tối thiểu 44x44px, số lượng ở giữa editable
- **Giá bán:** Font mono, size 18px, bold, color green-600
- **Tìm kiếm:** Auto-focus khi mở trang, hỗ trợ quét mã vạch qua camera
- **Thêm sản phẩm:** Single tap để thêm (quantity = 1), long press hoặc tap vào quantity để sửa số lượng
- **Xóa sản phẩm:** Swipe left trên mobile, icon trash trên desktop

## Performance

- Danh sách sản phẩm: virtualized list (chỉ render items visible)
- Search: debounce 300ms, hiển thị kết quả ngay khi gõ
- Barcode scan: kết quả < 1 giây
