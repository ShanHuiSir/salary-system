# 后端 Node.js 服务（生产镜像）
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

# openssl 供 Prisma 使用；wget 供 Docker Compose 健康检查使用。
RUN apk add --no-cache openssl wget

# 运行时仅安装生产依赖；prisma CLI 被列为生产依赖以同步数据库结构。
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["sh", "-c", "for i in $(seq 1 30); do npx prisma db push --skip-generate && exec node dist/index.js; echo 数据库未就绪，2秒后重试...; sleep 2; done; echo 数据库结构同步失败; exit 1"]
