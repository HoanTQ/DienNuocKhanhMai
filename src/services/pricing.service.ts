import type { UnitConversion } from '@/lib/types';

/**
 * Tính giá vốn trung bình có trọng số (Weighted Average Cost) sau khi nhập hàng mới.
 *
 * Công thức: New WAC = (Current Stock × Current WAC + New Quantity × New Unit Cost) / (Current Stock + New Quantity)
 * Khi current_stock = 0, WAC mới = newUnitCost.
 *
 * @throws Error nếu inputs không hợp lệ (số âm, division by zero)
 *
 * Validates: Requirements 8.2, 3.2
 */
export function calculateWeightedAvgCost(
  currentStock: number,
  currentAvgCost: number,
  newQuantity: number,
  newUnitCost: number
): number {
  if (currentStock < 0) {
    throw new Error('currentStock không được là số âm');
  }
  if (currentAvgCost < 0) {
    throw new Error('currentAvgCost không được là số âm');
  }
  if (newQuantity <= 0) {
    throw new Error('newQuantity phải là số dương lớn hơn 0');
  }
  if (newUnitCost < 0) {
    throw new Error('newUnitCost không được là số âm');
  }

  if (currentStock === 0) {
    return newUnitCost;
  }

  const totalValue = currentStock * currentAvgCost + newQuantity * newUnitCost;
  const totalQuantity = currentStock + newQuantity;

  return totalValue / totalQuantity;
}

/**
 * Quy đổi đơn vị cho sản phẩm. Hỗ trợ tối đa 3 cấp quy đổi (L1 → L2 → L3).
 *
 * Tìm đường chuyển đổi trực tiếp hoặc gián tiếp (qua đơn vị trung gian) trong danh sách conversions.
 *
 * @throws Error nếu không tìm thấy đường chuyển đổi hoặc inputs không hợp lệ
 *
 * Validates: Requirements 3.2
 */
export function convertUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  conversions: UnitConversion[]
): number {
  if (quantity < 0) {
    throw new Error('quantity không được là số âm');
  }
  if (!fromUnit || !fromUnit.trim()) {
    throw new Error('fromUnit không được để trống');
  }
  if (!toUnit || !toUnit.trim()) {
    throw new Error('toUnit không được để trống');
  }

  // Cùng đơn vị → trả về nguyên quantity
  if (fromUnit === toUnit) {
    return quantity;
  }

  // Tìm chuyển đổi trực tiếp: fromUnit → toUnit
  const direct = conversions.find(
    (c) => c.from_unit === fromUnit && c.to_unit === toUnit
  );
  if (direct) {
    return quantity * direct.conversion_rate;
  }

  // Tìm chuyển đổi ngược: toUnit → fromUnit
  const reverse = conversions.find(
    (c) => c.from_unit === toUnit && c.to_unit === fromUnit
  );
  if (reverse) {
    if (reverse.conversion_rate === 0) {
      throw new Error('conversion_rate không được bằng 0');
    }
    return quantity / reverse.conversion_rate;
  }

  // Tìm chuyển đổi gián tiếp qua đơn vị trung gian (tối đa 1 bước trung gian)
  for (const conv1 of conversions) {
    if (conv1.from_unit === fromUnit) {
      const intermediateUnit = conv1.to_unit;
      // Tìm conv2: intermediateUnit → toUnit
      const conv2 = conversions.find(
        (c) => c.from_unit === intermediateUnit && c.to_unit === toUnit
      );
      if (conv2) {
        return quantity * conv1.conversion_rate * conv2.conversion_rate;
      }
      // Tìm conv2 ngược: toUnit → intermediateUnit
      const conv2Reverse = conversions.find(
        (c) => c.from_unit === toUnit && c.to_unit === intermediateUnit
      );
      if (conv2Reverse) {
        if (conv2Reverse.conversion_rate === 0) {
          throw new Error('conversion_rate không được bằng 0');
        }
        return (quantity * conv1.conversion_rate) / conv2Reverse.conversion_rate;
      }
    }
    // Thử ngược conv1: fromUnit ← conv1.to_unit (tức conv1.to_unit → conv1.from_unit)
    if (conv1.to_unit === fromUnit) {
      if (conv1.conversion_rate === 0) {
        throw new Error('conversion_rate không được bằng 0');
      }
      const intermediateUnit = conv1.from_unit;
      const quantityInIntermediate = quantity / conv1.conversion_rate;
      // Tìm conv2: intermediateUnit → toUnit
      const conv2 = conversions.find(
        (c) => c.from_unit === intermediateUnit && c.to_unit === toUnit
      );
      if (conv2) {
        return quantityInIntermediate * conv2.conversion_rate;
      }
      // Tìm conv2 ngược: toUnit → intermediateUnit
      const conv2Reverse = conversions.find(
        (c) => c.from_unit === toUnit && c.to_unit === intermediateUnit
      );
      if (conv2Reverse) {
        if (conv2Reverse.conversion_rate === 0) {
          throw new Error('conversion_rate không được bằng 0');
        }
        return quantityInIntermediate / conv2Reverse.conversion_rate;
      }
    }
  }

  throw new Error(
    `Không tìm thấy đường chuyển đổi từ "${fromUnit}" sang "${toUnit}"`
  );
}

