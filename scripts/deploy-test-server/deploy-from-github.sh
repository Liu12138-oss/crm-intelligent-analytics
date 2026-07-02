#!/usr/bin/env bash
set -euo pipefail

# GitHub 发布脚本
# 作用：从 GitHub 拉取指定分支或标签，构建新版本，切换 current，重启后端并重载 Nginx。
# 安全边界：每次发布都创建新 releases 目录，不覆盖旧版本，不覆盖 shared/backend.env 和 shared/.runtime。

APP_ROOT="${APP_ROOT:-/srv/crm-intelligent-analytics}"
APP_USER="${APP_USER:-crmapp}"
APP_GROUP="${APP_GROUP:-crmapp}"
SERVICE_NAME="${SERVICE_NAME:-crm-intelligent-analytics}"
REPO_URL="${REPO_URL:-${1:-}}"
GIT_REF="${GIT_REF:-${2:-main}}"
RELEASE_NAME="${RELEASE_NAME:-$(date +%Y%m%d-%H%M%S)}"
RELEASE_DIR="${APP_ROOT}/releases/${RELEASE_NAME}"
ENV_FILE="${APP_ROOT}/shared/backend.env"
CURRENT_LINK="${APP_ROOT}/current"

if [[ "${EUID}" -ne 0 ]]; then
  echo "请使用 root 用户执行：sudo REPO_URL=仓库地址 bash $0"
  exit 1
fi

if [[ -z "${REPO_URL}" ]]; then
  echo "缺少 GitHub 仓库地址。示例："
  echo "sudo REPO_URL=git@github.com:你的用户名/crm-intelligent-analytics.git bash $0"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "未找到环境变量文件：${ENV_FILE}"
  exit 1
fi

if [[ -e "${RELEASE_DIR}" ]]; then
  echo "版本目录已存在，为避免覆盖旧版本已停止：${RELEASE_DIR}"
  exit 1
fi

echo "==> 记录升级前状态"
BACKUP_DIR="${APP_ROOT}/backups/pre-upgrade-${RELEASE_NAME}"
mkdir -p "${BACKUP_DIR}"
if [[ -L "${CURRENT_LINK}" ]]; then
  readlink -f "${CURRENT_LINK}" > "${BACKUP_DIR}/previous-release.txt"
else
  printf '无当前版本\n' > "${BACKUP_DIR}/previous-release.txt"
fi
cp "${ENV_FILE}" "${BACKUP_DIR}/backend.env"
cp -a "${APP_ROOT}/shared/.runtime" "${BACKUP_DIR}/runtime"
chmod 600 "${BACKUP_DIR}/backend.env"

echo "==> 拉取代码：${REPO_URL} ${GIT_REF}"
mkdir -p "${APP_ROOT}/releases"
chown -R "${APP_USER}:${APP_GROUP}" "${APP_ROOT}/releases"
runuser -u "${APP_USER}" -- env GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new" git clone --branch "${GIT_REF}" --depth 1 "${REPO_URL}" "${RELEASE_DIR}"

echo "==> 加载环境变量"
set -a
source "${ENV_FILE}"
set +a

if [[ -z "${APP_WEB_BASE_URL:-}" ]]; then
  echo "backend.env 缺少 APP_WEB_BASE_URL"
  exit 1
fi

if [[ -z "${VITE_API_BASE_URL:-}" ]]; then
  export VITE_API_BASE_URL="${APP_WEB_BASE_URL}"
fi

if [[ -z "${VITE_APP_BASE_PATH:-}" ]]; then
  export VITE_APP_BASE_PATH="/insight/"
fi

echo "==> 安装依赖并构建"
cd "${RELEASE_DIR}"
pnpm install --frozen-lockfile
pnpm build

echo "==> 挂载共享运行态目录"
rm -rf .runtime
ln -s "${APP_ROOT}/shared/.runtime" .runtime

echo "==> 切换当前版本"
chown -R "${APP_USER}:${APP_GROUP}" "${RELEASE_DIR}"
ln -sfn "${RELEASE_DIR}" "${CURRENT_LINK}"
chown -h "${APP_USER}:${APP_GROUP}" "${CURRENT_LINK}"

echo "==> 重启服务"
systemctl restart "${SERVICE_NAME}"
systemctl reload nginx

echo "==> 验证服务状态"
systemctl is-active --quiet "${SERVICE_NAME}"

echo "==> 验证前端入口"
if command -v curl >/dev/null 2>&1; then
  curl -fsS -I "http://127.0.0.1${VITE_APP_BASE_PATH}" >/dev/null
fi

echo "==> 发布完成"
echo "当前版本目录：${RELEASE_DIR}"
echo "上一版本记录：${BACKUP_DIR}/previous-release.txt"
echo "查看日志：journalctl -u ${SERVICE_NAME} -n 100 --no-pager"
