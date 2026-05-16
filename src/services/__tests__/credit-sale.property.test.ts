import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { calculateLineTotal, calculateDiscount } from '@/services/pricing.service';
import type { DebtRecord } from '@/lib/types';
import type { CartItem } from '@/services/pos.service';

/**
 * **Validates: Requirements 3.6**
 *
 * Property 8: Credit Sale Creates Debt
 * - Mọi order is_credit=true với customer → tạo debt record với amount = order total
 * - Debt record liên kết đúng customer_id và order_id
 */

// === Pure function modeling credit sale → debt creation logic ===

export interface CreditSaleInput {
  items: CartItem[];
  customerId: string;
  orderId: string;
  discountType?: 'fixed' | 'percentage';
  discountValue?: number;
}

export interface CreditSaleResult {
  debtRecord: DebtRecord;
  orderTotal: number;
}

/**
 * Pure function that models the credit sale → debt creation logic.
 *
 * When a sales order is marked as credit (is_credit=true) with a customer,
 * a debt record is created with:
 * - amount = order total (subtotal - discount)
 * - customer_id = the customer who bought on credit
 * - order_id = the sales order that generated the debt
 * - paid_amount = 0 (nothing paid yet)
 * - remaining = amount (full amount outstanding)
 * - status = 'pending'
 */
export function createDebtFromCreditSale(input: CreditSaleInput): CreditSaleResult {
  const { items, customerId, orderId, discountType, discountValue } = input;

  // Calculate subtotal from line items
  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);

  // Calculate discount
  let discountAmount = 0;
  if (discountType && discountValue && discountValue > 0) {
    discountAmount = calculateDiscount(subtotal, discountType, discountValue);
  }

  // Calculate order total
  const orderTotal = subtotal - discountAmount;

  // Create debt record
  const debtRecord: DebtRecord = {
    id: `debt-${orderId}`,
    customer_id: customerId,
    order_id: orderId,
    amount: orderTotal,
    paid_amount: 0,
    remaining: orderTotal,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  return { debtRecord, orderTotal };
}

// === Generators ===

const cartItemArb = fc.record({
  id: fc.uuid(),
  product_id: fc.uuid(),
  product_name: fc.string({ minLength: 1, maxLength: 50 }),
  quantity: fc.integer({ min: 1, max: 1000 }),
  unit: fc.constantFrom('cái', 'mét', 'kg', 'cuộn', 'bao', 'hộp'),
  unit_price: fc.integer({ min: 1000, max: 50000000 }), // 1,000đ - 50,000,000đ
}).map((item) => ({
  ...item,
  line_total: calculateLineTotal(item.quantity, item.unit_price),
}));

const cartItemsArb = fc.array(cartItemArb, { minLength: 1, maxLength: 20 });

const creditSaleInputArb = fc.record({
  items: cartItemsArb,
  customerId: fc.uuid(),
  orderId: fc.uuid(),
  discountType: fc.option(fc.constantFrom('fixed' as const, 'percentage' as const), { nil: undefined }),
  discountValue: fc.option(fc.integer({ min: 0, max: 30 }), { nil: undefined }), // max 30% or 30 fixed
});

// === Property Tests ===

describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 8: Credit Sale Creates Debt', () => {
  it('mọi order is_credit=true với customer → tạo debt record với amount = order total', () => {
    fc.assert(
      fc.property(
        cartItemsArb,
        fc.uuid(),
        fc.uuid(),
        (items, customerId, orderId) => {
          const input: CreditSaleInput = {
            items,
            customerId,
            orderId,
          };

          const result = createDebtFromCreditSale(input);

          // Calculate expected order total
          const expectedSubtotal = items.reduce((sum, item) => sum + item.line_total, 0);
          const expectedTotal = expectedSubtotal; // No discount

          // Debt record amount must equal order total
          expect(result.debtRecord.amount).toBe(expectedTotal);
          expect(result.orderTotal).toBe(expectedTotal);

          // Debt record remaining must equal amount (nothing paid yet)
          expect(result.debtRecord.remaining).toBe(result.debtRecord.amount);
          expect(result.debtRecord.paid_amount).toBe(0);
          expect(result.debtRecord.status).toBe('pending');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('debt record với discount: amount = subtotal - discount_amount', () => {
    fc.assert(
      fc.property(
        cartItemsArb,
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom('fixed' as const, 'percentage' as const),
        fc.integer({ min: 1, max: 20 }), // discount value (% or fixed amount in reasonable range)
        (items, customerId, orderId, discountType, discountValue) => {
          const input: CreditSaleInput = {
            items,
            customerId,
            orderId,
            discountType,
            discountValue,
          };

          const result = createDebtFromCreditSale(input);

          // Calculate expected values
          const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
          const expectedDiscount = calculateDiscount(subtotal, discountType, discountValue);
          const expectedTotal = subtotal - expectedDiscount;

          // Debt amount must equal order total after discount
          expect(result.debtRecord.amount).toBe(expectedTotal);
          expect(result.orderTotal).toBe(expectedTotal);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('debt record liên kết đúng customer_id và order_id', () => {
    fc.assert(
      fc.property(
        creditSaleInputArb,
        (input) => {
          // Skip if discountValue is provided without discountType (invalid combo)
          if (input.discountValue !== undefined && input.discountType === undefined) {
            return;
          }

          const safeInput: CreditSaleInput = {
            items: input.items,
            customerId: input.customerId,
            orderId: input.orderId,
            discountType: input.discountType,
            discountValue: input.discountValue,
          };

          const result = createDebtFromCreditSale(safeInput);

          // Debt record must link to correct customer
          expect(result.debtRecord.customer_id).toBe(input.customerId);

          // Debt record must link to correct order
          expect(result.debtRecord.order_id).toBe(input.orderId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
