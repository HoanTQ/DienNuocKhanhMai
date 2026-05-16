-- ============================================================
-- Migration: Initial Schema
-- Description: Táº¡o táº¥t cáº£ tables cho Há»‡ thá»‘ng Quáº£n lÃ½ Cá»­a hÃ ng Äiá»‡n NÆ°á»›c
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- 1. USERS (extends Supabase Auth)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('owner', 'staff')),
  max_discount_percent DECIMAL(5, 2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. CATEGORIES (hierarchical: nhÃ³m chÃ­nh/phá»¥)
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. PRODUCTS
-- ============================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(500) NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  brand VARCHAR(255) NOT NULL,
  specification VARCHAR(500) NOT NULL,
  base_unit VARCHAR(50) NOT NULL,
  barcode VARCHAR(100),
  image_url TEXT,
  description TEXT,
  selling_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
  price_type VARCHAR(10) NOT NULL DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'variable')),
  weighted_avg_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
  last_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
  current_stock DECIMAL(15, 3) NOT NULL DEFAULT 0,
  min_stock_level DECIMAL(15, 3) NOT NULL DEFAULT 0,
  last_stocked_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. UNIT_CONVERSIONS
-- ============================================================
CREATE TABLE unit_conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  from_unit VARCHAR(50) NOT NULL,
  to_unit VARCHAR(50) NOT NULL,
  conversion_rate DECIMAL(15, 6) NOT NULL CHECK (conversion_rate > 0),
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, from_unit, to_unit)
);

-- ============================================================
-- 5. CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  notes TEXT,
  total_purchased DECIMAL(15, 2) NOT NULL DEFAULT 0,
  purchase_count INTEGER NOT NULL DEFAULT 0,
  current_debt DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. TRANSPORTERS
-- ============================================================
CREATE TABLE transporters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. SALES_ORDERS
-- ============================================================
CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  transporter_id UUID REFERENCES transporters(id) ON DELETE SET NULL,
  subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
  discount_type VARCHAR(10) CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value DECIMAL(15, 2) DEFAULT 0,
  discount_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total DECIMAL(15, 2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(10) NOT NULL CHECK (payment_method IN ('cash', 'transfer')),
  is_credit BOOLEAN NOT NULL DEFAULT false,
  is_third_party_delivery BOOLEAN NOT NULL DEFAULT false,
  delivery_time TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'returned_partial')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. SALES_ORDER_ITEMS
-- ============================================================
CREATE TABLE sales_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(50) NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL CHECK (unit_price >= 0),
  line_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
  returned_quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. DEBT_RECORDS
-- ============================================================
CREATE TABLE debt_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  paid_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  remaining DECIMAL(15, 2) NOT NULL,
  due_date TIMESTAMPTZ,
  status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. DEBT_PAYMENTS
-- ============================================================
CREATE TABLE debt_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debt_record_id UUID NOT NULL REFERENCES debt_records(id) ON DELETE RESTRICT,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(10) NOT NULL CHECK (payment_method IN ('cash', 'transfer')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. SUPPLIERS
-- ============================================================
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 12. SUPPLIER_PRICES
-- ============================================================
CREATE TABLE supplier_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_price DECIMAL(15, 2) NOT NULL CHECK (unit_price >= 0),
  effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(supplier_id, product_id, effective_date)
);

-- ============================================================
-- 13. PURCHASE_ORDERS
-- ============================================================
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'received', 'partial')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 14. PURCHASE_ORDER_ITEMS
-- ============================================================
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(50) NOT NULL,
  unit_price DECIMAL(15, 2) DEFAULT 0,
  received_quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 15. GOODS_RECEIPTS
