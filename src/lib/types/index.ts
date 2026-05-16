// ============================================================
// Hệ thống Quản lý Cửa hàng Điện Nước - TypeScript Interfaces
// ============================================================

// === Product & SKU ===

export interface Product {
  id: string;
  name: string;
  category_id: string;
  brand: string;
  specification: string;
  base_unit: string;
  barcode?: string;
  image_url?: string;
  description?: string;
  selling_price: number;
  price_type: 'fixed' | 'variable';
  weighted_avg_cost: number;
  last_cost: number;
  min_stock_level: number;
  current_stock: number;
  created_at: string;
  updated_at: string;
}

export interface UnitConversion {
  id: string;
  product_id: string;
  from_unit: string;
  to_unit: string;
  conversion_rate: number;
  level: 1 | 2 | 3; // Tối đa 3 cấp quy đổi
}

export interface Category {
  id: string;
  name: string;
  parent_id?: string;
  description?: string;
  image_url?: string;
  created_at: string;
}

export interface PriceHistory {
  id: string;
  product_id: string;
  supplier_id: string;
  unit_cost: number;
  quantity: number;
  receipt_id: string;
  created_at: string;
}

// === POS / Sales ===

export interface SalesOrder {
  id: string;
  order_number: string;
  customer_id?: string;
  items: SalesOrderItem[];
  subtotal: number;
  discount_type?: 'fixed' | 'percentage';
  discount_value?: number;
  discount_amount: number;
  total: number;
  payment_method: 'cash' | 'transfer';
  is_credit: boolean; // Mua nợ
  transporter_id?: string;
  is_third_party_delivery: boolean;
  delivery_time?: string;
  created_by: string;
  created_at: string;
  status: 'completed' | 'returned_partial';
}

export interface SalesOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit: string; // Đơn vị bán (có thể khác đơn vị cơ bản)
  unit_price: number;
  line_total: number;
  returned_quantity: number;
}

// === Inventory ===

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: 'sale' | 'purchase' | 'return' | 'adjustment';
  quantity: number; // Positive for in, negative for out
  unit: string;
  reference_id: string; // Order/Receipt ID
  created_by: string;
  created_at: string;
}

// === Purchasing ===

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  supplier_id: string;
  items: PurchaseOrderItem[];
  status: 'draft' | 'pending' | 'received' | 'partial';
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  received_quantity: number;
  line_total: number;
}

export interface GoodsReceipt {
  id: string;
  purchase_order_id?: string;
  supplier_id: string;
  items: GoodsReceiptItem[];
  promotional_items?: PromotionalItem[];
  defective_items?: DefectiveItem[];
  status: 'confirmed' | 'pending';
  created_by: string;
  created_at: string;
}

export interface GoodsReceiptItem {
  id: string;
  goods_receipt_id: string;
  product_id: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  line_total: number;
}

export interface PromotionalItem {
  id: string;
  goods_receipt_id: string;
  product_id: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface DefectiveItem {
  id: string;
  goods_receipt_id: string;
  product_id: string;
  quantity: number;
  unit: string;
  reason: string;
  status: 'pending_return' | 'returned';
}

// === Customer & Debt ===

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  total_purchased: number;
  purchase_count: number;
  current_debt: number;
  created_at: string;
}

export interface DebtRecord {
  id: string;
  customer_id: string;
  order_id: string;
  amount: number;
  paid_amount: number;
  remaining: number;
  due_date?: string;
  status: 'pending' | 'partial' | 'paid';
  created_at: string;
}

export interface DebtPayment {
  id: string;
  debt_record_id: string;
  amount: number;
  payment_method: 'cash' | 'transfer';
  notes?: string;
  created_by: string;
  created_at: string;
}

// === Supplier Prices ===

export interface SupplierPrice {
  id: string;
  supplier_id: string;
  product_id: string;
  unit_price: number;
  effective_date: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// === Supplier Debt ===

export interface SupplierDebt {
  id: string;
  supplier_id: string;
  goods_receipt_id: string;
  amount: number;
  paid_amount: number;
  remaining: number;
  status: 'pending' | 'partial' | 'paid';
  linked_order_id?: string; // Nợ gối đầu: liên kết đơn cũ với đơn mới
  created_at: string;
}

export interface SupplierPayment {
  id: string;
  supplier_debt_id: string;
  amount: number;
  payment_method: 'cash' | 'transfer';
  notes?: string;
  created_by: string;
  created_at: string;
}

// === Delivery / Transporter ===

export interface Transporter {
  id: string;
  name: string;
  phone: string;
  is_active: boolean;
  created_at: string;
}

// === Auth & User ===

export interface UserProfile {
  id: string;
  phone: string;
  full_name: string;
  role: 'owner' | 'staff';
  max_discount_percent?: number; // Giới hạn giảm giá cho staff
  is_active: boolean;
  created_at: string;
}

// === Notifications ===

export interface Notification {
  id: string;
  user_id: string;
  type: 'low_stock' | 'overdue_debt' | 'order_arrived' | 'price_changed' | 'stale_stock';
  title: string;
  message: string;
  reference_id?: string;
  reference_type?: string;
  is_read: boolean;
  created_at: string;
}

// === Audit Log ===

export interface AuditLog {
  id: string;
  user_id: string;
  action: 'create' | 'update' | 'delete';
  entity_type: string;
  entity_id: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  created_at: string;
}
