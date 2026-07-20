import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { dataRouter } from './routes/data.js';
import { stateRouter } from './routes/state.js';
import { prisma } from './utils/prisma.js';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// 中间件
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
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/data', dataRouter);
app.use('/api/v1/state', stateRouter);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 全局错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ code: 5000, message: err.message || '服务器内部错误' });
});

// 启动服务
async function start() {
  try {
    // 确保数据库连接正常
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    // 确保默认管理员可用；已有同名账号时同步密码，便于服务器重新部署后立即生效。
    const adminUsername = process.env.ADMIN_USERNAME || 'Mixmind';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Mixmind';
    const hash = await bcrypt.hash(adminPassword, 12);
    const adminExists = await prisma.user.findUnique({ where: { username: adminUsername } });
    if (adminExists) {
      await prisma.user.update({
        where: { username: adminUsername },
        data: {
          passwordHash: hash,
          displayName: adminExists.displayName || '系统管理员',
          role: 'super_admin',
          isActive: true,
          loginAttempts: 0,
          lockedUntil: null,
        },
      });
      console.log(`✅ 默认管理员已更新: ${adminUsername}`);
    } else {
      await prisma.user.create({
        data: {
          username: adminUsername,
          passwordHash: hash,
          displayName: '系统管理员',
          role: 'super_admin',
        },
      });
      console.log(`✅ 默认管理员已创建: ${adminUsername}`);
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
