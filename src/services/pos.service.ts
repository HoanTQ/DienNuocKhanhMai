import { createClient } from '@/lib/supabase/client';
import { calculateLineTotal, calculateDiscount } from '@/services/pricing.service';
import type { Product, SalesOrder, SalesOrderItem, DebtRecord } from '@/lib/types';

/**
 * POS Service - Quản lý bán hàng tại quầy
 *
 * Cung cấp logic nghiệp vụ cho:
 * 1. Tạo đơn bán hàng (createOrder)
 * 2. Thêm sản phẩm vào giỏ hàng (addItemToCart) - pure function
 * 3. Xóa sản phẩm khỏi giỏ hàng (removeItemFromCart) - pure function
 * 4. Áp dụng giảm giá với kiểm tra giới hạn (applyDiscount) - pure function
 *
 * Lưu ý: Stock updates được xử lý bởi database trigger (trg_sale_stock_decrease)
 * khi INSERT vào sales_order_items, nên service không cần gọi updateStock thủ công.
 *
 * Validates: Requirements 3.1, 3.3, 3.4, 3.5, 3.6, 3.7
 */

// === Types ===

export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  brand?: string;
  specification?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

export interface CreateOrderParams {
  items: CartItem[];
  customerId?: string;
  paymentMethod: 'cash' | 'transfer';
  isCredit: boolean;
  discountType?: 'fixed' | 'percentage';
  discountValue?: number;
  createdBy: string;
}

export interface CreateOrderResult {
  success: boolean;
  order: SalesOrder | null;
  debtRecord: DebtRecord | null;
  error?: string;
}

export interface ApplyDiscountResult {
  allowed: boolean;
  discountAmount: number;
  total: number;
  error?: string;
}

// === Pure Functions ===

/**
 * Thêm sản phẩm vào giỏ hàng.
 *
 * Tính line_total = quantity × unit_price sử dụng pricing service.
 * Nếu sản phẩm đã có trong giỏ (cùng product_id và unit), cộng dồn quantity.
 *
 * @param currentItems - Danh sách items hiện tại trong giỏ
 * @param product - Sản phẩm cần thêm
 * @param quantity - Số lượng
 * @param unit - Đơn vị bán
 * @returns Danh sách items mới sau khi thêm
 * @throws Error nếu quantity <= 0 hoặc product thiếu thông tin
 *
 * Validates: Requirements 3.1, 3.3
 */
export function addItemToCart(
  currentItems: CartItem[],
  product: Pick<Product, 'id' | 'name' | 'selling_price' | 'brand' | 'specification'>,
  quantity: number,
  unit: string
): CartItem[] {
  if (quantity <= 0) {
    throw new Error('quantity phải là số dương lớn hơn 0');
  }
  if (!product.id || !product.id.trim()) {
    throw new Error('product.id không được để trống');
  }
  if (!unit || !unit.trim()) {
    throw new Error('unit không được để trống');
  }
  if (product.selling_price < 0) {
    throw new Error('selling_price không được là số âm');
  }

  // Check if product already exists in cart with same unit
  const existingIndex = currentItems.findIndex(
    (item) => item.product_id === product.id && item.unit === unit
  );

  if (existingIndex >= 0) {
    // Update existing item: increase quantity and recalculate line_total
    const updatedItems = [...currentItems];
    const existingItem = updatedItems[existingIndex];
    const newQuantity = existingItem.quantity + quantity;
    const newLineTotal = calculateLineTotal(newQuantity, existingItem.unit_price);

    updatedItems[existingIndex] = {
      ...existingItem,
      quantity: newQuantity,
      line_total: newLineTotal,
    };

    return updatedItems;
  }

  // Add new item
  const lineTotal = calculateLineTotal(quantity, product.selling_price);
  const newItem: CartItem = {
    id: generateCartItemId(),
    product_id: product.id,
    product_name: product.name,
    brand: product.brand,
    specification: product.specification,
    quantity,
    unit,
    unit_price: product.selling_price,
    line_total: lineTotal,
  };

  return [...currentItems, newItem];
}

/**
 * Xóa sản phẩm khỏi giỏ hàng theo itemId.
 *
 * @param currentItems - Danh sách items hiện tại trong giỏ
 * @param itemId - ID của item cần xóa
 * @returns Danh sách items mới sau khi xóa
 * @throws Error nếu itemId trống hoặc không tìm thấy item
 *
 * Validates: Requirements 3.4
 */
export function removeItemFromCart(
  currentItems: CartItem[],
  itemId: string
): CartItem[] {
  if (!itemId || !itemId.trim()) {
    throw new Error('itemId không được để trống');
  }

  const itemExists = currentItems.some((item) => item.id === itemId);
  if (!itemExists) {
    throw new Error(`Không tìm thấy item với id: ${itemId}`);
  }

  return currentItems.filter((item) => item.id !== itemId);
}

