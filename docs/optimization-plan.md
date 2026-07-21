# 薪酬管理系统 优化计划 v1.2

> 生成日期：2026-07-21 | 审查范围：118 个文件 | 基准版本：salary-system-source-20260721-124330

---

## 目录

- [一、总览](#一总览)
- [二、P0 — 必须在上线前修复](#二p0--必须在上线前修复)
- [三、P1 — 建议在下一版修复](#三p1--建议在下一版修复)
- [四、P2 — 后续迭代优化](#四p2--后续迭代优化)
- [五、代码组织与可维护性](#五代码组织与可维护性)
- [六、文档更新清单](#六文档更新清单)
- [七、验证清单](#七验证清单)

---

## 一、总览

### 1.1 各维度评分

| 维度 | 评分 | 关键发现 |
|------|:----:|---------|
| 代码质量 | ⭐⭐⭐⭐ | 整体良好，少数文件存在重复代码和反模式 |
| 架构设计 | ⭐⭐⭐⭐⭐ | 权限模型、注册表模式、中间件链设计专业 |
| 性能优化 | ⭐⭐⭐ | 批量加载、图表打包、数据库重算均有优化空间 |
| 安全性 | ⭐⭐⭐⭐ | 关键保护到位，有若干可加固点 |
| 可维护性 | ⭐⭐⭐ | 4 个 1000+ 行巨组件是主要瓶颈 |
| 可扩展性 | ⭐⭐⭐⭐ | 新增数据类型/角色成本低 |
| 最佳实践 | ⭐⭐⭐⭐ | TS 严格模式、JWT 双 Token、统一响应格式 |

### 1.2 文件级评分排行

#### 评分最高（≥ 4/5）

| 文件 | 评分 | 亮点 |
|------|:----:|------|
| `src/utils/fieldStandards.ts` | 4.5 | CSV 兼容策略清晰，别名映射设计好 |
| `docs/field-standard.md` | 4 | 字段规范完整，命名规则明确 |
| `docs/account-permissions.md` | 4 | 权限矩阵详尽，API 示例清晰 |
| `src/lib/permissions.ts` | 4 | RBAC 实现干净，类型安全 |
| `src/pages/LoginPage.tsx` | 4 | 简洁、功能单一、体验好 |
| `src/hooks/useAuth.ts` | 4 | 认证状态管理清晰 |
| `src/App.tsx` | 4 | Provider 层级正确，路由保护合理 |
| `docker-compose.yml` | 4 | 健康检查依赖、数据卷持久化、环境变量注入 |
| `nginx.conf` | 4 | gzip+缓存+安全头齐全 |

#### 需要重点改进（≤ 3/5）

| 文件 | 评分 | 主要问题 |
|------|:----:|---------|
| `server/Dockerfile` | 2 | `prisma db push` 生产风险、缺 HEALTHCHECK、devDeps 打包 |
| `scripts/sync-to-server.sh` | 2 | sed 注入风险、硬编码凭据、无回滚 |
| `scripts/ubuntu-docker-deploy.sh` | 2 | `curl \| sudo sh` 供应链风险 |
| `server/src/services/salaryCalculator.ts` | 2 | 全表扫描 + N+1 更新、不区分数据范围 |
| `server/src/middleware/auditLog.ts` | 2 | tableName 永远为空、无变更值记录 |
| `KNOWN_ISSUES.md` | 2 | 3/10 条已过时，描述的是旧版 localStorage 架构 |
| `docs/DEPLOY.md` | 3 | 推荐已不可用的纯前端部署、IP 与脚本不一致 |
| `server/src/routes/data.ts` | 3 | 零输入校验、批次写入逐条 create、无 Zod |

---

## 二、P0 — 必须在上线前修复

### P0-1 server/Dockerfile — `prisma db push` 生产数据丢失风险

| 属性 | 内容 |
|------|------|
| **文件** | `server/Dockerfile:22` |
| **严重度** | 🔴 致命 |
| **当前行为** | `CMD` 中执行 `npx prisma db push`，这是开发命令，会直接推送 Schema 到数据库，不留迁移记录。Schema 不兼容时可能删表重建，导致生产数据丢失 |
| **修复方案** | 改为 `npx prisma migrate deploy`（应用已有迁移文件），同时生成并提交 migration 文件到 `server/prisma/migrations/` |
| **预计工时** | 1h |

```diff
- CMD npx prisma db push && node dist/index.js
+ CMD npx prisma migrate deploy && node dist/index.js
```

---

### P0-2 Docker Compose 健康检查链断裂

| 属性 | 内容 |
|------|------|
| **文件** | `server/Dockerfile` + `docker-compose.yml:52` |
| **严重度** | 🔴 致命 |
| **当前行为** | docker-compose.yml 用 `wget` 做服务器健康检查，但 server/Dockerfile 只装了 `openssl`，没装 `wget`。健康检查命令找不到 → 容器标记 unhealthy → client 容器永远不启动 |
| **修复方案** | server/Dockerfile 的 runner stage 加 `apk add --no-cache wget`；或改用 Node.js 内置健康检查 |
| **预计工时** | 0.5h |

```diff
# server/Dockerfile runner stage
- RUN apk add --no-cache openssl
+ RUN apk add --no-cache openssl wget

# 或 docker-compose.yml 改为 node 自检
- test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
+ test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health',r=>{process.exit(r.statusCode===200?0:1)})"]
```

---

### P0-3 硬编码凭据清理

| 属性 | 内容 |
|------|------|
| **文件** | `.env.example`、`server/.env.example`、`scripts/sync-to-server.sh`、`server/prisma/seed.ts` |
| **严重度** | 🔴 高危 |
| **当前行为** | `Mixmind / Mixmind` 作为真实可用的管理员默认凭据，出现在 4 个文件中。任何人拿到代码即可直接登录生产系统 |
| **修复方案** | `.env.example` 改为 `ADMIN_PASSWORD=change-me-now`（明确占位符）；`sync-to-server.sh` 移除硬编码，改为运行时报错要求手动输入；`seed.ts` 默认密码改为随机生成或强制要求环境变量 |
| **预计工时** | 1h |

**影响文件清单：**
```
.env.example:22          ADMIN_PASSWORD=Mixmind    → 改为占位符
server/.env.example:19    ADMIN_PASSWORD="Mixmind"  → 改为占位符
scripts/sync-to-server.sh:37  ensure_env ADMIN_PASSWORD Mixmind  → 移除或强制交互输入
server/prisma/seed.ts:16  const hash = await bcrypt.hash('Mixmind', 12)  → 读环境变量
```

---

### P0-4 KNOWN_ISSUES.md 过时

| 属性 | 内容 |
|------|------|
| **文件** | `KNOWN_ISSUES.md` |
| **严重度** | 🔴 高危 |
| **当前行为** | #1 (localStorage 存储)、#2 (无多用户)、#3 (mock 认证) 三条已因后端搭建而解决，但文档仍列为活跃问题，会误导排障 |
| **修复方案** | 将已解决的问题移到"已解决"分区，标注版本号。新增当前版本的实际已知问题 |
| **预计工时** | 0.5h |

---

### P0-5 sync-to-server.sh — Shell 注入与供应链风险

| 属性 | 内容 |
|------|------|
| **文件** | `scripts/sync-to-server.sh` |
| **严重度** | 🔴 高危 |
| **当前行为** | `sed -i "s|^${key}=.*|${key}=${value}|"` 中 `${value}` 未转义，含特殊字符可引发 sed 语法错误或命令注入；`ssh -tt` 强制伪终端在自动化环境下输出乱码 |
| **修复方案** | 用 `awk` 替代 `sed` 避免分隔符冲突；移除 `-tt` 标志；增加部署前数据库自动备份步骤 |
| **预计工时** | 2h |

---

### P0-6 后端数据路由缺少输入校验

| 属性 | 内容 |
|------|------|
| **文件** | `server/src/routes/data.ts` |
| **严重度** | 🔴 高危 |
| **当前行为** | `sanitizeRecord` 只删除了 `id`/`createdAt`/`updatedAt`，其余字段未经任何校验直接写入 Prisma。无效数据会触发数据库级错误，且错误消息泄露给客户端 |
| **修复方案** | 用 `zod`（已在 package.json 中）为每种数据类型定义 schema，在 `POST` 和 `PUT` 路由中校验 body |
| **预计工时** | 3h |

```typescript
// 新增 schema 文件 server/src/schemas/data.ts
import { z } from 'zod';

export const monthlyOverviewSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  totalRevenue: z.number().min(0),
  selfOperatedRevenue: z.number().min(0),
  franchiseRevenue: z.number().min(0),
  platformRevenue: z.number().min(0),
  factoryRevenue: z.number().min(0).optional(),
  totalLaborCost: z.number().min(0),
});

// data.ts 中使用
import { monthlyOverviewSchema } from '../schemas/data.js';
const parsed = monthlyOverviewSchema.safeParse(req.body);
if (!parsed.success) return fail(res, 1001, parsed.error.message);
```

---

### P0-7 salaryCalculator 全表扫描 + N+1 更新

| 属性 | 内容 |
|------|------|
| **文件** | `server/src/services/salaryCalculator.ts` |
| **严重度** | 🔴 高危 |
| **当前行为** | 每次数据写入触发 4 个 `findMany()` 全量拉取所有表中的所有行，然后逐行 `update()`。例：14 个月 × 6 部门 = 84 次 UPDATE，每次一条 SQL。数据增长后耗时线性恶化 |
| **修复方案** | ① 只重算受影响的月份（前后的环比/同比依赖行）；② 用 `updateMany` 批量更新替代逐条；③ 用事务保证一致性 |
| **预计工时** | 4h |

---

### P0-8 审计日志无表名、无变更记录

| 属性 | 内容 |
|------|------|
| **文件** | `server/src/middleware/auditLog.ts` |
| **严重度** | 🔴 高危 |
| **当前行为** | 所有路由调用 `auditLog('create', '')`，第二个参数永远是空字符串。`changes` 字段从未填充。审计日志无法告知"哪张表被改了"、"改了什么" |
| **修复方案** | 修复路由中的 `auditLog` 调用，传入实际表名；在中间件中捕获 request body 写入 `changes` 字段 |
| **预计工时** | 2h |

---

## 三、P1 — 建议在下一版修复

### P1-1 前端无 Token 自动刷新

| 属性 | 内容 |
|------|------|
| **文件** | `src/lib/api.ts` |
| **当前行为** | accessToken 过期时只清空 session → 用户被踢回登录页。refreshToken 已存储但从不使用 |
| **修复方案** | `request()` 函数在收到 401 时，自动调用 `/auth/refresh` 用 refreshToken 换新 accessToken，重试原请求。只有 refresh 也失败才清空 session |
| **预计工时** | 2h |

---

### P1-2 看板无聚合 API，10 并发请求

| 属性 | 内容 |
|------|------|
| **文件** | `src/lib/api.ts:242-265` |
| **当前行为** | `loadAllSalaryData()` 并发 10 个 `listData()` 请求，每个 listData 又并发拉取所有分页。如果有 5 页数据，就是 50 个并发请求 |
| **修复方案** | 后端新增 `GET /api/v1/dashboard/summary?month=2026-07` 聚合端点，一次返回看板所需的全部预计算数据；前端接入 React Query 管理缓存 |
| **预计工时** | 4h |

---

### P1-3 三处重复的 data type → storage key 映射

| 属性 | 内容 |
|------|------|
| **文件** | `src/lib/api.ts` (DATA_TO_STORAGE_KEY) + `src/contexts/DataContext.tsx` (DATA_TYPE_REGISTRY + SERVER_DATA_REGISTRY) |
| **当前行为** | 相同的 10-key 映射在 2 个文件 3 个位置分别维护。新增数据类型需要同步改 3 处 |
| **修复方案** | 将 `DATA_TO_STORAGE_KEY` 提升为唯一的共享定义，`api.ts` 导出，`DataContext.tsx` 导入使用 |
| **预计工时** | 1h |

---

### P1-4 `PersistedSalaryData` 接口重复定义

| 属性 | 内容 |
|------|------|
| **文件** | `src/lib/api.ts:77-88` + `src/utils/salaryCalculations.ts:17-28` |
| **当前行为** | 完全相同的 10 个字段的接口在两处定义 |
| **修复方案** | 在 `api.ts` 中保留唯一定义，`salaryCalculations.ts` 从 `api.ts` 导入 |
| **预计工时** | 0.5h |

---

### P1-5 DataContext 的 batchAddItems 丢弃错误报告

| 属性 | 内容 |
|------|------|
| **文件** | `src/contexts/DataContext.tsx:202-208` |
| **当前行为** | `batchCreateDataItems` 返回 `{ total, success, skipped, errors }`，调用方不检查返回值，静默丢弃导入失败的行 |
| **修复方案** | 检查返回值，通过 toast 向用户报告成功的数量和失败的原因 |
| **预计工时** | 0.5h |

---

### P1-6 看板 DashboardPage 仍需拆分

| 属性 | 内容 |
|------|------|
| **文件** | `src/pages/DashboardPage.tsx` (~1670 行) |
| **当前行为** | 单个组件管理全部 5 维 × 2 模式的 KPI、图表、分析面板渲染 |
| **修复方案** | 详见 `docs/dashboard-refactoring-plan.md` — 拆分为 6 个 hooks + 9 个 Section 组件 |
| **预计工时** | 8h（已在重构方案文档中详细设计） |

---

### P1-7 报表页 ReportPage 反模式

| 属性 | 内容 |
|------|------|
| **文件** | `src/pages/ReportPage.tsx` (~1440 行) |
| **当前行为** | 使用 IIFE 来规避 hooks 的条件调用规则；不同报表类型通过 `key={scope}-{type}` 强制 remount 整个组件 |
| **修复方案** | 拆分为 7 个独立报表组件（固浮比 / 业务线 / 部门 / 层级 / 区域人效 / 平台 / 成本对比），父组件仅做路由分发 |
| **预计工时** | 8h |

---

### P1-8 Prisma Float 用于金额字段

| 属性 | 内容 |
|------|------|
| **文件** | `server/prisma/schema.prisma` |
| **当前行为** | 所有金额字段用 `Float` 类型，映射为 PostgreSQL `double precision`。浮点数不能精确表示十进制，累积计算可能产生误差 |
| **修复方案** | 改为 `Decimal` 类型（Prisma 支持 Postgres `numeric`），或改为以「分」为单位的 `Int` |
| **预计工时** | 2h（需配合数据迁移） |

---

### P1-9 生成 Prisma Migration 文件

| 属性 | 内容 |
|------|------|
| **文件** | `server/prisma/migrations/` (目录不存在) |
| **当前行为** | 使用 `prisma db push` 直接同步 Schema 到数据库，没有迁移历史 |
| **修复方案** | 运行 `npx prisma migrate dev --name init` 生成初始迁移，后续 Schema 变更通过 `prisma migrate dev --name xxx` 创建新迁移文件 |
| **预计工时** | 1h |

---

### P1-10 `useDashboardLayout` 水合竞态

| 属性 | 内容 |
|------|------|
| **文件** | `src/components/dashboard/useDashboardLayout.ts` |
| **当前行为** | 组件挂载时异步加载服务器端布局。在加载完成前用户如果调整布局，服务器响应到达后会覆盖用户的本地修改 |
| **修复方案** | 用队列暂存加载期间的本地变更，加载完成后重放 |
| **预计工时** | 2h |

---

## 四、P2 — 后续迭代优化

### 4.1 安全性增强

| # | 项目 | 文件 | 说明 |
|---|------|------|------|
| P2-S1 | 添加 `helmet` 安全头中间件 | `server/src/index.ts` | 生产环境标准安全头部 |
| P2-S2 | 添加 `express-rate-limit` 限流 | `server/src/index.ts` | 登录接口和 API 全局限流 |
| P2-S3 | 替换 formulaEngine 的 `new Function() | `src/utils/formulaEngine.ts` | 改用 `mathjs` 安全表达式引擎 |
| P2-S4 | 生产环境错误消息脱敏 | `server/src/utils/response.ts` | `serverError` 不暴露 `err.message` |
| P2-S5 | 添加 CSP 头部 | `nginx.conf` | 移除过时的 X-XSS-Protection |
| P2-S6 | 认证中间件缓存降低 DB 压力 | `server/src/middleware/auth.ts` | 短时缓存 user 状态，减少每请求查库 |

### 4.2 性能优化

| # | 项目 | 文件 | 说明 |
|---|------|------|------|
| P2-P1 | 引入 React.lazy 实现 Code Splitting | `src/App.tsx` | 按页面懒加载，减少初始 bundle |
| P2-P2 | 后端批次导入改用 `createMany` | `server/src/routes/data.ts` | 当前逐条 create，改为批量插入 |
| P2-P3 | 看板聚合数据物化视图 | 数据库 | 已在 database-schema.md 中设计好 `mv_dashboard_summary` |
| P2-P4 | 前端引入 React Query | `src/lib/api.ts` | 集中管理请求缓存和去重 |

### 4.3 可维护性提升

| # | 项目 | 文件 | 说明 |
|---|------|------|------|
| P2-M1 | DataBindingPage 拆分 | `src/pages/DataBindingPage.tsx` (~1088 行) | 按 3 个 Tab 拆为独立组件 |
| P2-M2 | FieldConfigDialog 拆分 | `src/components/data/FieldConfigDialog.tsx` (~1058 行) | 提取字段编辑子组件 |
| P2-M3 | 引入 Storybook | 项目级 | 让 Section 组件可独立开发和测试 |
| P2-M4 | 补充后端单元测试 | `server/src/services/salaryCalculator.ts` | 覆盖核心计算逻辑 |
| P2-M5 | 补充权限集成测试 | 项目级 | 覆盖 6 角色 × 关键操作的矩阵 |

### 4.4 功能增强

| # | 项目 | 说明 |
|---|------|------|
| P2-F1 | `departmentScope` 数据过滤 | 当前字段已存在，但 API 未按 scope 过滤数据 |
| P2-F2 | Excel 导出 | 当前仅 JSON/CSV，增加 xlsx 格式导出 |
| P2-F3 | 数据导入前预览+校验报告 | 提升 CSV 导入体验 |
| P2-F4 | 服务器端 SSE 实时通知 | 多人编辑时推送"数据已更新" |
| P2-F5 | 图表系统升级 | 可选 echarts 替换 recharts 以减少 bundle |

---

## 五、代码组织与可维护性

### 5.1 巨组件清单

以下文件超过 1000 行，建议按优先级依次拆分：

| 文件 | 行数 | 优先级 | 拆分方向 |
|------|:----:|:------:|---------|
| `src/pages/DashboardPage.tsx` | ~1670 | P1 | 已有完整方案 → `docs/dashboard-refactoring-plan.md` |
| `src/pages/ReportPage.tsx` | ~1440 | P1 | 7 种报表独立组件 + 共享 layout |
| `src/pages/DataBindingPage.tsx` | ~1088 | P2 | 3 个 Tab 各自独立 |
| `src/components/data/FieldConfigDialog.tsx` | ~1058 | P2 | 字段编辑器、公式编辑器独立 |

### 5.2 跨文件重复定义

| 重复内容 | 出现位置 | 修复方案 |
|---------|---------|---------|
| `DATA_TO_STORAGE_KEY` 映射表 | `api.ts` + `DataContext.tsx` (2处) | 统一在 `api.ts` 导出 |
| `PersistedSalaryData` 接口 | `api.ts` + `salaryCalculations.ts` | 统一在 `api.ts` 导出 |
| `safeNum` 函数 | 旧版还有重复，已在新版统一为 `numberUtils.ts` | ✅ 已修复 |
| 前端 `permissions.ts` / 后端 `auth.ts` 的 `DATA_WRITE_TYPES` | `src/lib/permissions.ts` + `server/src/middleware/auth.ts` | 后端 `/api/v1/users/roles` 返回角色能力，前端读取 |

### 5.3 无用的依赖

| 包 | 文件 | 说明 |
|------|------|------|
| `zod` (v4.3.5) | `server/package.json` | 已声明但未导入，应在 P0-6 中启用 |
| `multer` (v2.0.2) | `server/package.json` | 已声明但未导入，文件上传功能尚未实现 |

---

## 六、文档更新清单

| 文档 | 问题 | 行动 |
|------|------|------|
| `KNOWN_ISSUES.md` | #1 / #2 / #3 已过时 | 移到"已解决"分区，标注 v1.2 |
| `DEPLOY.md` | 推荐纯前端部署（已不可用），IP 与脚本不一致 | 移除静态部署方式 B，统一 IP |
| `README.md` | 数据显示"7 种数据类型"实际为 10 种，部署方式标题编号错乱 | 修正为 10 种，修复标题编号 |
| `docs/deploy-guide.md` | 引用的文件可能不存在 | 逐文件确认路径 |

---

## 七、验证清单

以下项应在 P0 修复完成后逐条验证：

- [ ] `docker compose up -d` 能成功启动三个容器且全部 healthy
- [ ] 访问 `http://服务器IP` 可以打开登录页
- [ ] 登录后可以查看看板、数据管理、报表
- [ ] 在数据管理中新增一条部门数据，看板实时更新
- [ ] 用 `super_admin` 登录可以看到"账号管理"入口
- [ ] 用 `hr_admin` 创建新账号 → 新账号登录 → 只能看到对应权限的页面
- [ ] 用 `auditor` 登录 → 只能看读看板/报表，无法进入数据管理
- [ ] 停用一个账号 → 该账号的 refresh token 立即失效
- [ ] `npm run build` 前端构建通过（无 TypeScript 错误）
- [ ] `npm --prefix server run build` 后端构建通过
- [ ] `scripts/backup-postgres.sh` 可正常生成备份文件
- [ ] 审计日志记录中包含正确的 `tableName`

---

> 本优化计划基于对 salary-system-source-20260721-124330.tar.gz 中 118 个文件的逐文件审查，包含 3 个并行审查代理的独立分析结果汇总。
