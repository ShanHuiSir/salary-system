import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { authRouter } from './routes/auth.js';
import { dataRouter } from './routes/data.js';
import { dashboardRouter } from './routes/dashboard.js';
import { stateRouter } from './routes/state.js';
import { usersRouter } from './routes/users.js';
import { prisma } from './utils/prisma.js';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = parseInt(process.env.PORT || '3000');
const isProduction = process.env.NODE_ENV === 'production';

// 中间件
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 1_000, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 路由
app.use('/api/v1/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/data', dataRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/state', stateRouter);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 全局错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ code: 5000, message: isProduction ? '服务器内部错误' : (err.message || '服务器内部错误') });
});

// 启动服务
async function start() {
  try {
    // 确保数据库连接正常
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    // 仅在系统没有可用超级管理员时创建兜底管理员。
    // 已有账号不在启动/重新部署时同步密码，避免覆盖账号管理中维护的密码。
    const adminUsername = process.env.ADMIN_USERNAME?.trim() || 'admin';
    const configuredAdminPassword = process.env.ADMIN_PASSWORD;
    const activeSuperAdminCount = await prisma.user.count({
      where: { role: 'super_admin', isActive: true },
    });
    const adminPassword = configuredAdminPassword?.trim();

    if (activeSuperAdminCount > 0) {
      console.log('✅ 已存在可用超级管理员，跳过默认管理员初始化');
    } else {
      if (!adminPassword || adminPassword === 'change-me-now' || adminPassword.length < 12) {
        throw new Error('系统没有可用超级管理员。请设置长度至少 12 位且非占位符的 ADMIN_PASSWORD 后启动服务');
      }

      const adminExists = await prisma.user.findUnique({ where: { username: adminUsername } });
      if (adminExists) {
        await prisma.user.update({
          where: { username: adminUsername },
          data: {
            displayName: adminExists.displayName || '系统管理员',
            role: 'super_admin',
            isActive: true,
            loginAttempts: 0,
            lockedUntil: null,
          },
        });
        console.log(`✅ 已启用现有默认管理员（密码保持不变）: ${adminUsername}`);
      } else {
        const hash = await bcrypt.hash(adminPassword, 12);
        await prisma.user.create({
          data: {
            username: adminUsername,
            passwordHash: hash,
            displayName: '系统管理员',
            role: 'super_admin',
          },
        });
        console.log(`✅ 已创建初始默认管理员: ${adminUsername}`);
      }
    }

    app.listen(PORT, () => {
      console.log(`🚀 薪资系统后端已启动: http://localhost:${PORT}`);
      console.log(`📋 API 文档: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
}

start();

// 优雅关闭
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