/**
 * Áp dụng giảm giá trên tổng đơn hàng với kiểm tra giới hạn cho staff.
 *
 * - Kiểm tra discount không vượt quá userMaxDiscount (phần trăm tối đa cho staff)
 * - Tính discount_amount sử dụng pricing service
 * - Trả về total = subtotal - discount_amount
 *
 * @param subtotal - Tổng tiền trước giảm giá
 * @param discountType - Loại giảm giá ('fixed' hoặc 'percentage')
 * @param discountValue - Giá trị giảm giá
 * @param userMaxDiscount - Phần trăm giảm giá tối đa cho user (undefined = không giới hạn, tức owner)
 * @returns ApplyDiscountResult với allowed, discountAmount, total
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 */
export function applyDiscount(
  subtotal: number,
  discountType: 'fixed' | 'percentage',
  discountValue: number,
  userMaxDiscount?: number
): ApplyDiscountResult {
  if (subtotal < 0) {
    throw new Error('subtotal không được là số âm');
  }
  if (discountValue < 0) {
    throw new Error('discountValue không được là số âm');
  }

  // Check staff discount limit
  if (userMaxDiscount !== undefined) {
    let effectivePercentage: number;

    if (discountType === 'percentage') {
      effectivePercentage = discountValue;
    } else {
      // Fixed discount: calculate effective percentage
      effectivePercentage = subtotal > 0 ? (discountValue / subtotal) * 100 : 0;
    }

    if (effectivePercentage > userMaxDiscount) {
      return {
        allowed: false,
        discountAmount: 0,
        total: subtotal,
        error: `Giảm giá vượt quá giới hạn cho phép (tối đa ${userMaxDiscount}%)`,
      };
    }
  }

  // Calculate discount amount using pricing service
  const discountAmount = calculateDiscount(subtotal, discountType, discountValue);
  const total = subtotal - discountAmount;

  return {
    allowed: true,
    discountAmount,
    total,
  };
}

// === Async Functions (Supabase integration) ===

/**
 * Tạo đơn bán hàng mới.
 *
 * Quy trình:
 * 1. Validate inputs
 * 2. Tính subtotal, discount, total
 * 3. Insert sales_order vào Supabase
 * 4. Insert sales_order_items (trigger sẽ tự động trừ tồn kho)
 * 5. Nếu mua nợ (isCredit): tạo debt_record
 * 6. Trả về order đã tạo
 *
 * @throws Error nếu items rỗng hoặc createdBy trống
 *
 * Validates: Requirements 3.1, 3.5, 3.6, 3.7
 */
export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const { items, customerId, paymentMethod, isCredit, discountType, discountValue, createdBy } = params;

  // Validation
  if (!items || items.length === 0) {
    throw new Error('Đơn hàng phải có ít nhất 1 sản phẩm');
  }
  if (!createdBy || !createdBy.trim()) {
    throw new Error('createdBy không được để trống');
  }
  if (isCredit && !customerId) {
    throw new Error('Mua nợ phải có thông tin khách hàng');
  }

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);

  let discountAmount = 0;
  if (discountType && discountValue && discountValue > 0) {
    discountAmount = calculateDiscount(subtotal, discountType, discountValue);
  }

  const total = subtotal - discountAmount;

  const supabase = createClient();

  // Generate order number
  const orderNumber = generateOrderNumber();

  // Insert sales_order
  const { data: order, error: orderError } = await supabase
    .from('sales_orders')
    .insert({
      order_number: orderNumber,
      customer_id: customerId || null,
      subtotal,
      discount_type: discountType || null,
      discount_value: discountValue || null,
      discount_amount: discountAmount,
      total,
      payment_method: paymentMethod,
      is_credit: isCredit,
      is_third_party_delivery: false,
      created_by: createdBy,
      status: 'completed',
    })
    .select()
    .single();

  if (orderError || !order) {
    return {
      success: false,
      order: null,
      debtRecord: null,
      error: `Lỗi tạo đơn hàng: ${orderError?.message || 'Unknown error'}`,
    };
  }

  // Insert sales_order_items (database trigger handles stock decrease)
  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    line_total: item.line_total,
    returned_quantity: 0,
  }));

  const { error: itemsError } = await supabase
    .from('sales_order_items')
    .insert(orderItems);

  if (itemsError) {
    return {
      success: false,
      order: order as SalesOrder,
      debtRecord: null,
      error: `Lỗi tạo chi tiết đơn hàng: ${itemsError.message}`,
    };
  }

  // If credit sale, create debt record
  let debtRecord: DebtRecord | null = null;
  if (isCredit && customerId) {
    const { data: debt, error: debtError } = await supabase
      .from('debt_records')
      .insert({
        customer_id: customerId,
        order_id: order.id,
        amount: total,
        paid_amount: 0,
        remaining: total,
        status: 'pending',
      })
      .select()
      .single();

    if (debtError) {
      return {
        success: false,
        order: order as SalesOrder,
        debtRecord: null,
        error: `Lỗi tạo công nợ: ${debtError.message}`,
      };
    }

    debtRecord = debt as DebtRecord;

    // Update customer's current_debt
    await supabase.rpc('increment_customer_debt', {
      p_customer_id: customerId,
      p_amount: total,
    });
  }

  // Update customer purchase stats if customer exists
  if (customerId) {
    await supabase.rpc('update_customer_purchase_stats', {
      p_customer_id: customerId,
      p_amount: total,
    });
  }

  return {
    success: true,
    order: { ...order, items: orderItems } as SalesOrder,
    debtRecord,
  };
}

// === Helper Functions ===

/**
 * Generate a unique cart item ID (for client-side use).
 */
function generateCartItemId(): string {
  return `cart-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate order number with format: SO-YYYYMMDD-XXXX
 */
function generateOrderNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SO-${dateStr}-${random}`;
}
