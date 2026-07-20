# 部署指南

## 一、环境要求

| 项目 | 要求 |
|------|------|
| Node.js | >= 18.0.0 (推荐 20.x 或 22.x) |
| npm | >= 9.0.0 |
| 内存 | >= 1GB (构建时) |
| 磁盘 | >= 500MB (含 node_modules) |
| 操作系统 | Windows / macOS / Linux |

---

## 二、三种部署方式

### 生产内网部署必做

薪资系统只用于公司内网时，建议先完成以下配置再开放给业务用户：

1. 创建并检查 `.env`，不要使用 `.env.example` 中的示例密码。
2. 将 `CLIENT_BIND` 设置为服务器内网 IP，例如 `CLIENT_BIND=192.168.1.10`。
3. 将 `CORS_ORIGIN` 设置为实际访问地址，例如 `http://192.168.1.10` 或公司内网域名。
4. 确认 `ADMIN_USERNAME=Mixmind`、`ADMIN_PASSWORD=Mixmind` 已写入 `.env`。
5. 使用防火墙只允许公司内网网段访问 Web 端口。
6. 配置数据库自动备份，并定期测试恢复。

常用检查命令：

```bash
sudo docker-compose ps
sudo ss -lntup
sudo systemctl is-enabled docker
```

本机代码同步到公司服务器：

```bash
./sync-to-server.sh
```

默认同步到 `ouni777@192.168.0.235:/opt/salary-system`，并自动重新构建启动服务。

数据库手动备份：

```bash
bash scripts/backup-postgres.sh
```

每天凌晨 2 点自动备份示例：

```bash
mkdir -p /opt/salary-system/logs
crontab -e
```

加入：

```cron
0 2 * * * cd /opt/salary-system && bash scripts/backup-postgres.sh >> logs/backup.log 2>&1
```

### 方式 A：静态文件部署（最简单）

适合：Nginx / Apache / 云存储 / CDN

```bash
# 1. 安装依赖
npm install

# 2. 构建生产版本
npm run build

# 3. 将 dist/ 目录部署到服务器
#    - Nginx: 复制到 /usr/share/nginx/html/
#    - Apache: 复制到 /var/www/html/
#    - 云存储: 上传 dist/ 目录所有文件
```

**Nginx 最低配置（SPA 路由回退必需）：**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

> 项目已自带完整 nginx.conf，可直接使用。

---

### 方式 B：Docker Compose 完整部署（推荐生产环境）

适合：需要后端 API、PostgreSQL 数据库和前端一起部署的服务器。

```bash
# 一键构建并启动：PostgreSQL + 后端 API + 前端 Nginx
./deploy.sh docker
```

**验证：**
```bash
# 检查服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 健康检查
curl http://localhost/ | head -5
curl http://localhost/api/health
```

**停止/删除：**
```bash
docker compose down
```

首次运行时 `deploy.sh` 会自动创建 `.env`，生成数据库密码和 JWT 密钥，并设置初始管理员为 `Mixmind / Mixmind`。

如果只想跑当前前端静态页面，不启动数据库和后端 API，可用：

```bash
./deploy.sh frontend-docker
```

---

### 方式 C：一键脚本部署

```bash
# 赋予执行权限
chmod +x deploy.sh

# 静态构建
./deploy.sh static

# Docker 部署
./deploy.sh docker

# Ubuntu 服务器上一键安装 Docker 并部署
bash scripts/ubuntu-docker-deploy.sh

# Docker 构建并推送（需设置 DOCKER_REGISTRY 环境变量）
DOCKER_REGISTRY=registry.example.com/ ./deploy.sh docker-push
```

---

## 三、迁移到新服务器

### 步骤 1：打包项目

```bash
# 在项目目录执行
chmod +x pack.sh
./pack.sh

# 生成文件: salary-dashboard-v1.0.0-YYYYMMDD.tar.gz
# 大小约: 2-3MB（不含 node_modules）
```

### 步骤 2：传输到新服务器

```bash
# 使用 scp
scp salary-dashboard-v1.0.0-*.tar.gz user@new-server:/opt/

# 或使用 rsync
rsync -avz salary-dashboard-v1.0.0-*.tar.gz user@new-server:/opt/
```

### 步骤 3：解压并部署

```bash
# 在新服务器上
cd /opt
tar -xzf salary-dashboard-v1.0.0-*.tar.gz
cd app

# 方式 A：直接构建部署
npm install
npm run build
# 将 dist/ 复制到 nginx 目录

# 方式 B：Docker Compose 完整部署
bash scripts/ubuntu-docker-deploy.sh
```

---

## 四、环境变量配置

### 文件说明

| 文件 | 用途 | 是否提交 Git |
|------|------|-------------|
| `.env.example` | 模板文件，所有变量说明 | 是 |
| `.env.development` | 开发环境值 | 是 |
| `.env.production` | 生产环境值 | 是 |
| `.env.local` | 本地覆盖（优先级最高）| 否 |
| `.env.production.local` | 生产本地覆盖 | 否 |

### 优先级（从高到低）

```
.env.[mode].local  >  .env.[mode]  >  .env.local  >  .env
```

### 可用变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VITE_APP_TITLE` | 浏览器标签页标题 | 薪酬数据后台管理系统 |
| `VITE_APP_VERSION` | 应用版本号 | 1.0.0 |
| `VITE_BASE_PATH` | 路由基础路径 | ./ |
| `VITE_ENABLE_ANALYSIS` | 启用分析引擎 | true |

