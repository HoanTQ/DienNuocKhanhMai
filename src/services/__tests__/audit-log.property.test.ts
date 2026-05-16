import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import type { AuditLog } from '@/lib/types';

// ============================================================
// Pure function modeling: Audit Log Creation Logic
// ============================================================

/** Các loại operation quan trọng cần ghi audit log */
export type ImportantOperation =
  | 'create_order'
  | 'update_order'
  | 'delete_order'
  | 'price_change'
  | 'stock_adjustment'
  | 'delete_product';

/** Map operation type sang action trong AuditLog */
const OPERATION_TO_ACTION: Record<ImportantOperation, AuditLog['action']> = {
  create_order: 'create',
  update_order: 'update',
  delete_order: 'delete',
  price_change: 'update',
  stock_adjustment: 'update',
  delete_product: 'delete',
};

/** Map operation type sang entity_type */
const OPERATION_TO_ENTITY: Record<ImportantOperation, string> = {
  create_order: 'sales_order',
  update_order: 'sales_order',
  delete_order: 'sales_order',
  price_change: 'product',
  stock_adjustment: 'product',
  delete_product: 'product',
};

/** Input cho việc tạo audit log entry */
export interface AuditLogInput {
  userId: string;
  operation: ImportantOperation;
  entityId: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  timestamp: string;
}

/**
 * Tạo audit log entry cho một important operation.
 * Mọi important operation đều PHẢI tạo audit log entry.
 *
 * @returns AuditLog entry (không có id vì sẽ do DB generate)
 */
export function createAuditLogEntry(input: AuditLogInput): Omit<AuditLog, 'id'> {
  if (!input.userId || !input.userId.trim()) {
    throw new Error('userId không được để trống');
  }
  if (!input.entityId || !input.entityId.trim()) {
    throw new Error('entityId không được để trống');
  }
  if (!input.timestamp || !input.timestamp.trim()) {
    throw new Error('timestamp không được để trống');
  }
  if (!input.operation) {
    throw new Error('operation không được để trống');
  }

  return {
    user_id: input.userId,
    action: OPERATION_TO_ACTION[input.operation],
    entity_type: OPERATION_TO_ENTITY[input.operation],
    entity_id: input.entityId,
    changes: input.changes,
    created_at: input.timestamp,
  };
}

/**
 * Kiểm tra audit log entry có đầy đủ thông tin bắt buộc hay không.
 * Entry phải chứa: user_id, timestamp (created_at), operation type (action), change details (changes).
 */
export function isAuditLogComplete(entry: Omit<AuditLog, 'id'>): boolean {
  return (
    !!entry.user_id &&
    !!entry.created_at &&
    !!entry.action &&
    !!entry.entity_type &&
    !!entry.entity_id &&
    entry.changes !== undefined &&
    entry.changes !== null
  );
}

/**
 * Mô phỏng tính immutable của audit log entry.
 * Sau khi tạo, entry không thể bị thay đổi.
 * Trả về một frozen copy của entry.
 */
export function freezeAuditLogEntry(entry: Omit<AuditLog, 'id'>): Readonly<Omit<AuditLog, 'id'>> {
  return Object.freeze({ ...entry, changes: Object.freeze({ ...entry.changes }) });
}

/**
 * Xử lý một batch operations và tạo audit log entries cho tất cả.
 * Đảm bảo mọi important operation đều có audit log entry tương ứng.
 */
export function createAuditLogsForOperations(
  operations: AuditLogInput[]
): Omit<AuditLog, 'id'>[] {
  return operations.map(op => createAuditLogEntry(op));
}

// ============================================================
// Property Tests
// ============================================================

/**
 * **Validates: Requirements 17.1, 17.2**
 *
 * Property 12: Audit Log Completeness
 * - Mọi important operation đều tạo audit log entry
 * - Entry chứa đủ: user_id, timestamp, operation type, change details
 * - Audit log entry là immutable sau khi tạo
 */
describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 12: Audit Log Completeness', () => {
  // Generators
  const userIdArb = fc.uuid();
  const entityIdArb = fc.uuid();
  const timestampArb = fc
    .integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() })
    .map(ts => new Date(ts).toISOString());

  const operationArb = fc.constantFrom<ImportantOperation>(
    'create_order',
    'update_order',
    'delete_order',
    'price_change',
    'stock_adjustment',
    'delete_product'
  );

  const changesArb = fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.record({
      old: fc.oneof(fc.integer(), fc.string(), fc.boolean(), fc.constant(null)),
      new: fc.oneof(fc.integer(), fc.string(), fc.boolean(), fc.constant(null)),
    }),
    { minKeys: 1, maxKeys: 5 }
  ) as fc.Arbitrary<Record<string, { old: unknown; new: unknown }>>;

  const auditLogInputArb = fc.record({
    userId: userIdArb,
    operation: operationArb,
    entityId: entityIdArb,
    changes: changesArb,
    timestamp: timestampArb,
  });

  it('mọi important operation đều tạo audit log entry', () => {
    fc.assert(
      fc.property(
        fc.array(auditLogInputArb, { minLength: 1, maxLength: 10 }),
        (operations) => {
          const entries = createAuditLogsForOperations(operations);

          // Số lượng entries phải bằng số lượng operations
          expect(entries.length).toBe(operations.length);

          // Mỗi operation đều có entry tương ứng
          operations.forEach((op, index) => {
            const entry = entries[index];
            expect(entry).toBeDefined();
            expect(entry.user_id).toBe(op.userId);
            expect(entry.entity_id).toBe(op.entityId);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('entry chứa đủ: user_id, timestamp, operation type, change details', () => {
    fc.assert(
      fc.property(
        auditLogInputArb,
        (input) => {
          const entry = createAuditLogEntry(input);

          // Entry phải chứa user_id
          expect(entry.user_id).toBe(input.userId);
          expect(entry.user_id).toBeTruthy();

          // Entry phải chứa timestamp
          expect(entry.created_at).toBe(input.timestamp);
          expect(entry.created_at).toBeTruthy();

          // Entry phải chứa operation type (action)
          expect(entry.action).toBe(OPERATION_TO_ACTION[input.operation]);
          expect(['create', 'update', 'delete']).toContain(entry.action);

          // Entry phải chứa change details
          expect(entry.changes).toBeDefined();
          expect(entry.changes).not.toBeNull();
          expect(Object.keys(entry.changes).length).toBeGreaterThan(0);

          // Entry phải chứa entity_type và entity_id
          expect(entry.entity_type).toBe(OPERATION_TO_ENTITY[input.operation]);
          expect(entry.entity_id).toBe(input.entityId);

          // Kiểm tra completeness bằng helper function
          expect(isAuditLogComplete(entry)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('audit log entry là immutable sau khi tạo', () => {
    fc.assert(
      fc.property(
        auditLogInputArb,
        (input) => {
          const entry = createAuditLogEntry(input);
          const frozenEntry = freezeAuditLogEntry(entry);

          // Frozen entry phải giữ nguyên tất cả giá trị
          expect(frozenEntry.user_id).toBe(entry.user_id);
          expect(frozenEntry.created_at).toBe(entry.created_at);
          expect(frozenEntry.action).toBe(entry.action);
          expect(frozenEntry.entity_type).toBe(entry.entity_type);
          expect(frozenEntry.entity_id).toBe(entry.entity_id);
          expect(frozenEntry.changes).toEqual(entry.changes);

          // Thử thay đổi frozen entry phải throw error
          expect(() => {
            (frozenEntry as any).user_id = 'hacked-user';
          }).toThrow();

          expect(() => {
            (frozenEntry as any).action = 'delete';
          }).toThrow();

          expect(() => {
            (frozenEntry as any).created_at = '2099-01-01T00:00:00.000Z';
          }).toThrow();

          // Giá trị vẫn không thay đổi sau khi thử modify
          expect(frozenEntry.user_id).toBe(input.userId);
          expect(frozenEntry.action).toBe(OPERATION_TO_ACTION[input.operation]);
          expect(frozenEntry.created_at).toBe(input.timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mỗi loại important operation đều map đúng action type', () => {
    fc.assert(
      fc.property(
        userIdArb,
        entityIdArb,
        operationArb,
        changesArb,
        timestampArb,
        (userId, entityId, operation, changes, timestamp) => {
          const entry = createAuditLogEntry({
            userId,
            operation,
            entityId,
            changes,
            timestamp,
          });

          // Verify mapping chính xác
          switch (operation) {
            case 'create_order':
              expect(entry.action).toBe('create');
              expect(entry.entity_type).toBe('sales_order');
              break;
            case 'update_order':
              expect(entry.action).toBe('update');
              expect(entry.entity_type).toBe('sales_order');
              break;
            case 'delete_order':
              expect(entry.action).toBe('delete');
              expect(entry.entity_type).toBe('sales_order');
              break;
            case 'price_change':
              expect(entry.action).toBe('update');
              expect(entry.entity_type).toBe('product');
              break;
            case 'stock_adjustment':
              expect(entry.action).toBe('update');
              expect(entry.entity_type).toBe('product');
              break;
            case 'delete_product':
              expect(entry.action).toBe('delete');
              expect(entry.entity_type).toBe('product');
              break;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
