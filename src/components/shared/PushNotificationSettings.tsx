'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, BellOff, Smartphone, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  isPushSupported,
  getPushPermissionState,
  enablePushNotifications,
  disablePushNotifications,
  getPushPreferences,
  updatePushPreferences,
  registerServiceWorker,
  type PushNotificationPreferences,
  type PushNotificationType,
  type PushPermissionState,
} from '@/lib/utils/push-notifications';
import { getNotificationTypeLabel } from '@/services/notification.service';

/**
 * PushNotificationSettings - Cài đặt Push Notification
 *
 * Cho phép Owner:
 * - Bật/tắt push notification tổng thể
 * - Bật/tắt push notification cho từng loại cảnh báo
 * - Hiển thị trạng thái permission và hướng dẫn
 *
 * Validates: Requirements 21.1, 21.2
 */

interface PushNotificationSettingsProps {
  userId: string;
}

const PUSH_TYPES: PushNotificationType[] = [
  'low_stock',
  'overdue_debt',
  'order_arrived',
  'price_changed',
  'stale_stock',
];

/** Lấy icon cho loại thông báo */
function getTypeIcon(type: PushNotificationType): string {
  switch (type) {
    case 'low_stock':
      return '📦';
    case 'overdue_debt':
      return '💰';
    case 'order_arrived':
      return '🚚';
    case 'price_changed':
      return '💲';
    case 'stale_stock':
      return '⏰';
  }
}

export function PushNotificationSettings({ userId }: PushNotificationSettingsProps) {
  const [supported, setSupported] = useState(true);
  const [permissionState, setPermissionState] = useState<PushPermissionState>('default');
  const [preferences, setPreferences] = useState<PushNotificationPreferences>({
    enabled: false,
    low_stock: true,
    overdue_debt: true,
    order_arrived: true,
    price_changed: true,
    stale_stock: true,
  });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // VAPID public key - trong production sẽ lấy từ environment variable
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

  // Check support & load preferences
  useEffect(() => {
    const init = async () => {
      const isSupported = isPushSupported();
      setSupported(isSupported);

      if (!isSupported) {
        setLoading(false);
        return;
      }

      setPermissionState(getPushPermissionState());

      // Register service worker on load
      await registerServiceWorker();

      // Load preferences
      const prefs = await getPushPreferences(userId);
      setPreferences(prefs);
      setLoading(false);
    };

    init();
  }, [userId]);

  /** Bật push notification */
  const handleEnable = useCallback(async () => {
    setToggling(true);
    setError(null);

    if (!vapidPublicKey) {
      // Nếu chưa có VAPID key, vẫn cho phép bật (sẽ dùng local notifications)
      const result = await updatePushPreferences(userId, { enabled: true });
      if (result.success) {
        setPreferences((prev) => ({ ...prev, enabled: true }));
        // Request permission anyway for local notifications
        if ('Notification' in window) {
          await Notification.requestPermission();
          setPermissionState(getPushPermissionState());
        }
      } else {
        setError(result.error || 'Lỗi không xác định');
      }
    } else {
      const result = await enablePushNotifications(userId, vapidPublicKey);
      if (result.success) {
        setPreferences((prev) => ({ ...prev, enabled: true }));
        setPermissionState('granted');
      } else {
        setError(result.error || 'Lỗi không xác định');
      }
    }

    setToggling(false);
  }, [userId, vapidPublicKey]);

  /** Tắt push notification */
  const handleDisable = useCallback(async () => {
    setToggling(true);
    setError(null);

    const result = await disablePushNotifications(userId);
    if (result.success) {
      setPreferences((prev) => ({ ...prev, enabled: false }));
    } else {
      setError(result.error || 'Lỗi không xác định');
    }

    setToggling(false);
  }, [userId]);

  /** Toggle từng loại push notification */
  const handleToggleType = useCallback(
    async (type: PushNotificationType) => {
      const newValue = !preferences[type];
      setPreferences((prev) => ({ ...prev, [type]: newValue }));

      const result = await updatePushPreferences(userId, { [type]: newValue });
      if (!result.success) {
        // Rollback
        setPreferences((prev) => ({ ...prev, [type]: !newValue }));
        setError(result.error || 'Lỗi cập nhật cài đặt');
      }
    },
    [userId, preferences]
  );

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            <span className="text-sm text-muted-foreground">Đang tải cài đặt push...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not supported
  if (!supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BellOff className="h-5 w-5 text-muted-foreground" />
            Push Notification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Trình duyệt của bạn không hỗ trợ Push Notifications. Vui lòng sử dụng Chrome, Firefox,
              hoặc Edge phiên bản mới nhất.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Push Notification trên điện thoại
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Nhận thông báo đẩy ngay cả khi không mở ứng dụng
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Permission denied warning */}
        {permissionState === 'denied' && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/20 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Quyền thông báo bị từ chối
              </p>
              <p className="text-amber-700 dark:text-amber-300 mt-1">
                Vui lòng vào Cài đặt trình duyệt → Quyền → Thông báo → Cho phép trang web này gửi
                thông báo.
              </p>
            </div>
          </div>
        )}

        {/* Main toggle */}
        <div className="flex items-center justify-between py-3 border-b">
          <div className="flex items-center gap-3">
            {preferences.enabled ? (
              <Bell className="h-5 w-5 text-primary" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium">
                {preferences.enabled ? 'Push đang bật' : 'Push đang tắt'}
              </p>
              <p className="text-xs text-muted-foreground">
                {preferences.enabled
                  ? 'Bạn sẽ nhận thông báo đẩy cho các cảnh báo quan trọng'
                  : 'Bật để nhận thông báo ngay cả khi không mở ứng dụng'}
              </p>
            </div>
          </div>
          <Button
            variant={preferences.enabled ? 'destructive' : 'default'}
            size="sm"
            onClick={preferences.enabled ? handleDisable : handleEnable}
            disabled={toggling || permissionState === 'denied'}
          >
            {toggling ? (
              <span className="flex items-center gap-1">
                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                Đang xử lý...
              </span>
            ) : preferences.enabled ? (
              'Tắt Push'
            ) : (
              'Bật Push'
            )}
          </Button>
        </div>

        {/* Per-type toggles (only shown when push is enabled) */}
        {preferences.enabled && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Loại cảnh báo push
            </p>
            {PUSH_TYPES.map((type) => (
              <div
                key={type}
                className="flex items-center justify-between py-2 px-1"
              >
                <div className="flex items-center gap-3">
                  <span className="text-base">{getTypeIcon(type)}</span>
                  <span className="text-sm">{getNotificationTypeLabel(type)}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences[type]}
                  aria-label={`${preferences[type] ? 'Tắt' : 'Bật'} push ${getNotificationTypeLabel(type)}`}
                  onClick={() => handleToggleType(type)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                    preferences[type] ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences[type] ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
