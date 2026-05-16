/**
 * Service Worker cho Web Push Notifications
 *
 * Xử lý:
 * - Nhận push messages từ server
 * - Hiển thị notification với title, body, icon
 * - Click notification → mở trang liên quan
 *
 * Validates: Requirements 21.1, 21.2
 */

// eslint-disable-next-line no-undef
const SW_VERSION = '1.0.0';

/**
 * Xử lý sự kiện push - hiển thị notification
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    // Fallback nếu data không phải JSON
    data = {
      title: 'Thông báo mới',
      body: event.data.text(),
      icon: '/icons/icon-192x192.png',
      url: '/notifications',
    };
  }

  const title = data.title || 'Cửa hàng Điện Nước';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: data.tag || `notification-${Date.now()}`,
    data: {
      url: data.url || '/notifications',
      notificationId: data.notificationId || null,
      type: data.type || null,
    },
    // Vibrate pattern cho mobile
    vibrate: [200, 100, 200],
    // Tự động đóng sau khi click
    requireInteraction: data.requireInteraction || false,
    // Actions (nếu có)
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Xử lý click notification → mở trang liên quan
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/notifications';

  // Mở hoặc focus tab hiện có
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Tìm tab đã mở ứng dụng
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Nếu không có tab nào → mở tab mới
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

/**
 * Xử lý đóng notification (analytics/tracking nếu cần)
 */
self.addEventListener('notificationclose', (_event) => {
  // Có thể gửi analytics event ở đây nếu cần
});

/**
 * Service Worker install event
 */
self.addEventListener('install', (_event) => {
  console.log(`[SW v${SW_VERSION}] Service Worker installed`);
  self.skipWaiting();
});

/**
 * Service Worker activate event
 */
self.addEventListener('activate', (event) => {
  console.log(`[SW v${SW_VERSION}] Service Worker activated`);
  event.waitUntil(self.clients.claim());
});
