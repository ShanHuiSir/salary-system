# ============================================
# Dockerfile - 薪酬数据后台管理系统
# 多阶段构建: Node.js 构建 + Nginx 运行
# ============================================

# ---------- 阶段 1: 构建前端 ----------
FROM node:22-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json ./

# 安装依赖（使用 ci 确保版本一致性；部署构建跳过 audit/fund，避免网络审计接口拖慢或卡住）
RUN npm ci --no-audit --no-fund

# 复制源代码
COPY . .

# 构建生产版本
RUN npm run build

# ---------- 阶段 2: Nginx 运行 ----------
FROM nginx:alpine AS production

# 复制自定义 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物到 nginx 静态目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
