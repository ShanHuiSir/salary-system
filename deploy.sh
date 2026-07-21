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

ensure_env_value() {
    local key="$1"
    local value="$2"
    if ! grep -q "^${key}=" .env; then
        printf '%s=%s\n' "$key" "$value" >> .env
    fi
}

require_safe_env_value() {
    local key="$1"
    local value
    value="$(grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2- || true)"
    if [ -z "$value" ] || [[ "$value" == *change-me* ]] || [[ "$value" == *your_* ]]; then
        echo "请先在 .env 中设置安全的 $key 再继续部署。" >&2
        exit 1
    fi
}

ensure_env() {
    local generated_admin_password
    if [ -f .env ]; then
        ensure_env_value ADMIN_USERNAME admin
        if ! grep -q '^ADMIN_PASSWORD=' .env; then
            generated_admin_password="$(generate_password)"
            printf 'ADMIN_PASSWORD=%s\n' "$generated_admin_password" >> .env
            warn "未设置 ADMIN_PASSWORD，已生成随机初始管理员密码：$generated_admin_password"
            warn "请立即将该密码保存到受控密码库。"
        fi
        require_safe_env_value DB_PASSWORD
        require_safe_env_value JWT_SECRET
        require_safe_env_value JWT_REFRESH_SECRET
        require_safe_env_value ADMIN_PASSWORD
        return
    fi

    warn "未发现 .env，正在创建生产配置..."
    DB_PASSWORD="$(generate_secret)"
    JWT_SECRET="$(generate_secret)"
    JWT_REFRESH_SECRET="$(generate_secret)"
    generated_admin_password="$(generate_password)"
    cat > .env <<EOF
DB_USER=salary_admin
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
CLIENT_BIND=0.0.0.0
CLIENT_PORT=$HOST_PORT
CORS_ORIGIN=http://localhost
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$generated_admin_password
EOF
    chmod 600 .env

    log ".env 已创建"
    warn "初始管理员账号：admin"
    warn "初始管理员密码：$generated_admin_password"
    warn "请立即将密码保存到受控密码库，并按部署环境设置 CLIENT_BIND 与 CORS_ORIGIN。"
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
    warn "此模式不启动 PostgreSQL 和后端 API，仅适合静态预览。生产环境请使用 Docker Compose 完整部署。"
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

# ---------- 静态预览（不含后端 API） ----------
deploy_static() {
    log "构建本地静态预览..."
    npm ci
    npm run build

    log "构建完成：dist/ 可用于本地 UI 预览。"
    warn "静态文件不包含 PostgreSQL 和后端 API，不能作为独立生产部署。"
    info "本地预览：npm run preview"
    info "生产环境请执行：./deploy.sh docker"
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
        echo "  static      构建本地静态预览（不含后端 API，不能生产部署）"
        exit 1
        ;;
esac
