import { createClient } from '@/lib/supabase/client';
import type { StockMovement } from '@/lib/types';

/**
 * Inventory Service - Quản lý tồn kho
 *
 * Cung cấp logic nghiệp vụ cho:
 * 1. Cập nhật tồn kho thủ công (manual stock adjustments)
 * 2. Kiểm tra và cảnh báo tồn kho thấp (với deduplication)
 * 3. Tính tuổi lưu kho
 *
 * Lưu ý: Database triggers đã xử lý stock updates cho sales_order_items
 * và goods_receipt_items INSERT. Service này dùng cho adjustments thủ công
 * và logic cảnh báo.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6, 1.7
 */

export interface UpdateStockParams {
  productId: string;
  quantity: number;
  movementType: StockMovement['movement_type'];
  referenceId: string;
  unit?: string;
  notes?: string;
  createdBy: string;
}

export interface UpdateStockResult {
  success: boolean;
  newStock: number;
  movement: StockMovement | null;
  error?: string;
}

export interface CheckLowStockResult {
  isLowStock: boolean;
  currentStock: number;
  minStockLevel: number;
  alertCreated: boolean;
  alertDuplicate: boolean;
}

export interface StockAgeResult {
  productId: string;
  lastStockedAt: string | null;
  ageDays: number | null;
}

/**
 * Cập nhật tồn kho cho sản phẩm.
 *
 * Tạo stock_movement record và cập nhật product.current_stock.
 * - sale/adjustment (negative): trừ tồn kho
 * - purchase/return (positive): cộng tồn kho
 *
 * @throws Error nếu productId hoặc referenceId trống
 * @throws Error nếu quantity <= 0
 * @throws Error nếu tồn kho sau cập nhật < 0 (cho sale/adjustment giảm)
 *
 * Validates: Requirements 1.2, 1.3
 */
export async function updateStock(params: UpdateStockParams): Promise<UpdateStockResult> {
  const { productId, quantity, movementType, referenceId, unit, notes, createdBy } = params;

  // Validation
  if (!productId || !productId.trim()) {
    throw new Error('productId không được để trống');
  }
  if (!referenceId || !referenceId.trim()) {
    throw new Error('referenceId không được để trống');
  }
  if (!createdBy || !createdBy.trim()) {
    throw new Error('createdBy không được để trống');
  }
  if (quantity <= 0) {
    throw new Error('quantity phải là số dương lớn hơn 0');
  }

  const supabase = createClient();

  // Determine stock change direction based on movement type
  const stockChange = getStockChange(movementType, quantity);

  // Get current product stock
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('current_stock, base_unit')
    .eq('id', productId)
    .single();

  if (productError || !product) {
    return {
      success: false,
      newStock: 0,
      movement: null,
      error: `Không tìm thấy sản phẩm: ${productError?.message || 'Product not found'}`,
    };
  }

  const newStock = product.current_stock + stockChange;

  // Prevent negative stock
  if (newStock < 0) {
    return {
      success: false,
      newStock: product.current_stock,
      movement: null,
      error: `Tồn kho không đủ. Hiện tại: ${product.current_stock}, yêu cầu giảm: ${Math.abs(stockChange)}`,
    };
  }

  // Create stock movement record
  const { data: movement, error: movementError } = await supabase
    .from('stock_movements')
    .insert({
      product_id: productId,
      movement_type: movementType,
      quantity: stockChange,
      unit: unit || product.base_unit,
      reference_id: referenceId,
      reference_type: movementType === 'adjustment' ? 'manual' : movementType,
      notes: notes || null,
      created_by: createdBy,
    })
    .select()
    .single();

  if (movementError) {
    return {
      success: false,
      newStock: product.current_stock,
      movement: null,
      error: `Lỗi tạo stock movement: ${movementError.message}`,
    };
  }

  // Update product current_stock
  const { error: updateError } = await supabase
    .from('products')
    .update({ current_stock: newStock })
    .eq('id', productId);

  if (updateError) {
    return {
      success: false,
      newStock: product.current_stock,
      movement: movement as StockMovement,
      error: `Lỗi cập nhật tồn kho: ${updateError.message}`,
    };
  }

  return {
    success: true,
    newStock,
    movement: movement as StockMovement,
  };
}

/**
 * Kiểm tra tồn kho thấp cho sản phẩm và tạo alert nếu cần.
 *
 * Logic deduplication:
 * - Trước khi tạo notification mới, kiểm tra xem đã có notification
 *   chưa đọc (is_read = false) loại 'low_stock' cho product này chưa
 * - Nếu đã có → không tạo lại (tránh spam)
 * - Khi hàng được nhập bổ sung (stock tăng trên min_stock_level),
 *   alert cũ trở nên stale và alert mới có thể được tạo lần sau
 *
 * @returns CheckLowStockResult với thông tin chi tiết
 *
 * Validates: Requirements 1.4, 1.6
 */