-- ============================================================
CREATE TABLE goods_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number VARCHAR(50) NOT NULL UNIQUE,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('confirmed', 'pending')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 16. GOODS_RECEIPT_ITEMS
-- ============================================================
CREATE TABLE goods_receipt_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(50) NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL CHECK (unit_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 17. STOCK_MOVEMENTS
-- ============================================================
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  movement_type VARCHAR(15) NOT NULL CHECK (movement_type IN ('sale', 'purchase', 'return', 'adjustment')),
  quantity DECIMAL(15, 3) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  reference_id UUID,
  reference_type VARCHAR(50),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 18. PRICE_HISTORY
-- ============================================================
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  unit_price DECIMAL(15, 2) NOT NULL,
  quantity DECIMAL(15, 3),
  goods_receipt_id UUID REFERENCES goods_receipts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 19. NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('low_stock', 'overdue_debt', 'order_arrived', 'price_changed', 'stale_stock')),
  title VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  reference_id UUID,
  reference_type VARCHAR(50),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 20. AUDIT_LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action VARCHAR(10) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  changes JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 21. SUPPLIER_DEBTS
-- ============================================================
CREATE TABLE supplier_debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE RESTRICT,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  paid_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  remaining DECIMAL(15, 2) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
  linked_purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 22. SUPPLIER_PAYMENTS
-- ============================================================
CREATE TABLE supplier_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_debt_id UUID NOT NULL REFERENCES supplier_debts(id) ON DELETE RESTRICT,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(10) NOT NULL CHECK (payment_method IN ('cash', 'transfer')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 23. PROMOTIONAL_ITEMS (hÃ ng khuyáº¿n mÃ£i kÃ¨m theo phiáº¿u nháº­p)
-- ============================================================
CREATE TABLE promotional_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 24. DEFECTIVE_ITEMS (hÃ ng lá»—i chá» tráº£ NCC)
-- ============================================================
CREATE TABLE defective_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goods_receipt_id UUID REFERENCES goods_receipts(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(50) NOT NULL,
  reason TEXT,
  status VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'returned', 'resolved')),
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- ============================================================
-- Migration: Indexes
-- Description: Táº¡o indexes cho performance optimization
-- Bao gá»“m: barcode lookup, trigram search, FTS tiáº¿ng Viá»‡t, composite indexes
-- ============================================================

-- ============================================================
-- PRODUCTS INDEXES
-- ============================================================

-- Barcode lookup (< 1s requirement)
CREATE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- Trigram index cho fuzzy search tÃªn sáº£n pháº©m
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

-- Brand filter
CREATE INDEX idx_products_brand ON products(brand);

-- Category filter
CREATE INDEX idx_products_category ON products(category_id);

-- Composite index cho tra cá»©u nhanh (name + brand + specification)
CREATE INDEX idx_products_search ON products(name, brand, specification);

-- Full-text search cho tiáº¿ng Viá»‡t (sá»­ dá»¥ng 'simple' config vÃ¬ tiáº¿ng Viá»‡t khÃ´ng cÃ³ stemmer máº·c Ä‘á»‹nh)
CREATE INDEX idx_products_fts ON products USING gin(
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(specification, ''))
);

-- Active products filter
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;

-- Low stock alert check
CREATE INDEX idx_products_low_stock ON products(current_stock, min_stock_level) 
  WHERE current_stock <= min_stock_level AND is_active = true;

-- ============================================================
-- SALES_ORDERS INDEXES
-- ============================================================

-- Date-based queries for reports
CREATE INDEX idx_sales_orders_date ON sales_orders(created_at);

-- Customer orders lookup
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id) WHERE customer_id IS NOT NULL;

-- Created by (user's orders)
CREATE INDEX idx_sales_orders_created_by ON sales_orders(created_by);

-- Order number lookup
CREATE INDEX idx_sales_orders_number ON sales_orders(order_number);

-- Transporter lookup
CREATE INDEX idx_sales_orders_transporter ON sales_orders(transporter_id) WHERE transporter_id IS NOT NULL;

-- ============================================================
-- SALES_ORDER_ITEMS INDEXES
-- ============================================================

-- Order items lookup
CREATE INDEX idx_sales_order_items_order ON sales_order_items(order_id);

-- Product sales history
CREATE INDEX idx_sales_order_items_product ON sales_order_items(product_id);

-- ============================================================
-- STOCK_MOVEMENTS INDEXES
-- ============================================================

-- Product + date for stock history
CREATE INDEX idx_stock_movements_product_date ON stock_movements(product_id, created_at);

-- Movement type filter
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);

