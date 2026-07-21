import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { success, fail, serverError } from '../utils/response.js';
import { authenticate, isUserRole, type JwtPayload } from '../middleware/auth.js';

function getJwtSecret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET', developmentFallback: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`生产环境必须设置 ${name}`);
  }
  return developmentFallback;
}

const JWT_SECRET = getJwtSecret('JWT_SECRET', 'dev-secret-change-me');
const JWT_REFRESH_SECRET = getJwtSecret('JWT_REFRESH_SECRET', 'dev-refresh-secret');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export const authRouter = Router();

/**
 * POST /api/v1/auth/login
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return fail(res, 1001, '用户名和密码不能为空');
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return fail(res, 1002, '用户名或密码错误', 401);
    }
    if (!user.isActive) {
      return fail(res, 1002, '账号已停用，请联系管理员', 401);
    }
    if (!isUserRole(user.role)) {
      return fail(res, 1003, '账号角色无效，请联系管理员', 403);
    }

    // 检查是否锁定
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return fail(res, 1002, '账户已被锁定，请稍后再试', 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      // 记录失败次数
      const attempts = user.loginAttempts + 1;
      const lockedUntil = attempts >= 5
        ? new Date(Date.now() + 15 * 60 * 1000) // 15分钟
        : null;

      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: attempts, lockedUntil },
      });

      return fail(res, 1002, '用户名或密码错误', 401);
    }

    // 登录成功，重置尝试次数
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    // 生成 JWT
    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions);

    // 存储 refresh token hash
    const tokenHash = await bcrypt.hash(refreshToken, 6);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return success(res, {
      accessToken,
      refreshToken,
      expiresIn: 7200,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        departmentScope: user.departmentScope,
      },
    });
  } catch (error) {
    return serverError(res, error);
  }
});

/**
 * POST /api/v1/auth/refresh
 */
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return fail(res, 1001, 'refreshToken 不能为空');
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JwtPayload;
    } catch {
      return fail(res, 1002, 'refreshToken 无效或已过期', 401);
    }

    // 刷新令牌也必须校验账号当前状态，确保停用/角色变更立即生效。
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, username: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return fail(res, 1002, '账号不存在或已停用', 401);
    }
    if (!isUserRole(user.role)) {
      return fail(res, 1003, '账号角色无效，请联系管理员', 403);
    }

    // 验证 refresh token 未被撤销
    const tokens = await prisma.refreshToken.findMany({
      where: { userId: payload.userId, revoked: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    let found = false;
    for (const t of tokens) {
      if (await bcrypt.compare(refreshToken, t.tokenHash)) {
        found = true;
        break;
      }
    }

    if (!found) {
      return fail(res, 1002, 'refreshToken 已被撤销', 401);
    }

    const newAccessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions,
    );

    return success(res, { accessToken: newAccessToken, expiresIn: 7200 });
  } catch (error) {
    return serverError(res, error);
  }
});

/**
 * POST /api/v1/auth/logout
 */
authRouter.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    // 撤销所有 refresh tokens
    await prisma.refreshToken.updateMany({
      where: { userId: req.user!.userId, revoked: false },
      data: { revoked: true },
    });
    return success(res, null, '已登出');
  } catch (error) {
    return serverError(res, error);
  }
});

/**
 * GET /api/v1/auth/me
 */
authRouter.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, username: true, displayName: true, email: true,
        role: true, departmentScope: true, isActive: true,
        lastLoginAt: true, createdAt: true,
      },
    });
    if (!user) {
      return fail(res, 1004, '用户不存在');
    }
    return success(res, user);
  } catch (error) {
    return serverError(res, error);
  }
});
