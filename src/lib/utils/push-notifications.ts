/**
 * Push Notification Utility
 *
 * Client-side utility cho Web Push API:
 * - Đăng ký/hủy đăng ký Service Worker
 * - Quản lý push subscription
 * - Kiểm tra trạng thái permission
 * - Gửi subscription lên server (Supabase)
 * - Cho phép bật/tắt push notification cho từng loại cảnh báo
 *
 * Validates: Requirements 21.1, 21.2
 */

import { createClient } from '@/lib/supabase/client';

// === Types ===

export type PushNotificationType =
  | 'low_stock'
  | 'overdue_debt'
  | 'order_arrived'
  | 'price_changed'
  | 'stale_stock';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotificationPreferences {
  enabled: boolean;
  low_stock: boolean;
  overdue_debt: boolean;
  order_arrived: boolean;
  price_changed: boolean;
  stale_stock: boolean;
}

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface PushRegistrationResult {
  success: boolean;
  subscription?: PushSubscriptionData;
  error?: string;
}

// === Constants ===

const SW_PATH = '/sw.js';
const PUSH_PREFS_TABLE = 'push_notification_preferences';
const PUSH_SUBSCRIPTIONS_TABLE = 'push_subscriptions';

const DEFAULT_PUSH_PREFERENCES: PushNotificationPreferences = {
  enabled: false,
  low_stock: true,
  overdue_debt: true,
  order_arrived: true,
  price_changed: true,
  stale_stock: true,
};

// === Browser Support Check ===

/**
 * Kiểm tra trình duyệt có hỗ trợ Push Notifications không
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Lấy trạng thái permission hiện tại
 */
export function getPushPermissionState(): PushPermissionState {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission as PushPermissionState;
}

// === Service Worker Registration ===

/**
 * Đăng ký Service Worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register(SW_PATH, {
      scope: '/',
    });

    // Đợi service worker active
    if (registration.installing) {
      await new Promise<void>((resolve) => {
        registration.installing!.addEventListener('statechange', (e) => {
          if ((e.target as ServiceWorker).state === 'activated') {
            resolve();
          }
        });
      });
    }

    return registration;
  } catch (error) {
    console.error('[Push] Lỗi đăng ký Service Worker:', error);
    return null;
  }
}

/**
 * Lấy Service Worker registration hiện tại
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    return registration || null;
  } catch {
    return null;
  }
}

// === Push Subscription ===

/**
 * Yêu cầu permission và đăng ký push subscription
 */
export async function subscribeToPush(
  vapidPublicKey: string
): Promise<PushRegistrationResult> {
  if (!isPushSupported()) {
    return { success: false, error: 'Trình duyệt không hỗ trợ Push Notifications' };
  }

  try {
    // Yêu cầu permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        error: 'Người dùng từ chối quyền thông báo. Vui lòng bật trong cài đặt trình duyệt.',
      };
    }

    // Đăng ký service worker
    const registration = await registerServiceWorker();
    if (!registration) {
      return { success: false, error: 'Không thể đăng ký Service Worker' };
    }

    // Tạo push subscription
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });

    const subscriptionData = extractSubscriptionData(subscription);
    return { success: true, subscription: subscriptionData };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';
    return { success: false, error: `Lỗi đăng ký push: ${message}` };
  }
}

/**
 * Hủy đăng ký push subscription
 */
export async function unsubscribeFromPush(): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: 'Trình duyệt không hỗ trợ Push Notifications' };
  }

  try {
    const registration = await getServiceWorkerRegistration();
    if (!registration) {
      return { success: true }; // Không có registration → coi như đã hủy
    }

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';
    return { success: false, error: `Lỗi hủy đăng ký push: ${message}` };
  }
}

/**
 * Kiểm tra xem đã có push subscription chưa
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await getServiceWorkerRegistration();
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

// === Server Sync (Supabase) ===

/**
 * Lưu push subscription lên Supabase
 */
export async function saveSubscriptionToServer(
  userId: string,
  subscription: PushSubscriptionData
): Promise<{ success: boolean; error?: string }> {
  if (!userId || !userId.trim()) {
    return { success: false, error: 'userId không được để trống' };
  }

  const supabase = createClient();

  const { error } = await supabase.from(PUSH_SUBSCRIPTIONS_TABLE).upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh_key: subscription.keys.p256dh,
      auth_key: subscription.keys.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,endpoint' }
  );

  if (error) {
    return { success: false, error: `Lỗi lưu subscription: ${error.message}` };
  }

  return { success: true };
}

/**
 * Xóa push subscription khỏi Supabase
 */
export async function removeSubscriptionFromServer(
  userId: string,
  endpoint?: string
): Promise<{ success: boolean; error?: string }> {
  if (!userId || !userId.trim()) {
    return { success: false, error: 'userId không được để trống' };
  }

  const supabase = createClient();

  let query = supabase.from(PUSH_SUBSCRIPTIONS_TABLE).delete().eq('user_id', userId);

  if (endpoint) {
    query = query.eq('endpoint', endpoint);
  }

  const { error } = await query;

  if (error) {
    return { success: false, error: `Lỗi xóa subscription: ${error.message}` };
  }

  return { success: true };
}

