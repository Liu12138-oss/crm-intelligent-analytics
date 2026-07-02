#!/usr/bin/env bash
set -euo pipefail

# 回滚脚本
# 作用：把 current 软链接切回指定版本，并重启服务。
# 安全边界：不删除新版本，不修改 shared/backend.env，不修改 shared/.runtime。

APP_ROOT="${APP_ROOT:-/srv/crm-intelligent-analytics}"
APP_USER="${APP_USER:-crmapp}"
APP_GROUP="${APP_GROUP:-crmapp}"
SERVICE_NAME="${SERVICE_NAME:-crm-intelligent-analytics}"
TARGET_RELEASE="${TARGET_RELEASE:-${1:-}}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "请使用 root 用户执行：sudo TARGET_RELEASE=版本目录 bash $0"
  exit 1
fi

if [[ -z "${TARGET_RELEASE}" ]]; then
  echo "缺少回滚目标版本。可选版本如下："
  ls -1 "${APP_ROOT}/releases" || true
  echo "示例：sudo TARGET_RELEASE=20260702-150000 bash $0"
  exit 1
fi

if [[ "${TARGET_RELEASE}" == /* ]]; then
  RELEASE_DIR="${TARGET_RELEASE}"
else
  RELEASE_DIR="${APP_ROOT}/releases/${TARGET_RELEASE}"
fi

if [[ ! -d "${RELEASE_DIR}" ]]; then
  echo "回滚目标不存在：${RELEASE_DIR}"
  exit 1
fi

if [[ ! -f "${RELEASE_DIR}/backend/dist/src/main.js" ]]; then
  echo "回滚目标缺少后端构建产物：${RELEASE_DIR}/backend/dist/src/main.js"
  exit 1
fi

if [[ ! -f "${RELEASE_DIR}/frontend/dist/index.html" ]]; then
  echo "回滚目标缺少前端构建产物：${RELEASE_DIR}/frontend/dist/index.html"
  exit 1
fi

echo "==> 当前版本"
if [[ -L "${APP_ROOT}/current" ]]; then
  readlink -f "${APP_ROOT}/current"
else
  echo "当前没有 current 软链接"
fi

echo "==> 切换到：${RELEASE_DIR}"
ln -sfn "${RELEASE_DIR}" "${APP_ROOT}/current"
chown -h "${APP_USER}:${APP_GROUP}" "${APP_ROOT}/current"

echo "==> 重启服务"
systemctl restart "${SERVICE_NAME}"
systemctl reload nginx
systemctl is-active --quiet "${SERVICE_NAME}"

echo "==> 回滚完成"
echo "当前版本：$(readlink -f "${APP_ROOT}/current")"
echo "查看日志：journalctl -u ${SERVICE_NAME} -n 100 --no-pager"
