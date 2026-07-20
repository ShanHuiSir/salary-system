# 薪酬数据后台管理系统

> 管理每月人力成本变化、销售业绩、店效、人效等薪酬相关看板数据的后台系统。

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | 19.2 |
| 构建工具 | Vite | 7.2 |
| 类型系统 | TypeScript | 5.9 |
| CSS 框架 | Tailwind CSS | 3.4 |
| UI 组件库 | shadcn/ui (new-york) | - |
| 路由 | react-router-dom | 7.18 |
| 图表 | recharts | 2.15 |
| 表单 | react-hook-form + zod | 7.70 / 4.3 |
| 图标 | lucide-react | 0.562 |
| 通知 | sonner | 2.0 |
| 代码规范 | ESLint 9 (flat config) | - |

## 系统要求

- **Node.js**: >= 18.0.0 (推荐 20.x 或 22.x)
- **npm**: >= 9.0.0
- **操作系统**: Windows / macOS / Linux

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式启动

```bash
npm run dev
```

访问 `http://localhost:5173`

### 3. 生产构建

```bash
npm run build
```

构建产物在 `dist/` 目录。

### 4. 本地预览生产构建

```bash
npm run preview
```

## 部署方式

### 🚀 方式一: Docker Compose 一键部署（推荐 — 含数据库 + 后端）

```bash
# 1. 克隆项目
git clone https://github.com/ShanHuiSir/salary-system.git
cd salary-system

# 2. 配置环境变量
cp .env.example .env
nano .env   # 修改数据库密码和 JWT 密钥

# 3. 一键启动（PostgreSQL + 后端API + 前端Nginx）
docker compose up -d

# 4. 初始化数据库（首次启动）
docker compose exec server npx prisma db push
docker compose exec server npm run db:seed

# 5. 访问
# http://localhost   （或 http://<服务器IP>）
# 账号: Mixmind / 密码: Mixmind
```

详细部署文档：[docs/deploy-guide.md](docs/deploy-guide.md)

### 方式二: 仅前端部署（无后端，不推荐生产使用）

### 方式一: 静态文件部署（推荐）

构建后将 `dist/` 目录部署到任意静态文件服务器。

```bash
npm run build
# 将 dist/ 目录复制到服务器
```

#### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /usr/share/nginx/html;
    index index.html;

    # SPA 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 方式二: Docker 部署

```bash
# 构建镜像
docker build -t salary-dashboard:latest .

# 运行容器
docker run -d \
    --name salary-dashboard \
    -p 80:80 \
    --restart unless-stopped \
    salary-dashboard:latest
```

访问 `http://localhost`

### 方式三: 使用部署脚本

```bash
chmod +x deploy.sh

# 本地构建
./deploy.sh local

# Docker 部署
./deploy.sh docker

# 静态文件部署（含说明）
./deploy.sh static
```

## 环境配置

### 环境变量

复制 `.env.example` 为 `.env.local` 并按需修改：

