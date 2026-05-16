import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { convertUnit } from '@/services/pricing.service';
import type { UnitConversion } from '@/lib/types';

/**
 * **Validates: Requirements 3.2, 6.4**
 *
 * Property 3: Unit Conversion Transitivity
 * - Chuyển đổi L1→L3 trực tiếp = L1→L2→L3 tuần tự
 * - Round-trip conversion (L1→base→L1) trả về giá trị ban đầu
 */
describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 3: Unit Conversion Transitivity', () => {
  /**
   * Helper: tạo 3-level conversion chain với random rates
   * Ví dụ: thùng → hộp → cái
   */
  const buildThreeLevelConversions = (
    rate1: number,
    rate2: number
  ): UnitConversion[] => [
    {
      id: 'conv-1',
      product_id: 'product-1',
      from_unit: 'thùng',
      to_unit: 'hộp',
      conversion_rate: rate1,
      level: 1,
    },
    {
      id: 'conv-2',
      product_id: 'product-1',
      from_unit: 'hộp',
      to_unit: 'cái',
      conversion_rate: rate2,
      level: 2,
    },
  ];

  it('chuyển đổi L1→L3 trực tiếp = L1→L2→L3 tuần tự', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),   // quantity
        fc.integer({ min: 2, max: 100 }),    // rate1: thùng → hộp
        fc.integer({ min: 2, max: 100 }),    // rate2: hộp → cái
        (quantity, rate1, rate2) => {
          const conversions = buildThreeLevelConversions(rate1, rate2);

          // Chuyển đổi trực tiếp: thùng → cái (L1 → L3)
          const directResult = convertUnit(quantity, 'thùng', 'cái', conversions);

          // Chuyển đổi tuần tự: thùng → hộp → cái (L1 → L2 → L3)
          const step1 = convertUnit(quantity, 'thùng', 'hộp', conversions);
          const step2 = convertUnit(step1, 'hộp', 'cái', conversions);

          // Kết quả phải bằng nhau
          expect(directResult).toBeCloseTo(step2, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('round-trip conversion (L1→L2→L1) trả về giá trị ban đầu', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),   // quantity
        fc.integer({ min: 2, max: 100 }),    // rate1: thùng → hộp
        fc.integer({ min: 2, max: 100 }),    // rate2: hộp → cái (cần cho conversions array)
        (quantity, rate1, rate2) => {
          const conversions = buildThreeLevelConversions(rate1, rate2);

          // Round-trip: thùng → hộp → thùng
          const toBase = convertUnit(quantity, 'thùng', 'hộp', conversions);
          const backToOriginal = convertUnit(toBase, 'hộp', 'thùng', conversions);

          // Phải trả về giá trị ban đầu
          expect(backToOriginal).toBeCloseTo(quantity, 5);
        }
      ),
      { numRuns: 100 }
    );
  });
});
