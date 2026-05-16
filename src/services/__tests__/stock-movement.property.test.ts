import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { getStockChange } from '@/services/inventory.service';

/**
 * **Validates: Requirements 1.2, 1.3, 3.7, 12.2**
 *
 * Property 1: Stock Movement Invariant
 * - Sau sale quantity Q → new_stock = old_stock - Q
 * - Sau receipt (purchase) quantity Q → new_stock = old_stock + Q
 * - Sau return quantity Q → new_stock = old_stock + Q
 * - Stock không bao giờ âm (khi sale quantity <= old_stock)
 */
describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 1: Stock Movement Invariant', () => {
  it('sau sale quantity Q → new_stock = old_stock - Q', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // old_stock
        fc.integer({ min: 1, max: 100000 }), // quantity Q
        (oldStock, quantity) => {
          const stockChange = getStockChange('sale', quantity);
          const newStock = oldStock + stockChange;

          expect(newStock).toBe(oldStock - quantity);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sau receipt (purchase) quantity Q → new_stock = old_stock + Q', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }), // old_stock
        fc.integer({ min: 1, max: 100000 }), // quantity Q
        (oldStock, quantity) => {
          const stockChange = getStockChange('purchase', quantity);
          const newStock = oldStock + stockChange;

          expect(newStock).toBe(oldStock + quantity);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sau return quantity Q → new_stock = old_stock + Q', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }), // old_stock
        fc.integer({ min: 1, max: 100000 }), // quantity Q
        (oldStock, quantity) => {
          const stockChange = getStockChange('return', quantity);
          const newStock = oldStock + stockChange;

          expect(newStock).toBe(oldStock + quantity);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('stock không bao giờ âm khi sale quantity <= old_stock', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }).chain((oldStock) =>
          fc.tuple(
            fc.constant(oldStock),
            fc.integer({ min: 1, max: oldStock }) // quantity <= old_stock
          )
        ),
        ([oldStock, quantity]) => {
          const stockChange = getStockChange('sale', quantity);
          const newStock = oldStock + stockChange;

          expect(newStock).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
