import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { fail } from '../utils/response.js';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('生产环境必须设置 JWT_SECRET'); })() : 'dev-secret-change-me');

export const USER_ROLES = [
  'super_admin',
  'hr_admin',
  'hr_staff',
  'dept_manager',
  'finance',
  'auditor',
] as const;

export type UserRole = typeof USER_ROLES[number];

export const DATA_READ_ROLES: UserRole[] = [...USER_ROLES];
export const DATA_WRITE_ROLES: UserRole[] = ['super_admin', 'hr_admin', 'hr_staff', 'finance'];
export const DATA_ADMIN_ROLES: UserRole[] = ['super_admin', 'hr_admin'];
export const USER_ADMIN_ROLES: UserRole[] = ['super_admin', 'hr_admin'];
const DASHBOARD_ONLY_SCOPE_KEYS = new Set(['数据看板', '看板', 'dashboard', 'Dashboard']);
const ALL_SERVER_DATA_TYPES = ['overview', 'department', 'composition', 'position', 'store', 'budget', 'costStructure', 'hqBusinessLine', 'hqDept', 'platform'];
const HR_SERVER_DATA_TYPES = ['overview', 'department', 'composition', 'position', 'store', 'costStructure', 'hqBusinessLine', 'hqDept', 'platform'];
const FINANCE_SERVER_DATA_TYPES = ['overview', 'composition', 'budget', 'costStructure'];

const DATA_WRITE_TYPES_BY_ROLE: Record<UserRole, string[]> = {
  super_admin: ALL_SERVER_DATA_TYPES,
  hr_admin: ALL_SERVER_DATA_TYPES,
  hr_staff: HR_SERVER_DATA_TYPES,
  finance: FINANCE_SERVER_DATA_TYPES,
  dept_manager: [],
  auditor: [],
};

const DATA_DELETE_TYPES_BY_ROLE: Record<UserRole, string[]> = {
  super_admin: ALL_SERVER_DATA_TYPES,
  hr_admin: ALL_SERVER_DATA_TYPES,
  hr_staff: [],
  finance: [],
  dept_manager: [],
  auditor: [],
};

export function isUserRole(role: unknown): role is UserRole {
  return typeof role === 'string' && USER_ROLES.includes(role as UserRole);
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: UserRole;
  departmentScope?: string[];
}

function hasDashboardOnlyScope(user: { departmentScope?: string[] }) {
  return (user.departmentScope ?? []).some((scope) => DASHBOARD_ONLY_SCOPE_KEYS.has(scope.trim()));
}

export function canWriteDataType(user: JwtPayload, dataType: string): boolean {
  if (hasDashboardOnlyScope(user)) return false;
  return DATA_WRITE_TYPES_BY_ROLE[user.role]?.includes(dataType) ?? false;
}

export function canDeleteDataType(user: JwtPayload, dataType: string): boolean {
  if (hasDashboardOnlyScope(user)) return false;
  return DATA_DELETE_TYPES_BY_ROLE[user.role]?.includes(dataType) ?? false;
}

function isReadOnlyRoleCheck(roles: UserRole[]) {
  return roles.length === USER_ROLES.length && USER_ROLES.every((role) => roles.includes(role));
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

type CachedUser = { id: string; username: string; role: string; departmentScope: string[]; isActive: boolean };
const AUTH_USER_CACHE_TTL_MS = 30_000;
const authUserCache = new Map<string, { value: CachedUser; expiresAt: number }>();

export function invalidateAuthUserCache(userId: string) {
  authUserCache.delete(userId);
}

async function getAuthUser(userId: string): Promise<CachedUser | null> {
  const cached = authUserCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, role: true, departmentScope: true, isActive: true },
  });
  if (user) authUserCache.set(userId, { value: user, expiresAt: Date.now() + AUTH_USER_CACHE_TTL_MS });
  return user;
}

/**
 * JWT 认证中间件 — 验证 Bearer Token
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(res, 1002, '未提供认证 Token', 401);
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const user = await getAuthUser(payload.userId);

    if (!user || !user.isActive) {
      return fail(res, 1002, '账号不存在或已停用', 401);
    }
    if (!isUserRole(user.role)) {
      return fail(res, 1003, '账号角色无效，请联系管理员', 403);
    }

    req.user = { userId: user.id, username: user.username, role: user.role, departmentScope: user.departmentScope };
    next();
  } catch {
    return fail(res, 1002, 'Token 无效或已过期', 401);
  }
}

/**
 * 角色权限中间件工厂
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return fail(res, 1002, '未认证', 401);
    }
    if (!roles.includes(req.user.role)) {
      return fail(res, 1003, '无权限访问此资源', 403);
    }
    if (hasDashboardOnlyScope(req.user) && !isReadOnlyRoleCheck(roles)) {
      return fail(res, 1003, '当前账号仅允许只读访问数据看板', 403);
    }
    next();
  };
}
