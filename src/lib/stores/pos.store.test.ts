import { describe, it, expect, beforeEach } from 'vitest';
import { usePOSStore, getSubtotal, getDiscountAmount, getTotal } from './pos.store';
import type { Product } from '@/lib/types';

// Reset store before each test
beforeEach(() => {
  usePOSStore.setState({
    cartItems: [],
    customer: null,
    discountType: 'fixed',
    discountValue: 0,
    paymentMethod: 'cash',
    isCredit: false,
    isSubmitting: false,
    lastOrderResult: null,
    error: null,
  });
});

const mockProduct: Pick<Product, 'id' | 'name' | 'selling_price'> = {
  id: 'prod-1',
  name: 'Ống nước PVC 21mm',
  selling_price: 45000,
};

const mockProduct2: Pick<Product, 'id' | 'name' | 'selling_price'> = {
  id: 'prod-2',
  name: 'Dây điện Cadivi 2.5mm',
  selling_price: 120000,
};

describe('POS Store', () => {
  describe('addItem', () => {
    it('should add a product to empty cart', () => {
      const { addItem } = usePOSStore.getState();
      addItem(mockProduct, 2, 'mét');

      const { cartItems } = usePOSStore.getState();
      expect(cartItems).toHaveLength(1);
      expect(cartItems[0].product_id).toBe('prod-1');
      expect(cartItems[0].quantity).toBe(2);
      expect(cartItems[0].unit).toBe('mét');
      expect(cartItems[0].line_total).toBe(90000);
    });

    it('should merge quantity when same product and unit', () => {
      const { addItem } = usePOSStore.getState();
      addItem(mockProduct, 2, 'mét');
      addItem(mockProduct, 3, 'mét');

      const { cartItems } = usePOSStore.getState();
      expect(cartItems).toHaveLength(1);
      expect(cartItems[0].quantity).toBe(5);
      expect(cartItems[0].line_total).toBe(225000);
    });

    it('should add separate items for different products', () => {
      const { addItem } = usePOSStore.getState();
      addItem(mockProduct, 1, 'mét');
      addItem(mockProduct2, 2, 'cuộn');

      const { cartItems } = usePOSStore.getState();
      expect(cartItems).toHaveLength(2);
    });

    it('should set error for invalid quantity', () => {
      const { addItem } = usePOSStore.getState();
      addItem(mockProduct, -1, 'mét');

      const { error } = usePOSStore.getState();
      expect(error).toBeTruthy();
    });
  });

  describe('removeItem', () => {
    it('should remove item from cart', () => {
      const { addItem } = usePOSStore.getState();
      addItem(mockProduct, 2, 'mét');

      const { cartItems } = usePOSStore.getState();
      const itemId = cartItems[0].id;

      const { removeItem } = usePOSStore.getState();
      removeItem(itemId);

      const { cartItems: updatedItems } = usePOSStore.getState();
      expect(updatedItems).toHaveLength(0);
    });

    it('should set error when item not found', () => {
      const { removeItem } = usePOSStore.getState();
      removeItem('non-existent-id');

      const { error } = usePOSStore.getState();
      expect(error).toBeTruthy();
    });
  });

  describe('updateItemQuantity', () => {
    it('should update quantity and recalculate line_total', () => {
      const { addItem } = usePOSStore.getState();
      addItem(mockProduct, 2, 'mét');

      const { cartItems } = usePOSStore.getState();
      const itemId = cartItems[0].id;

      const { updateItemQuantity } = usePOSStore.getState();
      updateItemQuantity(itemId, 5);

      const { cartItems: updated } = usePOSStore.getState();
      expect(updated[0].quantity).toBe(5);
      expect(updated[0].line_total).toBe(225000);
    });

    it('should remove item when quantity is 0', () => {
      const { addItem } = usePOSStore.getState();
      addItem(mockProduct, 2, 'mét');

      const { cartItems } = usePOSStore.getState();
      const itemId = cartItems[0].id;

      const { updateItemQuantity } = usePOSStore.getState();
      updateItemQuantity(itemId, 0);

      const { cartItems: updated } = usePOSStore.getState();
      expect(updated).toHaveLength(0);
    });
  });

  describe('setDiscount', () => {
    it('should set discount type and value', () => {
      const { setDiscount } = usePOSStore.getState();
      setDiscount('percentage', 10);

      const { discountType, discountValue } = usePOSStore.getState();
      expect(discountType).toBe('percentage');
      expect(discountValue).toBe(10);
    });
  });

  describe('setPaymentMethod', () => {
    it('should set payment method', () => {
      const { setPaymentMethod } = usePOSStore.getState();
      setPaymentMethod('transfer');

      const { paymentMethod } = usePOSStore.getState();
      expect(paymentMethod).toBe('transfer');
    });
  });

  describe('setIsCredit', () => {
    it('should toggle credit mode', () => {
      const { setIsCredit } = usePOSStore.getState();
      setIsCredit(true);

      const { isCredit } = usePOSStore.getState();
      expect(isCredit).toBe(true);
    });
  });

  describe('clearCart', () => {
    it('should reset all state to initial', () => {
      const { addItem, setDiscount, setIsCredit } = usePOSStore.getState();
      addItem(mockProduct, 2, 'mét');
      setDiscount('percentage', 10);
      setIsCredit(true);

      const { clearCart } = usePOSStore.getState();
      clearCart();

      const state = usePOSStore.getState();
      expect(state.cartItems).toHaveLength(0);
      expect(state.discountValue).toBe(0);
      expect(state.isCredit).toBe(false);
      expect(state.customer).toBeNull();
    });
  });

  describe('computed helpers', () => {
    it('getSubtotal should sum all line totals', () => {
      const { addItem } = usePOSStore.getState();
      addItem(mockProduct, 2, 'mét'); // 90,000
      addItem(mockProduct2, 1, 'cuộn'); // 120,000

      const { cartItems } = usePOSStore.getState();
      expect(getSubtotal(cartItems)).toBe(210000);
    });

    it('getDiscountAmount should calculate fixed discount', () => {
      expect(getDiscountAmount(200000, 'fixed', 50000)).toBe(50000);
    });

    it('getDiscountAmount should calculate percentage discount', () => {
      expect(getDiscountAmount(200000, 'percentage', 10)).toBe(20000);
    });

    it('getDiscountAmount should return 0 for zero value', () => {
      expect(getDiscountAmount(200000, 'fixed', 0)).toBe(0);
    });

    it('getTotal should subtract discount from subtotal', () => {
      expect(getTotal(200000, 50000)).toBe(150000);
    });

    it('getTotal should not go below 0', () => {
      expect(getTotal(100, 200)).toBe(0);
    });
  });

  describe('submitOrder', () => {
    it('should return error when cart is empty', async () => {
      const { submitOrder } = usePOSStore.getState();
      const result = await submitOrder('user-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Giỏ hàng trống');
    });

    it('should return error when credit sale without customer', async () => {
      const { addItem, setIsCredit } = usePOSStore.getState();
      addItem(mockProduct, 1, 'mét');
      setIsCredit(true);

      const { submitOrder } = usePOSStore.getState();
      const result = await submitOrder('user-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('khách hàng');
    });
  });
});
