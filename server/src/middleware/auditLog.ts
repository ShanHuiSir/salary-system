import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';

type TableNameResolver = string | ((req: Request) => string | null | undefined);

const SENSITIVE_KEY = /password|token|secret|authorization/i;
const MAX_AUDIT_ARRAY_ITEMS = 20;

function sanitizeAuditValue(value: unknown, key = ''): unknown {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) {
    if (value.length > MAX_AUDIT_ARRAY_ITEMS) {
      return { count: value.length, sample: value.slice(0, MAX_AUDIT_ARRAY_ITEMS).map((item) => sanitizeAuditValue(item)) };
    }
    return value.map((item) => sanitizeAuditValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [childKey, sanitizeAuditValue(childValue, childKey)])
    );
  }
  return value;
}

function getResponseRecordId(body: unknown): string | null {
  const response = body as { data?: unknown };
  const data = response?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const id = (data as Record<string, unknown>).id;
  return typeof id === 'string' ? id : null;
}

/** 在成功响应后异步持久化审计日志，不阻塞业务响应。 */
export function auditLog(action: string, tableName: TableNameResolver) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    const changes = sanitizeAuditValue(req.body);

    res.json = function (body: unknown) {
      const result = body as { code?: number };
      if (result?.code === 0) {
        const resolvedTableName = typeof tableName === 'function' ? tableName(req) : tableName;
        prisma.auditLog.create({
          data: {
            userId: req.user?.userId ?? null,
            username: req.user?.username ?? 'system',
            action,
            tableName: resolvedTableName || null,
            recordId: typeof req.params.id === 'string' ? req.params.id : getResponseRecordId(body),
            changes: changes as never,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
          },
        }).catch((error) => console.error('[AuditLog] 记录失败:', error));
      }
      return originalJson(body);
    };

    next();
  };
}
