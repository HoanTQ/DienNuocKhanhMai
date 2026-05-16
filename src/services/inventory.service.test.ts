import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateStock,
  checkLowStock,
  getStockAge,
  calculateStockAgeDays,
  getStockChange,
} from './inventory.service';
import type { UpdateStockParams } from './inventory.service';

// Track all from() calls with their configured responses
let fromCallIndex: number;
let fromResponses: Array<{
  table: string;
  finalResponse: { data: unknown; error: unknown };
}>;

/**
 * Helper to configure mock responses for sequential Supabase calls.
 * Each call to supabase.from(table).select/insert/update...single/limit
 * will resolve with the configured response in order.
 */
function mockFromResponse(table: string, response: { data: unknown; error: unknown }) {
  fromResponses.push({ table, response: response, finalResponse: response });
}

// Create a chainable mock that resolves with configured responses
function createChainForCall(callIndex: number) {
  const chain: Record<string, any> = {};
  const response = fromResponses[callIndex]?.finalResponse ?? { data: null, error: null };

  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(response);
  chain.limit = vi.fn().mockResolvedValue(response);

  return chain;
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      const idx = fromCallIndex++;
      return createChainForCall(idx);
    },
  }),
}));

describe('inventory.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallIndex = 0;
    fromResponses = [];
  });

  // === getStockChange (pure function) ===
  describe('getStockChange', () => {
    it('should return negative quantity for sale', () => {
      expect(getStockChange('sale', 10)).toBe(-10);
    });

    it('should return positive quantity for purchase', () => {
      expect(getStockChange('purchase', 10)).toBe(10);
    });

    it('should return positive quantity for return', () => {
      expect(getStockChange('return', 5)).toBe(5);
    });

    it('should return positive quantity for adjustment (increase)', () => {
      expect(getStockChange('adjustment', 3)).toBe(3);
    });

    it('should throw for invalid movement type', () => {
      expect(() => getStockChange('invalid' as any, 10)).toThrow(
        'Loại movement không hợp lệ: invalid'
      );
    });
  });

  // === calculateStockAgeDays (pure function) ===
  describe('calculateStockAgeDays', () => {
    it('should return null when lastStockedAt is null', () => {
      expect(calculateStockAgeDays(null)).toBeNull();
    });

    it('should return 0 days when stocked today', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      const lastStocked = '2024-06-15T08:00:00Z';
      expect(calculateStockAgeDays(lastStocked, now)).toBe(0);
    });

    it('should return correct number of days', () => {
      const now = new Date('2024-06-20T12:00:00Z');
      const lastStocked = '2024-06-15T12:00:00Z';
      expect(calculateStockAgeDays(lastStocked, now)).toBe(5);
    });

    it('should return 30 days for a month-old stock', () => {
      const now = new Date('2024-07-15T12:00:00Z');
      const lastStocked = '2024-06-15T12:00:00Z';
      expect(calculateStockAgeDays(lastStocked, now)).toBe(30);
    });

    it('should floor partial days', () => {
      const now = new Date('2024-06-16T06:00:00Z'); // 22 hours after
      const lastStocked = '2024-06-15T08:00:00Z';
      expect(calculateStockAgeDays(lastStocked, now)).toBe(0);
    });

    it('should handle exactly 1 day difference', () => {
      const now = new Date('2024-06-16T12:00:00Z');
      const lastStocked = '2024-06-15T12:00:00Z';
      expect(calculateStockAgeDays(lastStocked, now)).toBe(1);
    });
  });

  // === updateStock ===
  describe('updateStock', () => {
    it('should throw for empty productId', async () => {
      const params: UpdateStockParams = {
        productId: '',
        quantity: 10,
        movementType: 'sale',
        referenceId: 'ref-1',
        createdBy: 'user-1',
      };
      await expect(updateStock(params)).rejects.toThrow('productId không được để trống');
    });

    it('should throw for empty referenceId', async () => {
      const params: UpdateStockParams = {
        productId: 'prod-1',
        quantity: 10,
        movementType: 'sale',
        referenceId: '',
        createdBy: 'user-1',
      };
      await expect(updateStock(params)).rejects.toThrow('referenceId không được để trống');
    });

    it('should throw for empty createdBy', async () => {
      const params: UpdateStockParams = {
        productId: 'prod-1',
        quantity: 10,
        movementType: 'sale',
        referenceId: 'ref-1',
        createdBy: '',
      };
      await expect(updateStock(params)).rejects.toThrow('createdBy không được để trống');
    });

    it('should throw for zero quantity', async () => {
      const params: UpdateStockParams = {
        productId: 'prod-1',
        quantity: 0,
        movementType: 'sale',
        referenceId: 'ref-1',
        createdBy: 'user-1',
      };
      await expect(updateStock(params)).rejects.toThrow('quantity phải là số dương lớn hơn 0');
    });

    it('should throw for negative quantity', async () => {
      const params: UpdateStockParams = {
        productId: 'prod-1',
        quantity: -5,
        movementType: 'sale',
        referenceId: 'ref-1',
        createdBy: 'user-1',
      };
      await expect(updateStock(params)).rejects.toThrow('quantity phải là số dương lớn hơn 0');
    });

    it('should return error when product not found', async () => {
      // from('products').select().eq().single() → error
      mockFromResponse('products', { data: null, error: { message: 'Row not found' } });

      const params: UpdateStockParams = {
        productId: 'nonexistent',
        quantity: 10,
        movementType: 'sale',
        referenceId: 'ref-1',
        createdBy: 'user-1',
      };

      const result = await updateStock(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Không tìm thấy sản phẩm');
    });

    it('should return error when stock would go negative on sale', async () => {
      // Product has 5 in stock, trying to sell 10
      mockFromResponse('products', {
        data: { current_stock: 5, base_unit: 'cái' },
        error: null,
      });

      const params: UpdateStockParams = {
        productId: 'prod-1',
        quantity: 10,
        movementType: 'sale',
        referenceId: 'ref-1',
        createdBy: 'user-1',
      };

      const result = await updateStock(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Tồn kho không đủ');
      expect(result.newStock).toBe(5); // unchanged
    });

    it('should successfully decrease stock on sale', async () => {
      // Product has 50 in stock, selling 10
      mockFromResponse('products', {
        data: { current_stock: 50, base_unit: 'cái' },
        error: null,
      });
      // Insert stock movement
      mockFromResponse('stock_movements', {
        data: { id: 'mov-1', product_id: 'prod-1', movement_type: 'sale', quantity: -10 },
        error: null,
      });
      // Update product stock
      mockFromResponse('products', { data: null, error: null });

      const params: UpdateStockParams = {
        productId: 'prod-1',
        quantity: 10,
        movementType: 'sale',
        referenceId: 'order-1',
        createdBy: 'user-1',
      };

      const result = await updateStock(params);
      expect(result.success).toBe(true);
      expect(result.newStock).toBe(40);
    });

    it('should successfully increase stock on purchase', async () => {
      // Product has 20 in stock, receiving 30
      mockFromResponse('products', {
        data: { current_stock: 20, base_unit: 'mét' },
        error: null,
      });
      // Insert stock movement
      mockFromResponse('stock_movements', {
        data: { id: 'mov-2', product_id: 'prod-1', movement_type: 'purchase', quantity: 30 },
        error: null,
      });
      // Update product stock
      mockFromResponse('products', { data: null, error: null });

      const params: UpdateStockParams = {
        productId: 'prod-1',
        quantity: 30,
        movementType: 'purchase',
        referenceId: 'receipt-1',
        createdBy: 'user-1',
      };

      const result = await updateStock(params);
      expect(result.success).toBe(true);
      expect(result.newStock).toBe(50);
    });

    it('should successfully increase stock on return', async () => {
      // Product has 10 in stock, returning 3
      mockFromResponse('products', {
        data: { current_stock: 10, base_unit: 'cái' },
        error: null,
      });
      // Insert stock movement
      mockFromResponse('stock_movements', {
        data: { id: 'mov-3', product_id: 'prod-1', movement_type: 'return', quantity: 3 },
        error: null,
      });
      // Update product stock
      mockFromResponse('products', { data: null, error: null });

      const params: UpdateStockParams = {
        productId: 'prod-1',
        quantity: 3,
        movementType: 'return',
        referenceId: 'return-1',
        createdBy: 'user-1',
      };

      const result = await updateStock(params);
      expect(result.success).toBe(true);
      expect(result.newStock).toBe(13);
    });

    it('should allow selling exact remaining stock (stock becomes 0)', async () => {
      mockFromResponse('products', {
        data: { current_stock: 10, base_unit: 'cái' },
        error: null,
      });
      mockFromResponse('stock_movements', {
        data: { id: 'mov-4', product_id: 'prod-1', movement_type: 'sale', quantity: -10 },
        error: null,
      });
      mockFromResponse('products', { data: null, error: null });

      const params: UpdateStockParams = {
        productId: 'prod-1',
        quantity: 10,
        movementType: 'sale',
        referenceId: 'order-2',
        createdBy: 'user-1',
      };

      const result = await updateStock(params);
      expect(result.success).toBe(true);
      expect(result.newStock).toBe(0);
    });

    it('should return error when stock_movement insert fails', async () => {
      mockFromResponse('products', {
        data: { current_stock: 50, base_unit: 'cái' },
        error: null,
      });
      // Insert fails
      mockFromResponse('stock_movements', {
        data: null,
        error: { message: 'Insert failed' },
      });

      const params: UpdateStockParams = {
        productId: 'prod-1',
        quantity: 5,
        movementType: 'sale',
        referenceId: 'order-3',
        createdBy: 'user-1',
      };

      const result = await updateStock(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Lỗi tạo stock movement');
    });
  });

  // === checkLowStock ===
  describe('checkLowStock', () => {
    it('should throw for empty productId', async () => {
      await expect(checkLowStock('')).rejects.toThrow('productId không được để trống');
    });

    it('should throw for whitespace-only productId', async () => {
      await expect(checkLowStock('   ')).rejects.toThrow('productId không được để trống');
    });

    it('should throw when product not found', async () => {
      mockFromResponse('products', { data: null, error: { message: 'Row not found' } });

      await expect(checkLowStock('nonexistent')).rejects.toThrow('Không tìm thấy sản phẩm');
    });

    it('should return isLowStock=false when stock is above min level', async () => {
      mockFromResponse('products', {
        data: { id: 'prod-1', name: 'Ống nước', current_stock: 50, min_stock_level: 10, base_unit: 'cái' },
        error: null,
      });

      const result = await checkLowStock('prod-1');
      expect(result.isLowStock).toBe(false);
      expect(result.currentStock).toBe(50);
      expect(result.minStockLevel).toBe(10);
      expect(result.alertCreated).toBe(false);
      expect(result.alertDuplicate).toBe(false);
    });

    it('should detect low stock when current_stock equals min_stock_level', async () => {
      mockFromResponse('products', {
        data: { id: 'prod-1', name: 'Dây điện', current_stock: 10, min_stock_level: 10, base_unit: 'mét' },
        error: null,
      });
      // Check existing notifications - none found
      mockFromResponse('notifications', { data: [], error: null });
      // Get owners
      mockFromResponse('users', { data: [{ id: 'owner-1' }], error: null });
      // Insert notification
      mockFromResponse('notifications', { data: null, error: null });

      const result = await checkLowStock('prod-1');
      expect(result.isLowStock).toBe(true);
      expect(result.alertCreated).toBe(true);
      expect(result.alertDuplicate).toBe(false);
    });

    it('should detect low stock when current_stock is below min_stock_level', async () => {
      mockFromResponse('products', {
        data: { id: 'prod-1', name: 'Van nước', current_stock: 3, min_stock_level: 10, base_unit: 'cái' },
        error: null,
      });
      // Check existing notifications - none found
      mockFromResponse('notifications', { data: [], error: null });
      // Get owners
      mockFromResponse('users', { data: [{ id: 'owner-1' }], error: null });
      // Insert notification
      mockFromResponse('notifications', { data: null, error: null });

      const result = await checkLowStock('prod-1');
      expect(result.isLowStock).toBe(true);
      expect(result.currentStock).toBe(3);
      expect(result.minStockLevel).toBe(10);
      expect(result.alertCreated).toBe(true);
    });

    it('should not create duplicate alert (deduplication)', async () => {
      mockFromResponse('products', {
        data: { id: 'prod-1', name: 'Ống PVC', current_stock: 2, min_stock_level: 5, base_unit: 'cái' },
        error: null,
      });
      // Existing unread notification found
      mockFromResponse('notifications', { data: [{ id: 'notif-existing' }], error: null });

      const result = await checkLowStock('prod-1');
      expect(result.isLowStock).toBe(true);
      expect(result.alertCreated).toBe(false);
      expect(result.alertDuplicate).toBe(true);
    });

    it('should create alert for multiple owners', async () => {
      mockFromResponse('products', {
        data: { id: 'prod-1', name: 'Công tắc', current_stock: 1, min_stock_level: 5, base_unit: 'cái' },
        error: null,
      });
      // No existing notification
      mockFromResponse('notifications', { data: [], error: null });
      // Multiple owners
      mockFromResponse('users', { data: [{ id: 'owner-1' }, { id: 'owner-2' }], error: null });
      // Insert notifications
      mockFromResponse('notifications', { data: null, error: null });

      const result = await checkLowStock('prod-1');
      expect(result.isLowStock).toBe(true);
      expect(result.alertCreated).toBe(true);
    });
  });

  // === getStockAge ===
  describe('getStockAge', () => {
    it('should throw for empty productId', async () => {
      await expect(getStockAge('')).rejects.toThrow('productId không được để trống');
    });

    it('should throw for whitespace-only productId', async () => {
      await expect(getStockAge('   ')).rejects.toThrow('productId không được để trống');
    });

    it('should throw when product not found', async () => {
      mockFromResponse('products', { data: null, error: { message: 'Row not found' } });

      await expect(getStockAge('nonexistent')).rejects.toThrow('Không tìm thấy sản phẩm');
    });

    it('should return null ageDays when last_stocked_at is null', async () => {
      mockFromResponse('products', {
        data: { id: 'prod-1', last_stocked_at: null },
        error: null,
      });

      const result = await getStockAge('prod-1');
      expect(result.productId).toBe('prod-1');
      expect(result.lastStockedAt).toBeNull();
      expect(result.ageDays).toBeNull();
    });

    it('should calculate stock age correctly', async () => {
      // Mock a product stocked 10 days ago
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      mockFromResponse('products', {
        data: { id: 'prod-1', last_stocked_at: tenDaysAgo.toISOString() },
        error: null,
      });

      const result = await getStockAge('prod-1');
      expect(result.productId).toBe('prod-1');
      expect(result.lastStockedAt).toBe(tenDaysAgo.toISOString());
      expect(result.ageDays).toBe(10);
    });
  });
});
