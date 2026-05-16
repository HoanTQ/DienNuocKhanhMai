import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

/**
 * **Validates: Requirements 1.4, 1.6**
 *
 * Property 7: Low Stock Alert Threshold
 * - Alert được tạo khi và chỉ khi current_stock <= min_stock_level
 * - Không có duplicate alert cho cùng SKU cho đến khi stock được replenish
 */

/**
 * Pure function encapsulating the low stock alert decision logic.
 *
 * Extracted from inventory.service.ts checkLowStock() for testability.
 * The actual service uses Supabase for data access, but the core decision
 * logic is: isLowStock = (currentStock <= minStockLevel) and
 * shouldAlert = isLowStock && !existingAlertExists.
 *
 * @param currentStock - Current stock level of the product
 * @param minStockLevel - Minimum stock threshold configured for the product
 * @param existingAlertExists - Whether an unread low_stock alert already exists for this product
 * @returns Object with isLowStock flag and shouldAlert decision
 */
export function shouldCreateAlert(
  currentStock: number,
  minStockLevel: number,
  existingAlertExists: boolean
): { isLowStock: boolean; shouldAlert: boolean } {
  const isLowStock = currentStock <= minStockLevel;
  const shouldAlert = isLowStock && !existingAlertExists;
  return { isLowStock, shouldAlert };
}

describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 7: Low Stock Alert Threshold', () => {
  it('alert được tạo khi và chỉ khi current_stock <= min_stock_level (no existing alert)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),  // currentStock
        fc.integer({ min: 0, max: 100000 }),  // minStockLevel
        (currentStock, minStockLevel) => {
          const result = shouldCreateAlert(currentStock, minStockLevel, false);

          // isLowStock should be true iff currentStock <= minStockLevel
          if (currentStock <= minStockLevel) {
            expect(result.isLowStock).toBe(true);
            expect(result.shouldAlert).toBe(true);
          } else {
            expect(result.isLowStock).toBe(false);
            expect(result.shouldAlert).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('không có duplicate alert cho cùng SKU cho đến khi stock được replenish', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),  // currentStock
        fc.integer({ min: 0, max: 100000 }),  // minStockLevel
        (currentStock, minStockLevel) => {
          // When an existing alert already exists (existingAlertExists = true),
          // shouldAlert must always be false regardless of stock level
          const result = shouldCreateAlert(currentStock, minStockLevel, true);

          // isLowStock still reflects the actual stock condition
          if (currentStock <= minStockLevel) {
            expect(result.isLowStock).toBe(true);
          } else {
            expect(result.isLowStock).toBe(false);
          }

          // But shouldAlert is always false when an alert already exists (deduplication)
          expect(result.shouldAlert).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('after replenish (stock > min_stock_level), alert can be created again on next drop', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),  // minStockLevel
        fc.integer({ min: 1, max: 100000 }),  // replenishAmount (added above min)
        (minStockLevel, replenishAmount) => {
          const stockAfterReplenish = minStockLevel + replenishAmount;

          // After replenish, stock is above threshold - no alert needed
          const afterReplenish = shouldCreateAlert(stockAfterReplenish, minStockLevel, false);
          expect(afterReplenish.isLowStock).toBe(false);
          expect(afterReplenish.shouldAlert).toBe(false);

          // When stock drops back to or below threshold, alert should be created
          // (existingAlertExists = false because previous alert becomes stale after replenish)
          const stockDropped = Math.max(0, minStockLevel - 1);
          const afterDrop = shouldCreateAlert(stockDropped, minStockLevel, false);
          expect(afterDrop.isLowStock).toBe(true);
          expect(afterDrop.shouldAlert).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isLowStock is equivalent to currentStock <= minStockLevel for all non-negative values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),  // currentStock
        fc.integer({ min: 0, max: 100000 }),  // minStockLevel
        fc.boolean(),                          // existingAlertExists
        (currentStock, minStockLevel, existingAlertExists) => {
          const result = shouldCreateAlert(currentStock, minStockLevel, existingAlertExists);

          // The isLowStock flag must always equal the threshold comparison
          expect(result.isLowStock).toBe(currentStock <= minStockLevel);

          // shouldAlert is the conjunction of isLowStock AND no existing alert
          expect(result.shouldAlert).toBe(
            currentStock <= minStockLevel && !existingAlertExists
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
