# 公司服务器部署指南

> 适用环境：裸机 Linux (Ubuntu/CentOS/Debian) | 更新时间：2026-07-15

---

## 一、前期准备

### 1.1 服务器最低配置

| 资源 | 要求 |
|------|------|
| CPU | 2 核 |
| 内存 | 4 GB |
| 磁盘 | 20 GB 可用 |
| 系统 | Ubuntu 22.04+ / CentOS 8+ / Debian 12+ |
| 网络 | 开放端口 80 (HTTP) 和 443 (HTTPS，可选) |

### 1.2 需要安装的软件

| 软件 | 用途 | 安装方式 |
|------|------|---------|
| Docker + Docker Compose | 容器化部署 | 官方脚本 |
| Git | 拉取代码 | `apt install git` |

---

## 二、一键部署

### 2.1 Ubuntu 服务器一键安装并部署

进入项目目录后只需要运行：

```bash
bash scripts/ubuntu-docker-deploy.sh
```

脚本会自动完成：

- 检查并安装 Docker
- 自动创建 `.env`
- 生成数据库密码、JWT 密钥，并设置初始管理员为 `Mixmind / Mixmind`
- 构建并启动 PostgreSQL、后端 API、前端 Nginx
- 首次启动后由后端自动同步 Prisma 数据库表

### 2.2 如果 Docker 已安装，也可以直接启动

```bash
./deploy.sh docker
```

### 2.3 访问系统

```
http://<服务器IP>
账号：Mixmind
密码：Mixmind
```

如需导入演示数据，可在启动成功后执行：

```bash
docker compose exec server npm run db:seed
```

---

## 三、手动部署（不使用 Docker）

如果你不想用 Docker，也可以手动部署：

### 3.1 安装 PostgreSQL

```bash
# Ubuntu
sudo apt install postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# 创建数据库和用户
sudo -u postgres psql <<EOF
CREATE USER salary_admin WITH PASSWORD 'your-secure-password';
CREATE DATABASE salary_db OWNER salary_admin;
GRANT ALL PRIVILEGES ON DATABASE salary_db TO salary_admin;
EOF
```

### 3.2 启动后端

```bash
cd server
cp .env.example .env
# 编辑 .env，填写正确的 DATABASE_URL 和密钥
nano .env

npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run build
npm start    # 后端运行在 http://localhost:3000
```

### 3.3 启动前端

```bash
cd ../
npm install
npm run build    # 生成 dist/ 目录

# 方式A：用 Nginx 托管
sudo cp nginx.conf /etc/nginx/sites-available/salary
sudo ln -s /etc/nginx/sites-available/salary /etc/nginx/sites-enabled/
sudo cp -r dist/* /usr/share/nginx/html/
sudo systemctl restart nginx

# 方式B：用 Vite preview
npm run preview -- --host 0.0.0.0 --port 80
```

---

## 四、环境变量说明

创建 `.env` 文件（docker-compose 需要）：

```bash
# 数据库密码（生产环境请修改！）
DB_USER=salary_admin
DB_PASSWORD=your-secure-password-here

# JWT 密钥（用 openssl rand -hex 32 生成）
JWT_SECRET=your-generated-secret-key
JWT_REFRESH_SECRET=your-another-secret-key

# 前端访问端口
CLIENT_PORT=80

# CORS 允许的域名（改为实际访问地址）
CORS_ORIGIN=http://your-server-ip-or-domain

# 初始管理员（首次启动自动创建）
ADMIN_USERNAME=Mixmind
ADMIN_PASSWORD=Mixmind
```

---

## 五、常用运维命令

```bash
# 查看所有容器状态
docker compose ps

# 查看日志
docker compose logs -f server
docker compose logs -f postgres

# 重启服务
docker compose restart server

# 重新构建并启动
docker compose up -d --build

# 停止所有服务
docker compose down

# 备份数据库
docker compose exec postgres pg_dump -U salary_admin salary_db > backup_$(date +%Y%m%d).sql

# 恢复数据库
docker compose exec -T postgres psql -U salary_admin salary_db < backup_20260715.sql

# 进入数据库命令行
docker compose exec postgres psql -U salary_admin salary_db
```

---

## 六、数据导入

从旧系统（localStorage 的 JSON 导出）迁移数据：

```bash
# 1. 从浏览器导出 JSON（在数据管理页点击「导出数据」）
# 2. 将 JSON 文件上传到服务器
# 3. 用 curl 批量导入

curl -X POST http://localhost:3000/api/v1/data/overview/batch \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"items": [...]}'
```

---

## 七、安全加固（生产必做）

```bash
# 1. 验证初始管理员登录
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"Mixmind","password":"Mixmind"}'

# 2. 配置防火墙
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable

# 3. 配置 HTTPS（可选）
# 安装 certbot 获取免费 SSL 证书
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 八、故障排查

| 问题 | 检查方法 |
|------|---------|
| 无法访问页面 | `docker compose ps` 确认容器运行中 |
| 数据库连接失败 | `docker compose logs postgres` |
| 后端 API 500 错误 | `docker compose logs server` |
| 前端显示 SSL 错误 | 检查 CORS_ORIGIN 配置 |
| 端口被占用 | `sudo lsof -i :80` 查看占用 |
