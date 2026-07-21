# 后端 Node.js 服务（生产镜像）
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

# openssl 供 Prisma 使用；wget 供 Docker Compose 健康检查使用。
RUN apk add --no-cache openssl wget

# 运行时仅安装生产依赖；prisma CLI 被列为生产依赖以执行 migrate deploy。
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=10 CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
