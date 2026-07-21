# 优化计划 v1.2 实施记录

> 实施日期：2026-07-21
> 来源计划：`docs/optimization-plan.md`
> 实施原则：优先完成上线前 P0、高收益 P1 与可安全落地的 P2；涉及数据迁移、业务口径或大组件拆分的事项保留为后续迭代。

## 一、改动总览

| 优先级 | 状态 | 主要改动 |
|------|------|------|
| P0 | 已落地 | 生产迁移、健康检查、默认凭据清理、部署脚本加固、Zod 输入校验、定向薪资重算、审计日志完善、已知问题文档更新 |
| P1 | 部分落地 | Token 自动刷新、看板聚合 API、重复类型收敛、批量导入反馈、Prisma 初始迁移、Dashboard 布局水合竞态修复 |
| P2 | 部分落地 | 页面懒加载、安全响应头、接口限流、公式引擎替换、生产错误脱敏、认证用户缓存、依赖安全审计修复 |
| 后续 | 待迭代 | 大组件拆分、金额字段精度迁移、物化视图、React Query、SSE、xlsx 导出、导入预览、自动化测试体系 |

## 二、已完成改动

### 2.1 生产部署与数据库迁移

- `server/Dockerfile`：将启动命令从 `prisma db push` 改为 `prisma migrate deploy`，避免生产环境无迁移历史地推送 Schema。
- `server/Dockerfile`：runner 阶段安装 `wget`，并新增 Docker `HEALTHCHECK`，与 Compose 健康检查保持一致。
- `server/package.json`、`server/package-lock.json`：将 `prisma` 保留在生产依赖中，保证容器运行时可执行迁移部署。
- `server/prisma/migrations/20260721130000_init/migration.sql`：新增初始迁移文件。
- `server/prisma/migrations/20260721143000_add_salary_v13_fields/migration.sql`：新增店铺业绩、有效贡献人数、病假/产假/年假工资、经济补偿金等 v1.3 字段迁移。
- `server/prisma/migrations/migration_lock.toml`：新增 Prisma 迁移锁文件。
- `DEPLOY.md`、`docs/deploy-guide.md`：补充历史 `db push` 数据库升级到 Prisma Migrate 的 baseline 步骤。

历史数据库首次升级前必须先备份，再执行一次：

```bash
docker compose run --rm server \
  npx prisma migrate resolve --applied 20260721130000_init
```

### 2.2 凭据与部署脚本安全

- `.env.example`、`server/.env.example`、`docker-compose.yml`：移除真实可用的默认管理员凭据，默认管理员用户名改为 `admin`，密码改为占位符。
- `server/prisma/seed.ts`：管理员密码必须来自环境变量，拒绝占位符和少于 12 位的密码。
- `server/src/index.ts`：仅在没有启用的超级管理员时创建初始管理员；生产启动时拒绝空密码、占位符或短密码。
- `deploy.sh`：自动生成随机初始管理员密码；已有 `.env` 时校验数据库、JWT 与管理员密码不能为示例值。
- `sync-to-server.sh`：移除硬编码服务器账号，要求显式传入 `user@host` 或 `SERVER`；增加参数白名单、部署前备份、远端 `.env` 安全检查，并避免危险的 `sed` 拼接。
- `scripts/ubuntu-docker-deploy.sh`：移除 `curl | sudo sh`，未安装 Docker 时只提示官方安装流程。

### 2.3 后端数据接口与计算优化

- `server/src/schemas/data.ts`：新增十类薪资数据的 Zod Schema，校验月份、文本、非负数字和非负整数，剥离未知字段。
- `server/prisma/schema.prisma`、`src/types/index.ts`、`src/types/fieldConfig.ts`：补齐预算人力成本与人力成本组成的新业务字段。
- `server/src/routes/data.ts`：所有新增、编辑、批量导入接口统一走服务端校验；`createdBy` 强制来自当前登录用户。
- `server/src/routes/data.ts`：批量导入改用 `createMany`，单次导入限制 5000 条，并返回成功、跳过和错误明细。
- `server/src/services/salaryCalculator.ts`：改为仅重算当前月、下月、下一年同月，并在事务中更新总览、部门、层级和区域人效派生字段。
- `server/src/middleware/auditLog.ts`：审计日志支持动态表名、记录脱敏后的变更内容，并从成功响应中提取新增记录 ID。

### 2.4 认证、权限与安全加固

