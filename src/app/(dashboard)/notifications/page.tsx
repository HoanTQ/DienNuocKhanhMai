'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, Filter, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Notification } from '@/lib/types';
import {
  fetchNotifications,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
  getNotificationTypeLabel,
  getNotificationRoute,
  type NotificationType,
  type NotificationPreferences,
} from '@/services/notification.service';
import { PushNotificationSettings } from '@/components/shared/PushNotificationSettings';

/**
 * Trang Thông báo
 *
 * - Hiển thị danh sách thông báo sắp xếp theo thời gian
 * - Đánh dấu đã đọc/chưa đọc
 * - Lọc theo loại thông báo
 * - Click thông báo → điều hướng đến màn hình liên quan
 * - Cài đặt bật/tắt từng loại thông báo (Owner only)
 *
 * Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */

// === Types ===

type TabView = 'all' | 'settings';

const NOTIFICATION_TYPES: NotificationType[] = [
  'low_stock',
  'overdue_debt',
  'order_arrived',
  'price_changed',
  'stale_stock',
];

// === Utility Functions ===

/** Format thời gian tương đối */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Lấy icon/emoji cho loại thông báo */
function getNotificationIcon(type: NotificationType): string {
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

/** Lấy variant badge cho loại thông báo */
function getTypeBadgeVariant(type: NotificationType): 'default' | 'secondary' | 'destructive' | 'warning' {
  switch (type) {
    case 'low_stock':
      return 'warning';
    case 'overdue_debt':
      return 'destructive';
    case 'order_arrived':
      return 'default';
    case 'price_changed':
      return 'secondary';
    case 'stale_stock':
      return 'warning';
  }
}

// === Main Component ===

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'owner' | 'staff' | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>('all');
  const [filterType, setFilterType] = useState<NotificationType | 'all'>('all');
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    low_stock: true,
    overdue_debt: true,
    order_arrived: true,
    price_changed: true,
    stale_stock: true,
  });
  const [savingPreferences, setSavingPreferences] = useState(false);

  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Get user role
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profile) {
          setUserRole(profile.role);
        }
      }
    };
    getUser();
  }, [supabase]);

  // Fetch notifications
  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const filter = filterType !== 'all' ? { type: filterType } : undefined;
    const result = await fetchNotifications(userId, filter);

    if (!result.error) {
      setNotifications(result.notifications);
    }
    setLoading(false);
  }, [userId, filterType]);

  // Fetch preferences
  const loadPreferences = useCallback(async () => {
    if (!userId) return;
    const prefs = await getNotificationPreferences(userId);
    setPreferences(prefs);
  }, [userId]);

  useEffect(() => {
    loadNotifications();
    loadPreferences();
  }, [loadNotifications, loadPreferences]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Add new notification to the top of the list
          const newNotification = payload.new as Notification;
          if (filterType === 'all' || newNotification.type === filterType) {
            setNotifications((prev) => [newNotification, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, filterType]);

  /** Đánh dấu đã đọc và điều hướng */
  const handleNotificationClick = useCallback(
    async (notification: Notification) => {
      // Mark as read
      if (!notification.is_read) {
        await markAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
        );
      }

      // Navigate to related screen
      const route = getNotificationRoute(notification);
      router.push(route);
    },
    [router]
  );

  /** Toggle đọc/chưa đọc */
  const handleToggleRead = useCallback(
    async (e: React.MouseEvent, notification: Notification) => {
      e.stopPropagation();
      if (notification.is_read) {
        await markAsUnread(notification.id);
      } else {
        await markAsRead(notification.id);
      }
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, is_read: !n.is_read } : n
        )
      );
    },
    []
  );

  /** Đánh dấu tất cả đã đọc */
  const handleMarkAllRead = useCallback(async () => {
    if (!userId) return;
    await markAllAsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, [userId]);

  /** Cập nhật preferences */
  const handleTogglePreference = useCallback(
    async (type: NotificationType) => {
      if (!userId) return;
      setSavingPreferences(true);

      const newPrefs = { ...preferences, [type]: !preferences[type] };
      setPreferences(newPrefs);

      await updateNotificationPreferences(userId, { [type]: newPrefs[type] });
      setSavingPreferences(false);
    },
    [userId, preferences]
  );

  // Unread count
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  // Loading state
  if (loading && notifications.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải thông báo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6" />
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Thông báo</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {unreadCount} thông báo chưa đọc
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              <CheckCheck className="h-4 w-4 mr-1" />
              Đọc tất cả
            </Button>
          )}
          {userRole === 'owner' && (
            <Button
              variant={activeTab === 'settings' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(activeTab === 'settings' ? 'all' : 'settings')}
            >
              <Settings className="h-4 w-4 mr-1" />
              Cài đặt
            </Button>
          )}
        </div>
      </div>

      {/* Settings Tab (Owner only) */}
      {activeTab === 'settings' && userRole === 'owner' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cài đặt thông báo</CardTitle>
            <p className="text-sm text-muted-foreground">
              Bật/tắt từng loại thông báo theo nhu cầu
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {NOTIFICATION_TYPES.map((type) => (
              <div
                key={type}
                className="flex items-center justify-between py-2 border-b last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getNotificationIcon(type)}</span>
                  <span className="text-sm font-medium">
                    {getNotificationTypeLabel(type)}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences[type]}
                  aria-label={`${preferences[type] ? 'Tắt' : 'Bật'} thông báo ${getNotificationTypeLabel(type)}`}
                  disabled={savingPreferences}
                  onClick={() => handleTogglePreference(type)}
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
          </CardContent>
        </Card>
      )}

      {/* Push Notification Settings (Owner only, in settings tab) */}
      {activeTab === 'settings' && userRole === 'owner' && userId && (
        <PushNotificationSettings userId={userId} />
      )}

      {/* Notifications List Tab */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          {/* Filter by type */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex gap-1 flex-nowrap">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('all')}
                className="text-xs whitespace-nowrap"
              >
                Tất cả
              </Button>
              {NOTIFICATION_TYPES.map((type) => (
                <Button
                  key={type}
                  variant={filterType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType(type)}
                  className="text-xs whitespace-nowrap"
                >
                  {getNotificationIcon(type)} {getNotificationTypeLabel(type)}
                </Button>
              ))}
            </div>
          </div>

          {/* Notification List */}
          {notifications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">
                  {filterType === 'all'
                    ? 'Chưa có thông báo nào'
                    : `Không có thông báo loại "${getNotificationTypeLabel(filterType)}"`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                  onToggleRead={(e) => handleToggleRead(e, notification)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// === Sub-components ===

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onToggleRead: (e: React.MouseEvent) => void;
}

/** Một item thông báo trong danh sách */
function NotificationItem({ notification, onClick, onToggleRead }: NotificationItemProps) {
  return (
    <Card
      className={`cursor-pointer transition-colors hover:bg-accent/50 ${
        !notification.is_read ? 'border-l-4 border-l-primary bg-primary/5' : ''
      }`}
    >
      <CardContent className="p-3 md:p-4" onClick={onClick}>
        <div className="flex items-start gap-3">
          {/* Icon */}
          <span className="text-xl flex-shrink-0 mt-0.5">
            {getNotificationIcon(notification.type)}
          </span>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3
                className={`text-sm leading-tight ${
                  !notification.is_read ? 'font-semibold' : 'font-medium text-muted-foreground'
                }`}
              >
                {notification.title}
              </h3>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                {formatRelativeTime(notification.created_at)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {notification.message}
            </p>
            <div className="flex items-center justify-between mt-2">
              <Badge variant={getTypeBadgeVariant(notification.type)} className="text-[10px]">
                {getNotificationTypeLabel(notification.type)}
              </Badge>
              <button
                type="button"
                onClick={onToggleRead}
                className="p-1 rounded hover:bg-accent transition-colors"
                aria-label={notification.is_read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
                title={notification.is_read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
              >
                <Check
                  className={`h-3.5 w-3.5 ${
                    notification.is_read ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
