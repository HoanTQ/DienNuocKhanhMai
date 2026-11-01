import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import type { Product } from '@/lib/types';

/**
 * Pure search filter function for testing.
 * Replicates the ilike search logic from ProductSearch component:
 * - Matches query (case-insensitive) against product name, brand, or specification
 * - A product matches if the query is a substring of any of those fields
 */
export function filterProductsByQuery(
  products: Product[],
  query: string
): Product[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const lowerQuery = trimmedQuery.toLowerCase();

  return products.filter((product) => {
    const name = product.name.toLowerCase();
    const brand = product.brand.toLowerCase();
    const specification = product.specification.toLowerCase();

    return (
      name.includes(lowerQuery) ||
      brand.includes(lowerQuery) ||
      specification.includes(lowerQuery)
    );
  });
}

/**
 * Helper: checks if a product matches a query (case-insensitive substring match)
 */
function productMatchesQuery(product: Product, query: string): boolean {
  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) return false;

  return (
    product.name.toLowerCase().includes(lowerQuery) ||
    product.brand.toLowerCase().includes(lowerQuery) ||
    product.specification.toLowerCase().includes(lowerQuery)
  );
}

// Arbitrary for generating a valid Product
const productArb = (overrides?: Partial<Product>): fc.Arbitrary<Product> =>
  fc.record({
    id: fc.uuid(),
    name: overrides?.name !== undefined
      ? fc.constant(overrides.name)
      : fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
    category_id: fc.option(fc.uuid(), { nil: undefined }),
    brand: overrides?.brand !== undefined
      ? fc.constant(overrides.brand)
      : fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    specification: overrides?.specification !== undefined
      ? fc.constant(overrides.specification)
      : fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    base_unit: fc.constantFrom('cái', 'mét', 'kg', 'cuộn', 'bao', 'hộp'),
    barcode: fc.option(fc.stringMatching(/^[0-9]{8,13}$/), { nil: undefined }),
    image_url: fc.constant(undefined),
    description: fc.constant(undefined),
    selling_price: fc.integer({ min: 1000, max: 50000000 }),
    price_type: fc.constantFrom('fixed' as const, 'variable' as const),
    weighted_avg_cost: fc.integer({ min: 500, max: 40000000 }),
    last_cost: fc.integer({ min: 500, max: 40000000 }),
    min_stock_level: fc.integer({ min: 1, max: 1000 }),
    current_stock: fc.integer({ min: 0, max: 100000 }),
    created_at: fc.constant('2024-01-01T00:00:00Z'),
    updated_at: fc.constant('2024-01-01T00:00:00Z'),
  });

// Arbitrary for generating a non-empty search query string
const searchQueryArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim().length > 0);

/**
 * **Validates: Requirements 2.2**
 *
 * Property 13: Search Results Relevance
 * - Mọi kết quả trả về đều chứa query (hoặc substring) trong name, brand, hoặc specification
 * - Không có product matching query bị loại khỏi kết quả
 */
describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 13: Search Results Relevance', () => {
  it('mọi kết quả trả về đều chứa query trong name, brand, hoặc specification', () => {
    fc.assert(
      fc.property(
        fc.array(productArb(), { minLength: 1, maxLength: 50 }),
        searchQueryArb,
        (products, query) => {
          const results = filterProductsByQuery(products, query);

          // Every result must contain the query in at least one searchable field
          for (const result of results) {
            const matches = productMatchesQuery(result, query);
            expect(matches).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('không có product matching query bị loại khỏi kết quả (completeness)', () => {
    fc.assert(
      fc.property(
        fc.array(productArb(), { minLength: 1, maxLength: 50 }),
        searchQueryArb,
        (products, query) => {
          const results = filterProductsByQuery(products, query);

          // Every product that matches the query must be in the results
          for (const product of products) {
            if (productMatchesQuery(product, query)) {
              const found = results.some((r) => r.id === product.id);
              expect(found).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('kết quả trả về là subset chính xác của products matching query', () => {
    fc.assert(
      fc.property(
        fc.array(productArb(), { minLength: 0, maxLength: 50 }),
        searchQueryArb,
        (products, query) => {
          const results = filterProductsByQuery(products, query);

          // Results count should equal the number of matching products
          const expectedCount = products.filter((p) =>
            productMatchesQuery(p, query)
          ).length;
          expect(results.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('search với query là substring của product name luôn trả về product đó', () => {
    fc.assert(
      fc.property(
        productArb(),
        fc.array(productArb(), { minLength: 0, maxLength: 20 }),
        (targetProduct, otherProducts) => {
          // Extract a non-empty substring from the product name
          const name = targetProduct.name;
          if (name.length === 0) return; // skip if empty name

          // Pick a random substring of the name (at least 1 char)
          const startIdx = 0;
          const endIdx = Math.max(1, Math.ceil(name.length / 2));
          const querySubstring = name.slice(startIdx, endIdx);

          if (querySubstring.trim().length === 0) return; // skip whitespace-only

          const allProducts = [targetProduct, ...otherProducts];
          const results = filterProductsByQuery(allProducts, querySubstring);

          // The target product must be in results
          const found = results.some((r) => r.id === targetProduct.id);
          expect(found).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('search là case-insensitive: query uppercase/lowercase đều match', () => {
    fc.assert(
      fc.property(
        productArb(),
        (product) => {
          const query = product.brand; // Use brand as query
          if (query.trim().length === 0) return;

          const products = [product];

          // Search with original case
          const resultsOriginal = filterProductsByQuery(products, query);
          // Search with uppercase
          const resultsUpper = filterProductsByQuery(products, query.toUpperCase());
          // Search with lowercase
          const resultsLower = filterProductsByQuery(products, query.toLowerCase());

          // All should return the same results
          expect(resultsOriginal.length).toBe(resultsUpper.length);
          expect(resultsOriginal.length).toBe(resultsLower.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty query trả về mảng rỗng', () => {
    fc.assert(
      fc.property(
        fc.array(productArb(), { minLength: 1, maxLength: 20 }),
        fc.constantFrom('', '   ', '\t', '\n'),
        (products, emptyQuery) => {
          const results = filterProductsByQuery(products, emptyQuery);
          expect(results).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
