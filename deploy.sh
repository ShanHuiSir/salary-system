#!/bin/bash
# ============================================
# 部署脚本 - 薪酬数据后台管理系统
# 使用方法:
#   ./deploy.sh              # 本地构建并预览
#   ./deploy.sh docker       # Docker Compose 构建+运行完整系统
#   ./deploy.sh docker-push  # Docker 构建+推送镜像
# ============================================

set -e

# ---------- 配置 ----------
APP_NAME="salary-dashboard"
IMAGE_NAME="$APP_NAME"
IMAGE_TAG="latest"
CONTAINER_PORT=80
HOST_PORT=80
DOCKER_CMD=${DOCKER_CMD:-docker}

# ---------- 颜色输出 ----------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }

generate_secret() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex 32
    else
        date +%s%N | sha256sum | awk '{print $1}'
    fi
}

generate_password() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -base64 24 | tr -d '\n'
    else
        date +%s%N | sha256sum | awk '{print substr($1,1,24)}'
    fi
}

set_env_value() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" .env; then
        sed -i.bak "s|^${key}=.*|${key}=${value}|" .env && rm -f .env.bak
    else
        printf '%s=%s\n' "$key" "$value" >> .env
    fi
}

ensure_env() {
    if [ -f .env ]; then
        set_env_value ADMIN_USERNAME Mixmind
        set_env_value ADMIN_PASSWORD Mixmind
        return
    fi

    warn "未发现 .env，正在自动创建默认生产配置..."
    DB_PASSWORD="$(generate_secret)"
    JWT_SECRET="$(generate_secret)"
    JWT_REFRESH_SECRET="$(generate_secret)"
    cat > .env <<EOF
DB_USER=salary_admin
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
CLIENT_BIND=0.0.0.0
CLIENT_PORT=$HOST_PORT
CORS_ORIGIN=http://localhost
ADMIN_USERNAME=Mixmind
ADMIN_PASSWORD=Mixmind
EOF

    log ".env 已创建"
    warn "初始管理员账号：Mixmind"
    warn "初始管理员密码：Mixmind"
    warn "请按需把 CLIENT_BIND 改为服务器内网 IP。"
    warn "如需绑定域名/IP，请编辑 .env 的 CORS_ORIGIN"
}

# ---------- 本地构建+预览 ----------
deploy_local() {
    log "开始本地构建..."

    # 检查 Node.js 版本
    info "Node.js 版本: $(node -v)"
    info "npm 版本: $(npm -v)"

    # 安装依赖
    log "安装依赖..."
    npm ci

    # 类型检查
    log "TypeScript 类型检查..."
    npx tsc --noEmit

    # 构建
    log "构建生产版本..."
    npm run build

    log "构建完成！"
    echo ""
    info "构建产物在 dist/ 目录"
    info "预览命令: npm run preview"
    info "或使用静态服务器: npx serve dist -p 3000"
}

# ---------- Docker 构建+运行 ----------
deploy_docker() {
    log "开始 Docker Compose 构建并启动完整系统..."
    ensure_env
    $DOCKER_CMD compose up -d --build

    log "服务已启动！"
    $DOCKER_CMD compose ps
    info "访问地址: http://localhost:$HOST_PORT 或 http://服务器IP:$HOST_PORT"
    info "查看日志: docker compose logs -f"
    info "停止服务: docker compose down"
}

# ---------- 仅前端 Docker 构建+运行 ----------
deploy_frontend_docker() {
    log "开始仅前端 Docker 构建..."

    $DOCKER_CMD build -t $IMAGE_NAME:$IMAGE_TAG .

    if $DOCKER_CMD ps -a --format '{{.Names}}' | grep -q "^$APP_NAME$"; then
        warn "停止并移除旧前端容器..."
        $DOCKER_CMD stop $APP_NAME 2>/dev/null || true
        $DOCKER_CMD rm $APP_NAME 2>/dev/null || true
    fi

    log "启动前端容器..."
    $DOCKER_CMD run -d \
        --name $APP_NAME \
        -p $HOST_PORT:$CONTAINER_PORT \
        --restart unless-stopped \
        $IMAGE_NAME:$IMAGE_TAG

    log "前端容器已启动！"
    info "访问地址: http://localhost:$HOST_PORT"
    warn "此模式不启动 PostgreSQL 和后端 API，仅适合当前 localStorage 版本或静态预览。"
}

# ---------- Docker 构建+推送 ----------
deploy_docker_push() {
    log "开始 Docker 构建+推送..."

    # 如果有 registry 参数
    REGISTRY=${DOCKER_REGISTRY:-""}
    FULL_IMAGE_NAME="${REGISTRY}${IMAGE_NAME}:${IMAGE_TAG}"

    $DOCKER_CMD build -t $FULL_IMAGE_NAME .
    $DOCKER_CMD push $FULL_IMAGE_NAME

    log "镜像已推送: $FULL_IMAGE_NAME"
}

# ---------- 静态部署（直接用 dist/） ----------
deploy_static() {
    log "静态文件部署模式..."

    # 构建
    npm ci
    npm run build

    log "构建完成！dist/ 目录可直接部署到任意静态服务器"
    echo ""
    info "===== 部署方式 ====="
    info "1. Nginx: 将 dist/ 复制到 /usr/share/nginx/html/"
    info "2. Apache: 将 dist/ 复制到 /var/www/html/"
    info "3. Serve: npx serve dist -p 3000"
    info "4. Python: cd dist && python -m http.server 3000"
    echo ""
    info "===== Nginx SPA 配置 ====="
    info "location / { try_files \$uri \$uri/ /index.html; }"
}

# ---------- 主逻辑 ----------
case "${1:-local}" in
    local)
        deploy_local
        ;;
    docker)
        deploy_docker
        ;;
    frontend-docker)
        deploy_frontend_docker
        ;;
    docker-push)
        deploy_docker_push
        ;;
    static)
        deploy_static
        ;;
    *)
        echo "用法: $0 {local|docker|frontend-docker|docker-push|static}"
        echo ""
        echo "命令说明:"
        echo "  local       本地构建（仅生成 dist/）"
        echo "  docker      Docker Compose 构建并运行完整系统"
        echo "  frontend-docker 仅构建并运行前端容器"
        echo "  docker-push Docker 构建并推送镜像"
        echo "  static      构建并显示静态部署说明"
        exit 1
        ;;
esac
