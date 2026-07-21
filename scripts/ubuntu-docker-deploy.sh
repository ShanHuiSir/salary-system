#!/usr/bin/env bash
# Ubuntu 部署脚本：校验 Docker 环境并启动薪资系统完整服务。
# 为避免 curl | sudo sh 供应链风险，Docker 安装必须使用发行版可信包源或官方文档的校验流程预先完成。
# 使用方式：在项目根目录运行 bash scripts/ubuntu-docker-deploy.sh

set -euo pipefail
cd "$(dirname "$0")/.."

log() { echo "[DEPLOY] $1"; }

if ! command -v docker >/dev/null 2>&1; then
  cat >&2 <<'MESSAGE'
未检测到 Docker。为避免执行未经校验的远程安装脚本，本项目不会自动通过 curl | sh 安装 Docker。
请按 Docker 官方文档或组织的软件源策略完成安装后，再重新运行本脚本：
https://docs.docker.com/engine/install/ubuntu/
MESSAGE
  exit 1
fi

log "Docker 已安装：$(docker --version)"
if docker ps >/dev/null 2>&1; then
  DOCKER_RUNNER="docker"
else
  DOCKER_RUNNER="sudo docker"
fi

log "使用 $DOCKER_RUNNER compose 启动服务..."
chmod +x ./deploy.sh
DOCKER_CMD="$DOCKER_RUNNER" ./deploy.sh docker

echo "如需免 sudo 使用 Docker，请执行：sudo usermod -aG docker $USER，然后重新登录服务器。"
