import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { productCreateSchema } from '@/lib/validations/product.schema';

/**
 * **Validates: Requirements 6.1**
 *
 * Property 14: Product Validation
 * - tạo product thiếu required fields → bị reject với validation error
 * - tạo product đủ required fields → được accept
 */
describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 14: Product Validation', () => {
  // Generators for valid field values
  const validName = fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0);
  const validCategoryId = fc.uuid();
  const validBrand = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);
  const validSpecification = fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0);
  const validBaseUnit = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);
  const validSellingPrice = fc.integer({ min: 0, max: 100000000 });
  const validPriceType = fc.constantFrom('fixed' as const, 'variable' as const);

  // Generator for a complete valid product
  const validProductArb = fc.record({
    name: validName,
    category_id: validCategoryId,
    brand: validBrand,
    specification: validSpecification,
    base_unit: validBaseUnit,
    selling_price: validSellingPrice,
    price_type: validPriceType,
    min_stock_level: fc.integer({ min: 0, max: 10000 }),
  });

  const requiredFields = ['name', 'category_id', 'brand', 'specification', 'base_unit'] as const;

  it('product đủ required fields → safeParse should succeed', () => {
    fc.assert(
      fc.property(
        validProductArb,
        (product) => {
          const result = productCreateSchema.safeParse(product);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('product thiếu một required field → safeParse should fail', () => {
    fc.assert(
      fc.property(
        validProductArb,
        fc.constantFrom(...requiredFields),
        (product, fieldToOmit) => {
          // Remove one required field
          const incomplete = { ...product };
          delete (incomplete as Record<string, unknown>)[fieldToOmit];

          const result = productCreateSchema.safeParse(incomplete);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('product với required field là empty string → safeParse should fail', () => {
    fc.assert(
      fc.property(
        validProductArb,
        fc.constantFrom(...requiredFields),
        (product, fieldToEmpty) => {
          // Set one required field to empty string
          const withEmpty = { ...product, [fieldToEmpty]: '' };

          const result = productCreateSchema.safeParse(withEmpty);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('product thiếu nhiều required fields → safeParse should fail', () => {
    fc.assert(
      fc.property(
        validProductArb,
        fc.subarray([...requiredFields], { minLength: 1 }),
        (product, fieldsToOmit) => {
          // Remove multiple required fields
          const incomplete = { ...product };
          for (const field of fieldsToOmit) {
            delete (incomplete as Record<string, unknown>)[field];
          }

          const result = productCreateSchema.safeParse(incomplete);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
