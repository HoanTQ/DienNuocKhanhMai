import { createClient } from '@/lib/supabase/client';
import type { Notification } from '@/lib/types';

/**
 * Notification Service - Quản lý thông báo và cảnh báo
 *
 * Cung cấp logic nghiệp vụ cho:
 * 1. Tạo thông báo cho các sự kiện: tồn kho thấp, công nợ quá hạn, đơn NCC đến, giá NCC đổi, hàng tồn lâu
 * 2. Lấy danh sách thông báo (sắp xếp theo thời gian, lọc theo loại)
 * 3. Đánh dấu đã đọc/chưa đọc
 * 4. Đếm số thông báo chưa đọc
 * 5. Quản lý cài đặt bật/tắt từng loại thông báo
 *
 * Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */

// === Types ===

export type NotificationType = Notification['type'];

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: string;
  referenceType?: string;
}

export interface NotificationFilter {
  type?: NotificationType;
  isRead?: boolean;
  limit?: number;
  offset?: number;
}

export interface NotificationPreferences {
  low_stock: boolean;
  overdue_debt: boolean;
  order_arrived: boolean;
  price_changed: boolean;
  stale_stock: boolean;
}

export interface FetchNotificationsResult {
  notifications: Notification[];
  total: number;
  error?: string;
}

// === Default Preferences ===

const DEFAULT_PREFERENCES: NotificationPreferences = {
  low_stock: true,
  overdue_debt: true,
  order_arrived: true,
  price_changed: true,
  stale_stock: true,
};

// === Notification Label Helpers ===

/** Lấy label tiếng Việt cho loại thông báo */
export function getNotificationTypeLabel(type: NotificationType): string {
  switch (type) {
    case 'low_stock':
      return 'Tồn kho thấp';
    case 'overdue_debt':
      return 'Công nợ quá hạn';
    case 'order_arrived':
      return 'Đơn NCC đã đến';
    case 'price_changed':
      return 'Giá NCC thay đổi';
    case 'stale_stock':
      return 'Hàng tồn lâu';
  }
}

/** Lấy đường dẫn điều hướng dựa trên loại thông báo và reference */
export function getNotificationRoute(notification: Notification): string {
  switch (notification.type) {
    case 'low_stock':
      return '/inventory';
    case 'overdue_debt':
      return '/debts';
    case 'order_arrived':
      return '/purchasing/receipts';
    case 'price_changed':
      return '/products/pricing';
    case 'stale_stock':
      return '/inventory';
    default:
      return '/notifications';
  }
}

// === Service Functions ===

/**
 * Tạo thông báo mới.
 *
 * Kiểm tra preferences của user trước khi tạo.
 * Nếu user đã tắt loại thông báo này → không tạo.
 *
 * Validates: Requirements 16.2, 16.6
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<{ success: boolean; notification?: Notification; error?: string }> {
  const { userId, type, title, message, referenceId, referenceType } = params;

  if (!userId || !userId.trim()) {
    return { success: false, error: 'userId không được để trống' };
  }
  if (!title || !title.trim()) {
    return { success: false, error: 'title không được để trống' };
  }
  if (!message || !message.trim()) {
    return { success: false, error: 'message không được để trống' };
  }

  const supabase = createClient();

  // Check user notification preferences
  const preferences = await getNotificationPreferences(userId);
  if (!preferences[type]) {
    return { success: false, error: `Loại thông báo "${type}" đã bị tắt bởi người dùng` };
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      message,
      reference_id: referenceId || null,
      reference_type: referenceType || null,
      is_read: false,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: `Lỗi tạo thông báo: ${error.message}` };
  }

  return { success: true, notification: data as Notification };
}

/**
 * Tạo thông báo cho tất cả Owner khi có sự kiện quan trọng.
 *
 * Validates: Requirements 16.2
 */
export async function notifyAllOwners(
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<{ success: boolean; count: number; error?: string }> {
  const supabase = createClient();

  const { data: owners, error: ownersError } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'owner')
    .eq('is_active', true);

  if (ownersError || !owners || owners.length === 0) {
    return { success: false, count: 0, error: 'Không tìm thấy owner nào' };
  }

  let successCount = 0;
  for (const owner of owners) {
    const result = await createNotification({ ...params, userId: owner.id });
    if (result.success) successCount++;
  }

  return { success: successCount > 0, count: successCount };
}

/**
 * Tạo thông báo tồn kho thấp.
 *
 * Validates: Requirements 16.2
 */
export async function notifyLowStock(
  productId: string,
  productName: string,
  currentStock: number,
  minLevel: number,
  unit: string
): Promise<{ success: boolean; count: number; error?: string }> {
  return notifyAllOwners({
    type: 'low_stock',
    title: `Tồn kho thấp: ${productName}`,
    message: `Sản phẩm "${productName}" chỉ còn ${currentStock} ${unit} (mức tối thiểu: ${minLevel})`,
    referenceId: productId,
    referenceType: 'product',
  });
}

/**
 * Tạo thông báo công nợ quá hạn.
 *
 * Validates: Requirements 16.2
 */
export async function notifyOverdueDebt(
  customerId: string,
  customerName: string,
  debtAmount: number,
  daysOverdue: number
): Promise<{ success: boolean; count: number; error?: string }> {
  const formattedAmount = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(debtAmount);

  return notifyAllOwners({
    type: 'overdue_debt',
    title: `Công nợ quá hạn: ${customerName}`,
    message: `Khách hàng "${customerName}" nợ ${formattedAmount}, quá hạn ${daysOverdue} ngày`,
    referenceId: customerId,
    referenceType: 'customer',
  });
}

