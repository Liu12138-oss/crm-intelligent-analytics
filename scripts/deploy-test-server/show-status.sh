#!/usr/bin/env bash
set -euo pipefail

# 状态查看脚本
# 作用：快速查看当前版本、服务状态、最近日志和前端入口。

APP_ROOT="${APP_ROOT:-/srv/crm-intelligent-analytics}"
SERVICE_NAME="${SERVICE_NAME:-crm-intelligent-analytics}"
APP_PATH="${APP_PATH:-/insight/}"

echo "==> 当前版本"
if [[ -L "${APP_ROOT}/current" ]]; then
  readlink -f "${APP_ROOT}/current"
else
  echo "未找到 ${APP_ROOT}/current"
fi

echo "==> 最近版本目录"
ls -1t "${APP_ROOT}/releases" 2>/dev/null | head -10 || true

echo "==> 服务状态"
systemctl status "${SERVICE_NAME}" --no-pager || true

echo "==> 最近日志"
journalctl -u "${SERVICE_NAME}" -n 80 --no-pager || true

echo "==> 前端入口"
if command -v curl >/dev/null 2>&1; then
  curl -I "http://127.0.0.1${APP_PATH}" || true
fi