-- Reference lookup
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_id) WHERE reference_id IS NOT NULL;

-- ============================================================
-- DEBT_RECORDS INDEXES
-- ============================================================

-- Customer + status for debt management
CREATE INDEX idx_debt_records_customer_status ON debt_records(customer_id, status);

-- Overdue debts (for notifications)
CREATE INDEX idx_debt_records_due_date ON debt_records(due_date) WHERE status != 'paid';

-- ============================================================
-- CUSTOMERS INDEXES
-- ============================================================

-- Phone search
CREATE INDEX idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;

-- Name search (trigram)
CREATE INDEX idx_customers_name_trgm ON customers USING gin(name gin_trgm_ops);

-- ============================================================
-- SUPPLIERS INDEXES
-- ============================================================

-- Supplier name search
CREATE INDEX idx_suppliers_name ON suppliers(name);

-- ============================================================
-- SUPPLIER_PRICES INDEXES
-- ============================================================

-- Product price comparison across suppliers
CREATE INDEX idx_supplier_prices_product ON supplier_prices(product_id);

-- Supplier's price list
CREATE INDEX idx_supplier_prices_supplier ON supplier_prices(supplier_id);

-- ============================================================
-- PURCHASE_ORDERS INDEXES
-- ============================================================

-- Supplier orders
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);

-- Status filter (pending orders check)
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status) WHERE status IN ('draft', 'pending');

-- ============================================================
-- GOODS_RECEIPTS INDEXES
-- ============================================================

-- Supplier receipts
CREATE INDEX idx_goods_receipts_supplier ON goods_receipts(supplier_id);

-- Date-based queries
CREATE INDEX idx_goods_receipts_date ON goods_receipts(created_at);

-- ============================================================
-- PRICE_HISTORY INDEXES
-- ============================================================

-- Product price history (chronological)
CREATE INDEX idx_price_history_product_date ON price_history(product_id, created_at);

-- ============================================================
-- NOTIFICATIONS INDEXES
-- ============================================================

-- User's unread notifications
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Type filter
CREATE INDEX idx_notifications_type ON notifications(type);

-- ============================================================
-- AUDIT_LOGS INDEXES
-- ============================================================

-- Date-based queries (recent activity)
CREATE INDEX idx_audit_logs_date ON audit_logs(created_at);

-- Entity lookup
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- User activity
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);

-- ============================================================
-- SUPPLIER_DEBTS INDEXES
-- ============================================================

-- Supplier debt status
CREATE INDEX idx_supplier_debts_supplier_status ON supplier_debts(supplier_id, status);

-- ============================================================
-- CATEGORIES INDEXES
-- ============================================================

-- Parent category lookup (hierarchical)
CREATE INDEX idx_categories_parent ON categories(parent_id) WHERE parent_id IS NOT NULL;

-- ============================================================
-- DEFECTIVE_ITEMS INDEXES
-- ============================================================

-- Pending defective items (chá» tráº£ NCC)
CREATE INDEX idx_defective_items_status ON defective_items(status) WHERE status = 'pending';
-- ============================================================
-- Migration: Row Level Security Policies
-- Description: PhÃ¢n quyá»n Owner (full access) vÃ  Staff (restricted access)
-- Owner: toÃ n quyá»n trÃªn táº¥t cáº£ tables
-- Staff: read-only háº§u háº¿t tables, cÃ³ thá»ƒ táº¡o sales_orders vÃ  stock_movements
-- Staff KHÃ”NG tháº¥y: weighted_avg_cost, last_cost (dÃ¹ng products_staff_view)
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
-- ============================================================
-- Migration: Triggers and Functions
-- Description: Database triggers cho:
-- 1. Stock updates khi bÃ¡n hÃ ng (sales_order_items)
-- 2. Stock updates + WAC recalculation khi nháº­p hÃ ng (goods_receipt_items)
-- 3. Audit logging cho important operations
-- 4. Updated_at auto-update
-- ============================================================

