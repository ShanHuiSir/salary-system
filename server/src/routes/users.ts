import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma.js';
import { success, fail, serverError } from '../utils/response.js';
import {
  authenticate,
  invalidateAuthUserCache,
  isUserRole,
  requireRole,
  USER_ADMIN_ROLES,
  USER_ROLES,
  type UserRole,
} from '../middleware/auth.js';
import { auditLog } from '../middleware/auditLog.js';

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.use(requireRole(...USER_ADMIN_ROLES));

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: '超级管理员',
  hr_admin: 'HR 管理员',
  hr_staff: 'HR 专员',
  dept_manager: '部门负责人',
  finance: '财务',
  auditor: '审计/只读',
};

const ROLE_LEVEL: Record<UserRole, number> = {
  super_admin: 100,
  hr_admin: 80,
  hr_staff: 50,
  finance: 45,
  dept_manager: 30,
  auditor: 10,
};

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  role: true,
  departmentScope: true,
  isActive: true,
  lastLoginAt: true,
  loginAttempts: true,
  lockedUntil: true,
  createdAt: true,
  updatedAt: true,
} as const;

function getParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`无效路由参数: ${name}`);
  return value;
}

function normalizeOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDepartmentScope(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateUsername(username: unknown): string | null {
  if (typeof username !== 'string') return null;
  const trimmed = username.trim();
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(trimmed)) return null;
  return trimmed;
}

function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string') return null;
  if (password.length < 8 || password.length > 72) return null;
  return password;
}

function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === 'super_admin') return true;
  return ROLE_LEVEL[actorRole] > ROLE_LEVEL[targetRole] && targetRole !== 'super_admin';
}

async function ensureCanChangeSuperAdmin(targetUserId: string, nextRole: UserRole, nextIsActive: boolean) {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { role: true, isActive: true },
  });
  if (!target) return { ok: false, message: '用户不存在' };
  if (target.role !== 'super_admin' || !target.isActive) return { ok: true };
  if (nextRole === 'super_admin' && nextIsActive) return { ok: true };

  const otherActiveSuperAdmins = await prisma.user.count({
    where: { id: { not: targetUserId }, role: 'super_admin', isActive: true },
  });
  if (otherActiveSuperAdmins === 0) {
    return { ok: false, message: '至少需要保留一个启用状态的超级管理员' };
  }
  return { ok: true };
}

async function revokeUserTokens(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });
}

usersRouter.get('/roles', (_req: Request, res: Response) => {
  return success(res, USER_ROLES.map((role) => ({ role, label: ROLE_LABELS[role] })));
});

usersRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { search, role, isActive, page = '1', pageSize = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const size = Math.min(200, Math.max(1, parseInt(pageSize as string)));
    const where: Record<string, unknown> = {};

    if (typeof role === 'string' && isUserRole(role)) where.role = role;
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;
    if (typeof search === 'string' && search.trim()) {
      where.OR = [
        { username: { contains: search.trim(), mode: 'insensitive' } },
        { displayName: { contains: search.trim(), mode: 'insensitive' } },
        { email: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [list, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        skip: (pageNum - 1) * size,
        take: size,
      }),
      prisma.user.count({ where }),
    ]);

    return success(res, { list, total, page: pageNum, pageSize: size, totalPages: Math.ceil(total / size) });
  } catch (error) {
    return serverError(res, error);
  }
});

usersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: getParam(req, 'id') }, select: USER_SELECT });
    if (!user) return fail(res, 1004, '用户不存在', 404);
    return success(res, user);
  } catch (error) {
    return serverError(res, error);
  }
});

usersRouter.post('/', auditLog('create_user', 'users'), async (req: Request, res: Response) => {
  try {
    const username = validateUsername(req.body?.username);
    const password = validatePassword(req.body?.password);
    const role = req.body?.role;
    const displayName = normalizeOptionalString(req.body?.displayName);
    const email = normalizeOptionalString(req.body?.email);
    const departmentScope = normalizeDepartmentScope(req.body?.departmentScope) ?? [];

    if (!username) return fail(res, 1001, '用户名需为 3-32 位字母、数字、下划线、点或横线');
    if (!password) return fail(res, 1001, '密码长度需为 8-72 位');
    if (!isUserRole(role)) return fail(res, 1001, '角色无效');
    if (!canManageRole(req.user!.role, role)) return fail(res, 1003, '无权限创建此角色', 403);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        displayName: displayName ?? username,
        email,
        role,
        departmentScope,
        isActive: req.body?.isActive === false ? false : true,
      },
      select: USER_SELECT,
    });

    return success(res, user, '账号创建成功');
  } catch (error) {
    return serverError(res, error);
  }
});

