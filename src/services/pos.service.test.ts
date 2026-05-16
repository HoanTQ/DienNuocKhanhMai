import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addItemToCart,
  removeItemFromCart,
  applyDiscount,
  createOrder,
} from './pos.service';
import type { CartItem, CreateOrderParams } from './pos.service';

// === Mock Supabase for createOrder tests ===

let fromCallIndex: number;
let fromResponses: Array<{
  table: string;
  finalResponse: { data: unknown; error: unknown };
}>;

function mockFromResponse(table: string, response: { data: unknown; error: unknown }) {
  fromResponses.push({ table, finalResponse: response });
}

function createChainForCall(callIndex: number) {
  const response = fromResponses[callIndex]?.finalResponse ?? { data: null, error: null };

  // Create a thenable chain that resolves with the response at any point
  const chain: Record<string, unknown> = {};

  // Make the chain itself thenable (for cases like `await supabase.from(...).insert(...)`)
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve);
  chain.catch = (reject: (reason: unknown) => unknown) => Promise.resolve(response).catch(reject);

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
    from: () => {
      const idx = fromCallIndex++;
      return createChainForCall(idx);
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

describe('pos.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallIndex = 0;
    fromResponses = [];
  });

  // === addItemToCart (pure function) ===
  describe('addItemToCart', () => {
    const sampleProduct = {
      id: 'prod-1',
      name: 'Ống nước PVC 21mm',
      selling_price: 45000,
    };

    it('should add a new item to empty cart', () => {
      const result = addItemToCart([], sampleProduct, 2, 'mét');

      expect(result).toHaveLength(1);
      expect(result[0].product_id).toBe('prod-1');
      expect(result[0].product_name).toBe('Ống nước PVC 21mm');
      expect(result[0].quantity).toBe(2);
      expect(result[0].unit).toBe('mét');
      expect(result[0].unit_price).toBe(45000);
      expect(result[0].line_total).toBe(90000); // 2 × 45000
    });

    it('should add a new item to existing cart', () => {
      const existingItems: CartItem[] = [
        {
          id: 'cart-1',
          product_id: 'prod-existing',
          product_name: 'Dây điện',
          quantity: 5,
          unit: 'mét',
          unit_price: 10000,
          line_total: 50000,
        },
      ];

      const result = addItemToCart(existingItems, sampleProduct, 3, 'cái');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(existingItems[0]); // existing item unchanged
      expect(result[1].product_id).toBe('prod-1');
      expect(result[1].quantity).toBe(3);
      expect(result[1].line_total).toBe(135000); // 3 × 45000
    });

    it('should merge quantity when same product and unit already in cart', () => {
      const existingItems: CartItem[] = [
        {
          id: 'cart-1',
          product_id: 'prod-1',
          product_name: 'Ống nước PVC 21mm',
          quantity: 2,
          unit: 'mét',
          unit_price: 45000,
          line_total: 90000,
        },
      ];

      const result = addItemToCart(existingItems, sampleProduct, 3, 'mét');

      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(5); // 2 + 3
      expect(result[0].line_total).toBe(225000); // 5 × 45000
    });

    it('should NOT merge when same product but different unit', () => {
      const existingItems: CartItem[] = [
        {
          id: 'cart-1',
          product_id: 'prod-1',
          product_name: 'Ống nước PVC 21mm',
          quantity: 2,
          unit: 'mét',
          unit_price: 45000,
          line_total: 90000,
        },
      ];

      const result = addItemToCart(existingItems, sampleProduct, 1, 'cuộn');

      expect(result).toHaveLength(2);
    });

    it('should handle decimal quantities (bán lẻ mét, kg)', () => {
      const result = addItemToCart([], sampleProduct, 2.5, 'mét');

      expect(result[0].quantity).toBe(2.5);
      expect(result[0].line_total).toBe(112500); // 2.5 × 45000
    });

    it('should not mutate the original array', () => {
      const original: CartItem[] = [];
      const result = addItemToCart(original, sampleProduct, 1, 'cái');

      expect(original).toHaveLength(0);
      expect(result).toHaveLength(1);
    });

    it('should throw for quantity <= 0', () => {
      expect(() => addItemToCart([], sampleProduct, 0, 'mét')).toThrow(
        'quantity phải là số dương lớn hơn 0'
      );
      expect(() => addItemToCart([], sampleProduct, -1, 'mét')).toThrow(
        'quantity phải là số dương lớn hơn 0'
      );
    });

    it('should throw for empty product.id', () => {
      const badProduct = { id: '', name: 'Test', selling_price: 1000 };
      expect(() => addItemToCart([], badProduct, 1, 'cái')).toThrow(
        'product.id không được để trống'
      );
    });

    it('should throw for empty unit', () => {
      expect(() => addItemToCart([], sampleProduct, 1, '')).toThrow(
        'unit không được để trống'
      );
    });

    it('should throw for negative selling_price', () => {
      const badProduct = { id: 'p1', name: 'Test', selling_price: -100 };
      expect(() => addItemToCart([], badProduct, 1, 'cái')).toThrow(
        'selling_price không được là số âm'
      );
    });

    it('should handle selling_price of 0 (free item)', () => {
      const freeProduct = { id: 'p-free', name: 'Quà tặng', selling_price: 0 };
      const result = addItemToCart([], freeProduct, 1, 'cái');

      expect(result[0].line_total).toBe(0);
    });
  });

  // === removeItemFromCart (pure function) ===
  describe('removeItemFromCart', () => {
    const sampleCart: CartItem[] = [
      {
        id: 'cart-1',
        product_id: 'prod-1',
        product_name: 'Ống nước',
        quantity: 2,
        unit: 'mét',
        unit_price: 45000,
        line_total: 90000,
      },
      {
        id: 'cart-2',
        product_id: 'prod-2',
        product_name: 'Dây điện',
        quantity: 5,
        unit: 'mét',
        unit_price: 10000,
        line_total: 50000,
      },
      {
        id: 'cart-3',
        product_id: 'prod-3',
        product_name: 'Van nước',
        quantity: 1,
        unit: 'cái',
        unit_price: 35000,
        line_total: 35000,
      },
    ];

    it('should remove item by id', () => {
      const result = removeItemFromCart(sampleCart, 'cart-2');

      expect(result).toHaveLength(2);
      expect(result.find((item) => item.id === 'cart-2')).toBeUndefined();
      expect(result[0].id).toBe('cart-1');
      expect(result[1].id).toBe('cart-3');
    });

    it('should remove the only item in cart', () => {
      const singleItemCart: CartItem[] = [sampleCart[0]];
      const result = removeItemFromCart(singleItemCart, 'cart-1');

      expect(result).toHaveLength(0);
    });

    it('should not mutate the original array', () => {
      const original = [...sampleCart];
      removeItemFromCart(original, 'cart-1');

      expect(original).toHaveLength(3);
    });

    it('should throw for empty itemId', () => {
      expect(() => removeItemFromCart(sampleCart, '')).toThrow(
        'itemId không được để trống'
      );
    });

    it('should throw for whitespace-only itemId', () => {
      expect(() => removeItemFromCart(sampleCart, '   ')).toThrow(
        'itemId không được để trống'
      );
    });

    it('should throw when item not found', () => {
      expect(() => removeItemFromCart(sampleCart, 'nonexistent')).toThrow(
        'Không tìm thấy item với id: nonexistent'
      );
    });

    it('should throw when removing from empty cart', () => {
      expect(() => removeItemFromCart([], 'cart-1')).toThrow(
        'Không tìm thấy item với id: cart-1'
      );
    });
  });

  // === applyDiscount (pure function) ===
  describe('applyDiscount', () => {
    it('should apply fixed discount correctly', () => {
      const result = applyDiscount(500000, 'fixed', 50000);

      expect(result.allowed).toBe(true);
      expect(result.discountAmount).toBe(50000);
      expect(result.total).toBe(450000); // 500000 - 50000
    });

    it('should apply percentage discount correctly', () => {
      const result = applyDiscount(500000, 'percentage', 10);

      expect(result.allowed).toBe(true);
      expect(result.discountAmount).toBe(50000); // 500000 × 10%
      expect(result.total).toBe(450000);
    });

    it('should allow discount when within staff limit (percentage)', () => {
      const result = applyDiscount(500000, 'percentage', 5, 10);

      expect(result.allowed).toBe(true);
      expect(result.discountAmount).toBe(25000); // 500000 × 5%
      expect(result.total).toBe(475000);
    });

    it('should reject discount when exceeding staff limit (percentage)', () => {
      const result = applyDiscount(500000, 'percentage', 15, 10);

      expect(result.allowed).toBe(false);
      expect(result.discountAmount).toBe(0);
      expect(result.total).toBe(500000); // unchanged
      expect(result.error).toContain('tối đa 10%');
    });

    it('should allow fixed discount when effective percentage within limit', () => {
      // 25000 / 500000 = 5% which is within 10% limit
      const result = applyDiscount(500000, 'fixed', 25000, 10);

      expect(result.allowed).toBe(true);
      expect(result.discountAmount).toBe(25000);
      expect(result.total).toBe(475000);
    });

    it('should reject fixed discount when effective percentage exceeds limit', () => {
      // 60000 / 500000 = 12% which exceeds 10% limit
      const result = applyDiscount(500000, 'fixed', 60000, 10);

      expect(result.allowed).toBe(false);
      expect(result.discountAmount).toBe(0);
      expect(result.total).toBe(500000);
    });

    it('should allow any discount when userMaxDiscount is undefined (owner)', () => {
      const result = applyDiscount(500000, 'percentage', 50, undefined);

      expect(result.allowed).toBe(true);
      expect(result.discountAmount).toBe(250000);
      expect(result.total).toBe(250000);
    });

    it('should allow discount at exact limit boundary', () => {
      const result = applyDiscount(500000, 'percentage', 10, 10);

      expect(result.allowed).toBe(true);
      expect(result.discountAmount).toBe(50000);
      expect(result.total).toBe(450000);
    });

    it('should handle 0% discount', () => {
      const result = applyDiscount(500000, 'percentage', 0, 10);

      expect(result.allowed).toBe(true);
      expect(result.discountAmount).toBe(0);
      expect(result.total).toBe(500000);
    });

    it('should handle 0 fixed discount', () => {
      const result = applyDiscount(500000, 'fixed', 0, 10);

      expect(result.allowed).toBe(true);
      expect(result.discountAmount).toBe(0);
      expect(result.total).toBe(500000);
    });

    it('should handle subtotal of 0 with fixed discount', () => {
      const result = applyDiscount(0, 'fixed', 0);

      expect(result.allowed).toBe(true);
      expect(result.discountAmount).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should maintain invariant: discountAmount + total = subtotal', () => {
      const subtotal = 750000;
      const result = applyDiscount(subtotal, 'percentage', 7.5);

      expect(result.discountAmount + result.total).toBeCloseTo(subtotal);
    });

    it('should throw for negative subtotal', () => {
      expect(() => applyDiscount(-100, 'fixed', 50)).toThrow(
        'subtotal không được là số âm'
      );
    });

    it('should throw for negative discountValue', () => {
      expect(() => applyDiscount(500000, 'fixed', -100)).toThrow(
        'discountValue không được là số âm'
      );
    });

    it('should handle userMaxDiscount of 0 (no discount allowed)', () => {
      const result = applyDiscount(500000, 'percentage', 1, 0);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain('tối đa 0%');
    });
  });

  // === createOrder (async, Supabase integration) ===
  describe('createOrder', () => {
    const sampleItems: CartItem[] = [
      {
        id: 'cart-1',
        product_id: 'prod-1',
        product_name: 'Ống nước',
        quantity: 2,
        unit: 'mét',
        unit_price: 45000,
        line_total: 90000,
      },
      {
        id: 'cart-2',
        product_id: 'prod-2',
        product_name: 'Van nước',
        quantity: 1,
        unit: 'cái',
        unit_price: 35000,
        line_total: 35000,
      },
    ];

    it('should throw for empty items', async () => {
      const params: CreateOrderParams = {
        items: [],
        paymentMethod: 'cash',
        isCredit: false,
        createdBy: 'user-1',
      };
      await expect(createOrder(params)).rejects.toThrow(
        'Đơn hàng phải có ít nhất 1 sản phẩm'
      );
    });

    it('should throw for empty createdBy', async () => {
      const params: CreateOrderParams = {
        items: sampleItems,
        paymentMethod: 'cash',
        isCredit: false,
        createdBy: '',
      };
      await expect(createOrder(params)).rejects.toThrow(
        'createdBy không được để trống'
      );
    });

    it('should throw for credit sale without customer', async () => {
      const params: CreateOrderParams = {
        items: sampleItems,
        paymentMethod: 'cash',
        isCredit: true,
        createdBy: 'user-1',
      };
      await expect(createOrder(params)).rejects.toThrow(
        'Mua nợ phải có thông tin khách hàng'
      );
    });

    it('should create order successfully with cash payment', async () => {
      // Insert sales_order
      mockFromResponse('sales_orders', {
        data: {
          id: 'order-1',
          order_number: 'SO-20240615-ABCD',
          subtotal: 125000,
          discount_amount: 0,
          total: 125000,
          payment_method: 'cash',
          is_credit: false,
          status: 'completed',
        },
        error: null,
      });
      // Insert sales_order_items
      mockFromResponse('sales_order_items', { data: null, error: null });

      const params: CreateOrderParams = {
        items: sampleItems,
        paymentMethod: 'cash',
        isCredit: false,
        createdBy: 'user-1',
      };

      const result = await createOrder(params);
      expect(result.success).toBe(true);
      expect(result.order).not.toBeNull();
      expect(result.debtRecord).toBeNull();
    });

    it('should create order with discount', async () => {
      mockFromResponse('sales_orders', {
        data: {
          id: 'order-2',
          order_number: 'SO-20240615-EFGH',
          subtotal: 125000,
          discount_type: 'percentage',
          discount_value: 10,
          discount_amount: 12500,
          total: 112500,
          payment_method: 'transfer',
          is_credit: false,
          status: 'completed',
        },
        error: null,
      });
      mockFromResponse('sales_order_items', { data: null, error: null });

      const params: CreateOrderParams = {
        items: sampleItems,
        paymentMethod: 'transfer',
        isCredit: false,
        discountType: 'percentage',
        discountValue: 10,
        createdBy: 'user-1',
      };

      const result = await createOrder(params);
      expect(result.success).toBe(true);
    });

    it('should create debt record for credit sale', async () => {
      // Insert sales_order
      mockFromResponse('sales_orders', {
        data: {
          id: 'order-3',
          order_number: 'SO-20240615-IJKL',
          subtotal: 125000,
          discount_amount: 0,
          total: 125000,
          payment_method: 'cash',
          is_credit: true,
          customer_id: 'cust-1',
          status: 'completed',
        },
        error: null,
      });
      // Insert sales_order_items
      mockFromResponse('sales_order_items', { data: null, error: null });
      // Insert debt_record
      mockFromResponse('debt_records', {
        data: {
          id: 'debt-1',
          customer_id: 'cust-1',
          order_id: 'order-3',
          amount: 125000,
          paid_amount: 0,
          remaining: 125000,
          status: 'pending',
        },
        error: null,
      });

      const params: CreateOrderParams = {
        items: sampleItems,
        customerId: 'cust-1',
        paymentMethod: 'cash',
        isCredit: true,
        createdBy: 'user-1',
      };

      const result = await createOrder(params);
      expect(result.success).toBe(true);
      expect(result.debtRecord).not.toBeNull();
      expect(result.debtRecord?.customer_id).toBe('cust-1');
      expect(result.debtRecord?.amount).toBe(125000);
      expect(result.debtRecord?.status).toBe('pending');
    });

    it('should return error when sales_order insert fails', async () => {
      mockFromResponse('sales_orders', {
        data: null,
        error: { message: 'Database error' },
      });

      const params: CreateOrderParams = {
        items: sampleItems,
        paymentMethod: 'cash',
        isCredit: false,
        createdBy: 'user-1',
      };

      const result = await createOrder(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Lỗi tạo đơn hàng');
    });

    it('should return error when sales_order_items insert fails', async () => {
      mockFromResponse('sales_orders', {
        data: { id: 'order-4', order_number: 'SO-20240615-MNOP' },
        error: null,
      });
      mockFromResponse('sales_order_items', {
        data: null,
        error: { message: 'Items insert failed' },
      });

      const params: CreateOrderParams = {
        items: sampleItems,
        paymentMethod: 'cash',
        isCredit: false,
        createdBy: 'user-1',
      };

      const result = await createOrder(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Lỗi tạo chi tiết đơn hàng');
    });

    it('should return error when debt_record insert fails for credit sale', async () => {
      mockFromResponse('sales_orders', {
        data: {
          id: 'order-5',
          order_number: 'SO-20240615-QRST',
          subtotal: 125000,
          discount_amount: 0,
          total: 125000,
          is_credit: true,
          customer_id: 'cust-1',
        },
        error: null,
      });
      mockFromResponse('sales_order_items', { data: null, error: null });
      mockFromResponse('debt_records', {
        data: null,
        error: { message: 'Debt insert failed' },
      });

      const params: CreateOrderParams = {
        items: sampleItems,
        customerId: 'cust-1',
        paymentMethod: 'cash',
        isCredit: true,
        createdBy: 'user-1',
      };

      const result = await createOrder(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Lỗi tạo công nợ');
    });
  });
});