- `server/src/index.ts`：增加 Helmet、全局 API 限流、登录接口限流，并关闭 `x-powered-by`。
- `server/src/utils/response.ts`：生产环境统一隐藏内部异常信息。
- `server/src/middleware/auth.ts`：增加 30 秒用户状态缓存，降低每请求查库压力。
- `server/src/routes/auth.ts`：登录与刷新 Token 均校验账号是否启用、角色是否有效；生产环境强制设置 JWT 密钥。
- `server/src/routes/users.ts`：账号编辑、停用、密码重置后撤销 refresh token 并清理认证缓存。
- `nginx.conf`：移除过时的 `X-XSS-Protection`，新增 CSP 安全头。

### 2.5 前端性能与体验优化

- `src/lib/api.ts`：实现 Access Token 自动刷新；并发 401 时复用同一个刷新请求，刷新失败才清空会话。
- `server/src/routes/dashboard.ts`：新增 `GET /api/v1/dashboard/summary` 聚合接口，一次返回十类看板数据。
- `src/contexts/DataContext.tsx`：看板数据加载改为调用聚合接口；批量导入后通过 toast 展示成功、跳过和前三条错误。
- `src/lib/api.ts`、`src/utils/salaryCalculations.ts`：收敛 `DATA_TO_STORAGE_KEY`、`PersistedSalaryData` 和数据类型映射，减少重复维护点。
- `src/App.tsx`：对主要页面使用 `React.lazy` 与 `Suspense`，实现页面级 code splitting。
- `src/components/dashboard/useDashboardLayout.ts`：加载服务器布局期间缓存本地操作，避免异步响应覆盖用户刚做的调整。
- `src/utils/formulaEngine.ts`：使用 `mathjs.evaluate` 替代动态 `Function()`，并保留表达式字符白名单。
- `package.json`、`package-lock.json`：新增 `mathjs`，并通过 `npm audit fix --package-lock-only --omit=dev` 修复生产依赖审计问题。

### 2.6 文档同步

- `DEPLOY.md`：重写为完整生产部署指南，明确不能只部署静态前端，并加入迁移 baseline、备份、安全检查和验收清单。
- `docs/deploy-guide.md`：更新公司服务器部署流程，移除固定管理员密码，补充 Docker 安装、迁移、更新和运维说明。
- `README.md`：修正部署方式、10 类数据类型说明和默认管理员初始化逻辑。
- `KNOWN_ISSUES.md`：将 localStorage、多设备不共享、Mock 认证等已解决事项移到 v1.2 已解决区域，保留 Float 精度等真实遗留问题。
- `deploy.sh`、`package.json`：将静态构建明确标注为本地预览，不再描述为生产部署方式。

## 三、验证记录

已通过的验证命令：

```bash
npm run build
npm --prefix server run build
cd server && DATABASE_URL='postgresql://salary:salary@127.0.0.1:5432/salary?schema=public' npx prisma validate --schema prisma/schema.prisma
bash -n deploy.sh
bash -n sync-to-server.sh
bash -n scripts/backup-postgres.sh
bash -n scripts/ubuntu-docker-deploy.sh
COMPOSE_PROJECT_NAME=salary-system docker compose config
npm audit --omit=dev --audit-level=high
npm --prefix server audit --omit=dev --audit-level=high
```

验证说明：

- 前端 TypeScript 与 Vite 构建通过。
- 后端 TypeScript 编译通过。
- Prisma Schema 校验通过。
- Shell 脚本语法检查通过。
- Docker Compose 配置校验通过。
- 前后端生产依赖高危审计通过。
- 当前本机 Docker daemon 未运行，因此未执行实际镜像构建和 `docker compose up`。
- Vite 仍提示 `formulaEngine` 对应 chunk 较大，原因是引入 `mathjs`；后续可将公式引擎改为动态导入或替换为轻量表达式解析器。

## 四、未纳入本次的事项

- `DashboardPage`、`ReportPage`、`DataBindingPage`、`FieldConfigDialog` 大组件拆分：改动面较大，建议单独排期并配合页面回归。
- Prisma 金额字段从 `Float` 切换到 `Decimal` 或以分为单位的 `Int`：需要正式数据迁移、回滚方案和金额精度口径确认。
- 数据库物化视图：需要确定刷新策略、权限和生产数据库资源预算。
- React Query：当前先通过聚合 API 降低请求数；缓存体系建议结合页面拆分一起推进。
- `departmentScope` 行级过滤：需要先明确总览、跨部门和多部门角色的数据口径。
- xlsx 导出、导入预览报告、SSE、Storybook、计算单测、权限集成测试：属于后续功能与测试体系建设。
