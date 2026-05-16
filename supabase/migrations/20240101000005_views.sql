-- ============================================================
-- Migration: Views
-- Description: Tạo views cho phân quyền và tiện ích truy vấn
-- ============================================================

-- ============================================================
-- products_staff_view: Ẩn giá vốn cho staff
-- Staff sử dụng view này thay vì truy cập trực tiếp bảng products
-- Ẩn: weighted_avg_cost, last_cost
-- ============================================================
CREATE OR REPLACE VIEW products_staff_view AS
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
  selling_price,
  price_type,
  current_stock,
  min_stock_level,
  last_stocked_at,
  is_active,
  created_at,
  updated_at
FROM products;

-- Grant access to the view
GRANT SELECT ON products_staff_view TO authenticated;

-- ============================================================
-- debt_summary_view: Tổng hợp công nợ khách hàng với tuổi nợ
-- ============================================================
CREATE OR REPLACE VIEW debt_summary_view AS
SELECT
  dr.id,
  dr.customer_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  dr.order_id,
  dr.amount,
  dr.paid_amount,
  dr.remaining,
  dr.due_date,
  dr.status,
  dr.created_at,
  EXTRACT(DAY FROM NOW() - dr.created_at)::INTEGER AS days_outstanding,
  CASE
    WHEN EXTRACT(DAY FROM NOW() - dr.created_at) <= 3 THEN 'short-term'
    WHEN EXTRACT(DAY FROM NOW() - dr.created_at) <= 5 THEN 'medium-term'
    WHEN EXTRACT(DAY FROM NOW() - dr.created_at) <= 30 THEN 'long-term'
    ELSE 'overdue'
  END AS age_category
FROM debt_records dr
JOIN customers c ON c.id = dr.customer_id
WHERE dr.status != 'paid';

-- ============================================================
-- inventory_alert_view: Sản phẩm tồn kho thấp
-- ============================================================
CREATE OR REPLACE VIEW inventory_alert_view AS
SELECT
  p.id,
  p.name,
  p.brand,
  p.specification,
  p.base_unit,
  p.current_stock,
  p.min_stock_level,
  p.last_stocked_at,
  c.name AS category_name,
  EXTRACT(DAY FROM NOW() - p.last_stocked_at)::INTEGER AS days_since_last_stock
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.current_stock <= p.min_stock_level
  AND p.is_active = true
  AND p.min_stock_level > 0;

-- ============================================================
-- daily_sales_summary_view: Tổng hợp doanh thu hàng ngày
-- ============================================================
CREATE OR REPLACE VIEW daily_sales_summary_view AS
SELECT
  DATE(created_at) AS sale_date,
  COUNT(*) AS order_count,
  SUM(total) AS total_revenue,
  SUM(discount_amount) AS total_discounts,
  SUM(CASE WHEN is_credit = true THEN total ELSE 0 END) AS total_credit,
  SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END) AS cash_revenue,
  SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END) AS transfer_revenue
FROM sales_orders
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;