/**
 * Tính số tiền giảm giá trên tổng đơn hàng.
 *
 * - 'fixed': Giảm trực tiếp số tiền cố định (ví dụ: giảm 50,000đ)
 * - 'percentage': Giảm theo phần trăm (ví dụ: giảm 5% → subtotal * 5 / 100)
 *
 * @returns Số tiền giảm giá (discount amount)
 * @throws Error nếu inputs không hợp lệ
 *
 * Validates: Requirements 11.1, 11.2
 */
export function calculateDiscount(
  subtotal: number,
  discountType: 'fixed' | 'percentage',
  discountValue: number
): number {
  if (subtotal < 0) {
    throw new Error('subtotal không được là số âm');
  }
  if (discountValue < 0) {
    throw new Error('discountValue không được là số âm');
  }

  if (discountType === 'percentage') {
    if (discountValue > 100) {
      throw new Error('discountValue phần trăm không được vượt quá 100');
    }
    return (subtotal * discountValue) / 100;
  }

  // discountType === 'fixed'
  if (discountValue > subtotal) {
    throw new Error('discountValue cố định không được vượt quá subtotal');
  }
  return discountValue;
}

/**
 * Tính thành tiền cho một dòng sản phẩm (line item).
 *
 * Công thức: line_total = quantity × unitPrice
 *
 * @throws Error nếu inputs không hợp lệ (số âm)
 *
 * Validates: Requirements 3.3
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number
): number {
  if (quantity < 0) {
    throw new Error('quantity không được là số âm');
  }
  if (unitPrice < 0) {
    throw new Error('unitPrice không được là số âm');
  }

  return quantity * unitPrice;
}

// ============================================================
// PRICE MANAGEMENT — Quản lý Giá nâng cao
// ============================================================

/**
 * Tính giá vốn trên mỗi đơn vị sản phẩm từ tổng thanh toán.
 *
 * Công thức: unit_price = total_payment / quantity
 * Kết quả làm tròn 2 chữ số thập phân.
 *
 * @param totalPayment Tổng tiền thanh toán sau chiết khấu (phải >= 0)
 * @param quantity Số lượng sản phẩm (phải > 0)
 * @returns Giá vốn trên mỗi đơn vị (làm tròn 2 decimal)
 * @throws Error nếu inputs không hợp lệ
 *
 * Validates: Price Management Requirements 2.1, 2.5
 */
export function calculateUnitPriceFromPayment(
  totalPayment: number,
  quantity: number
): number {
  if (quantity <= 0) {
    throw new Error('Số lượng phải lớn hơn 0');
  }
  if (totalPayment < 0) {
    throw new Error('Tổng thanh toán không được là số âm');
  }

  const unitPrice = totalPayment / quantity;
  return Math.round(unitPrice * 100) / 100;
}

/**
 * Tính tổng thanh toán sau chiết khấu cho một dòng sản phẩm nhập kho.
 *
 * - 'percent': payment = subtotal × (1 - discountValue / 100)
 * - 'fixed': payment = subtotal - discountValue
 *
 * Kết quả làm tròn 2 chữ số thập phân.
 *
 * @param subtotal Thành tiền trước CK (Số lượng × Giá NCC)
 * @param discountType Loại chiết khấu: 'percent' hoặc 'fixed'
 * @param discountValue Giá trị chiết khấu (VD: 5 cho 5%, hoặc 370000 cho CK cố định)
 * @returns Tổng thanh toán sau CK (làm tròn 2 decimal)
 * @throws Error nếu inputs không hợp lệ
 *
 * Validates: Price Management Requirements 1.1, 1.2, 1.3
 */
export function calculatePaymentAfterDiscount(
  subtotal: number,
  discountType: 'percent' | 'fixed',
  discountValue: number
): number {
  if (subtotal < 0) {
    throw new Error('Thành tiền không được là số âm');
  }
  if (discountValue < 0) {
    throw new Error('Chiết khấu không được là số âm');
  }

  if (discountType === 'percent') {
    if (discountValue > 100) {
      throw new Error('Chiết khấu phần trăm không được vượt quá 100%');
    }
    const payment = subtotal * (1 - discountValue / 100);
    return Math.round(payment * 100) / 100;
  } else {
    // fixed
    if (discountValue > subtotal) {
      throw new Error('Chiết khấu cố định không được lớn hơn thành tiền');
    }
    const payment = subtotal - discountValue;
    return Math.round(payment * 100) / 100;
  }
}

/**
 * Tính phần trăm chiết khấu thực tế dựa trên Giá NCC và Thanh toán.
 * Dùng để hiển thị % CK thực tế khi user nhập Thanh toán trực tiếp.
 *
 * Công thức: discount% = (1 - totalPayment / subtotal) × 100
 *
 * @param subtotal Thành tiền (Số lượng × Giá NCC)
 * @param totalPayment Tổng thanh toán thực tế
 * @returns Phần trăm chiết khấu (làm tròn 1 decimal)
 *
 * Validates: Price Management Requirements 4.3
 */
export function calculateActualDiscountPercent(
  subtotal: number,
  totalPayment: number
): number {
  if (subtotal <= 0) return 0;
  if (totalPayment < 0) return 0;
  if (totalPayment >= subtotal) return 0;

  const percent = (1 - totalPayment / subtotal) * 100;
  return Math.round(percent * 10) / 10;
}
