-- ============================================================
-- Thêm role 'sales' — chỉ được dùng Bán hàng (POS) và Báo giá.
--
-- Sales là role bị giới hạn chặt nhất:
--   - Được: tạo đơn bán hàng, đọc sản phẩm/khách/danh mục để bán & báo giá.
--   - Không được: công nợ, nhà cung cấp, nhập hàng, báo cáo, cài đặt, nhật ký...
--     (mặc định deny — không tạo policy nào thì không truy cập được).
--
-- Allow-list route (middleware): /pos, /quotation, /notifications.
-- ============================================================

-- 1. Cho phép giá trị 'sales' trong cột role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('owner', 'staff', 'sales'));

-- ============================================================
-- 2. RLS policies cho role 'sales' (mirror các quyền staff cần cho POS + Báo giá)
-- ============================================================

-- USERS: đọc profile của chính mình
CREATE POLICY "users_sales_select_own" ON users
  FOR SELECT USING (get_user_role() = 'sales' AND id = auth.uid());

-- CATEGORIES: read only (để lọc/hiển thị sản phẩm)
CREATE POLICY "categories_sales_select" ON categories
  FOR SELECT USING (get_user_role() = 'sales');

-- PRODUCTS: read only (nên dùng products_staff_view để ẩn giá vốn)
CREATE POLICY "products_sales_select" ON products
  FOR SELECT USING (get_user_role() = 'sales');

-- UNIT_CONVERSIONS: read only (quy đổi đơn vị khi bán)
CREATE POLICY "unit_conversions_sales_select" ON unit_conversions
  FOR SELECT USING (get_user_role() = 'sales');

-- SALES_ORDERS: đọc tất cả đơn + tạo đơn mới
CREATE POLICY "sales_orders_sales_select" ON sales_orders
  FOR SELECT USING (get_user_role() = 'sales');

CREATE POLICY "sales_orders_sales_insert" ON sales_orders
  FOR INSERT WITH CHECK (get_user_role() = 'sales' AND created_by = auth.uid());

-- SALES_ORDER_ITEMS: đọc + tạo chi tiết đơn
CREATE POLICY "sales_order_items_sales_select" ON sales_order_items
  FOR SELECT USING (get_user_role() = 'sales');

CREATE POLICY "sales_order_items_sales_insert" ON sales_order_items
  FOR INSERT WITH CHECK (get_user_role() = 'sales');

-- CUSTOMERS: read only (chọn khách khi bán/báo giá, không sửa thông tin)
CREATE POLICY "customers_sales_select" ON customers
  FOR SELECT USING (get_user_role() = 'sales');

-- STOCK_MOVEMENTS: đọc + tạo (trigger trừ tồn kho khi bán)
CREATE POLICY "stock_movements_sales_select" ON stock_movements
  FOR SELECT USING (get_user_role() = 'sales');

CREATE POLICY "stock_movements_sales_insert" ON stock_movements
  FOR INSERT WITH CHECK (get_user_role() = 'sales' AND created_by = auth.uid());

-- NOTIFICATIONS: đọc + cập nhật thông báo của chính mình (chuông header)
CREATE POLICY "notifications_sales_select" ON notifications
  FOR SELECT USING (get_user_role() = 'sales' AND user_id = auth.uid());

CREATE POLICY "notifications_sales_update" ON notifications
  FOR UPDATE USING (get_user_role() = 'sales' AND user_id = auth.uid());

-- Lưu ý: Không tạo policy cho debt_records, debt_payments, suppliers,
-- supplier_prices, purchase_orders, purchase_order_items, goods_receipts,
-- goods_receipt_items, price_history, transporters, audit_logs,
-- supplier_debts, supplier_payments, promotional_items, defective_items.
-- => role 'sales' KHÔNG truy cập được các bảng này (mặc định deny).
