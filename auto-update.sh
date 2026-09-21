#!/bin/bash
# 地铁渗透率看板 - 每日自动更新数据并推送到 GitHub
# 需要在内网环境运行（能访问 cloudide.dev.alipay.net）
# 
# 配合 crontab 每日定时执行：
#   crontab -e
#   添加：0 8 * * * /path/to/metro-dashboard/auto-update.sh >> /tmp/metro-dashboard-update.log 2>&1

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== $(date '+%Y-%m-%d %H:%M:%S') 开始更新 ==="

# 1. 更新本地数据
python3 update-data.py
if [ $? -ne 0 ]; then
  echo "❌ 数据更新失败"
  exit 1
fi

# 2. 推送到 GitHub
git add data/
git diff --staged --quiet && echo "数据无变化" && exit 0
git commit -m "Auto-update data $(date '+%Y-%m-%d')"
git push origin main

echo "=== $(date '+%Y-%m-%d %H:%M:%S') 更新完成 ==="