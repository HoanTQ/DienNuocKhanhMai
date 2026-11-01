-- ============================================================
-- Migration: Thêm giá sỉ (trade_price) cho products
-- Description:
--   Giá bán cho thợ/nhà thầu (giá sỉ), thấp hơn giá lẻ selling_price.
--   Nullable: sản phẩm không khai giá sỉ vẫn hợp lệ (khi bán dùng giá lẻ).
--   Nhân viên tự chọn mức giá (lẻ/sỉ) khi tạo đơn bán ở POS.
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS trade_price DECIMAL(15, 2)
  CHECK (trade_price IS NULL OR trade_price >= 0);
