-- ============================================================
-- Migration: Initial Schema
-- Description: Tạo tất cả tables cho Hệ thống Quản lý Cửa hàng Điện Nước
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
-- 2. CATEGORIES (hierarchical: nhóm chính/phụ)
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
-- 23. PROMOTIONAL_ITEMS (hàng khuyến mãi kèm theo phiếu nhập)
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
-- 24. DEFECTIVE_ITEMS (hàng lỗi chờ trả NCC)
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
