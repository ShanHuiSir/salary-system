#!/usr/bin/env bash
# Ubuntu 一键部署脚本：安装 Docker（如缺失）并启动薪资系统完整服务。
# 使用方式：在项目根目录运行 bash scripts/ubuntu-docker-deploy.sh

set -euo pipefail

cd "$(dirname "$0")/.."

log() { echo "[DEPLOY] $1"; }
warn() { echo "[WARN] $1"; }

if ! command -v docker >/dev/null 2>&1; then
  log "未检测到 Docker，开始安装..."
  curl -fsSL https://get.docker.com | sudo sh
else
  log "Docker 已安装：$(docker --version)"
fi

if docker ps >/dev/null 2>&1; then
  DOCKER_RUNNER="docker"
else
  DOCKER_RUNNER="sudo docker"
fi

log "使用 $DOCKER_RUNNER compose 启动服务..."
chmod +x ./deploy.sh
DOCKER_CMD="$DOCKER_RUNNER" ./deploy.sh docker

warn "如果你希望以后不用 sudo 运行 docker，可执行：sudo usermod -aG docker $USER，然后重新登录服务器。"
