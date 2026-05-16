'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getUnreadCount } from '@/services/notification.service';

/**
 * NotificationBell - Biểu tượng chuông thông báo với badge số chưa đọc
 *
 * Hiển thị icon chuông với badge đỏ hiển thị số thông báo chưa đọc.
 * Click → điều hướng đến trang thông báo.
 * Tự động cập nhật count qua Supabase Realtime subscription.
 *
 * Validates: Requirements 16.1
 */

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, [supabase]);

  // Fetch unread count
  const refreshCount = useCallback(async () => {
    if (!userId) return;
    const count = await getUnreadCount(userId);
    setUnreadCount(count);
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // Subscribe to realtime changes on notifications table
  useEffect(() => {
    if (!userId) return;

    // Tạo unique channel name mỗi lần mount để tránh conflict với Strict Mode
    const channelName = `notifications-bell-${userId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          refreshCount();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, supabase]);

  const handleClick = () => {
    router.push('/notifications');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center p-2 rounded-md hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${className || ''}`}
      aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ''}`}
      title="Thông báo"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-destructive rounded-full"
          aria-hidden="true"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
