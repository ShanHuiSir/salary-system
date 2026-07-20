#!/usr/bin/env bash
# PostgreSQL 数据库备份脚本
# 用法：bash scripts/backup-postgres.sh
# 可选环境变量：BACKUP_DIR、RETENTION_DAYS、COMPOSE_CMD

set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_NAME="salary_db"
DB_USER="salary_admin"

if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a
  source .env
  set +a
fi

DB_USER="${DB_USER:-salary_admin}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/salary_db-$TIMESTAMP.dump"

if [ -n "${COMPOSE_CMD:-}" ]; then
  read -r -a COMPOSE <<< "$COMPOSE_CMD"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
elif sudo docker compose version >/dev/null 2>&1; then
  COMPOSE=(sudo docker compose)
elif command -v sudo >/dev/null 2>&1 && sudo docker-compose version >/dev/null 2>&1; then
  COMPOSE=(sudo docker-compose)
else
  echo "未找到 docker compose 或 docker-compose" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "开始备份 PostgreSQL：$BACKUP_FILE"
"${COMPOSE[@]}" exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$BACKUP_FILE"
chmod 600 "$BACKUP_FILE"

find "$BACKUP_DIR" -type f -name 'salary_db-*.dump' -mtime +"$RETENTION_DAYS" -delete

echo "备份完成：$BACKUP_FILE"
echo "恢复示例：${COMPOSE[*]} exec -T postgres pg_restore -U $DB_USER -d $DB_NAME --clean --if-exists < $BACKUP_FILE"
