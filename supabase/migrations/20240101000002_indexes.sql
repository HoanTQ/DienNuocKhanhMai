-- ============================================================
-- Migration: Indexes
-- Description: Tạo indexes cho performance optimization
-- Bao gồm: barcode lookup, trigram search, FTS tiếng Việt, composite indexes
-- ============================================================

-- ============================================================
-- PRODUCTS INDEXES
-- ============================================================

-- Barcode lookup (< 1s requirement)
CREATE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- Trigram index cho fuzzy search tên sản phẩm
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

-- Brand filter
CREATE INDEX idx_products_brand ON products(brand);

-- Category filter
CREATE INDEX idx_products_category ON products(category_id);

-- Composite index cho tra cứu nhanh (name + brand + specification)
CREATE INDEX idx_products_search ON products(name, brand, specification);

-- Full-text search cho tiếng Việt (sử dụng 'simple' config vì tiếng Việt không có stemmer mặc định)
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

-- Pending defective items (chờ trả NCC)
CREATE INDEX idx_defective_items_status ON defective_items(status) WHERE status = 'pending';
