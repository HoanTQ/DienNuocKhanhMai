# Page Override: Purchasing (Đặt hàng & Nhập hàng)

> Overrides MASTER.md for the Purchasing/Receiving screen

---

## Layout

### Desktop
- Tab navigation: [Đơn đặt hàng] | [Phiếu nhập kho] | [Nhà cung cấp]
- Đơn đặt hàng: table with status badges
- Phiếu nhập kho: table with link to đơn đặt hàng gốc

### Mobile
- Segment control: Đặt hàng | Nhập kho | NCC
- Card list with status badges

## Đơn đặt hàng

```
┌─────────────────────────────────┐
│ ĐH-2026-0045                    │
│ NCC: Cadivi                     │
│ Ngày đặt: 25/05/2026           │
│ 5 sản phẩm — 12.500.000đ       │
│ ● Đang chờ giao                 │ ← status badge
│                    [Nhập hàng]  │ ← khi hàng đến
└─────────────────────────────────┘
```

### Status Badges

| Status | Color | Badge |
|--------|-------|-------|
| Nháp | `slate-100 text-slate-600` | Nháp |
| Đã gửi NCC | `blue-100 text-blue-700` | Đã gửi |
| Đang chờ giao | `amber-100 text-amber-700` | Chờ giao |
| Đã nhập kho | `green-100 text-green-700` | Đã nhập |
| Hủy | `red-100 text-red-700` | Đã hủy |

## Tạo đơn đặt hàng

### Flow (3 bước)

1. **Chọn NCC** → dropdown/search
2. **Thêm sản phẩm** → search + hiển thị tồn kho hiện tại + cảnh báo nếu có đơn đang chờ
3. **Xác nhận** → review + gửi

### Form thêm sản phẩm

```
┌─────────────────────────────────┐
│ 🔍 Tìm sản phẩm...             │
├─────────────────────────────────┤
│ Dây điện Cadivi 2.5mm           │
│ Tồn kho: 5 cuộn                │
│ ⚠ Có đơn đang chờ: ĐH-0044    │ ← warning nếu trùng
│ Giá NCC gần nhất: 380.000đ     │
│ Số lượng: [___] cuộn           │
│                        [Thêm]  │
└─────────────────────────────────┘
```

## Phiếu nhập kho

### Flow nhập hàng

1. Chọn đơn đặt hàng (hoặc tạo phiếu nhập mới không có đơn đặt)
2. Kiểm tra từng sản phẩm: số lượng đặt vs thực nhận
3. Ghi nhận hàng khuyến mãi (nếu có)
4. Ghi nhận hàng lỗi (nếu có)
5. Xác nhận → tự động cập nhật tồn kho + giá vốn

### So sánh đặt vs nhận

```
┌─────────────────────────────────────────┐
│ Sản phẩm          │ Đặt  │ Nhận │ Lỗi │
├───────────────────┼──────┼──────┼──────┤
│ Dây Cadivi 2.5mm  │ 10   │ [10] │ [0] │
│ Ống BM D21        │ 50   │ [48] │ [2] │ ← highlight khác biệt
│ + KM: Ống D21     │ —    │ [5]  │ —   │ ← hàng khuyến mãi
└─────────────────────────────────────────┘
```

## Specific Rules

- **Cảnh báo đặt trùng:** Amber banner khi sản phẩm đã có trong đơn đang chờ
- **Hiển thị tồn kho:** Luôn hiển thị bên cạnh mỗi sản phẩm khi đặt hàng
- **So sánh số lượng:** Highlight đỏ nếu nhận < đặt
- **Hàng khuyến mãi:** Row riêng, đánh dấu "KM", giá = 0
- **Import bảng giá NCC:** Nút upload Excel, preview trước khi confirm
- **Chỉ Chủ cửa hàng** mới được tạo đơn đặt hàng và xem giá NCC
- **Nhân viên** chỉ được nhập hàng (kiểm hàng khi NCC giao)
