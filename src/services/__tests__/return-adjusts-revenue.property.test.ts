import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { calculateLineTotal } from '@/services/pricing.service';
import type { SalesOrderItem, Customer } from '@/lib/types';

/**
 * **Validates: Requirements 12.4**
 *
 * Property 17: Return Adjusts Customer Revenue
 * - Sau return, customer total_purchased giảm đúng returned amount
 * - Effective order total được tính lại chính xác
 */

// === Types ===

export interface ReturnInput {
  /** Items being returned with their quantities */
  returnedItems: Array<{
    orderItemId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  /** Customer before the return */
  customer: Pick<Customer, 'id' | 'total_purchased'>;
  /** Original order total */
  originalOrderTotal: number;
  /** Original order items (to compute effective total after return) */
  orderItems: Pick<SalesOrderItem, 'id' | 'quantity' | 'unit_price' | 'returned_quantity'>[];
}

export interface ReturnResult {
  /** New customer total_purchased after return */
  newTotalPurchased: number;
  /** Total amount returned (sum of returned qty * unit_price) */
  returnedAmount: number;
  /** Effective order total after accounting for all returns */
  effectiveOrderTotal: number;
}

// === Pure function modeling return → revenue adjustment ===

/**
 * Pure function that models the return → customer revenue adjustment logic.
 *
 * When a product return is confirmed:
 * 1. The returned amount = sum of (returned_quantity × unit_price) for each returned item
 * 2. Customer's total_purchased decreases by the returned amount (floored at 0)
 * 3. The effective order total = original total - all returned amounts on that order
 */
export function processReturnRevenueAdjustment(input: ReturnInput): ReturnResult {
  const { returnedItems, customer, originalOrderTotal, orderItems } = input;

  // Calculate total returned amount for this return operation
  const returnedAmount = returnedItems.reduce(
    (sum, item) => sum + calculateLineTotal(item.quantity, item.unitPrice),
    0
  );

  // Customer total_purchased decreases by returned amount, floored at 0
  const newTotalPurchased = Math.max(0, customer.total_purchased - returnedAmount);

  // Calculate effective order total:
  // Original total minus all returned amounts (previous + current)
  const totalReturnedOnOrder = orderItems.reduce((sum, orderItem) => {
    // Find if this item is being returned in current operation
    const currentReturn = returnedItems.find((ri) => ri.orderItemId === orderItem.id);
    const currentReturnQty = currentReturn ? currentReturn.quantity : 0;
    // Total returned = previously returned + currently returning
    const totalReturnedQty = orderItem.returned_quantity + currentReturnQty;
    return sum + calculateLineTotal(totalReturnedQty, orderItem.unit_price);
  }, 0);

  const effectiveOrderTotal = Math.max(0, originalOrderTotal - totalReturnedOnOrder);

  return {
    newTotalPurchased,
    returnedAmount,
    effectiveOrderTotal,
  };
}

// === Generators ===

/** Generate a valid order item */
const orderItemArb = fc.record({
  id: fc.uuid(),
  quantity: fc.integer({ min: 1, max: 100 }),
  unit_price: fc.integer({ min: 1000, max: 10000000 }), // 1,000đ - 10,000,000đ
  returned_quantity: fc.constant(0), // Will be adjusted below
});

/** Generate a list of order items with valid returned_quantity */
const orderItemsArb = fc.array(orderItemArb, { minLength: 1, maxLength: 10 }).map((items) =>
  items.map((item) => ({
    ...item,
    // returned_quantity must be less than quantity (some room to return more)
    returned_quantity: 0,
  }))
);

/**
 * Generate a complete valid return scenario:
 * - Order items with quantities
 * - Return items that are a subset of order items with valid return quantities
 * - Customer with total_purchased >= returned amount
 */
const returnScenarioArb = orderItemsArb.chain((orderItems) => {
  // Pick a non-empty subset of items to return
  const returnItemsArb = fc
    .subarray(orderItems, { minLength: 1 })
    .chain((selectedItems) =>
      fc.tuple(
        ...selectedItems.map((item) =>
          fc.integer({ min: 1, max: item.quantity }).map((qty) => ({
            orderItemId: item.id,
            productId: fc.sample(fc.uuid(), 1)[0],
            quantity: qty,
            unitPrice: item.unit_price,
          }))
        )
      )
    );

  return returnItemsArb.chain((returnedItems) => {
    // Calculate the returned amount to ensure customer has enough total_purchased
    const returnedAmount = returnedItems.reduce(
      (sum, ri) => sum + ri.quantity * ri.unitPrice,
      0
    );

    // Original order total = sum of all order item line totals
    const originalOrderTotal = orderItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );

    // Customer total_purchased must be >= returned amount for meaningful test
    const customerTotalArb = fc.integer({
      min: returnedAmount,
      max: returnedAmount + 100000000, // up to 100M more
    });

    return fc.tuple(
      fc.constant(orderItems),
      fc.constant(returnedItems),
      customerTotalArb,
      fc.constant(originalOrderTotal),
      fc.uuid()
    );
  });
});