export async function checkLowStock(productId: string): Promise<CheckLowStockResult> {
  if (!productId || !productId.trim()) {
    throw new Error('productId không được để trống');
  }

  const supabase = createClient();

  // Get product info
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, current_stock, min_stock_level, base_unit')
    .eq('id', productId)
    .single();

  if (productError || !product) {
    throw new Error(`Không tìm thấy sản phẩm: ${productError?.message || 'Product not found'}`);
  }

  const isLowStock = product.current_stock <= product.min_stock_level;

  if (!isLowStock) {
    return {
      isLowStock: false,
      currentStock: product.current_stock,
      minStockLevel: product.min_stock_level,
      alertCreated: false,
      alertDuplicate: false,
    };
  }

  // Check for existing unread low_stock notification for this product (deduplication)
  const { data: existingAlert } = await supabase
    .from('notifications')
    .select('id')
    .eq('type', 'low_stock')
    .eq('reference_id', productId)
    .eq('is_read', false)
    .limit(1);

  if (existingAlert && existingAlert.length > 0) {
    // Duplicate alert exists - don't create another
    return {
      isLowStock: true,
      currentStock: product.current_stock,
      minStockLevel: product.min_stock_level,
      alertCreated: false,
      alertDuplicate: true,
    };
  }

  // Get all owner users to send notification
  const { data: owners } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'owner')
    .eq('is_active', true);

  if (owners && owners.length > 0) {
    // Create notification for each owner
    const notifications = owners.map((owner) => ({
      user_id: owner.id,
      type: 'low_stock' as const,
      title: `Tồn kho thấp: ${product.name}`,
      message: `Sản phẩm "${product.name}" chỉ còn ${product.current_stock} ${product.base_unit} (mức tối thiểu: ${product.min_stock_level})`,
      reference_id: productId,
      reference_type: 'product',
      is_read: false,
    }));

    await supabase.from('notifications').insert(notifications);
  }

  return {
    isLowStock: true,
    currentStock: product.current_stock,
    minStockLevel: product.min_stock_level,
    alertCreated: true,
    alertDuplicate: false,
  };
}

/**
 * Tính tuổi lưu kho (số ngày kể từ lần nhập hàng gần nhất).
 *
 * Dựa trên trường last_stocked_at của product.
 * Nếu chưa từng nhập hàng (last_stocked_at = null), trả về null.
 *
 * Validates: Requirements 1.7
 */
export async function getStockAge(productId: string): Promise<StockAgeResult> {
  if (!productId || !productId.trim()) {
    throw new Error('productId không được để trống');
  }

  const supabase = createClient();

  const { data: product, error } = await supabase
    .from('products')
    .select('id, last_stocked_at')
    .eq('id', productId)
    .single();

  if (error || !product) {
    throw new Error(`Không tìm thấy sản phẩm: ${error?.message || 'Product not found'}`);
  }

  if (!product.last_stocked_at) {
    return {
      productId,
      lastStockedAt: null,
      ageDays: null,
    };
  }

  const lastStockedDate = new Date(product.last_stocked_at);
  const now = new Date();
  const diffMs = now.getTime() - lastStockedDate.getTime();
  const ageDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return {
    productId,
    lastStockedAt: product.last_stocked_at,
    ageDays,
  };
}

/**
 * Tính tuổi lưu kho từ một ngày cụ thể (pure function cho testing).
 *
 * @param lastStockedAt - Ngày nhập hàng gần nhất
 * @param now - Ngày hiện tại (mặc định: new Date())
 * @returns Số ngày lưu kho, hoặc null nếu lastStockedAt là null
 */
export function calculateStockAgeDays(
  lastStockedAt: string | null,
  now: Date = new Date()
): number | null {
  if (!lastStockedAt) {
    return null;
  }

  const lastStockedDate = new Date(lastStockedAt);
  const diffMs = now.getTime() - lastStockedDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Xác định hướng thay đổi tồn kho dựa trên loại movement.
 *
 * - sale: giảm tồn kho (trả về -quantity)
 * - purchase: tăng tồn kho (trả về +quantity)
 * - return: tăng tồn kho (trả về +quantity)
 * - adjustment: có thể tăng hoặc giảm (trả về +quantity cho tăng, -quantity cho giảm)
 *   → Với adjustment, quantity dương = tăng, quantity âm sẽ bị reject ở validation
 *   → Để giảm stock qua adjustment, dùng movementType 'sale' hoặc truyền quantity dương
 *     và service sẽ trừ stock
 *
 * Lưu ý: Hàm này dùng nội bộ. Với adjustment, mặc định là tăng stock.
 * Để giảm stock thủ công, sử dụng movementType 'sale'.
 */
export function getStockChange(
  movementType: StockMovement['movement_type'],
  quantity: number
): number {
  switch (movementType) {
    case 'sale':
      return -quantity;
    case 'purchase':
      return quantity;
    case 'return':
      return quantity;
    case 'adjustment':
      // Adjustment mặc định là tăng stock (dùng cho điều chỉnh tăng)
      // Để giảm stock, sử dụng movementType 'sale'
      return quantity;
    default:
      throw new Error(`Loại movement không hợp lệ: ${movementType}`);
  }
}
