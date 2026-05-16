'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Search, Filter, Clock, User, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { AuditLog } from '@/lib/types';

/**
 * Trang Nhật ký Hoạt động (Audit Log)
 *
 * - Hiển thị danh sách nhật ký sắp xếp theo thời gian (mới nhất trước)
 * - Tìm kiếm theo entity_type, action, hoặc user
 * - Lọc theo loại thao tác (create/update/delete) và loại đối tượng
 * - Chỉ Owner xem được (Staff bị chặn bởi middleware + RLS)
 * - Lưu trữ tối thiểu 12 tháng
 * - Giao diện tiếng Việt, mobile-first
 *
 * Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5
 */

// === Types ===

type ActionType = 'create' | 'update' | 'delete';
type EntityType = 'sales_order' | 'product' | 'stock_adjustment' | 'price_change';

interface AuditLogWithUser extends AuditLog {
  user_name?: string;
}

// === Constants ===

const ACTION_LABELS: Record<ActionType, string> = {
  create: 'Tạo mới',
  update: 'Cập nhật',
  delete: 'Xóa',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  sales_order: 'Đơn hàng',
  product: 'Sản phẩm',
  stock_adjustment: 'Điều chỉnh tồn kho',
  price_change: 'Thay đổi giá',
};

const ACTION_TYPES: ActionType[] = ['create', 'update', 'delete'];
const ENTITY_TYPES: EntityType[] = ['sales_order', 'product', 'stock_adjustment', 'price_change'];

// === Utility Functions ===

/** Lấy nhãn tiếng Việt cho loại thao tác */
function getActionLabel(action: string): string {
  return ACTION_LABELS[action as ActionType] || action;
}

/** Lấy nhãn tiếng Việt cho loại đối tượng */
function getEntityTypeLabel(entityType: string): string {
  return ENTITY_TYPE_LABELS[entityType] || entityType;
}

/** Lấy variant badge cho loại thao tác */
function getActionBadgeVariant(action: string): 'default' | 'success' | 'destructive' | 'warning' {
  switch (action) {
    case 'create':
      return 'success';
    case 'update':
      return 'warning';
    case 'delete':
      return 'destructive';
    default:
      return 'default';
  }
}

/** Format thời gian đầy đủ */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

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
  if (diffDays < 30) return `${diffDays} ngày trước`;

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Format chi tiết thay đổi thành chuỗi dễ đọc */
function formatChanges(changes: Record<string, { old: unknown; new: unknown }>): string {
  if (!changes || Object.keys(changes).length === 0) return 'Không có chi tiết';

  return Object.entries(changes)
    .map(([field, { old: oldVal, new: newVal }]) => {
      const oldStr = oldVal !== null && oldVal !== undefined ? String(oldVal) : '(trống)';
      const newStr = newVal !== null && newVal !== undefined ? String(newVal) : '(trống)';
      return `${field}: ${oldStr} → ${newStr}`;
    })
    .join(', ');
}

