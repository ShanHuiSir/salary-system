# 公司服务器部署指南

> 本指南面向内网/生产环境。系统依赖 PostgreSQL 和后端 API；不要将前端静态文件作为独立生产系统部署。

## 一、前期准备

### 1.1 服务器最低配置

| 项目 | 建议 |
|------|------|
| CPU | 2 核或以上 |
| 内存 | 2 GB 或以上 |
| 磁盘 | 20 GB 或以上（需预留备份空间） |
| 系统 | Ubuntu 22.04+、Debian 12+ 或等效 Linux 发行版 |
| 网络 | 开放内网 Web 端口；公网场景另行配置 HTTPS、访问控制和域名 |

### 1.2 安装 Docker

请按公司软件源策略或 Docker 官方文档安装 Docker Engine 和 Compose v2；部署脚本不会执行 `curl | sudo sh` 形式的远程安装命令。

```bash
# 在项目根目录执行；若 Docker 未安装，脚本会给出安装说明并退出
bash scripts/ubuntu-docker-deploy.sh
```

## 二、首次部署

```bash
git clone https://github.com/ShanHuiSir/salary-system.git
cd salary-system
cp .env.example .env
chmod 600 .env
```

编辑 `.env`，为以下变量设置真实安全值：

```dotenv
DB_USER=salary_admin
DB_PASSWORD=<强数据库密码>
JWT_SECRET=<openssl rand -hex 32 的输出>
JWT_REFRESH_SECRET=<另一条 openssl rand -hex 32 的输出>
CLIENT_BIND=<服务器内网 IP 或 0.0.0.0>
CLIENT_PORT=80
CORS_ORIGIN=http://<服务器内网 IP 或域名>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<至少 12 位的初始管理员密码>
```

启动：

```bash
docker compose up -d --build
docker compose ps
```

访问 `http://<服务器IP或域名>`，使用 `.env` 中设置的管理员账号登录。管理员只会在数据库不存在启用的超级管理员时创建；后续重新构建和同步不会覆盖账号管理中维护的密码。

如需导入演示数据，可在服务健康后执行：

```bash
docker compose exec server npm run db:seed
```

## 三、从 db push 升级到 Prisma Migrate

新版本以 `prisma migrate deploy` 应用迁移。对于全新数据库，无须额外操作。

对于历史上使用 `prisma db push` 创建的数据库，初始迁移没有记录。升级前先备份，然后仅执行一次 baseline：

```bash
bash scripts/backup-postgres.sh
docker compose run --rm server \
  npx prisma migrate resolve --applied 20260721130000_init
docker compose up -d --build
```

该命令只登记迁移已经应用，不会创建表。不要在既有数据库上直接执行未 baseline 的初始迁移。

## 四、更新与远程发布

在服务器本地更新：

```bash
git pull
docker compose up -d --build --remove-orphans
docker compose ps
```

从开发机同步：

```bash
./sync-to-server.sh <user@server> [/opt/salary-system]
```

同步脚本会保留服务器 `.env`，部署前自动备份数据库（若备份脚本存在），并拒绝使用 `change-me` 等示例密钥。

## 五、运维与备份

```bash
# 查看容器及日志
docker compose ps
docker compose logs -f server

# 备份数据库
bash scripts/backup-postgres.sh

# 重启后端
docker compose restart server

# 停止服务，保留数据
docker compose down

# 危险：删除数据库卷和所有数据
docker compose down -v
```

建议每天自动备份并保留足够的历史版本。例如：

```cron
0 2 * * * cd /opt/salary-system && bash scripts/backup-postgres.sh >> logs/backup.log 2>&1
```

恢复前请先停止业务写入，并在隔离环境验证备份可用。

## 六、安全检查

- `.env` 权限设为仅部署账号可读，且不提交到版本库。
- 数据库密码、JWT 密钥和初始管理员密码不能使用示例值；管理员密码至少 12 位。
- 防火墙仅开放需要的网段和端口；不要将 PostgreSQL 端口暴露到公网。
- 生产环境应在反向代理层配置 HTTPS；将 `CORS_ORIGIN` 设为实际来源。
- 日常更新不要运行 `docker compose down -v`。

## 七、常见问题

| 问题 | 检查方式 |
|------|---------|
| 前端无法访问 | `docker compose ps`，确认 `client` 正常并检查防火墙/端口 |
| 后端不健康 | `docker compose logs server`，检查数据库、迁移与环境变量 |
| 数据库连接失败 | `docker compose logs postgres`，检查 `DB_PASSWORD` 和数据卷状态 |
| 首次升级迁移失败 | 确认历史数据库已按第三节执行 `migrate resolve --applied 20260721130000_init` |
| 账号无法登录 | 检查账号是否被停用、管理员密码是否为 `.env` 中首次设置的密码 |