/**
 * Tạo thông báo đơn NCC đã đến.
 *
 * Validates: Requirements 16.2
 */
export async function notifyOrderArrived(
  receiptId: string,
  supplierName: string
): Promise<{ success: boolean; count: number; error?: string }> {
  return notifyAllOwners({
    type: 'order_arrived',
    title: `Đơn hàng NCC đã đến: ${supplierName}`,
    message: `Đơn hàng từ "${supplierName}" đã được giao. Vui lòng kiểm tra và xác nhận nhập kho.`,
    referenceId: receiptId,
    referenceType: 'goods_receipt',
  });
}

/**
 * Tạo thông báo giá NCC thay đổi.
 *
 * Validates: Requirements 16.2
 */
export async function notifyPriceChanged(
  productId: string,
  productName: string,
  oldPrice: number,
  newPrice: number,
  supplierName: string
): Promise<{ success: boolean; count: number; error?: string }> {
  const formatVND = (n: number) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(n);

  const direction = newPrice > oldPrice ? 'tăng' : 'giảm';

  return notifyAllOwners({
    type: 'price_changed',
    title: `Giá ${direction}: ${productName}`,
    message: `NCC "${supplierName}" đã ${direction} giá "${productName}" từ ${formatVND(oldPrice)} → ${formatVND(newPrice)}`,
    referenceId: productId,
    referenceType: 'product',
  });
}

/**
 * Tạo thông báo hàng tồn lâu.
 *
 * Validates: Requirements 16.2
 */
export async function notifyStaleStock(
  productId: string,
  productName: string,
  ageDays: number
): Promise<{ success: boolean; count: number; error?: string }> {
  return notifyAllOwners({
    type: 'stale_stock',
    title: `Hàng tồn lâu: ${productName}`,
    message: `Sản phẩm "${productName}" đã tồn kho ${ageDays} ngày không bán được`,
    referenceId: productId,
    referenceType: 'product',
  });
}

/**
 * Lấy danh sách thông báo cho user hiện tại.
 * Sắp xếp theo thời gian mới nhất, hỗ trợ lọc theo loại và trạng thái đọc.
 *
 * Validates: Requirements 16.3, 16.4
 */
export async function fetchNotifications(
  userId: string,
  filter?: NotificationFilter
): Promise<FetchNotificationsResult> {
  if (!userId || !userId.trim()) {
    return { notifications: [], total: 0, error: 'userId không được để trống' };
  }

  const supabase = createClient();
  const limit = filter?.limit || 50;
  const offset = filter?.offset || 0;

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter?.type) {
    query = query.eq('type', filter.type);
  }
  if (filter?.isRead !== undefined) {
    query = query.eq('is_read', filter.isRead);
  }

  const { data, error, count } = await query;

  if (error) {
    return { notifications: [], total: 0, error: `Lỗi tải thông báo: ${error.message}` };
  }

  return {
    notifications: (data || []) as Notification[],
    total: count || 0,
  };
}

/**
 * Đếm số thông báo chưa đọc.
 *
 * Validates: Requirements 16.1
 */
export async function getUnreadCount(userId: string): Promise<number> {
  if (!userId || !userId.trim()) return 0;

  const supabase = createClient();

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) return 0;
  return count || 0;
}

/**
 * Đánh dấu một thông báo đã đọc.
 *
 * Validates: Requirements 16.3
 */
export async function markAsRead(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  if (!notificationId || !notificationId.trim()) {
    return { success: false, error: 'notificationId không được để trống' };
  }

  const supabase = createClient();

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    return { success: false, error: `Lỗi đánh dấu đã đọc: ${error.message}` };
  }

  return { success: true };
}

/**
 * Đánh dấu tất cả thông báo đã đọc cho user.
 *
 * Validates: Requirements 16.3
 */
export async function markAllAsRead(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!userId || !userId.trim()) {
    return { success: false, error: 'userId không được để trống' };
  }

  const supabase = createClient();

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    return { success: false, error: `Lỗi đánh dấu tất cả đã đọc: ${error.message}` };
  }

  return { success: true };
}

/**
 * Đánh dấu một thông báo chưa đọc.
 *
 * Validates: Requirements 16.3
 */
export async function markAsUnread(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  if (!notificationId || !notificationId.trim()) {
    return { success: false, error: 'notificationId không được để trống' };
  }

  const supabase = createClient();

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: false })
    .eq('id', notificationId);

  if (error) {
    return { success: false, error: `Lỗi đánh dấu chưa đọc: ${error.message}` };
  }

  return { success: true };
}

/**
 * Lấy cài đặt thông báo của user.
 * Nếu chưa có cài đặt → trả về mặc định (tất cả bật).
 *
 * Validates: Requirements 16.6
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  if (!userId || !userId.trim()) return { ...DEFAULT_PREFERENCES };

  const supabase = createClient();

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return { ...DEFAULT_PREFERENCES };
  }

  return {
    low_stock: data.low_stock ?? true,
    overdue_debt: data.overdue_debt ?? true,
    order_arrived: data.order_arrived ?? true,
    price_changed: data.price_changed ?? true,
    stale_stock: data.stale_stock ?? true,
  };
}

/**
 * Cập nhật cài đặt thông báo của user.
 * Nếu chưa có record → tạo mới (upsert).
 *
 * Validates: Requirements 16.6
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<{ success: boolean; error?: string }> {
  if (!userId || !userId.trim()) {
    return { success: false, error: 'userId không được để trống' };
  }

  const supabase = createClient();

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    return { success: false, error: `Lỗi cập nhật cài đặt: ${error.message}` };
  }

  return { success: true };
}
