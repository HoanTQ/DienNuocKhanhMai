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