```bash
cp .env.example .env.local
```

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_APP_TITLE` | 应用标题 | 薪酬数据后台管理系统 |
| `VITE_APP_VERSION` | 版本号 | 1.0.0 |
| `VITE_BASE_PATH` | 路由基础路径 | ./ |
| `VITE_ENABLE_ANALYSIS` | 启用分析引擎 | true |

### 环境文件优先级

```
.env.[mode].local  >  .env.[mode]  >  .env.local  >  .env
```

- `.env.development` — 开发模式 (`npm run dev`)
- `.env.production` — 生产构建 (`npm run build`)

## 项目结构

```
salary-system/
├── docker-compose.yml          # 一键部署编排 (PostgreSQL + 后端 + 前端)
├── .env.example                # Docker 环境变量模板
├── Dockerfile                  # 前端 Docker 镜像
├── nginx.conf                  # Nginx 配置（含 API 反向代理）
│
├── server/                     # 🔧 后端 API 服务 (Express + Prisma)
│   ├── Dockerfile              # 后端 Docker 镜像
│   ├── package.json            # 后端依赖
│   ├── tsconfig.json           # 后端 TypeScript 配置
│   ├── .env.example            # 后端环境变量模板
│   ├── prisma/
│   │   ├── schema.prisma       # 数据库表结构定义 (10 张业务表 + 系统表)
│   │   └── seed.ts             # 初始种子数据
│   └── src/
│       ├── index.ts            # Express 服务入口
│       ├── routes/
│       │   ├── auth.ts         # 登录/登出/Token 刷新
│       │   └── data.ts         # 10 种数据类型的通用 CRUD
│       ├── services/
│       │   └── salaryCalculator.ts  # 薪资数据自动重算
│       ├── middleware/
│       │   ├── auth.ts         # JWT 认证中间件
│       │   └── auditLog.ts     # 操作审计日志
│       └── utils/
│           ├── prisma.ts       # 数据库客户端
│           └── response.ts     # 统一 API 响应格式
│
├── src/                        # 前端 React 应用
│   ├── App.tsx             # 应用入口 + 路由配置
    ├── App.css             # 全局样式
    ├── index.css           # Tailwind + CSS 变量主题
    ├── main.tsx            # React 挂载入口
    ├── vite-env.d.ts       # Vite 环境变量类型声明
    ├── components/
    │   ├── dashboard/      # 看板组件
    │   │   ├── AnalysisPanel.tsx     # 分析面板
    │   │   ├── KpiCard.tsx           # KPI 卡片
    │   │   ├── SegmentOverviewCard.tsx # 板块概况
    │   │   └── TrendIndicator.tsx    # 趋势指标
    │   ├── data/           # 数据管理组件
    │   │   ├── FieldConfigDialog.tsx # 字段配置
    │   │   └── ImportDialog.tsx      # 批量导入
    │   ├── layout/         # 布局组件
    │   │   ├── AppLayout.tsx
    │   │   ├── Header.tsx
    │   │   └── Sidebar.tsx
    │   └── ui/             # shadcn/ui 组件库 (40+ 组件)
    ├── contexts/
    │   ├── DataContext.tsx         # 数据持久化 (localStorage)
    │   └── FieldConfigContext.tsx  # 字段配置持久化
    ├── data/
    │   └── mockData.ts             # 初始模拟数据
    ├── hooks/
    │   ├── useAuth.ts             # 后端认证
    │   ├── use-mobile.ts          # 移动端检测
    │   └── use-toast.ts           # Toast 通知
    ├── lib/
    │   └── utils.ts               # 工具函数 (cn 等)
    ├── pages/
    │   ├── DashboardPage.tsx      # 数据看板
    │   ├── DataListPage.tsx      # 数据管理列表
    │   ├── DataFormPage.tsx       # 数据编辑表单
    │   ├── LoginPage.tsx          # 登录页
    │   └── ReportPage.tsx         # 报表页
    ├── types/
    │   ├── index.ts               # 数据类型定义
    │   └── fieldConfig.ts        # 字段配置类型
    └── utils/
        ├── analysisEngine.ts     # 分析引擎
        ├── csvParser.ts          # CSV 解析
        └── formulaEngine.ts      # 公式计算引擎