// === Property Tests ===

describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 17: Return Adjusts Customer Revenue', () => {
  it('sau return, customer total_purchased giảm đúng returned amount', () => {
    fc.assert(
      fc.property(
        returnScenarioArb,
        ([orderItems, returnedItems, customerTotal, originalOrderTotal, customerId]) => {
          const input: ReturnInput = {
            returnedItems,
            customer: { id: customerId, total_purchased: customerTotal },
            originalOrderTotal,
            orderItems,
          };

          const result = processReturnRevenueAdjustment(input);

          // Calculate expected returned amount
          const expectedReturnedAmount = returnedItems.reduce(
            (sum, ri) => sum + ri.quantity * ri.unitPrice,
            0
          );

          // Returned amount must be calculated correctly
          expect(result.returnedAmount).toBe(expectedReturnedAmount);

          // New total_purchased = old total_purchased - returned amount (floored at 0)
          const expectedNewTotal = Math.max(0, customerTotal - expectedReturnedAmount);
          expect(result.newTotalPurchased).toBe(expectedNewTotal);

          // The decrease must be exactly the returned amount (when not floored)
          if (customerTotal >= expectedReturnedAmount) {
            expect(customerTotal - result.newTotalPurchased).toBe(expectedReturnedAmount);
          }

          // New total_purchased must never be negative
          expect(result.newTotalPurchased).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('effective order total được tính lại chính xác sau return', () => {
    fc.assert(
      fc.property(
        returnScenarioArb,
        ([orderItems, returnedItems, customerTotal, originalOrderTotal, customerId]) => {
          const input: ReturnInput = {
            returnedItems,
            customer: { id: customerId, total_purchased: customerTotal },
            originalOrderTotal,
            orderItems,
          };

          const result = processReturnRevenueAdjustment(input);

          // Calculate total returned value on the order (previous + current)
          const totalReturnedValue = orderItems.reduce((sum, orderItem) => {
            const currentReturn = returnedItems.find(
              (ri) => ri.orderItemId === orderItem.id
            );
            const currentReturnQty = currentReturn ? currentReturn.quantity : 0;
            const totalReturnedQty = orderItem.returned_quantity + currentReturnQty;
            return sum + totalReturnedQty * orderItem.unit_price;
          }, 0);

          // Effective order total = original - all returned, floored at 0
          const expectedEffective = Math.max(0, originalOrderTotal - totalReturnedValue);
          expect(result.effectiveOrderTotal).toBe(expectedEffective);

          // Effective order total must never exceed original
          expect(result.effectiveOrderTotal).toBeLessThanOrEqual(originalOrderTotal);

          // Effective order total must never be negative
          expect(result.effectiveOrderTotal).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('return amount = sum of (quantity × unit_price) cho mỗi returned item', () => {
    fc.assert(
      fc.property(
        // Simpler generator for this specific property
        fc.array(
          fc.record({
            orderItemId: fc.uuid(),
            productId: fc.uuid(),
            quantity: fc.integer({ min: 1, max: 500 }),
            unitPrice: fc.integer({ min: 1000, max: 10000000 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.integer({ min: 0, max: 500000000 }), // customer total_purchased
        (returnedItems, customerTotal) => {
          // Build minimal order items matching the returned items
          const orderItems = returnedItems.map((ri) => ({
            id: ri.orderItemId,
            quantity: ri.quantity + 10, // enough room
            unit_price: ri.unitPrice,
            returned_quantity: 0,
          }));

          const originalOrderTotal = orderItems.reduce(
            (sum, item) => sum + item.quantity * item.unit_price,
            0
          );

          const input: ReturnInput = {
            returnedItems,
            customer: { id: 'customer-1', total_purchased: customerTotal },
            originalOrderTotal,
            orderItems,
          };

          const result = processReturnRevenueAdjustment(input);

          // Verify returned amount is the sum of each item's (qty × price)
          const expectedAmount = returnedItems.reduce(
            (sum, ri) => sum + ri.quantity * ri.unitPrice,
            0
          );
          expect(result.returnedAmount).toBe(expectedAmount);

          // Each individual item contributes correctly
          for (const ri of returnedItems) {
            const itemContribution = ri.quantity * ri.unitPrice;
            expect(itemContribution).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
