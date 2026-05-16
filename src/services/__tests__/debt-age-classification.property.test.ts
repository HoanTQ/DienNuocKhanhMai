import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import type { DebtRecord } from '@/lib/types';

/**
 * **Validates: Requirements 10.2**
 *
 * Property 11: Debt Age Classification
 * - 1-3 ngày → 'short-term'
 * - 4-5 ngày → 'medium-term'
 * - 6-30 ngày → 'long-term'
 * - Vượt ngưỡng giá trị (≥ 5,000,000 VND) → 'large' bất kể tuổi nợ
 */

// === Constants ===

const LARGE_DEBT_THRESHOLD = 5_000_000; // 5 triệu VND

// === Types ===

type DebtAgeCategory = 'short-term' | 'medium-term' | 'long-term' | 'large';

// === Pure functions extracted from debts/page.tsx ===

/** Tính số ngày nợ từ ngày tạo */
function getDaysOutstanding(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/** Phân loại tuổi nợ theo yêu cầu */
function classifyDebtAge(debt: DebtRecord): DebtAgeCategory {
  // Nợ lớn: theo giá trị, bất kể tuổi nợ
  if (debt.remaining >= LARGE_DEBT_THRESHOLD) {
    return 'large';
  }
  const days = getDaysOutstanding(debt.created_at);
  if (days <= 3) return 'short-term';
  if (days <= 5) return 'medium-term';
  return 'long-term';
}

// === Helpers ===

/** Tạo ngày cách đây N ngày */
function daysAgo(n: number): string {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date.toISOString();
}

/** Tạo DebtRecord với remaining và created_at tùy chỉnh */
function makeDebtRecord(remaining: number, createdAt: string): DebtRecord {
  return {
    id: 'test-debt-id',
    customer_id: 'test-customer-id',
    order_id: 'test-order-id',
    amount: remaining,
    paid_amount: 0,
    remaining,
    status: 'pending',
    created_at: createdAt,
  };
}

// === Generators ===

/** Generator cho số ngày trong khoảng short-term: 1-3 ngày */
const shortTermDaysArb = fc.integer({ min: 1, max: 3 });

/** Generator cho số ngày trong khoảng medium-term: 4-5 ngày */
const mediumTermDaysArb = fc.integer({ min: 4, max: 5 });

/** Generator cho số ngày trong khoảng long-term: 6-30 ngày */
const longTermDaysArb = fc.integer({ min: 6, max: 30 });

/** Generator cho số ngày bất kỳ (1-30) - dùng cho test 'large' */
const anyDaysArb = fc.integer({ min: 1, max: 30 });

/** Generator cho remaining dưới ngưỡng nợ lớn (1 - 4,999,999 VND) */
const belowThresholdRemainingArb = fc.integer({ min: 1, max: LARGE_DEBT_THRESHOLD - 1 });

/** Generator cho remaining vượt ngưỡng nợ lớn (≥ 5,000,000 VND) */
const aboveThresholdRemainingArb = fc.integer({ min: LARGE_DEBT_THRESHOLD, max: 100_000_000 });

// === Property Tests ===

describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 11: Debt Age Classification', () => {
  it('1-3 ngày → short-term (khi remaining < ngưỡng nợ lớn)', () => {
    fc.assert(
      fc.property(
        shortTermDaysArb,
        belowThresholdRemainingArb,
        (days, remaining) => {
          const debt = makeDebtRecord(remaining, daysAgo(days));
          const category = classifyDebtAge(debt);
          expect(category).toBe('short-term');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('4-5 ngày → medium-term (khi remaining < ngưỡng nợ lớn)', () => {
    fc.assert(
      fc.property(
        mediumTermDaysArb,
        belowThresholdRemainingArb,
        (days, remaining) => {
          const debt = makeDebtRecord(remaining, daysAgo(days));
          const category = classifyDebtAge(debt);
          expect(category).toBe('medium-term');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('6-30 ngày → long-term (khi remaining < ngưỡng nợ lớn)', () => {
    fc.assert(
      fc.property(
        longTermDaysArb,
        belowThresholdRemainingArb,
        (days, remaining) => {
          const debt = makeDebtRecord(remaining, daysAgo(days));
          const category = classifyDebtAge(debt);
          expect(category).toBe('long-term');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('vượt ngưỡng giá trị (≥ 5,000,000 VND) → large bất kể tuổi nợ', () => {
    fc.assert(
      fc.property(
        anyDaysArb,
        aboveThresholdRemainingArb,
        (days, remaining) => {
          const debt = makeDebtRecord(remaining, daysAgo(days));
          const category = classifyDebtAge(debt);
          expect(category).toBe('large');
        }
      ),
      { numRuns: 100 }
    );
  });
});
