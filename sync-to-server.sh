#!/usr/bin/env bash
# 一键同步本机代码到公司服务器并重新构建启动。
# 默认服务器：ouni777@192.168.0.235:/opt/salary-system
# 用法：
#   ./sync-to-server.sh
#   ./sync-to-server.sh 用户名@服务器IP /服务器项目目录

set -euo pipefail

SERVER="${1:-${SERVER:-ouni777@192.168.0.235}}"
REMOTE_DIR="${2:-${REMOTE_DIR:-/opt/salary-system}}"
SERVER_HOST="${SERVER#*@}"
TMP_DIR="/tmp/salary-system-sync-$(date +%Y%m%d%H%M%S)"
CONTROL_PATH="/tmp/salary-system-ssh-${SERVER_HOST}-$$"
LOCAL_REMOTE_SCRIPT="$(mktemp)"

if [[ ! "$SERVER" =~ ^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$ ]]; then
  echo "SERVER 格式不合法，仅支持 user@host 形式" >&2
  exit 64
fi

if [[ ! "$REMOTE_DIR" =~ ^/[a-zA-Z0-9._/-]+$ ]]; then
  echo "REMOTE_DIR 必须是仅包含字母、数字、._/- 的绝对路径" >&2
  exit 64
fi

cleanup() {
  rm -f "$LOCAL_REMOTE_SCRIPT"
  ssh -S "$CONTROL_PATH" -O exit "$SERVER" >/dev/null 2>&1 || true
  rm -f "$CONTROL_PATH"
}
trap cleanup EXIT

cat > "$LOCAL_REMOTE_SCRIPT" <<'REMOTE_SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

remote_dir="$1"
tmp_dir="$2"
server_host="$3"

sudo -v
sudo mkdir -p "$remote_dir"

if [ -f "$remote_dir/docker-compose.yml" ] && [ -x "$remote_dir/scripts/backup-postgres.sh" ]; then
  echo "执行部署前数据库备份..."
  (cd "$remote_dir" && bash scripts/backup-postgres.sh) || echo "提示：备份未完成，继续部署。"
else
  echo "提示：未找到可执行的备份脚本，跳过自动备份。"
fi

sudo rsync -a --delete \
  --exclude='.env' \
  --exclude='backups/' \
  --exclude='logs/' \
  --exclude='.remote-deploy.sh' \
  "$tmp_dir/" "$remote_dir/"
sudo chown -R "$USER:" "$remote_dir"
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

get_env_value() {
  local key="$1"
  grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2- || true
}

update_env CLIENT_BIND "$server_host"
update_env CORS_ORIGIN "http://$server_host"
update_env ADMIN_USERNAME Mixmind

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    date +%s%N | sha256sum | awk '{print $1}'
  fi
}

require_secret() {
  local key="$1" value
  value="$(grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2- || true)"
  if [ -z "$value" ] || [[ "$value" == *change-me* ]] || [[ "$value" == *your_* ]] || { [ "$key" = ADMIN_PASSWORD ] && [ "${#value}" -lt 12 ]; }; then
    value="$(generate_secret)"
    update_env "$key" "$value"
    echo "已自动生成 $key"
  fi
}

require_secret DB_PASSWORD
require_secret JWT_SECRET
require_secret JWT_REFRESH_SECRET
require_secret ADMIN_PASSWORD

DB_USER_VALUE="$(get_env_value DB_USER)"
DB_USER_VALUE="${DB_USER_VALUE:-salary_admin}"
DB_PASSWORD_VALUE="$(get_env_value DB_PASSWORD)"
DB_NAME_VALUE="salary_db"

