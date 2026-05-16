-- ============================================================
-- Migration: Row Level Security Policies
-- Description: Phân quyền Owner (full access) và Staff (restricted access)
-- Owner: toàn quyền trên tất cả tables
-- Staff: read-only hầu hết tables, có thể tạo sales_orders và stock_movements
-- Staff KHÔNG thấy: weighted_avg_cost, last_cost (dùng products_staff_view)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE transporters ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotional_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE defective_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper function: get current user role
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- USERS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "users_owner_all" ON users
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: can read own profile only
CREATE POLICY "users_staff_select_own" ON users
  FOR SELECT USING (get_user_role() = 'staff' AND id = auth.uid());

-- ============================================================
-- CATEGORIES TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "categories_owner_all" ON categories
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: read only
CREATE POLICY "categories_staff_select" ON categories
  FOR SELECT USING (get_user_role() = 'staff');

-- ============================================================
-- PRODUCTS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "products_owner_all" ON products
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: read only (note: staff should use products_staff_view to hide cost columns)
CREATE POLICY "products_staff_select" ON products
  FOR SELECT USING (get_user_role() = 'staff');

-- ============================================================
-- UNIT_CONVERSIONS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "unit_conversions_owner_all" ON unit_conversions
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: read only
CREATE POLICY "unit_conversions_staff_select" ON unit_conversions
  FOR SELECT USING (get_user_role() = 'staff');

-- ============================================================
-- SALES_ORDERS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "sales_orders_owner_all" ON sales_orders
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: can read all orders and create new orders
CREATE POLICY "sales_orders_staff_select" ON sales_orders
  FOR SELECT USING (get_user_role() = 'staff');

CREATE POLICY "sales_orders_staff_insert" ON sales_orders
  FOR INSERT WITH CHECK (get_user_role() = 'staff' AND created_by = auth.uid());

-- ============================================================
-- SALES_ORDER_ITEMS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "sales_order_items_owner_all" ON sales_order_items
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: can read and create items (linked to their orders)
CREATE POLICY "sales_order_items_staff_select" ON sales_order_items
  FOR SELECT USING (get_user_role() = 'staff');

CREATE POLICY "sales_order_items_staff_insert" ON sales_order_items
  FOR INSERT WITH CHECK (get_user_role() = 'staff');

-- ============================================================
-- CUSTOMERS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "customers_owner_all" ON customers
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: read only (cannot edit customer info)
CREATE POLICY "customers_staff_select" ON customers
  FOR SELECT USING (get_user_role() = 'staff');

-- ============================================================
-- DEBT_RECORDS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "debt_records_owner_all" ON debt_records
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: NO access (debt management restricted to owner)

-- ============================================================
-- DEBT_PAYMENTS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "debt_payments_owner_all" ON debt_payments
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: NO access

-- ============================================================
-- SUPPLIERS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "suppliers_owner_all" ON suppliers
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: NO access (supplier management restricted to owner)

-- ============================================================
-- SUPPLIER_PRICES TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "supplier_prices_owner_all" ON supplier_prices
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: NO access

-- ============================================================
-- PURCHASE_ORDERS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "purchase_orders_owner_all" ON purchase_orders
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: NO access

-- ============================================================
-- PURCHASE_ORDER_ITEMS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "purchase_order_items_owner_all" ON purchase_order_items
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: NO access

-- ============================================================
-- GOODS_RECEIPTS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "goods_receipts_owner_all" ON goods_receipts
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: NO access

-- ============================================================
-- GOODS_RECEIPT_ITEMS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "goods_receipt_items_owner_all" ON goods_receipt_items
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: NO access

-- ============================================================
-- STOCK_MOVEMENTS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "stock_movements_owner_all" ON stock_movements
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: can read and create stock movements (for sales)
CREATE POLICY "stock_movements_staff_select" ON stock_movements
  FOR SELECT USING (get_user_role() = 'staff');

CREATE POLICY "stock_movements_staff_insert" ON stock_movements
  FOR INSERT WITH CHECK (get_user_role() = 'staff' AND created_by = auth.uid());

-- ============================================================
-- PRICE_HISTORY TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "price_history_owner_all" ON price_history
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: NO access (price history contains cost info)

-- ============================================================
-- TRANSPORTERS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "transporters_owner_all" ON transporters
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: read only
CREATE POLICY "transporters_staff_select" ON transporters
  FOR SELECT USING (get_user_role() = 'staff');

-- ============================================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================================

-- Owner: full access to own notifications
CREATE POLICY "notifications_owner_all" ON notifications
  FOR ALL USING (get_user_role() = 'owner' AND user_id = auth.uid());

-- Staff: read own notifications
CREATE POLICY "notifications_staff_select" ON notifications
  FOR SELECT USING (get_user_role() = 'staff' AND user_id = auth.uid());

CREATE POLICY "notifications_staff_update" ON notifications
  FOR UPDATE USING (get_user_role() = 'staff' AND user_id = auth.uid());

-- ============================================================
-- AUDIT_LOGS TABLE POLICIES
-- ============================================================

-- Owner: read only (audit logs are immutable, created by triggers)
CREATE POLICY "audit_logs_owner_select" ON audit_logs
  FOR SELECT USING (get_user_role() = 'owner');

-- Staff: NO access (audit log restricted to owner)

-- System insert (via triggers using SECURITY DEFINER functions)
CREATE POLICY "audit_logs_system_insert" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- SUPPLIER_DEBTS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "supplier_debts_owner_all" ON supplier_debts
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: NO access

-- ============================================================
-- SUPPLIER_PAYMENTS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "supplier_payments_owner_all" ON supplier_payments
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: NO access

-- ============================================================
-- PROMOTIONAL_ITEMS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "promotional_items_owner_all" ON promotional_items
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: NO access

-- ============================================================
-- DEFECTIVE_ITEMS TABLE POLICIES
-- ============================================================

-- Owner: full access
CREATE POLICY "defective_items_owner_all" ON defective_items
  FOR ALL USING (get_user_role() = 'owner');

-- Staff: read only
CREATE POLICY "defective_items_staff_select" ON defective_items
  FOR SELECT USING (get_user_role() = 'staff');
