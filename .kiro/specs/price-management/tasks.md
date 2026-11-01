# Implementation Plan: Quản lý Giá nâng cao

## Overview

Mở rộng flow nhập kho để hỗ trợ chiết khấu và tự động tính giá vốn. Thêm hiển thị giá NCC trên trang sản phẩm. Giữ nguyên trigger WAC hiện tại, chỉ thay đổi application layer và UI.

## Tasks

- [x] 1. Database Migration — Thêm cột chiết khấu vào goods_receipt_items
  - [x] 1.1 Tạo migration thêm 3 cột mới vào `goods_receipt_items`
    - Thêm `total_payment DECIMAL(15, 2)` — nullable (backward compat)
    - Thêm `discount_type VARCHAR(10) DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed'))`
    - Thêm `discount_value DECIMAL(15, 2) DEFAULT 0 CHECK (discount_value >= 0)`
    - Không thay đổi `unit_price` constraint (giữ nguyên NOT NULL, >= 0)
    - _Requirements: 1.1, 2.4_

- [x] 2. Application Logic — Service tính giá vốn
  - [x] 2.1 Thêm functions mới vào `src/services/pricing.service.ts`
    - `calculateUnitPriceFromPayment(totalPayment, quantity)` → trả về unit_price
    - `calculatePaymentAfterDiscount(subtotal, discountType, discountValue)` → trả về payment sau CK
    - `calculateActualDiscountPercent(subtotal, totalPayment)` → trả về % CK thực tế
    - Validate inputs: quantity > 0, totalPayment >= 0, discount hợp lệ
    - Làm tròn 2 chữ số thập phân
    - _Requirements: 2.1, 2.5, 1.1_

  - [x] 2.2 Cập nhật TypeScript types
    - Thêm `total_payment?: number`, `discount_type?: 'percent' | 'fixed'`, `discount_value?: number` vào interface `GoodsReceiptItem`
    - _Requirements: 2.4_

- [x] 3. UI Form nhập kho — Đổi sang flow mới
  - [x] 3.1 Cập nhật form tạo/sửa phiếu nhập kho
    - Thay input `unit_price` bằng: input `Thanh toán` + input `Chiết khấu` + dropdown `%/VNĐ`
    - Hiển thị Giá NCC (từ `supplier_prices`) dạng label tham khảo khi chọn sản phẩm
    - Real-time tính và hiển thị `Giá vốn/sp` khi đủ Số lượng + Thanh toán
    - Hiển thị tổng thanh toán cuối phiếu
    - Chiết khấu mặc định = 0, optional
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 2.2, 1.2, 1.3, 1.4, 1.5_

  - [x] 3.2 Cập nhật logic submit phiếu nhập kho
    - Tính `unit_price = total_payment / quantity` trước khi insert
    - Lưu `total_payment`, `discount_type`, `discount_value` vào `goods_receipt_items`
    - Validate trước khi submit: quantity > 0, total_payment > 0, unit_price >= 0
    - Trigger WAC hiện tại sẽ tự chạy khi confirm — không cần sửa trigger
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 4.5_

- [x] 4. UI Hiển thị giá trên trang sản phẩm
  - [x] 4.1 Thêm section thông tin giá trên trang chi tiết sản phẩm (Owner only)
    - Hiển thị: Giá NCC (query `supplier_prices` mới nhất), Giá vốn TB (`weighted_avg_cost`), Giá nhập GN (`last_cost`), Giá bán (`selling_price`)
    - Tính và hiển thị lợi nhuận: số tiền + phần trăm
    - Xử lý edge case: WAC = 0 → hiển thị "Chưa có giá vốn"
    - Ẩn toàn bộ section này với role Staff
    - Khi có nhiều NCC → hiển thị giá NCC gần nhất (theo effective_date)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
