import { describe, it, expect } from 'vitest';
import {
  getNotificationTypeLabel,
  getNotificationRoute,
} from './notification.service';
import type { Notification } from '@/lib/types';

/**
 * Tests for notification.service.ts pure functions
 *
 * Validates: Requirements 16.4, 16.5
 */

describe('notification.service', () => {
  // === getNotificationTypeLabel ===
  describe('getNotificationTypeLabel', () => {
    it('should return correct Vietnamese label for low_stock', () => {
      expect(getNotificationTypeLabel('low_stock')).toBe('Tồn kho thấp');
    });

    it('should return correct Vietnamese label for overdue_debt', () => {
      expect(getNotificationTypeLabel('overdue_debt')).toBe('Công nợ quá hạn');
    });

    it('should return correct Vietnamese label for order_arrived', () => {
      expect(getNotificationTypeLabel('order_arrived')).toBe('Đơn NCC đã đến');
    });

    it('should return correct Vietnamese label for price_changed', () => {
      expect(getNotificationTypeLabel('price_changed')).toBe('Giá NCC thay đổi');
    });

    it('should return correct Vietnamese label for stale_stock', () => {
      expect(getNotificationTypeLabel('stale_stock')).toBe('Hàng tồn lâu');
    });
  });

  // === getNotificationRoute ===
  describe('getNotificationRoute', () => {
    const makeNotification = (
      type: Notification['type'],
      referenceId?: string,
      referenceType?: string
    ): Notification => ({
      id: 'test-id',
      user_id: 'user-1',
      type,
      title: 'Test',
      message: 'Test message',
      reference_id: referenceId,
      reference_type: referenceType,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    it('should navigate to /inventory for low_stock notifications', () => {
      const notification = makeNotification('low_stock', 'product-1', 'product');
      expect(getNotificationRoute(notification)).toBe('/inventory');
    });

    it('should navigate to /debts for overdue_debt notifications', () => {
      const notification = makeNotification('overdue_debt', 'customer-1', 'customer');
      expect(getNotificationRoute(notification)).toBe('/debts');
    });

    it('should navigate to /purchasing/receipts for order_arrived notifications', () => {
      const notification = makeNotification('order_arrived', 'receipt-1', 'goods_receipt');
      expect(getNotificationRoute(notification)).toBe('/purchasing/receipts');
    });

    it('should navigate to /products/pricing for price_changed notifications', () => {
      const notification = makeNotification('price_changed', 'product-1', 'product');
      expect(getNotificationRoute(notification)).toBe('/products/pricing');
    });

    it('should navigate to /inventory for stale_stock notifications', () => {
      const notification = makeNotification('stale_stock', 'product-1', 'product');
      expect(getNotificationRoute(notification)).toBe('/inventory');
    });

    it('should handle notifications without reference_id', () => {
      const notification = makeNotification('low_stock');
      expect(getNotificationRoute(notification)).toBe('/inventory');
    });
  });
});
