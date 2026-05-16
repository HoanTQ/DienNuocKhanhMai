import { describe, it, expect } from 'vitest';
import {
  calculateWeightedAvgCost,
  convertUnit,
  calculateDiscount,
  calculateLineTotal,
} from './pricing.service';
import type { UnitConversion } from '@/lib/types';

describe('pricing.service', () => {
  // === calculateWeightedAvgCost ===
  describe('calculateWeightedAvgCost', () => {
    it('should calculate WAC correctly for typical inputs', () => {
      // 100 cái × 6,800đ + 50 cái × 7,000đ = (680,000 + 350,000) / 150 = 6,866.67
      const result = calculateWeightedAvgCost(100, 6800, 50, 7000);
      expect(result).toBeCloseTo(6866.67, 0);
    });

    it('should return newUnitCost when currentStock is 0', () => {
      const result = calculateWeightedAvgCost(0, 0, 10, 5000);
      expect(result).toBe(5000);
    });

    it('should return newUnitCost when currentStock is 0 regardless of currentAvgCost', () => {
      const result = calculateWeightedAvgCost(0, 9999, 5, 3000);
      expect(result).toBe(3000);
    });

    it('should handle equal costs (WAC stays the same)', () => {
      const result = calculateWeightedAvgCost(100, 5000, 50, 5000);
      expect(result).toBe(5000);
    });

    it('should throw for negative currentStock', () => {
      expect(() => calculateWeightedAvgCost(-1, 5000, 10, 5000)).toThrow(
        'currentStock không được là số âm'
      );
    });

    it('should throw for negative currentAvgCost', () => {
      expect(() => calculateWeightedAvgCost(10, -100, 10, 5000)).toThrow(
        'currentAvgCost không được là số âm'
      );
    });

    it('should throw for zero newQuantity', () => {
      expect(() => calculateWeightedAvgCost(10, 5000, 0, 5000)).toThrow(
        'newQuantity phải là số dương lớn hơn 0'
      );
    });

    it('should throw for negative newQuantity', () => {
      expect(() => calculateWeightedAvgCost(10, 5000, -5, 5000)).toThrow(
        'newQuantity phải là số dương lớn hơn 0'
      );
    });

    it('should throw for negative newUnitCost', () => {
      expect(() => calculateWeightedAvgCost(10, 5000, 10, -100)).toThrow(
        'newUnitCost không được là số âm'
      );
    });

    it('should handle newUnitCost of 0 (free goods)', () => {
      // 10 × 5000 + 5 × 0 = 50000 / 15 = 3333.33
      const result = calculateWeightedAvgCost(10, 5000, 5, 0);
      expect(result).toBeCloseTo(3333.33, 0);
    });
  });

  // === convertUnit ===
  describe('convertUnit', () => {
    const sampleConversions: UnitConversion[] = [
      {
        id: '1',
        product_id: 'p1',
        from_unit: 'cuộn',
        to_unit: 'mét',
        conversion_rate: 100,
        level: 1,
      },
      {
        id: '2',
        product_id: 'p1',
        from_unit: 'mét',
        to_unit: 'cm',
        conversion_rate: 100,
        level: 2,
      },
    ];

    it('should return same quantity when fromUnit equals toUnit', () => {
      expect(convertUnit(5, 'mét', 'mét', sampleConversions)).toBe(5);
    });

    it('should convert directly (cuộn → mét)', () => {
      expect(convertUnit(2, 'cuộn', 'mét', sampleConversions)).toBe(200);
    });

    it('should convert in reverse (mét → cuộn)', () => {
      expect(convertUnit(200, 'mét', 'cuộn', sampleConversions)).toBe(2);
    });

    it('should convert through intermediate unit (cuộn → cm)', () => {
      // 1 cuộn = 100 mét, 1 mét = 100 cm → 1 cuộn = 10,000 cm
      expect(convertUnit(1, 'cuộn', 'cm', sampleConversions)).toBe(10000);
    });

    it('should convert through intermediate unit in reverse (cm → cuộn)', () => {
      expect(convertUnit(10000, 'cm', 'cuộn', sampleConversions)).toBe(1);
    });

    it('should handle quantity of 0', () => {
      expect(convertUnit(0, 'cuộn', 'mét', sampleConversions)).toBe(0);
    });

    it('should throw for negative quantity', () => {
      expect(() => convertUnit(-1, 'cuộn', 'mét', sampleConversions)).toThrow(
        'quantity không được là số âm'
      );
    });

    it('should throw for empty fromUnit', () => {
      expect(() => convertUnit(1, '', 'mét', sampleConversions)).toThrow(
        'fromUnit không được để trống'
      );
    });

    it('should throw for empty toUnit', () => {
      expect(() => convertUnit(1, 'cuộn', '', sampleConversions)).toThrow(
        'toUnit không được để trống'
      );
    });

    it('should throw when no conversion path exists', () => {
      expect(() => convertUnit(1, 'cuộn', 'kg', sampleConversions)).toThrow(
        'Không tìm thấy đường chuyển đổi từ "cuộn" sang "kg"'
      );
    });

    it('should handle 3-level conversion chain', () => {
      const threeLevel: UnitConversion[] = [
        {
          id: '1',
          product_id: 'p1',
          from_unit: 'thùng',
          to_unit: 'hộp',
          conversion_rate: 12,
          level: 1,
        },
        {
          id: '2',
          product_id: 'p1',
          from_unit: 'hộp',
          to_unit: 'cái',
          conversion_rate: 10,
          level: 2,
        },
      ];
      // 1 thùng = 12 hộp = 120 cái
      expect(convertUnit(2, 'thùng', 'cái', threeLevel)).toBe(240);
    });
  });

  // === calculateDiscount ===
  describe('calculateDiscount', () => {
    it('should calculate fixed discount correctly', () => {
      expect(calculateDiscount(500000, 'fixed', 50000)).toBe(50000);
    });

    it('should calculate percentage discount correctly', () => {
      // 500,000 × 5% = 25,000
      expect(calculateDiscount(500000, 'percentage', 5)).toBe(25000);
    });

    it('should return 0 for 0% discount', () => {
      expect(calculateDiscount(500000, 'percentage', 0)).toBe(0);
    });

    it('should return subtotal for 100% discount', () => {
      expect(calculateDiscount(500000, 'percentage', 100)).toBe(500000);
    });

    it('should return 0 for fixed discount of 0', () => {
      expect(calculateDiscount(500000, 'fixed', 0)).toBe(0);
    });

    it('should throw for negative subtotal', () => {
      expect(() => calculateDiscount(-100, 'fixed', 50)).toThrow(
        'subtotal không được là số âm'
      );
    });

    it('should throw for negative discountValue', () => {
      expect(() => calculateDiscount(500000, 'fixed', -100)).toThrow(
        'discountValue không được là số âm'
      );
    });

    it('should throw for percentage > 100', () => {
      expect(() => calculateDiscount(500000, 'percentage', 101)).toThrow(
        'discountValue phần trăm không được vượt quá 100'
      );
    });

    it('should throw for fixed discount exceeding subtotal', () => {
      expect(() => calculateDiscount(500000, 'fixed', 600000)).toThrow(
        'discountValue cố định không được vượt quá subtotal'
      );
    });

    it('should handle subtotal of 0 with percentage discount', () => {
      expect(calculateDiscount(0, 'percentage', 10)).toBe(0);
    });

    it('should handle subtotal of 0 with fixed discount of 0', () => {
      expect(calculateDiscount(0, 'fixed', 0)).toBe(0);
    });
  });

  // === calculateLineTotal ===
  describe('calculateLineTotal', () => {
    it('should calculate line total correctly', () => {
      expect(calculateLineTotal(5, 10000)).toBe(50000);
    });

    it('should return 0 when quantity is 0', () => {
      expect(calculateLineTotal(0, 10000)).toBe(0);
    });

    it('should return 0 when unitPrice is 0', () => {
      expect(calculateLineTotal(5, 0)).toBe(0);
    });

    it('should handle decimal quantities', () => {
      // 2.5 mét × 45,000đ/mét = 112,500đ
      expect(calculateLineTotal(2.5, 45000)).toBe(112500);
    });

    it('should throw for negative quantity', () => {
      expect(() => calculateLineTotal(-1, 10000)).toThrow(
        'quantity không được là số âm'
      );
    });

    it('should throw for negative unitPrice', () => {
      expect(() => calculateLineTotal(5, -100)).toThrow(
        'unitPrice không được là số âm'
      );
    });
  });
});
