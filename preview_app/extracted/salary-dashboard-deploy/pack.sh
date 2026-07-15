#!/bin/bash
# ============================================
# 打包部署脚本 - 将项目打包为可迁移的 zip
# 使用: bash pack.sh [output-dir]
# ============================================

set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_NAME="salary-dashboard"
VERSION=$(grep '"version"' "$APP_DIR/package.json" | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')
OUTPUT_DIR="${1:-$(dirname "$APP_DIR")}"
ARCHIVE_NAME="${PROJECT_NAME}-v${VERSION}-$(date +%Y%m%d).tar.gz"
ARCHIVE_PATH="$OUTPUT_DIR/$ARCHIVE_NAME"

echo "=========================================="
echo "  打包 ${PROJECT_NAME} v${VERSION}"
echo "=========================================="
echo "  源目录:   $APP_DIR"
echo "  输出路径: $ARCHIVE_PATH"
echo "=========================================="
echo ""

# 排除不需要的文件/目录
tar -czf "$ARCHIVE_PATH" \
    -C "$(dirname "$APP_DIR")" \
    --exclude='app/node_modules' \
    --exclude='app/dist' \
    --exclude='app/.git' \
    --exclude='app/.env.local' \
    --exclude='app/.env.*.local' \
    --exclude='app/coverage' \
    --exclude='app/.cache' \
    --exclude='app/.temp' \
    --exclude='app/.eslintcache' \
    "$(basename "$APP_DIR")"

echo ""
echo "=========================================="
echo "  打包完成!"
echo "=========================================="
echo ""
echo "  文件: $ARCHIVE_PATH"
echo "  大小: $(du -h "$ARCHIVE_PATH" | cut -f1)"
echo ""
echo "  部署步骤:"
echo "  1. 解压: tar -xzf $ARCHIVE_NAME"
echo "  2. 进入: cd app"
echo "  3. 安装: npm install"
echo "  4. 构建: npm run build"
echo "  5. 部署: 复制 dist/ 到服务器"
echo "  或 Docker: docker build -t $PROJECT_NAME ."
echo ""
