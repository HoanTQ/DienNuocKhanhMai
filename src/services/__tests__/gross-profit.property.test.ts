import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

// ============================================================
// Pure function modeling: Gross Profit Calculation
// ============================================================

/**
 * Tính lợi nhuận gộp (gross profit) cho một sản phẩm đã bán.
 *
 * Công thức: gross_profit = (selling_price - weighted_avg_cost) × quantity_sold
 *
 * @param sellingPrice - Giá bán (đồng)
 * @param weightedAvgCost - Giá vốn trung bình có trọng số (đồng)
 * @param quantitySold - Số lượng đã bán
 * @returns Lợi nhuận gộp (có thể âm nếu bán dưới giá vốn)
 * @throws Error nếu inputs không hợp lệ
 */
export function calculateGrossProfit(
  sellingPrice: number,
  weightedAvgCost: number,
  quantitySold: number
): number {
  if (sellingPrice < 0) {
    throw new Error('sellingPrice không được là số âm');
  }
  if (weightedAvgCost < 0) {
    throw new Error('weightedAvgCost không được là số âm');
  }
  if (quantitySold <= 0) {
    throw new Error('quantitySold phải là số dương lớn hơn 0');
  }

  return (sellingPrice - weightedAvgCost) * quantitySold;
}

/**
 * Tính biên lợi nhuận gộp (gross profit margin) theo phần trăm.
 *
 * Công thức: gross_profit_margin = gross_profit / revenue × 100
 * Trong đó: revenue = selling_price × quantity_sold
 *
 * @param grossProfit - Lợi nhuận gộp
 * @param revenue - Doanh thu (selling_price × quantity_sold)
 * @returns Biên lợi nhuận gộp (%), trả về 0 nếu revenue = 0
 */
export function calculateGrossProfitMargin(
  grossProfit: number,
  revenue: number
): number {
  if (revenue < 0) {
    throw new Error('revenue không được là số âm');
  }

  if (revenue === 0) {
    return 0;
  }

  return (grossProfit / revenue) * 100;
}

// ============================================================
// Property Tests
// ============================================================

/**
 * **Validates: Requirements 18.2**
 *
 * Property 15: Gross Profit Calculation
 * - gross_profit = (selling_price - weighted_avg_cost) × quantity_sold
 * - gross_profit_margin = gross_profit / revenue × 100
 */
describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 15: Gross Profit Calculation', () => {
  // Generators
  const sellingPriceArb = fc.integer({ min: 100, max: 10000000 }); // đồng
  const weightedAvgCostArb = fc.integer({ min: 100, max: 10000000 }); // đồng
  const quantitySoldArb = fc.integer({ min: 1, max: 10000 });

  it('gross_profit = (selling_price - weighted_avg_cost) × quantity_sold', () => {
    fc.assert(
      fc.property(
        sellingPriceArb,
        weightedAvgCostArb,
        quantitySoldArb,
        (sellingPrice, weightedAvgCost, quantitySold) => {
          const result = calculateGrossProfit(sellingPrice, weightedAvgCost, quantitySold);
          const expected = (sellingPrice - weightedAvgCost) * quantitySold;

          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('gross_profit_margin = gross_profit / revenue × 100', () => {
    fc.assert(
      fc.property(
        sellingPriceArb,
        weightedAvgCostArb,
        quantitySoldArb,
        (sellingPrice, weightedAvgCost, quantitySold) => {
          const grossProfit = calculateGrossProfit(sellingPrice, weightedAvgCost, quantitySold);
          const revenue = sellingPrice * quantitySold;

          const margin = calculateGrossProfitMargin(grossProfit, revenue);

          if (revenue === 0) {
            expect(margin).toBe(0);
          } else {
            const expectedMargin = (grossProfit / revenue) * 100;
            expect(margin).toBeCloseTo(expectedMargin, 10);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('gross_profit_margin đơn giản hóa thành ((selling_price - weighted_avg_cost) / selling_price) × 100 khi revenue > 0', () => {
    fc.assert(
      fc.property(
        sellingPriceArb,
        weightedAvgCostArb,
        quantitySoldArb,
        (sellingPrice, weightedAvgCost, quantitySold) => {
          const grossProfit = calculateGrossProfit(sellingPrice, weightedAvgCost, quantitySold);
          const revenue = sellingPrice * quantitySold;

          // revenue > 0 vì sellingPrice >= 100 và quantitySold >= 1
          const margin = calculateGrossProfitMargin(grossProfit, revenue);

          // Margin chỉ phụ thuộc vào selling_price và weighted_avg_cost
          // margin = ((sp - wac) * qty) / (sp * qty) * 100 = ((sp - wac) / sp) * 100
          const expectedSimplified = ((sellingPrice - weightedAvgCost) / sellingPrice) * 100;
          expect(margin).toBeCloseTo(expectedSimplified, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('gross_profit là dương khi selling_price > weighted_avg_cost', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10000000 }), // sellingPrice (cao hơn)
        fc.integer({ min: 100, max: 999 }),        // weightedAvgCost (thấp hơn)
        quantitySoldArb,
        (sellingPrice, weightedAvgCost, quantitySold) => {
          const result = calculateGrossProfit(sellingPrice, weightedAvgCost, quantitySold);
          expect(result).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('gross_profit là âm khi selling_price < weighted_avg_cost (bán lỗ)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 999 }),        // sellingPrice (thấp hơn)
        fc.integer({ min: 1000, max: 10000000 }), // weightedAvgCost (cao hơn)
        quantitySoldArb,
        (sellingPrice, weightedAvgCost, quantitySold) => {
          const result = calculateGrossProfit(sellingPrice, weightedAvgCost, quantitySold);
          expect(result).toBeLessThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('gross_profit = 0 khi selling_price = weighted_avg_cost (hòa vốn)', () => {
    fc.assert(
      fc.property(
        sellingPriceArb,
        quantitySoldArb,
        (price, quantitySold) => {
          // selling_price = weighted_avg_cost → lợi nhuận = 0
          const result = calculateGrossProfit(price, price, quantitySold);
          expect(result).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('gross_profit_margin trả về 0 khi revenue = 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10000000, max: 10000000 }), // grossProfit bất kỳ
        (_grossProfit) => {
          const margin = calculateGrossProfitMargin(_grossProfit, 0);
          expect(margin).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
