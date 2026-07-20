import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';

/**
 * 审计日志中间件 — 记录所有写操作
 */
export function auditLog(action: string, tableName: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    // 保存原始 json 方法以便拦截
    const originalJson = _res.json.bind(_res);
    _res.json = function (body: unknown) {
      // 异步记录审计日志，不阻塞响应
      const result = body as { code?: number };
      if (result?.code === 0) {
        prisma.auditLog.create({
          data: {
            userId: req.user?.userId ?? null,
            username: req.user?.username ?? 'system',
            action,
            tableName,
            recordId: typeof req.params.id === 'string' ? req.params.id : null,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
          },
        }).catch((err) => console.error('[AuditLog] 记录失败:', err));
      }
      return originalJson(body);
    };
    next();
  };
}
