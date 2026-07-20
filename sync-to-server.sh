#!/usr/bin/env bash
# 一键同步本机代码到公司服务器并重新构建启动
# 默认服务器：ouni777@192.168.0.235:/opt/salary-system
# 用法：
#   ./sync-to-server.sh
#   ./sync-to-server.sh 用户名@服务器IP /服务器项目目录

set -euo pipefail

SERVER="${1:-ouni777@192.168.0.235}"
REMOTE_DIR="${2:-/opt/salary-system}"
TMP_DIR="/tmp/salary-system-sync-$(date +%Y%m%d%H%M%S)"

echo "[1/4] 同步到临时目录：$SERVER:$TMP_DIR"
rsync -az --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='server/node_modules/' \
  --exclude='dist/' \
  --exclude='backups/' \
  --exclude='logs/' \
  --exclude='.env' \
  --exclude='.env.*.backup' \
  ./ "$SERVER:$TMP_DIR/"

echo "[2/4] 发布到服务器目录：$REMOTE_DIR"
ssh -tt "$SERVER" "sudo mkdir -p '$REMOTE_DIR' && sudo rsync -a --delete --exclude='.env' --exclude='backups/' --exclude='logs/' '$TMP_DIR/' '$REMOTE_DIR/' && sudo chown -R \$USER: '$REMOTE_DIR' && rm -rf '$TMP_DIR'"

echo "[3/4] 确保服务器 .env 使用内网地址和管理员账号"
ssh "$SERVER" "cd '$REMOTE_DIR' && \
  if [ ! -f .env ]; then cp .env.example .env; fi && \
  set_env() { key=\"\$1\"; value=\"\$2\"; if grep -q \"^\${key}=\" .env; then sed -i \"s|^\${key}=.*|\${key}=\${value}|\" .env; else printf '%s=%s\\n' \"\$key\" \"\$value\" >> .env; fi; }; \
  set_env CLIENT_BIND 192.168.0.235; \
  set_env CORS_ORIGIN http://192.168.0.235; \
  set_env ADMIN_USERNAME Mixmind; \
  set_env ADMIN_PASSWORD Mixmind"

echo "[4/4] 重新构建并启动 Docker 服务"
ssh -tt "$SERVER" "cd '$REMOTE_DIR' && sudo docker-compose up -d --build && sudo docker-compose ps"

echo "完成。请访问：http://192.168.0.235"
echo "账号：Mixmind"
echo "密码：Mixmind"
