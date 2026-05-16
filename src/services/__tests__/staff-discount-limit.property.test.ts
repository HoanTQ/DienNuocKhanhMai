import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { applyDiscount } from '@/services/pos.service';

/**
 * **Validates: Requirements 11.4**
 *
 * Property 6: Staff Discount Limit Enforcement
 * - discount vượt max_discount_percent → bị reject (allowed = false)
 * - discount <= max_discount_percent → được accept (allowed = true)
 */
describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 6: Staff Discount Limit Enforcement', () => {
  it('percentage discount vượt max_discount_percent → bị reject', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10000000 }),  // subtotal (đồng)
        fc.integer({ min: 1, max: 99 }),            // maxDiscountPercent
        (subtotal, maxDiscountPercent) => {
          // discountValue > maxDiscountPercent → phải bị reject
          const discountValue = maxDiscountPercent + fc.sample(
            fc.integer({ min: 1, max: 100 - maxDiscountPercent }),
            1
          )[0];

          const result = applyDiscount(subtotal, 'percentage', discountValue, maxDiscountPercent);

          expect(result.allowed).toBe(false);
          expect(result.discountAmount).toBe(0);
          expect(result.total).toBe(subtotal);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('percentage discount <= max_discount_percent → được accept', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10000000 }),  // subtotal (đồng)
        fc.integer({ min: 1, max: 100 }),           // maxDiscountPercent
        (subtotal, maxDiscountPercent) => {
          // discountValue <= maxDiscountPercent → phải được accept
          const discountValue = fc.sample(
            fc.integer({ min: 0, max: maxDiscountPercent }),
            1
          )[0];

          const result = applyDiscount(subtotal, 'percentage', discountValue, maxDiscountPercent);

          expect(result.allowed).toBe(true);
          expect(result.discountAmount).toBeGreaterThanOrEqual(0);
          expect(result.total).toBeLessThanOrEqual(subtotal);
          expect(result.total).toBe(subtotal - result.discountAmount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('fixed discount vượt max_discount_percent (tính theo % effective) → bị reject', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10000000 }),  // subtotal (đồng)
        fc.integer({ min: 1, max: 99 }),            // maxDiscountPercent
        (subtotal, maxDiscountPercent) => {
          // Fixed discount amount that exceeds maxDiscountPercent of subtotal
          const maxAllowedAmount = Math.floor(subtotal * maxDiscountPercent / 100);
          const discountValue = maxAllowedAmount + fc.sample(
            fc.integer({ min: 1, max: Math.max(1, subtotal - maxAllowedAmount) }),
            1
          )[0];

          const result = applyDiscount(subtotal, 'fixed', discountValue, maxDiscountPercent);

          expect(result.allowed).toBe(false);
          expect(result.discountAmount).toBe(0);
          expect(result.total).toBe(subtotal);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('fixed discount <= max_discount_percent (tính theo % effective) → được accept', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10000000 }),  // subtotal (đồng)
        fc.integer({ min: 1, max: 100 }),           // maxDiscountPercent
        (subtotal, maxDiscountPercent) => {
          // Fixed discount amount that is within maxDiscountPercent of subtotal
          const maxAllowedAmount = Math.floor(subtotal * maxDiscountPercent / 100);
          const discountValue = fc.sample(
            fc.integer({ min: 0, max: maxAllowedAmount }),
            1
          )[0];

          const result = applyDiscount(subtotal, 'fixed', discountValue, maxDiscountPercent);

          expect(result.allowed).toBe(true);
          expect(result.discountAmount).toBeGreaterThanOrEqual(0);
          expect(result.total).toBeLessThanOrEqual(subtotal);
          expect(result.total).toBe(subtotal - result.discountAmount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
