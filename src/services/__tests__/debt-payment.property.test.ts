import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import type { DebtRecord } from '@/lib/types';

/**
 * **Validates: Requirements 10.4**
 *
 * Property 10: Debt Payment Reduces Balance
 * - Payment P (P <= R) → new remaining = R - P
 * - P = R → status = 'paid'
 * - 0 < P < R → status = 'partial'
 */

// === Pure function modeling debt payment logic ===

export interface DebtPaymentInput {
  debtRecord: DebtRecord;
  paymentAmount: number;
}

export interface DebtPaymentResult {
  updatedDebt: DebtRecord;
  paymentAccepted: boolean;
  error?: string;
}

/**
 * Pure function that models the debt payment logic.
 *
 * When a customer makes a payment P on a debt with remaining balance R:
 * - If P <= 0 or P > R: payment is rejected
 * - If P = R: remaining becomes 0, status changes to 'paid'
 * - If 0 < P < R: remaining becomes R - P, status changes to 'partial'
 */
export function applyDebtPayment(input: DebtPaymentInput): DebtPaymentResult {
  const { debtRecord, paymentAmount } = input;
  const remaining = debtRecord.remaining;

  // Validate payment amount
  if (paymentAmount <= 0) {
    return {
      updatedDebt: debtRecord,
      paymentAccepted: false,
      error: 'Payment amount must be positive',
    };
  }

  if (paymentAmount > remaining) {
    return {
      updatedDebt: debtRecord,
      paymentAccepted: false,
      error: 'Payment amount exceeds remaining balance',
    };
  }

  // Calculate new values
  const newPaidAmount = debtRecord.paid_amount + paymentAmount;
  const newRemaining = remaining - paymentAmount;
  const newStatus: DebtRecord['status'] = newRemaining === 0 ? 'paid' : 'partial';

  const updatedDebt: DebtRecord = {
    ...debtRecord,
    paid_amount: newPaidAmount,
    remaining: newRemaining,
    status: newStatus,
  };

  return {
    updatedDebt,
    paymentAccepted: true,
  };
}

// === Generators ===

const debtRecordArb = fc
  .record({
    id: fc.uuid(),
    customer_id: fc.uuid(),
    order_id: fc.uuid(),
    amount: fc.integer({ min: 1000, max: 100000000 }), // 1,000đ - 100,000,000đ
    paid_amount: fc.constant(0), // Will be adjusted below
    due_date: fc.option(fc.date().map((d) => d.toISOString()), { nil: undefined }),
    created_at: fc.date().map((d) => d.toISOString()),
  })
  .chain((record) =>
    // paid_amount must be between 0 and amount
    fc.integer({ min: 0, max: record.amount - 1 }).map((paidAmount) => ({
      ...record,
      paid_amount: paidAmount,
      remaining: record.amount - paidAmount,
      status: (paidAmount === 0 ? 'pending' : 'partial') as DebtRecord['status'],
    }))
  );

// === Property Tests ===

describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 10: Debt Payment Reduces Balance', () => {
  it('payment P (P <= R) → new remaining = R - P', () => {
    fc.assert(
      fc.property(
        debtRecordArb.chain((debt) =>
          fc.integer({ min: 1, max: debt.remaining }).map((payment) => ({
            debt,
            payment,
          }))
        ),
        ({ debt, payment }) => {
          const result = applyDebtPayment({
            debtRecord: debt,
            paymentAmount: payment,
          });

          expect(result.paymentAccepted).toBe(true);
          expect(result.updatedDebt.remaining).toBe(debt.remaining - payment);
          expect(result.updatedDebt.paid_amount).toBe(debt.paid_amount + payment);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('P = R → status = "paid"', () => {
    fc.assert(
      fc.property(debtRecordArb, (debt) => {
        // Pay the full remaining balance
        const payment = debt.remaining;

        const result = applyDebtPayment({
          debtRecord: debt,
          paymentAmount: payment,
        });

        expect(result.paymentAccepted).toBe(true);
        expect(result.updatedDebt.remaining).toBe(0);
        expect(result.updatedDebt.status).toBe('paid');
      }),
      { numRuns: 100 }
    );
  });

  it('0 < P < R → status = "partial"', () => {
    fc.assert(
      fc.property(
        debtRecordArb
          .filter((debt) => debt.remaining > 1) // Need remaining > 1 to have a valid partial payment
          .chain((debt) =>
            fc.integer({ min: 1, max: debt.remaining - 1 }).map((payment) => ({
              debt,
              payment,
            }))
          ),
        ({ debt, payment }) => {
          const result = applyDebtPayment({
            debtRecord: debt,
            paymentAmount: payment,
          });

          expect(result.paymentAccepted).toBe(true);
          expect(result.updatedDebt.remaining).toBeGreaterThan(0);
          expect(result.updatedDebt.status).toBe('partial');
        }
      ),
      { numRuns: 100 }
    );
  });
});
