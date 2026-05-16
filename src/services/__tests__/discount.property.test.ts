import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { calculateDiscount } from '@/services/pricing.service';
import { applyDiscount } from '@/services/pos.service';

/**
 * **Validates: Requirements 11.1, 11.2, 11.3**
 *
 * Property 5: Discount Calculation Invariant
 * - Fixed discount → discount_amount = fixed value
 * - Percentage discount → discount_amount = subtotal × percentage / 100
 * - Invariant: discount_amount + total = subtotal luôn đúng
 */
describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 5: Discount Calculation Invariant', () => {
  it('fixed discount → discount_amount = fixed value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 100000000 }), // subtotal (đồng)
        fc.integer({ min: 0, max: 1000 }),          // discountValue seed
        (subtotal, discountSeed) => {
          // Ensure discountValue <= subtotal
          const discountValue = Math.min(discountSeed, subtotal);

          const result = calculateDiscount(subtotal, 'fixed', discountValue);
          expect(result).toBe(discountValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('percentage discount → discount_amount = subtotal × percentage / 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 100000000 }), // subtotal (đồng)
        fc.integer({ min: 0, max: 100 }),           // discountValue (percentage 0-100)
        (subtotal, discountValue) => {
          const result = calculateDiscount(subtotal, 'percentage', discountValue);
          const expected = (subtotal * discountValue) / 100;
          expect(result).toBeCloseTo(expected, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invariant: discount_amount + total = subtotal luôn đúng', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 100000000 }), // subtotal (đồng)
        fc.oneof(
          // Fixed discount
          fc.record({
            type: fc.constant('fixed' as const),
            value: fc.integer({ min: 0, max: 1000 }),
          }),
          // Percentage discount
          fc.record({
            type: fc.constant('percentage' as const),
            value: fc.integer({ min: 0, max: 100 }),
          })
        ),
        (subtotal, discount) => {
          // For fixed discount, ensure value <= subtotal
          const discountValue =
            discount.type === 'fixed'
              ? Math.min(discount.value, subtotal)
              : discount.value;

          const result = applyDiscount(subtotal, discount.type, discountValue);

          // applyDiscount should be allowed (no max discount limit)
          expect(result.allowed).toBe(true);

          // Invariant: discount_amount + total = subtotal
          expect(result.discountAmount + result.total).toBeCloseTo(subtotal, 5);
        }
      ),
      { numRuns: 100 }
    );
  });
});
