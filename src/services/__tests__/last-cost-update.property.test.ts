import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import type { Product, GoodsReceiptItem, PriceHistory } from '@/lib/types';

// ============================================================
// Pure function modeling: Last Cost Update on Receipt
// ============================================================

/**
 * Khi phiếu nhập kho được xác nhận, cập nhật last_cost của product
 * bằng unit_cost từ phiếu nhập đó.
 *
 * @returns Product mới với last_cost đã cập nhật
 */
export function updateLastCostOnReceipt(
  product: Pick<Product, 'id' | 'last_cost'>,
  receiptItem: Pick<GoodsReceiptItem, 'product_id' | 'unit_cost'>
): Pick<Product, 'id' | 'last_cost'> {
  if (receiptItem.product_id !== product.id) {
    throw new Error('Receipt item product_id không khớp với product id');
  }
  if (receiptItem.unit_cost < 0) {
    throw new Error('unit_cost không được là số âm');
  }

  return {
    ...product,
    last_cost: receiptItem.unit_cost,
  };
}

/**
 * Khi phiếu nhập kho được xác nhận, tạo price history record
 * ghi nhận giá mới và timestamp.
 *
 * @returns PriceHistory record mới
 */
export function createPriceHistoryOnReceipt(
  receiptItem: Pick<GoodsReceiptItem, 'goods_receipt_id' | 'product_id' | 'unit_cost' | 'quantity'>,
  supplierId: string,
  timestamp: string
): Omit<PriceHistory, 'id'> {
  if (receiptItem.unit_cost < 0) {
    throw new Error('unit_cost không được là số âm');
  }
  if (receiptItem.quantity <= 0) {
    throw new Error('quantity phải là số dương');
  }
  if (!supplierId || !supplierId.trim()) {
    throw new Error('supplierId không được để trống');
  }
  if (!timestamp || !timestamp.trim()) {
    throw new Error('timestamp không được để trống');
  }

  return {
    product_id: receiptItem.product_id,
    supplier_id: supplierId,
    unit_cost: receiptItem.unit_cost,
    quantity: receiptItem.quantity,
    receipt_id: receiptItem.goods_receipt_id,
    created_at: timestamp,
  };
}

// ============================================================
// Property Tests
// ============================================================

/**
 * **Validates: Requirements 7.6, 8.5**
 *
 * Property 16: Last Cost Update on Receipt
 * - Sau khi xác nhận phiếu nhập, last_cost = unit price từ phiếu đó
 * - Price history record được tạo với giá mới và timestamp
 */
describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 16: Last Cost Update on Receipt', () => {
  // Generators
  const productIdArb = fc.uuid();
  const supplierIdArb = fc.uuid();
  const receiptIdArb = fc.uuid();
  const unitCostArb = fc.integer({ min: 100, max: 10000000 }); // đồng
  const quantityArb = fc.integer({ min: 1, max: 10000 });
  const timestampArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
    .map(d => d.toISOString());

  it('sau khi xác nhận phiếu nhập, last_cost = unit price từ phiếu đó', () => {
    fc.assert(
      fc.property(
        productIdArb,
        unitCostArb, // old last_cost
        unitCostArb, // new unit_cost from receipt
        (productId, oldLastCost, newUnitCost) => {
          const product = { id: productId, last_cost: oldLastCost };
          const receiptItem = { product_id: productId, unit_cost: newUnitCost };

          const updatedProduct = updateLastCostOnReceipt(product, receiptItem);

          // last_cost phải bằng unit_cost từ phiếu nhập
          expect(updatedProduct.last_cost).toBe(newUnitCost);
          // product id không thay đổi
          expect(updatedProduct.id).toBe(productId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('last_cost luôn được ghi đè bởi unit_cost mới nhất bất kể giá trị cũ', () => {
    fc.assert(
      fc.property(
        productIdArb,
        unitCostArb,
        unitCostArb,
        unitCostArb,
        (productId, oldLastCost, firstReceiptCost, secondReceiptCost) => {
          const product = { id: productId, last_cost: oldLastCost };

          // Xác nhận phiếu nhập lần 1
          const afterFirst = updateLastCostOnReceipt(
            product,
            { product_id: productId, unit_cost: firstReceiptCost }
          );
          expect(afterFirst.last_cost).toBe(firstReceiptCost);

          // Xác nhận phiếu nhập lần 2
          const afterSecond = updateLastCostOnReceipt(
            afterFirst,
            { product_id: productId, unit_cost: secondReceiptCost }
          );
          expect(afterSecond.last_cost).toBe(secondReceiptCost);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('price history record được tạo với giá mới và timestamp', () => {
    fc.assert(
      fc.property(
        productIdArb,
        supplierIdArb,
        receiptIdArb,
        unitCostArb,
        quantityArb,
        timestampArb,
        (productId, supplierId, receiptId, unitCost, quantity, timestamp) => {
          const receiptItem = {
            goods_receipt_id: receiptId,
            product_id: productId,
            unit_cost: unitCost,
            quantity: quantity,
          };

          const priceHistory = createPriceHistoryOnReceipt(
            receiptItem,
            supplierId,
            timestamp
          );

          // Price history phải chứa đúng unit_cost từ phiếu nhập
          expect(priceHistory.unit_cost).toBe(unitCost);
          // Price history phải chứa đúng timestamp
          expect(priceHistory.created_at).toBe(timestamp);
          // Price history phải liên kết đúng product_id
          expect(priceHistory.product_id).toBe(productId);
          // Price history phải liên kết đúng supplier_id
          expect(priceHistory.supplier_id).toBe(supplierId);
          // Price history phải liên kết đúng receipt_id
          expect(priceHistory.receipt_id).toBe(receiptId);
          // Price history phải chứa đúng quantity
          expect(priceHistory.quantity).toBe(quantity);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('price history unit_cost khớp với last_cost sau khi cập nhật', () => {
    fc.assert(
      fc.property(
        productIdArb,
        supplierIdArb,
        receiptIdArb,
        unitCostArb, // old last_cost
        unitCostArb, // new unit_cost
        quantityArb,
        timestampArb,
        (productId, supplierId, receiptId, oldLastCost, newUnitCost, quantity, timestamp) => {
          const product = { id: productId, last_cost: oldLastCost };
          const receiptItem = {
            goods_receipt_id: receiptId,
            product_id: productId,
            unit_cost: newUnitCost,
            quantity: quantity,
          };

          // Cập nhật last_cost
          const updatedProduct = updateLastCostOnReceipt(product, { product_id: productId, unit_cost: newUnitCost });

          // Tạo price history
          const priceHistory = createPriceHistoryOnReceipt(receiptItem, supplierId, timestamp);

          // last_cost và price history unit_cost phải khớp nhau
          expect(updatedProduct.last_cost).toBe(priceHistory.unit_cost);
        }
      ),
      { numRuns: 100 }
    );
  });
});
