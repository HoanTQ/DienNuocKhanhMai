import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { calculateWeightedAvgCost } from '@/services/pricing.service';

/**
 * **Validates: Requirements 7.2, 8.2**
 *
 * Property 2: Weighted Average Cost Calculation
 * - WAC mới = (S × C + Q × P) / (S + Q) cho mọi valid inputs
 * - Khi current_stock = 0, WAC mới = new unit cost
 * - WAC luôn nằm giữa min và max của old cost và new cost
 */
describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 2: Weighted Average Cost Calculation', () => {
  it('WAC mới = (S × C + Q × P) / (S + Q) cho mọi valid inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),    // currentStock (S)
        fc.integer({ min: 100, max: 10000000 }), // currentAvgCost (C) - đồng
        fc.integer({ min: 1, max: 10000 }),      // newQuantity (Q)
        fc.integer({ min: 100, max: 10000000 }), // newUnitCost (P) - đồng
        (currentStock, currentAvgCost, newQuantity, newUnitCost) => {
          const result = calculateWeightedAvgCost(
            currentStock,
            currentAvgCost,
            newQuantity,
            newUnitCost
          );
          const expected =
            (currentStock * currentAvgCost + newQuantity * newUnitCost) /
            (currentStock + newQuantity);
          expect(result).toBeCloseTo(expected, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('khi current_stock = 0, WAC mới = new unit cost', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000000 }),   // currentAvgCost (bất kỳ, sẽ bị bỏ qua)
        fc.integer({ min: 1, max: 10000 }),      // newQuantity
        fc.integer({ min: 100, max: 10000000 }), // newUnitCost
        (currentAvgCost, newQuantity, newUnitCost) => {
          const result = calculateWeightedAvgCost(
            0,
            currentAvgCost,
            newQuantity,
            newUnitCost
          );
          expect(result).toBe(newUnitCost);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('WAC luôn nằm giữa min và max của old cost và new cost', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),    // currentStock (S > 0)
        fc.integer({ min: 100, max: 10000000 }), // currentAvgCost (C)
        fc.integer({ min: 1, max: 10000 }),      // newQuantity (Q)
        fc.integer({ min: 100, max: 10000000 }), // newUnitCost (P)
        (currentStock, currentAvgCost, newQuantity, newUnitCost) => {
          const result = calculateWeightedAvgCost(
            currentStock,
            currentAvgCost,
            newQuantity,
            newUnitCost
          );
          const minCost = Math.min(currentAvgCost, newUnitCost);
          const maxCost = Math.max(currentAvgCost, newUnitCost);
          expect(result).toBeGreaterThanOrEqual(minCost);
          expect(result).toBeLessThanOrEqual(maxCost);
        }
      ),
      { numRuns: 100 }
    );
  });
});