-- ============================================================
-- HELPER: Auto-update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at column
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_unit_conversions_updated_at
  BEFORE UPDATE ON unit_conversions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_transporters_updated_at
  BEFORE UPDATE ON transporters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_sales_orders_updated_at
  BEFORE UPDATE ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_debt_records_updated_at
  BEFORE UPDATE ON debt_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_supplier_prices_updated_at
  BEFORE UPDATE ON supplier_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_goods_receipts_updated_at
  BEFORE UPDATE ON goods_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_supplier_debts_updated_at
  BEFORE UPDATE ON supplier_debts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_defective_items_updated_at
  BEFORE UPDATE ON defective_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER 1: Decrease stock after sale (sales_order_items INSERT)
-- ============================================================
CREATE OR REPLACE FUNCTION handle_sale_stock_decrease()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrease product current_stock by sold quantity
  UPDATE products
  SET current_stock = current_stock - NEW.quantity
  WHERE id = NEW.product_id;

  -- Create stock movement record
  INSERT INTO stock_movements (product_id, movement_type, quantity, unit, reference_id, reference_type, created_by)
  SELECT
    NEW.product_id,
    'sale',
    -NEW.quantity,
    NEW.unit,
    NEW.order_id,
    'sales_order',
    so.created_by
  FROM sales_orders so
  WHERE so.id = NEW.order_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sale_stock_decrease
  AFTER INSERT ON sales_order_items
  FOR EACH ROW
  EXECUTE FUNCTION handle_sale_stock_decrease();

-- ============================================================
-- TRIGGER 2: Increase stock + recalculate WAC after goods receipt
-- (goods_receipt_items INSERT when receipt is confirmed)
-- ============================================================
CREATE OR REPLACE FUNCTION handle_receipt_stock_increase()
RETURNS TRIGGER AS $$
DECLARE
  v_current_stock DECIMAL(15, 3);
  v_current_wac DECIMAL(15, 2);
  v_new_wac DECIMAL(15, 2);
  v_receipt_status VARCHAR(10);
  v_supplier_id UUID;
  v_created_by UUID;