// === Push Notification Preferences ===

/**
 * Lấy cài đặt push notification cho user
 */
export async function getPushPreferences(
  userId: string
): Promise<PushNotificationPreferences> {
  if (!userId || !userId.trim()) return { ...DEFAULT_PUSH_PREFERENCES };

  const supabase = createClient();

  const { data, error } = await supabase
    .from(PUSH_PREFS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return { ...DEFAULT_PUSH_PREFERENCES };
  }

  return {
    enabled: data.enabled ?? false,
    low_stock: data.low_stock ?? true,
    overdue_debt: data.overdue_debt ?? true,
    order_arrived: data.order_arrived ?? true,
    price_changed: data.price_changed ?? true,
    stale_stock: data.stale_stock ?? true,
  };
}

/**
 * Cập nhật cài đặt push notification cho user
 */
export async function updatePushPreferences(
  userId: string,
  preferences: Partial<PushNotificationPreferences>
): Promise<{ success: boolean; error?: string }> {
  if (!userId || !userId.trim()) {
    return { success: false, error: 'userId không được để trống' };
  }

  const supabase = createClient();

  const { error } = await supabase.from(PUSH_PREFS_TABLE).upsert(
    {
      user_id: userId,
      ...preferences,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    return { success: false, error: `Lỗi cập nhật cài đặt push: ${error.message}` };
  }

  return { success: true };
}

// === Full Enable/Disable Flow ===

/**
 * Bật push notification hoàn chỉnh:
 * 1. Yêu cầu permission
 * 2. Đăng ký service worker + subscription
 * 3. Lưu subscription lên server
 * 4. Cập nhật preferences
 */
export async function enablePushNotifications(
  userId: string,
  vapidPublicKey: string
): Promise<{ success: boolean; error?: string }> {
  // Step 1 & 2: Subscribe
  const result = await subscribeToPush(vapidPublicKey);
  if (!result.success || !result.subscription) {
    return { success: false, error: result.error };
  }

  // Step 3: Save subscription to server
  const saveResult = await saveSubscriptionToServer(userId, result.subscription);
  if (!saveResult.success) {
    return { success: false, error: saveResult.error };
  }

  // Step 4: Update preferences
  const prefsResult = await updatePushPreferences(userId, { enabled: true });
  if (!prefsResult.success) {
    return { success: false, error: prefsResult.error };
  }

  return { success: true };
}

/**
 * Tắt push notification hoàn chỉnh:
 * 1. Hủy subscription
 * 2. Xóa subscription khỏi server
 * 3. Cập nhật preferences
 */
export async function disablePushNotifications(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // Step 1: Get current subscription endpoint before unsubscribing
  const currentSub = await getCurrentSubscription();
  const endpoint = currentSub?.endpoint;

  // Step 2: Unsubscribe
  const unsubResult = await unsubscribeFromPush();
  if (!unsubResult.success) {
    return { success: false, error: unsubResult.error };
  }

  // Step 3: Remove from server
  await removeSubscriptionFromServer(userId, endpoint);

  // Step 4: Update preferences
  const prefsResult = await updatePushPreferences(userId, { enabled: false });
  if (!prefsResult.success) {
    return { success: false, error: prefsResult.error };
  }

  return { success: true };
}

// === Local Push (for testing/demo without server) ===

/**
 * Gửi push notification cục bộ (dùng cho testing/demo)
 * Trong production, push sẽ được gửi từ server (Supabase Edge Functions)
 */
export async function sendLocalPushNotification(options: {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
  type?: PushNotificationType;
}): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: 'Trình duyệt không hỗ trợ Push Notifications' };
  }

  if (Notification.permission !== 'granted') {
    return { success: false, error: 'Chưa được cấp quyền thông báo' };
  }

  try {
    const registration = await getServiceWorkerRegistration();
    if (!registration) {
      return { success: false, error: 'Service Worker chưa được đăng ký' };
    }

    await registration.showNotification(options.title, {
      body: options.body,
      icon: options.icon || '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: options.tag || `local-${Date.now()}`,
      data: {
        url: options.url || '/notifications',
        type: options.type || null,
      },
    } as NotificationOptions);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';
    return { success: false, error: `Lỗi gửi notification: ${message}` };
  }
}

// === Helper Functions ===

/**
 * Chuyển đổi VAPID public key từ base64 URL-safe sang Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Trích xuất dữ liệu subscription thành format lưu trữ
 */
function extractSubscriptionData(subscription: PushSubscription): PushSubscriptionData {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: json.keys?.p256dh || '',
      auth: json.keys?.auth || '',
    },
  };
}
