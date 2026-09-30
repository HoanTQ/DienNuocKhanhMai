-- ============================================================
-- Drop 2 cột giá vốn khỏi products (đã chuyển sang product_costs).
-- Cập nhật products_staff_view: thêm trade_price + sku, security_invoker.
-- ============================================================

-- 1. Drop cột giá vốn khỏi products
ALTER TABLE products DROP COLUMN IF EXISTS weighted_avg_cost;
ALTER TABLE products DROP COLUMN IF EXISTS last_cost;

-- 2. Tạo lại products_staff_view (DROP trước vì đổi thứ tự/thêm cột)
DROP VIEW IF EXISTS products_staff_view;
CREATE VIEW products_staff_view
WITH (security_invoker = on) AS
SELECT
  id,
  name,
  category_id,
  brand,
  specification,
  base_unit,
  barcode,
  image_url,
  description,
  sku,
  selling_price,
  trade_price,
  price_type,
  current_stock,
  min_stock_level,
  last_stocked_at,
  is_active,
  created_at,
  updated_at
FROM products;

GRANT SELECT ON products_staff_view TO authenticated;

-- 3. Bật security_invoker cho các view còn lại (defense in depth)
ALTER VIEW debt_summary_view SET (security_invoker = on);
ALTER VIEW inventory_alert_view SET (security_invoker = on);
ALTER VIEW daily_sales_summary_view SET (security_invoker = on);
