'use client';

import { create } from 'zustand';
import type { Product, Customer } from '@/lib/types';
import {
  addItemToCart,
  removeItemFromCart,
  applyDiscount,
  createOrder,
  type CartItem,
  type CreateOrderResult,
} from '@/services/pos.service';

// === Types ===

export type DiscountType = 'fixed' | 'percentage';
export type PaymentMethod = 'cash' | 'transfer';

export interface POSState {
  // Cart
  cartItems: CartItem[];
  // Customer (for credit sales)
  customer: Customer | null;
  // Discount
  discountType: DiscountType;
  discountValue: number;
  // Payment
  paymentMethod: PaymentMethod;
  isCredit: boolean;
  // UI state
  isSubmitting: boolean;
  lastOrderResult: CreateOrderResult | null;
  error: string | null;
}

export interface POSActions {
  addItem: (product: Pick<Product, 'id' | 'name' | 'selling_price'>, quantity: number, unit: string) => void;
  removeItem: (itemId: string) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  setDiscount: (type: DiscountType, value: number) => void;
  setCustomer: (customer: Customer | null) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setIsCredit: (isCredit: boolean) => void;
  clearCart: () => void;
  submitOrder: (createdBy: string, userMaxDiscount?: number) => Promise<CreateOrderResult>;
  clearError: () => void;
  clearLastOrder: () => void;
}

export type POSStore = POSState & POSActions;

// === Computed helpers ===

export function getSubtotal(cartItems: CartItem[]): number {
  return cartItems.reduce((sum, item) => sum + item.line_total, 0);
}

export function getDiscountAmount(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number
): number {
  if (discountValue <= 0 || subtotal <= 0) return 0;
  try {
    const result = applyDiscount(subtotal, discountType, discountValue);
    return result.discountAmount;
  } catch {
    return 0;
  }
}

export function getTotal(
  subtotal: number,
  discountAmount: number
): number {
  return Math.max(0, subtotal - discountAmount);
}

// === Store ===

const initialState: POSState = {
  cartItems: [],
  customer: null,
  discountType: 'fixed',
  discountValue: 0,
  paymentMethod: 'cash',
  isCredit: false,
  isSubmitting: false,
  lastOrderResult: null,
  error: null,
};

export const usePOSStore = create<POSStore>((set, get) => ({
  ...initialState,

  addItem: (product, quantity, unit) => {
    try {
      const newItems = addItemToCart(get().cartItems, product, quantity, unit);
      set({ cartItems: newItems, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Lỗi thêm sản phẩm' });
    }
  },

  removeItem: (itemId) => {
    try {
      const newItems = removeItemFromCart(get().cartItems, itemId);
      set({ cartItems: newItems, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Lỗi xóa sản phẩm' });
    }
  },

  updateItemQuantity: (itemId, quantity) => {
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      try {
        const newItems = removeItemFromCart(get().cartItems, itemId);
        set({ cartItems: newItems, error: null });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Lỗi cập nhật số lượng' });
      }
      return;
    }

    const { cartItems } = get();
    const updatedItems = cartItems.map((item) => {
      if (item.id === itemId) {
        const lineTotal = quantity * item.unit_price;
        return { ...item, quantity, line_total: lineTotal };
      }
      return item;
    });
    set({ cartItems: updatedItems, error: null });
  },

  setDiscount: (type, value) => {
    set({ discountType: type, discountValue: value, error: null });
  },

  setCustomer: (customer) => {
    set({ customer, error: null });
  },

  setPaymentMethod: (method) => {
    set({ paymentMethod: method, error: null });
  },

  setIsCredit: (isCredit) => {
    set({ isCredit, error: null });
  },

  clearCart: () => {
    set({ ...initialState });
  },

  submitOrder: async (createdBy, userMaxDiscount) => {
    const { cartItems, customer, paymentMethod, isCredit, discountType, discountValue } = get();

    if (cartItems.length === 0) {
      const result: CreateOrderResult = {
        success: false,
        order: null,
        debtRecord: null,
        error: 'Giỏ hàng trống',
      };
      set({ error: 'Giỏ hàng trống' });
      return result;
    }

    if (isCredit && !customer) {
      const result: CreateOrderResult = {
        success: false,
        order: null,
        debtRecord: null,
        error: 'Vui lòng chọn khách hàng cho đơn mua nợ',
      };
      set({ error: 'Vui lòng chọn khách hàng cho đơn mua nợ' });
      return result;
    }

    // Check discount limit
    if (discountValue > 0 && userMaxDiscount !== undefined) {
      const subtotal = getSubtotal(cartItems);
      const discountResult = applyDiscount(subtotal, discountType, discountValue, userMaxDiscount);
      if (!discountResult.allowed) {
        const result: CreateOrderResult = {
          success: false,
          order: null,
          debtRecord: null,
          error: discountResult.error,
        };
        set({ error: discountResult.error || 'Giảm giá vượt giới hạn' });
        return result;
      }
    }

    set({ isSubmitting: true, error: null });

    try {
      const result = await createOrder({
        items: cartItems,
        customerId: customer?.id,
        paymentMethod,
        isCredit,
        discountType: discountValue > 0 ? discountType : undefined,
        discountValue: discountValue > 0 ? discountValue : undefined,
        createdBy,
      });

      if (result.success) {
        set({
          ...initialState,
          lastOrderResult: result,
        });
      } else {
        set({
          isSubmitting: false,
          error: result.error || 'Lỗi tạo đơn hàng',
          lastOrderResult: result,
        });
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi không xác định';
      const result: CreateOrderResult = {
        success: false,
        order: null,
        debtRecord: null,
        error: errorMsg,
      };
      set({ isSubmitting: false, error: errorMsg, lastOrderResult: result });
      return result;
    }
  },

  clearError: () => {
    set({ error: null });
  },

  clearLastOrder: () => {
    set({ lastOrderResult: null });
  },
}));
