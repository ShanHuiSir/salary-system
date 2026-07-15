#!/bin/bash
# ============================================
# 部署脚本 - 薪酬数据后台管理系统
# 使用方法:
#   ./deploy.sh              # 本地构建并预览
#   ./deploy.sh docker       # Docker 构建+运行
#   ./deploy.sh docker-push  # Docker 构建+推送镜像
# ============================================

set -e

# ---------- 配置 ----------
APP_NAME="salary-dashboard"
IMAGE_NAME="$APP_NAME"
IMAGE_TAG="latest"
CONTAINER_PORT=8080
HOST_PORT=80

# ---------- 颜色输出 ----------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }

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
    log "开始 Docker 构建..."

    # 构建镜像
    docker build -t $IMAGE_NAME:$IMAGE_TAG .

    # 停止旧容器（如果存在）
    if docker ps -a --format '{{.Names}}' | grep -q $APP_NAME; then
        warn "停止并移除旧容器..."
        docker stop $APP_NAME 2>/dev/null || true
        docker rm $APP_NAME 2>/dev/null || true
    fi

    # 运行新容器
    log "启动容器..."
    docker run -d \
        --name $APP_NAME \
        -p $HOST_PORT:$CONTAINER_PORT \
        --restart unless-stopped \
        $IMAGE_NAME:$IMAGE_TAG

    log "容器已启动！"
    info "访问地址: http://localhost:$HOST_PORT"
    info "查看日志: docker logs -f $APP_NAME"
    info "停止容器: docker stop $APP_NAME"
}

# ---------- Docker 构建+推送 ----------
deploy_docker_push() {
    log "开始 Docker 构建+推送..."

    # 如果有 registry 参数
    REGISTRY=${DOCKER_REGISTRY:-""}
    FULL_IMAGE_NAME="${REGISTRY}${IMAGE_NAME}:${IMAGE_TAG}"

    docker build -t $FULL_IMAGE_NAME .
    docker push $FULL_IMAGE_NAME

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
    docker-push)
        deploy_docker_push
        ;;
    static)
        deploy_static
        ;;
    *)
        echo "用法: $0 {local|docker|docker-push|static}"
        echo ""
        echo "命令说明:"
        echo "  local       本地构建（仅生成 dist/）"
        echo "  docker      Docker 构建并运行容器"
        echo "  docker-push Docker 构建并推送镜像"
        echo "  static      构建并显示静态部署说明"
        exit 1
        ;;
esac