if [[ ! "$DB_USER_VALUE" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "DB_USER 只能包含字母、数字和下划线。" >&2
  exit 1
fi

echo "当前关键环境配置："
grep -E '^(CLIENT_BIND|CORS_ORIGIN|ADMIN_USERNAME|ADMIN_PASSWORD)=' .env

if sudo docker compose version >/dev/null 2>&1; then
  COMPOSE=(sudo docker compose)
else
  COMPOSE=(sudo docker-compose)
fi

"${COMPOSE[@]}" rm -sf client server postgres >/dev/null 2>&1 || true
sudo docker rm -f salary-client salary-server salary-db >/dev/null 2>&1 || true
"${COMPOSE[@]}" up -d postgres

for i in $(seq 1 60); do
  if sudo docker exec salary-db psql -U "$DB_USER_VALUE" -d "$DB_NAME_VALUE" -tAc "SELECT 1" >/dev/null 2>&1; then
    break
  fi

  if [ "$i" -eq 60 ]; then
    echo "❌ 数据库启动失败：等待 120 秒后仍无法连接本地 PostgreSQL。" >&2
    sudo docker logs --tail=80 salary-db >&2 || true
    exit 1
  fi

  echo "等待数据库启动中... ($i/60)"
  sleep 2
done

escaped_db_password="${DB_PASSWORD_VALUE//\'/\'\'}"
sudo docker exec salary-db psql -U "$DB_USER_VALUE" -d "$DB_NAME_VALUE" -c "ALTER USER \"$DB_USER_VALUE\" WITH PASSWORD '$escaped_db_password';" >/dev/null
echo "已同步 PostgreSQL 用户密码：$DB_USER_VALUE"

"${COMPOSE[@]}" up -d --build --remove-orphans server client
"${COMPOSE[@]}" ps

for i in $(seq 1 60); do
  if sudo docker exec salary-server node -e "fetch('http://127.0.0.1:3000/api/health').then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status))).then(body => console.log('✅ 后端健康检查通过：' + body)).catch(() => process.exit(1))"; then
    break
  fi

  if [ "$i" -eq 60 ]; then
    echo "❌ 后端健康检查失败：等待 120 秒后仍无法访问 http://127.0.0.1:3000/api/health" >&2
    echo "最近后端日志：" >&2
    sudo docker logs --tail=80 salary-server >&2 || true
    exit 1
  fi

  echo "等待后端启动中... ($i/60)"
  sleep 2
done

rm -rf "$tmp_dir"
REMOTE_SCRIPT

SSH=(ssh -o ControlMaster=auto -o ControlPath="$CONTROL_PATH" -o ControlPersist=10m)
RSYNC_SSH="ssh -o ControlMaster=auto -o ControlPath=$CONTROL_PATH -o ControlPersist=10m"

echo "[0/4] 建立到服务器的连接：$SERVER"
echo "如果提示 password，请输入服务器用户密码。"
"${SSH[@]}" -MNf "$SERVER" || true

echo "[1/4] 同步代码到临时目录：$SERVER:$TMP_DIR"
rsync -az --delete -e "$RSYNC_SSH" \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='server/node_modules/' \
  --exclude='dist/' \
  --exclude='backups/' \
  --exclude='logs/' \
  --exclude='.env' \
  --exclude='.env.*.backup' \
  ./ "$SERVER:$TMP_DIR/"

rsync -az -e "$RSYNC_SSH" "$LOCAL_REMOTE_SCRIPT" "$SERVER:$TMP_DIR/.remote-deploy.sh"

echo "[2/4] 发布代码、校验环境、构建并启动服务"
echo "如果提示 [sudo] password，请输入服务器用户密码。密码输入时不会显示。"
"${SSH[@]}" -tt "$SERVER" "bash '$TMP_DIR/.remote-deploy.sh' '$REMOTE_DIR' '$TMP_DIR' '$SERVER_HOST'"

echo "[3/4] 同步与部署已完成"
echo "[4/4] 请访问：http://$SERVER_HOST"
echo "账号：Mixmind"
echo "密码：以服务器 .env 中 ADMIN_PASSWORD 为准（脚本会在缺失或过短时自动生成）"