usersRouter.put('/:id', auditLog('update_user', 'users'), async (req: Request, res: Response) => {
  try {
    const id = getParam(req, 'id');
    const existing = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!existing) return fail(res, 1004, '用户不存在', 404);
    if (!isUserRole(existing.role)) return fail(res, 1003, '目标用户角色无效', 403);
    if (!canManageRole(req.user!.role, existing.role)) return fail(res, 1003, '无权限管理此用户', 403);

    const nextRole = req.body?.role === undefined ? existing.role : req.body.role;
    if (!isUserRole(nextRole)) return fail(res, 1001, '角色无效');
    if (!canManageRole(req.user!.role, nextRole)) return fail(res, 1003, '无权限分配此角色', 403);

    const nextIsActive = req.body?.isActive === undefined ? existing.isActive : Boolean(req.body.isActive);
    if (id === req.user!.userId && !nextIsActive) return fail(res, 1001, '不能停用当前登录账号');

    const superAdminCheck = await ensureCanChangeSuperAdmin(id, nextRole, nextIsActive);
    if (!superAdminCheck.ok) return fail(res, 1001, superAdminCheck.message ?? '无法修改超级管理员');

    const data: Record<string, unknown> = { role: nextRole, isActive: nextIsActive };
    const displayName = normalizeOptionalString(req.body?.displayName);
    const email = normalizeOptionalString(req.body?.email);
    const departmentScope = normalizeDepartmentScope(req.body?.departmentScope);
    if (displayName !== undefined) data.displayName = displayName ?? existing.username;
    if (email !== undefined) data.email = email;
    if (departmentScope !== undefined) data.departmentScope = departmentScope;
    if (req.body?.lockedUntil === null) {
      data.lockedUntil = null;
      data.loginAttempts = 0;
    }

    const user = await prisma.user.update({ where: { id }, data, select: USER_SELECT });
    invalidateAuthUserCache(id);
    if (!nextIsActive || nextRole !== existing.role) await revokeUserTokens(id);

    return success(res, user, '账号更新成功');
  } catch (error) {
    return serverError(res, error);
  }
});

usersRouter.post('/:id/password', auditLog('reset_password', 'users'), async (req: Request, res: Response) => {
  try {
    const id = getParam(req, 'id');
    const password = validatePassword(req.body?.password);
    if (!password) return fail(res, 1001, '密码长度需为 8-72 位');

    const existing = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!existing) return fail(res, 1004, '用户不存在', 404);
    if (!isUserRole(existing.role)) return fail(res, 1003, '目标用户角色无效', 403);
    if (!canManageRole(req.user!.role, existing.role)) return fail(res, 1003, '无权限管理此用户', 403);

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id },
      data: { passwordHash, loginAttempts: 0, lockedUntil: null },
    });
    invalidateAuthUserCache(id);
    await revokeUserTokens(id);

    return success(res, null, '密码已重置');
  } catch (error) {
    return serverError(res, error);
  }
});

usersRouter.delete('/:id', auditLog('disable_user', 'users'), async (req: Request, res: Response) => {
  try {
    const id = getParam(req, 'id');
    if (id === req.user!.userId) return fail(res, 1001, '不能停用当前登录账号');

    const existing = await prisma.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
    if (!existing) return fail(res, 1004, '用户不存在', 404);
    if (!isUserRole(existing.role)) return fail(res, 1003, '目标用户角色无效', 403);
    if (!canManageRole(req.user!.role, existing.role)) return fail(res, 1003, '无权限管理此用户', 403);

    const superAdminCheck = await ensureCanChangeSuperAdmin(id, existing.role, false);
    if (!superAdminCheck.ok) return fail(res, 1001, superAdminCheck.message ?? '无法停用超级管理员');

    const user = await prisma.user.update({ where: { id }, data: { isActive: false }, select: USER_SELECT });
    invalidateAuthUserCache(id);
    await revokeUserTokens(id);

    return success(res, user, '账号已停用');
  } catch (error) {
    return serverError(res, error);
  }
});