```

## 核心功能

### 数据看板
- 总览 + 四大板块（总部、自营区域、线上、犀利工厂）
- 月份选择器，支持查看不同月份数据
- 当期 / 年度累计模式切换
- KPI 卡片、趋势图表、板块概况
- 自动分析洞察面板

### 数据管理
- 7 种数据类型：月度总览、部门数据、成本构成、层级数据、区域人效、预算人力成本、人力成本组成
- 列表管理 + 表单编辑
- 批量导入（CSV 上传，支持 UTF-8/GBK 编码）
- 字段自定义配置（增删改排序）
- 公式计算字段（安全沙箱执行）

### 报表系统
- 固浮比报表
- 业务线报表（人数、人力成本、预算、使用率）
- 部门报表（按中心分组，含小计）
- 层级报表
- 区域人效报表
- 各平台报表

### 数据联动
- 看板 KPI 从部门数据实时派生
- 数据管理编辑后看板自动更新
- 生产环境推荐使用 Docker Compose 完整部署，业务数据保存到服务器 PostgreSQL 数据库

## 默认账号

```
用户名: Mixmind
密码:   Mixmind
```

> 当前版本使用后端认证服务，默认管理员会在后端启动时自动确保可用。

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 (http://localhost:5173) |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | ESLint 代码检查 |
| `npx tsc --noEmit` | 仅类型检查（不生成文件）|

## 部署注意事项

1. **路由模式**: 使用 `BrowserRouter`，服务器需配置 SPA fallback 到 `index.html`
2. **base 路径**: `vite.config.ts` 中 `base: './'`，支持子目录部署
3. **数据持久化**: 使用 localStorage，数据存储在浏览器本地，换浏览器/设备不共享
4. **构建产物**: `dist/` 目录包含 `index.html` + `assets/` (JS/CSS)，可直接部署

## 浏览器兼容性

- Chrome / Edge >= 100
- Firefox >= 100
- Safari >= 15

## 文档目录

项目配套设计文档位于 `docs/` 目录：

| 文档 | 说明 |
|------|------|
| [docs/optimization-plan.md](docs/optimization-plan.md) | **🔍 全面优化计划** — P0/P1/P2 三级优化清单，涵盖安全性、性能、代码质量、可维护性共 36 项具体行动 |
| [docs/deploy-guide.md](docs/deploy-guide.md) | **公司服务器部署指南** — 一键 Docker 部署、手动部署步骤、运维命令、故障排查 |
| [docs/api-design.md](docs/api-design.md) | **后端 API 完整设计** — 35 个 REST 接口定义，含认证、CRUD、报表、导入导出、审计日志 |
| [docs/database-schema.md](docs/database-schema.md) | **数据库表结构** — 10 张业务表 + 6 张系统表的完整 DDL，含索引、视图、触发器 |
| [docs/dashboard-refactoring-plan.md](docs/dashboard-refactoring-plan.md) | **DashboardPage 重构方案** — 1672 行拆分为 6 个 hooks + 9 个 Section 组件的详细计划 |
| [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | 已知问题列表与规避方案 |
| [DEPLOY.md](DEPLOY.md) | 前端静态部署指南（Nginx / Docker） |

## 最近更新 (2026-07-21)

### v1.2 全面代码审查
- 完成对 118 个文件的逐文件审查（前端 + 后端 + 脚本 + 文档）
- 输出 [全面优化计划](docs/optimization-plan.md) — P0 8 项必须修复 + P1 10 项建议修复 + P2 18 项后续迭代
- 涵盖：代码质量、架构设计、性能优化、安全性、可维护性、可扩展性六大维度

### 账号权限系统
- 六角色 RBAC 权限模型（super_admin / hr_admin / hr_staff / finance / dept_manager / auditor）
- 前端账号管理页面、后端用户管理 API、权限中间件

### 后端搭建（新增 `server/` 目录）
- Express + TypeScript + Prisma + PostgreSQL 后端服务
- JWT 认证（accessToken + refreshToken）
- 10 种数据类型的通用 CRUD API
- 薪资数据自动重算服务
- Docker Compose 一键部署（PostgreSQL + 后端 + 前端 + Nginx）
- 操作审计日志记录
- 初始种子数据脚本

### P1 代码重构
- 新增 `src/utils/numberUtils.ts` — 统一数值处理（替代分散在 7 处的 `safeNum`）
- 新增 `src/utils/dateUtils.ts` — 统一日期处理（替代分散在 4 处的 `addMonths`）
- 新增 `src/utils/formatUtils.ts` — 统一显示格式化（`formatWan`、`formatPct` 等）
- 新增 `src/utils/cumulativeData.ts` — 累计模式计算（`getCumulativeOverview` 等）
- 重构 `src/contexts/DataContext.tsx` — 引入 `DATA_TYPE_REGISTRY` 消除 switch-case 重复（650→551 行）

### P0 后端设计
- 完成 [API 接口设计文档](docs/api-design.md)
- 完成 [数据库表结构设计](docs/database-schema.md)
- 完成 [DashboardPage 重构方案](docs/dashboard-refactoring-plan.md)
- 完成 [公司服务器部署指南](docs/deploy-guide.md)

## License

Private - Internal Use Only