// === Main Component ===

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'owner' | 'staff' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<ActionType | 'all'>('all');
  const [filterEntity, setFilterEntity] = useState<EntityType | 'all'>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const PAGE_SIZE = 50;

  // Get current user and verify role
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserRole(profile.role);
        // Staff bị chặn - redirect về POS
        if (profile.role === 'staff') {
          router.push('/pos');
          return;
        }
      }
    };
    getUser();
  }, [supabase, router]);

  // Fetch audit logs
  const loadLogs = useCallback(async (pageNum: number = 0, append: boolean = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);

    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    // Apply filters
    if (filterAction !== 'all') {
      query = query.eq('action', filterAction);
    }
    if (filterEntity !== 'all') {
      query = query.eq('entity_type', filterEntity);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      if (!append) setLoading(false);
      else setLoadingMore(false);
      return;
    }

    // Fetch user names for the logs
    const logsWithUsers = await enrichLogsWithUserNames(data || []);

    if (append) {
      setLogs(prev => [...prev, ...logsWithUsers]);
    } else {
      setLogs(logsWithUsers);
    }

    setHasMore((data || []).length === PAGE_SIZE);
    if (!append) setLoading(false);
    else setLoadingMore(false);
  }, [supabase, filterAction, filterEntity]);

  /** Enrich logs with user display names */
  const enrichLogsWithUserNames = async (auditLogs: AuditLog[]): Promise<AuditLogWithUser[]> => {
    if (auditLogs.length === 0) return [];

    // Get unique user IDs
    const userIds = Array.from(new Set(auditLogs.map(log => log.user_id)));

    const { data: users } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', userIds);

    const userMap = new Map<string, string>();
    if (users) {
      users.forEach(u => userMap.set(u.id, u.full_name));
    }

    return auditLogs.map(log => ({
      ...log,
      user_name: userMap.get(log.user_id) || 'Không xác định',
    }));
  };

  // Load logs when filters change
  useEffect(() => {
    if (userRole === 'owner') {
      setPage(0);
      loadLogs(0, false);
    }
  }, [userRole, loadLogs]);

  // Load more
  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadLogs(nextPage, true);
  }, [page, loadLogs]);

  // Filter logs by search query (client-side for quick search)
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;

    const query = searchQuery.toLowerCase().trim();
    return logs.filter(log => {
      const entityLabel = getEntityTypeLabel(log.entity_type).toLowerCase();
      const actionLabel = getActionLabel(log.action).toLowerCase();
      const userName = (log.user_name || '').toLowerCase();
      const entityId = log.entity_id.toLowerCase();
      const changesStr = JSON.stringify(log.changes).toLowerCase();

      return (
        entityLabel.includes(query) ||
        actionLabel.includes(query) ||
        userName.includes(query) ||
        entityId.includes(query) ||
        changesStr.includes(query)
      );
    });
  }, [logs, searchQuery]);

  // Loading state
  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải nhật ký...</p>
        </div>
      </div>
    );
  }

  // Access denied for staff (fallback, middleware should handle this)
  if (userRole === 'staff') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-2">Không có quyền truy cập</h2>
            <p className="text-muted-foreground text-sm">
              Chỉ chủ cửa hàng mới có thể xem nhật ký hoạt động.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6" />
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Nhật ký hoạt động</h1>
            <p className="text-sm text-muted-foreground">
              Theo dõi mọi thao tác trên hệ thống
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="self-start md:self-auto">
          {filteredLogs.length} bản ghi
        </Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm kiếm theo người dùng, loại thao tác, đối tượng..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          aria-label="Tìm kiếm nhật ký"
        />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Action type filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground flex-shrink-0">Thao tác:</span>
          <div className="flex gap-1 flex-nowrap">
            <Button
              variant={filterAction === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterAction('all')}
              className="text-xs whitespace-nowrap"
            >
              Tất cả
            </Button>
            {ACTION_TYPES.map((action) => (
              <Button
                key={action}
                variant={filterAction === action ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterAction(action)}
                className="text-xs whitespace-nowrap"
              >
                {getActionLabel(action)}
              </Button>
            ))}
          </div>
        </div>

        {/* Entity type filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground flex-shrink-0">Đối tượng:</span>
          <div className="flex gap-1 flex-nowrap">
            <Button
              variant={filterEntity === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterEntity('all')}
              className="text-xs whitespace-nowrap"
            >
              Tất cả
            </Button>
            {ENTITY_TYPES.map((entity) => (
              <Button
                key={entity}
                variant={filterEntity === entity ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterEntity(entity)}
                className="text-xs whitespace-nowrap"
              >
                {getEntityTypeLabel(entity)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Audit Log List */}
      {filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">
              {searchQuery || filterAction !== 'all' || filterEntity !== 'all'
                ? 'Không tìm thấy nhật ký phù hợp'
                : 'Chưa có nhật ký hoạt động nào'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <AuditLogItem key={log.id} log={log} />
          ))}

          {/* Load more button */}
          {hasMore && !searchQuery && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                    Đang tải...
                  </>
                ) : (
                  'Tải thêm'
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// === Sub-components ===

interface AuditLogItemProps {
  log: AuditLogWithUser;
}

/** Một item nhật ký trong danh sách */
function AuditLogItem({ log }: AuditLogItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="transition-colors hover:bg-accent/30">
      <CardContent
        className="p-3 md:p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex flex-col gap-2">
          {/* Top row: action badge + entity type + time */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={getActionBadgeVariant(log.action)} className="text-[10px]">
                {getActionLabel(log.action)}
              </Badge>
              <span className="text-sm font-medium">
                {getEntityTypeLabel(log.entity_type)}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
              {formatRelativeTime(log.created_at)}
            </span>
          </div>

          {/* User and summary */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{log.user_name || 'Không xác định'}</span>
            <span className="text-muted-foreground/50">•</span>
            <span className="truncate">ID: {log.entity_id.slice(0, 8)}...</span>
          </div>

          {/* Expanded: change details */}
          {expanded && (
            <div className="mt-2 pt-2 border-t space-y-2">
              {/* Full timestamp */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span>{formatDateTime(log.created_at)}</span>
              </div>

              {/* Entity ID */}
              <div className="text-xs">
                <span className="text-muted-foreground">Mã đối tượng: </span>
                <span className="font-mono text-[11px]">{log.entity_id}</span>
              </div>

              {/* Change details */}
              <div className="text-xs">
                <span className="text-muted-foreground font-medium">Chi tiết thay đổi:</span>
                {log.changes && Object.keys(log.changes).length > 0 ? (
                  <div className="mt-1 space-y-1 bg-muted/50 rounded-md p-2">
                    {Object.entries(log.changes).map(([field, { old: oldVal, new: newVal }]) => (
                      <div key={field} className="flex flex-col sm:flex-row sm:items-center gap-1">
                        <span className="font-medium text-foreground min-w-[100px]">{field}:</span>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-destructive line-through">
                            {oldVal !== null && oldVal !== undefined ? String(oldVal) : '(trống)'}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-green-700 dark:text-green-400">
                            {newVal !== null && newVal !== undefined ? String(newVal) : '(trống)'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-muted-foreground italic">Không có chi tiết thay đổi</p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
