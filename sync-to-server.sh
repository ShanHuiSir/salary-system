#!/usr/bin/env bash
# 安全同步本机代码到服务器并重新构建启动。
# 用法：./sync-to-server.sh <user@server> [远程项目目录]
# 也可通过 SERVER、REMOTE_DIR 环境变量传入。
#
# 减少密码输入次数：
#   1. 推荐先执行 bash scripts/setup-ssh-key.sh <user@server> 配置免密登录（一劳永逸）
#   2. 脚本已启用 SSH 连接复用（ControlMaster），未配密钥时只需输入一次密码

set -euo pipefail

SERVER="${1:-${SERVER:-}}"
REMOTE_DIR="${2:-${REMOTE_DIR:-/opt/salary-system}}"

if [[ -z "$SERVER" ]]; then
  echo "用法：$0 <user@server> [远程项目目录]" >&2
  echo "示例：$0 ouni777@192.168.0.235" >&2
  echo ""
  echo "💡 首次使用建议先配免密登录：bash scripts/setup-ssh-key.sh <user@server>" >&2
  exit 64
fi
if [[ ! "$SERVER" =~ ^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$ ]]; then
  echo "SERVER 格式不合法，仅支持 user@host 形式" >&2
  exit 64
fi
if [[ ! "$REMOTE_DIR" =~ ^/[a-zA-Z0-9._/-]+$ ]]; then
  echo "REMOTE_DIR 必须是仅包含字母、数字、._/- 的绝对路径" >&2
  exit 64
fi

SERVER_HOST="${SERVER#*@}"
TMP_DIR="/tmp/salary-system-sync-$(date +%Y%m%d%H%M%S)"

# ===== SSH 连接复用 =====
# 所有 ssh/rsync 共享一条 TCP 连接，未配密钥时只需输一次密码
SSH_CONTROL_DIR="/tmp/ssh-control-$$"
mkdir -p "$SSH_CONTROL_DIR"
chmod 700 "$SSH_CONTROL_DIR"
SSH_CTL="${SSH_CONTROL_DIR}/ctl-%r@%h:%p"

SSH_OPTS=(
  -o ControlMaster=auto
  -o ControlPath="$SSH_CTL"
  -o ControlPersist=600
  -o ServerAliveInterval=60
)

cleanup_all() {
  # 关闭主连接
  ssh -o ControlPath="$SSH_CTL" -O exit "$SERVER" >/dev/null 2>&1 || true
  # 清理远程临时目录
  ssh "${SSH_OPTS[@]}" "$SERVER" "rm -rf '$TMP_DIR'" >/dev/null 2>&1 || true
  rm -rf "$SSH_CONTROL_DIR"
}
trap cleanup_all EXIT

# 先打开主连接（未配 SSH 密钥时在此处输入唯一一次密码）
echo "🔗 建立 SSH 主连接（连接复用模式下只需这一次认证）..."
ssh "${SSH_OPTS[@]}" -fN "$SERVER" 2>&1
echo ""

# rsync 也使用相同复用连接
RSYNC_OPTS=(-az --delete -e "ssh ${SSH_OPTS[*]}")

# ===== 执行同步 =====

printf '[1/5] 同步代码到服务器临时目录：%s:%s\n' "$SERVER" "$TMP_DIR"
rsync "${RSYNC_OPTS[@]}" \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='server/node_modules/' \
  --exclude='dist/' \
  --exclude='backups/' \
  --exclude='logs/' \
  --exclude='.env' \
  --exclude='.env.*.backup' \
  ./ "$SERVER:$TMP_DIR/"

printf '[2/5] 备份数据库并发布到：%s\n' "$REMOTE_DIR"
ssh "${SSH_OPTS[@]}" "$SERVER" bash -s -- "$REMOTE_DIR" "$TMP_DIR" <<'REMOTE'
set -euo pipefail
remote_dir="$1"
tmp_dir="$2"

sudo mkdir -p "$remote_dir"
if [ -f "$remote_dir/docker-compose.yml" ] && [ -x "$remote_dir/scripts/backup-postgres.sh" ]; then
  echo "执行部署前数据库备份..."
  (cd "$remote_dir" && bash scripts/backup-postgres.sh)
else
  echo "提示：未找到可执行的备份脚本，跳过自动备份。"
fi
sudo rsync -a --delete --exclude='.env' --exclude='backups/' --exclude='logs/' "$tmp_dir/" "$remote_dir/"
sudo chown -R "$USER:" "$remote_dir"
REMOTE

printf '[3/5] 校验并补齐服务器环境配置\n'
ssh "${SSH_OPTS[@]}" "$SERVER" bash -s -- "$REMOTE_DIR" "$SERVER_HOST" <<'REMOTE'
set -euo pipefail
remote_dir="$1"
server_host="$2"
cd "$remote_dir"

if [ ! -f .env ]; then
  cp .env.example .env
fi

update_env() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    $0 ~ "^" key "=" { print key "=" value; found = 1; next }
    { print }
    END { if (!found) print key "=" value }
  ' .env > "$tmp"
  mv "$tmp" .env
}

update_env CLIENT_BIND "$server_host"
update_env CORS_ORIGIN "http://$server_host"
if ! grep -q '^ADMIN_USERNAME=' .env; then
  printf 'ADMIN_USERNAME=admin\n' >> .env
fi

require_secret() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2- || true)"
  if [ -z "$value" ] || [[ "$value" == *change-me* ]] || [[ "$value" == *your_* ]]; then
    echo "请先在 $remote_dir/.env 中设置安全的 $key，再重新运行同步脚本。" >&2
    exit 1
  fi
}
require_secret DB_PASSWORD
require_secret JWT_SECRET
require_secret JWT_REFRESH_SECRET
require_secret ADMIN_PASSWORD
REMOTE

printf '[4/5] 重新构建并启动 Docker 服务（保留数据库卷）\n'
ssh "${SSH_OPTS[@]}" "$SERVER" bash -s -- "$REMOTE_DIR" <<'REMOTE'
set -euo pipefail
cd "$1"
if sudo docker compose version >/dev/null 2>&1; then
  COMPOSE=(sudo docker compose)
else
  COMPOSE=(sudo docker-compose)
fi
"${COMPOSE[@]}" up -d --build --force-recreate --remove-orphans
"${COMPOSE[@]}" ps
REMOTE

printf '[5/5] 验证服务健康状态\n'
ssh "${SSH_OPTS[@]}" "$SERVER" \
  "sudo docker exec salary-server node -e \"fetch('http://localhost:3000/api/health').then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status))).then(body => console.log('✅ 后端健康检查通过：' + body)).catch(error => { console.error('❌ 后端健康检查失败：' + error.message); process.exit(1); })\""

trap - EXIT
cleanup_all
echo ""
printf '✅ 部署完成！请访问：http://%s\n' "$SERVER_HOST"
