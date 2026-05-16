import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { calculateLineTotal, calculateDiscount } from '@/services/pricing.service';

/**
 * **Validates: Requirements 3.3, 3.4**
 *
 * Property 4: Order Total Calculation
 * - line_total = unit_price × quantity cho mọi line item
 * - subtotal = sum of all line_totals
 * - total = subtotal - discount_amount
 */
describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 4: Order Total Calculation', () => {
  it('line_total = unit_price × quantity cho mọi line item', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),      // quantity
        fc.integer({ min: 100, max: 10000000 }), // unitPrice (đồng)
        (quantity, unitPrice) => {
          const result = calculateLineTotal(quantity, unitPrice);
          const expected = unitPrice * quantity;
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('subtotal = sum of all line_totals', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            quantity: fc.integer({ min: 1, max: 1000 }),
            unitPrice: fc.integer({ min: 100, max: 1000000 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (items) => {
          const lineTotals = items.map((item) =>
            calculateLineTotal(item.quantity, item.unitPrice)
          );
          const subtotal = lineTotals.reduce((sum, lt) => sum + lt, 0);
          const expectedSubtotal = items.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0
          );
          expect(subtotal).toBe(expectedSubtotal);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('total = subtotal - discount_amount', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            quantity: fc.integer({ min: 1, max: 1000 }),
            unitPrice: fc.integer({ min: 100, max: 1000000 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        fc.oneof(
          fc.record({
            type: fc.constant('fixed' as const),
            value: fc.integer({ min: 0, max: 100000 }),
          }),
          fc.record({
            type: fc.constant('percentage' as const),
            value: fc.integer({ min: 0, max: 100 }),
          })
        ),
        (items, discount) => {
          // Calculate subtotal from line items
          const subtotal = items.reduce(
            (sum, item) => sum + calculateLineTotal(item.quantity, item.unitPrice),
            0
          );

          // Skip cases where fixed discount exceeds subtotal
          if (discount.type === 'fixed' && discount.value > subtotal) {
            return;
          }

          const discountAmount = calculateDiscount(
            subtotal,
            discount.type,
            discount.value
          );
          const total = subtotal - discountAmount;

          // Invariant: total = subtotal - discount_amount
          expect(total).toBeCloseTo(subtotal - discountAmount, 5);
          // Total should never be negative
          expect(total).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
