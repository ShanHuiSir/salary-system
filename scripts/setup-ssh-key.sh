#!/usr/bin/env bash
# SSH 免密登录配置脚本
# 用法：bash scripts/setup-ssh-key.sh <user@server>
#
# 执行一次后，后续 sync-to-server.sh 不再需要输入密码。
# 如果服务器 sudo 也需要免密，脚本末尾会给出提示。

set -euo pipefail

SERVER="${1:-}"

if [[ -z "$SERVER" ]]; then
  echo "用法：$0 <user@server>" >&2
  echo "示例：$0 ouni777@192.168.0.235" >&2
  exit 1
fi

SERVER_HOST="${SERVER#*@}"
SSH_KEY="$HOME/.ssh/id_ed25519"

# 1. 如果没有密钥，生成一个
if [[ ! -f "$SSH_KEY" ]]; then
  echo "[1/3] 生成 SSH 密钥对..."
  ssh-keygen -t ed25519 -f "$SSH_KEY" -N "" -C "salary-system-deploy"
  echo "密钥已生成：$SSH_KEY"
else
  echo "[1/3] 已有 SSH 密钥：$SSH_KEY"
fi

# 2. 把公钥复制到服务器
echo "[2/3] 将公钥复制到服务器（需要输入一次服务器密码）..."
ssh-copy-id -i "$SSH_KEY.pub" "$SERVER"

# 3. 验证免密登录
echo "[3/3] 验证免密登录..."
if ssh -o BatchMode=yes -o ConnectTimeout=5 "$SERVER" "echo '免密登录成功！服务器：$(hostname)'" 2>/dev/null; then
  echo "✅ SSH 免密登录配置完成"
else
  echo "⚠️  免密登录验证失败，请检查服务器 SSH 配置"
  exit 1
fi

# 4. 检查 sudo 是否需要密码
echo ""
if ssh "$SERVER" "sudo -n true" 2>/dev/null; then
  echo "✅ 服务器 sudo 已配置免密，sync-to-server.sh 不会卡在 sudo。"
else
  echo "⚠️  服务器 sudo 仍需要密码。建议在服务器上执行："
  echo "   echo '$USER ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/99-salary-deploy"
  echo "   sudo chmod 440 /etc/sudoers.d/99-salary-deploy"
fi

echo ""
echo "现在可以运行 sync-to-server.sh，不再需要输入 SSH 密码："
echo "  ./sync-to-server.sh $SERVER"
