# 生产部署指南

本系统的生产部署必须同时运行 **PostgreSQL、后端 API 和前端 Nginx**。单独部署 `dist/` 或仅运行前端容器无法提供认证、数据读写和看板聚合能力，只适用于本地静态预览。

## 1. 环境要求

- Docker Engine 与 Docker Compose v2
- 至少 1 GB 内存和 500 MB 可用磁盘（不含业务数据与备份）
- 对外或内网开放 Web 端口（默认 `80`）
- 部署服务器已配置可用的防火墙与备份策略

## 2. 首次部署

```bash
# 在项目根目录执行
cp .env.example .env
chmod 600 .env
```

编辑 `.env`。以下四项必须替换为**非示例值**，其中管理员密码至少 12 位：

```dotenv
DB_PASSWORD=<强数据库密码>
JWT_SECRET=<openssl rand -hex 32 的输出>
JWT_REFRESH_SECRET=<另一条 openssl rand -hex 32 的输出>
ADMIN_PASSWORD=<至少 12 位的初始管理员密码>

# 可选；默认用户名为 admin
ADMIN_USERNAME=admin
# 建议设为实际内网 IP 或域名；公网场景应使用反向代理和 HTTPS
CLIENT_BIND=0.0.0.0
CLIENT_PORT=80
CORS_ORIGIN=http://<服务器IP或域名>
```

生成密钥示例：

```bash
openssl rand -hex 32
```

启动完整服务：

```bash
docker compose up -d --build
docker compose ps
```

等待 `postgres`、`server`、`client` 均处于运行状态后，访问 `http://<服务器IP或域名>`。首次启动且数据库中没有启用的超级管理员时，后端会用 `.env` 中的 `ADMIN_USERNAME` 与 `ADMIN_PASSWORD` 创建初始管理员；之后重新部署不会重置已有密码。

> 不要把 `.env`、备份文件或真实密钥提交到 Git。

## 3. 既有数据库切换到迁移部署

从 v1.2 起，容器使用 `prisma migrate deploy`，不再在生产环境执行 `prisma db push`。新数据库会自动应用仓库内的初始迁移。

如果生产数据库过去由 `prisma db push` 初始化，表已经存在但没有 Prisma 迁移历史。**仅首次**升级前，在确认当前 Schema 与仓库一致、且已完成备份后，执行：

```bash
# 在项目根目录；将初始迁移标记为已应用，不会执行建表 SQL
docker compose run --rm server \
  npx prisma migrate resolve --applied 20260721130000_init

docker compose up -d --build
```

不要在已有数据库上直接运行初始迁移，否则它会尝试创建已存在的表。若 Schema 已经被手工改动，请先在预生产环境核对并由 DBA 制定迁移方案。

## 4. 日常更新与远程同步

本机向服务器同步时，显式传入目标服务器，避免依赖硬编码地址：

```bash
./sync-to-server.sh <user@server> [/opt/salary-system]
```

脚本会先调用远端 `scripts/backup-postgres.sh`（若存在），然后保留远端 `.env`、重新构建容器并验证后端健康检查。请先确认远端 `.env` 的数据库、JWT 与管理员密钥均已替换示例值。

也可在服务器项目目录手动更新：

```bash
git pull
docker compose up -d --build --remove-orphans
docker compose ps
```

## 5. 备份、恢复与运维

```bash
# 备份（默认写入 backups/）
bash scripts/backup-postgres.sh

# 查看状态与日志
docker compose ps
docker compose logs -f server
docker compose logs -f postgres

# 重启后端
docker compose restart server

# 停止服务但保留数据卷
docker compose down

# 危险：会删除 PostgreSQL 数据卷并清空账号及业务数据
docker compose down -v
```

恢复示例（先停止业务写入并确认备份文件可信）：

```bash
docker compose exec -T postgres \
  psql -U "$(grep '^DB_USER=' .env | cut -d= -f2-)" -d salary_db \
  < backups/<backup-file>.sql
```

建议设置定时备份，并定期在隔离环境演练恢复。

## 6. 上线验收清单

- [ ] `docker compose ps` 中所有服务正常，后端健康检查通过
- [ ] 可访问登录页并使用设置的管理员账号登录
- [ ] 看板、数据管理和报表可正常加载
- [ ] 新增或编辑部门数据后，看板相关数据正确更新
- [ ] `super_admin` 可见账号管理；审计角色只能读取允许的数据
- [ ] 停用账号后，该账号无法继续使用刷新令牌
- [ ] `scripts/backup-postgres.sh` 能生成可恢复的备份
- [ ] 审计日志中包含真实表名与脱敏后的变更内容