### 自定义示例

```bash
# 生产环境自定义标题
cp .env.production .env.production.local
# 编辑 .env.production.local
echo 'VITE_APP_TITLE=公司薪酬系统' >> .env.production.local

# 重新构建
npm run build
```

---

## 五、文件清单

### 根目录配置文件（14 个）

| 文件 | 说明 | 部署必需 |
|------|------|---------|
| `package.json` | 项目依赖和脚本 | 是 |
| `package-lock.json` | 依赖版本锁定 | 是 |
| `vite.config.ts` | Vite 构建配置 | 是 |
| `tsconfig.json` | TS 项目引用 | 是 |
| `tsconfig.app.json` | TS 应用配置 | 是 |
| `tsconfig.node.json` | TS Node 配置 | 是 |
| `tailwind.config.js` | Tailwind 配置 | 是 |
| `postcss.config.js` | PostCSS 配置 | 是 |
| `eslint.config.js` | ESLint 配置 | 否（仅开发） |
| `components.json` | shadcn/ui 配置 | 否（仅开发） |
| `index.html` | HTML 入口 | 是 |

### 部署配置文件（10 个，新增）

| 文件 | 说明 |
|------|------|
| `.gitignore` | Git 忽略规则 |
| `.env.example` | 环境变量模板 |
| `.env.development` | 开发环境变量 |
| `.env.production` | 生产环境变量 |
| `Dockerfile` | Docker 多阶段构建 |
| `.dockerignore` | Docker 忽略规则 |
| `nginx.conf` | Nginx SPA 配置 |
| `deploy.sh` | 部署脚本 |
| `pack.sh` | 打包脚本 |
| `README.md` | 项目文档 |

### 源码目录（src/）

```
src/
├── App.tsx                          # 应用入口 + 路由
├── App.css                          # 全局样式
├── index.css                        # Tailwind + CSS 变量
├── main.tsx                         # React 挂载
├── vite-env.d.ts                    # Vite 类型声明 [新增]
├── components/
│   ├── dashboard/                   # 看板组件 (4)
│   │   ├── AnalysisPanel.tsx
│   │   ├── KpiCard.tsx
│   │   ├── SegmentOverviewCard.tsx
│   │   └── TrendIndicator.tsx
│   ├── data/                        # 数据管理 (2)
│   │   ├── FieldConfigDialog.tsx
│   │   └── ImportDialog.tsx
│   ├── layout/                      # 布局 (3)
│   │   ├── AppLayout.tsx
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   └── ui/                          # shadcn/ui (49 个)
│       └── ... (accordion, alert, button, card, etc.)
├── contexts/
│   ├── DataContext.tsx              # 数据持久化
│   └── FieldConfigContext.tsx       # 字段配置持久化
├── data/
│   └── mockData.ts                  # 初始数据
├── hooks/
│   ├── useAuth.ts                   # 认证
│   ├── use-mobile.ts                # 移动端检测
│   └── use-toast.ts                 # Toast
├── lib/
│   └── utils.ts                     # cn() 等工具
├── pages/
│   ├── LoginPage.tsx               # 登录
│   ├── DashboardPage.tsx           # 看板
│   ├── DataListPage.tsx            # 数据列表
│   ├── DataFormPage.tsx            # 数据表单
│   └── ReportPage.tsx              # 报表
├── types/
│   ├── index.ts                    # 数据类型
│   └── fieldConfig.ts              # 字段配置类型
└── utils/
    ├── analysisEngine.ts           # 分析引擎
    ├── csvParser.ts                # CSV 解析
    └── formulaEngine.ts            # 公式引擎
```

---

## 六、常见问题

### Q1: 页面刷新后 404？

**原因**: 服务器未配置 SPA 路由回退。

**解决**: 确保服务器将所有未匹配路由回退到 `index.html`：
- Nginx: `try_files $uri $uri/ /index.html;`
- Apache: 使用 `.htaccess` 重写规则
- Docker: 项目自带 nginx.conf 已配置

### Q2: 部署到子目录后资源 404？

**原因**: `vite.config.ts` 已设置 `base: './'`，支持相对路径。

**如果仍出现问题**，修改 `.env.production`：
```bash
VITE_BASE_PATH=/your-sub-path/
```
并修改 `vite.config.ts` 的 `base` 为对应值。

### Q3: Docker 构建很慢？

**优化**: 使用国内镜像源，在 Dockerfile 中添加：
```dockerfile
RUN npm config set registry https://registry.npmmirror.com && npm ci
```

### Q4: 初始管理员账号？

Docker Compose 生产部署使用 `.env` 中的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`，当前设置为 `Mixmind / Mixmind`。后端启动时会自动确保该管理员账号可用，并同步密码。

### Q5: 数据存储在哪里？

当前版本数据存储在浏览器 **localStorage** 中：
- 数据不随服务器迁移
- 切换浏览器/设备后数据不共享
- 清除浏览器缓存会丢失数据
- 如需后端持久化，需对接 API（预留了环境变量配置）

---

## 七、构建产物说明

```
dist/
├── index.html              (417 bytes)    # 入口 HTML
└── assets/
    ├── index-[hash].css    (~89 KB)       # CSS (gzip ~15 KB)
    └── index-[hash].js     (~1.06 MB)     # JS (gzip ~304 KB)
```

- 总计未压缩约 1.15 MB
- gzip 压缩后约 319 KB
- 纯静态文件，无后端依赖