BEGIN
  -- Only process if the parent goods_receipt is confirmed
  SELECT gr.status, gr.supplier_id, gr.created_by
  INTO v_receipt_status, v_supplier_id, v_created_by
  FROM goods_receipts gr
  WHERE gr.id = NEW.goods_receipt_id;

  IF v_receipt_status = 'confirmed' THEN
    -- Get current stock and WAC
    SELECT current_stock, weighted_avg_cost
    INTO v_current_stock, v_current_wac
    FROM products
    WHERE id = NEW.product_id;

    -- Calculate new WAC: (current_stock * current_wac + new_qty * new_price) / (current_stock + new_qty)
    IF v_current_stock + NEW.quantity > 0 THEN
      v_new_wac := (v_current_stock * v_current_wac + NEW.quantity * NEW.unit_price) / (v_current_stock + NEW.quantity);
    ELSE
      v_new_wac := NEW.unit_price;
    END IF;

    -- Update product: increase stock, update WAC, update last_cost, update last_stocked_at
    UPDATE products
    SET
      current_stock = current_stock + NEW.quantity,
      weighted_avg_cost = v_new_wac,
      last_cost = NEW.unit_price,
      last_stocked_at = NOW()
    WHERE id = NEW.product_id;

    -- Create stock movement record
    INSERT INTO stock_movements (product_id, movement_type, quantity, unit, reference_id, reference_type, created_by)
    VALUES (NEW.product_id, 'purchase', NEW.quantity, NEW.unit, NEW.goods_receipt_id, 'goods_receipt', v_created_by);

    -- Create price history record
    INSERT INTO price_history (product_id, supplier_id, unit_price, quantity, goods_receipt_id)
    VALUES (NEW.product_id, v_supplier_id, NEW.unit_price, NEW.quantity, NEW.goods_receipt_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_receipt_stock_increase
  AFTER INSERT ON goods_receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION handle_receipt_stock_increase();

-- ============================================================
-- TRIGGER 2b: Handle goods_receipt status change to 'confirmed'
-- Process all items when receipt is confirmed after items are added
-- ============================================================
CREATE OR REPLACE FUNCTION handle_receipt_confirmation()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_current_stock DECIMAL(15, 3);
  v_current_wac DECIMAL(15, 2);
  v_new_wac DECIMAL(15, 2);
BEGIN
  -- Only trigger when status changes to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    -- Process each item in the receipt
    FOR v_item IN
      SELECT * FROM goods_receipt_items WHERE goods_receipt_id = NEW.id
    LOOP
      -- Get current stock and WAC
      SELECT current_stock, weighted_avg_cost
      INTO v_current_stock, v_current_wac
      FROM products
      WHERE id = v_item.product_id;

      -- Calculate new WAC
      IF v_current_stock + v_item.quantity > 0 THEN
        v_new_wac := (v_current_stock * v_current_wac + v_item.quantity * v_item.unit_price) / (v_current_stock + v_item.quantity);
      ELSE
        v_new_wac := v_item.unit_price;
      END IF;

      -- Update product
      UPDATE products
      SET
        current_stock = current_stock + v_item.quantity,
        weighted_avg_cost = v_new_wac,
        last_cost = v_item.unit_price,
        last_stocked_at = NOW()
      WHERE id = v_item.product_id;

      -- Create stock movement
      INSERT INTO stock_movements (product_id, movement_type, quantity, unit, reference_id, reference_type, created_by)
      VALUES (v_item.product_id, 'purchase', v_item.quantity, v_item.unit, NEW.id, 'goods_receipt', NEW.created_by);

      -- Create price history
      INSERT INTO price_history (product_id, supplier_id, unit_price, quantity, goods_receipt_id)
      VALUES (v_item.product_id, NEW.supplier_id, v_item.unit_price, v_item.quantity, NEW.id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_receipt_confirmation
  AFTER UPDATE ON goods_receipts
  FOR EACH ROW
  EXECUTE FUNCTION handle_receipt_confirmation();

-- ============================================================
-- TRIGGER 3: Audit logging for important operations
-- ============================================================

-- 3a. Audit log for sales_orders
CREATE OR REPLACE FUNCTION audit_sales_orders()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
    VALUES (NEW.created_by, 'create', 'sales_order', NEW.id, 
      jsonb_build_object('new', row_to_json(NEW)::jsonb));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
    VALUES (COALESCE(auth.uid(), NEW.created_by), 'update', 'sales_order', NEW.id,
      jsonb_build_object('old', row_to_json(OLD)::jsonb, 'new', row_to_json(NEW)::jsonb));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
    VALUES (COALESCE(auth.uid(), OLD.created_by), 'delete', 'sales_order', OLD.id,
      jsonb_build_object('old', row_to_json(OLD)::jsonb));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_sales_orders
  AFTER INSERT OR UPDATE OR DELETE ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION audit_sales_orders();

-- 3b. Audit log for products (price changes, deletion)
CREATE OR REPLACE FUNCTION audit_products()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Only log if important fields changed (price, stock adjustment)
    IF OLD.selling_price != NEW.selling_price 
       OR OLD.weighted_avg_cost != NEW.weighted_avg_cost
       OR OLD.is_active != NEW.is_active THEN
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
      VALUES (COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'update', 'product', NEW.id,
        jsonb_build_object(
          'old', jsonb_build_object(
            'selling_price', OLD.selling_price,
            'weighted_avg_cost', OLD.weighted_avg_cost,
            'current_stock', OLD.current_stock,
            'is_active', OLD.is_active
          ),
          'new', jsonb_build_object(
            'selling_price', NEW.selling_price,
            'weighted_avg_cost', NEW.weighted_avg_cost,
            'current_stock', NEW.current_stock,
            'is_active', NEW.is_active
          )
        ));
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
    VALUES (COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'delete', 'product', OLD.id,
      jsonb_build_object('old', row_to_json(OLD)::jsonb));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_products
  AFTER UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION audit_products();

-- 3c. Audit log for stock adjustments (manual adjustments via stock_movements)
CREATE OR REPLACE FUNCTION audit_stock_adjustments()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'adjustment' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
    VALUES (NEW.created_by, 'update', 'stock_adjustment', NEW.product_id,
      jsonb_build_object(
        'movement_id', NEW.id,
        'quantity', NEW.quantity,
        'notes', NEW.notes
      ));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_stock_adjustments
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION audit_stock_adjustments();

-- ============================================================
-- TRIGGER 4: Update customer stats after sale
-- ============================================================
CREATE OR REPLACE FUNCTION update_customer_stats_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE customers
    SET
      total_purchased = total_purchased + NEW.total,
      purchase_count = purchase_count + 1
    WHERE id = NEW.customer_id;

    -- If credit sale, update customer debt
    IF NEW.is_credit = true THEN
      UPDATE customers
      SET current_debt = current_debt + NEW.total
      WHERE id = NEW.customer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_customer_stats
  AFTER INSERT ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION update_customer_stats_on_sale();

-- ============================================================
-- TRIGGER 5: Update debt record on payment
-- ============================================================
CREATE OR REPLACE FUNCTION update_debt_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_debt_remaining DECIMAL(15, 2);
  v_customer_id UUID;
BEGIN
  -- Update debt record
  UPDATE debt_records
  SET
    paid_amount = paid_amount + NEW.amount,
    remaining = remaining - NEW.amount,
    status = CASE
      WHEN remaining - NEW.amount <= 0 THEN 'paid'
      ELSE 'partial'
    END
  WHERE id = NEW.debt_record_id
  RETURNING remaining, customer_id INTO v_debt_remaining, v_customer_id;

  -- Update customer current_debt
  UPDATE customers
  SET current_debt = current_debt - NEW.amount
  WHERE id = v_customer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_debt_on_payment
  AFTER INSERT ON debt_payments
  FOR EACH ROW EXECUTE FUNCTION update_debt_on_payment();

-- ============================================================
-- TRIGGER 6: Update supplier debt on payment
-- ============================================================
CREATE OR REPLACE FUNCTION update_supplier_debt_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE supplier_debts
  SET
    paid_amount = paid_amount + NEW.amount,
    remaining = remaining - NEW.amount,
    status = CASE
      WHEN remaining - NEW.amount <= 0 THEN 'paid'
      ELSE 'partial'
    END
  WHERE id = NEW.supplier_debt_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_supplier_debt_on_payment
  AFTER INSERT ON supplier_payments
  FOR EACH ROW EXECUTE FUNCTION update_supplier_debt_on_payment();
-- ============================================================
-- Migration: Views
-- Description: Táº¡o views cho phÃ¢n quyá»n vÃ  tiá»‡n Ã­ch truy váº¥n
-- ============================================================

-- ============================================================
-- products_staff_view: áº¨n giÃ¡ vá»‘n cho staff
-- Staff sá»­ dá»¥ng view nÃ y thay vÃ¬ truy cáº­p trá»±c tiáº¿p báº£ng products
-- áº¨n: weighted_avg_cost, last_cost
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
-- debt_summary_view: Tá»•ng há»£p cÃ´ng ná»£ khÃ¡ch hÃ ng vá»›i tuá»•i ná»£
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
-- inventory_alert_view: Sáº£n pháº©m tá»“n kho tháº¥p
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
-- daily_sales_summary_view: Tá»•ng há»£p doanh thu hÃ ng ngÃ y
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
