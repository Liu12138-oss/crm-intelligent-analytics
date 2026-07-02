#!/usr/bin/env bash
set -euo pipefail

# 生产发布脚本模板
# 说明：
# 1. 本脚本默认在服务器本机构建并发布。
# 2. 执行前请先确认 backend.env、systemd、Nginx 已准备完成。
# 3. 若使用源码压缩包而非 Git 拉取，请按实际流程改造“获取代码”部分。
# 4. 本脚本不会修改 Nginx 配置，只负责发布版本、切换 current、重启后端。

APP_ROOT="/srv/crm-intelligent-analytics"
APP_USER="crmapp"
APP_GROUP="crmapp"
SERVICE_NAME="crm-intelligent-analytics"
REPO_URL="git@github.com:company/crm.git"
BRANCH="main"
RELEASE_NAME="${RELEASE_NAME:-$(date +%Y%m%d-%H%M%S)}"
RELEASE_DIR="${APP_ROOT}/releases/${RELEASE_NAME}"
ENV_FILE="${APP_ROOT}/shared/backend.env"
CURRENT_LINK="${APP_ROOT}/current"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "未找到环境变量文件：${ENV_FILE}"
  exit 1
fi

# 当前模板约定 backend.env 为受控文件，允许在发布脚本中 source。
set -a
source "${ENV_FILE}"
set +a

if [[ -z "${APP_WEB_BASE_URL:-}" ]]; then
  echo "缺少 APP_WEB_BASE_URL，无法推导前端正式地址。"
  exit 1
fi

if [[ -z "${VITE_API_BASE_URL:-}" ]]; then
  export VITE_API_BASE_URL="${APP_WEB_BASE_URL}"
fi

echo "==> 准备发布目录 ${RELEASE_DIR}"
mkdir -p "${APP_ROOT}/releases"
git clone --branch "${BRANCH}" --depth 1 "${REPO_URL}" "${RELEASE_DIR}"

cd "${RELEASE_DIR}"

echo "==> 安装依赖"
pnpm install --frozen-lockfile

echo "==> 构建产物"
pnpm build

echo "==> 接入共享运行目录"
rm -rf .runtime
ln -s "${APP_ROOT}/shared/.runtime" .runtime

echo "==> 切换 current 软链接"
ln -sfn "${RELEASE_DIR}" "${CURRENT_LINK}"
chown -h "${APP_USER}:${APP_GROUP}" "${CURRENT_LINK}"
chown -R "${APP_USER}:${APP_GROUP}" "${RELEASE_DIR}"

echo "==> 重启后端服务"
systemctl restart "${SERVICE_NAME}"
systemctl status "${SERVICE_NAME}" --no-pager

echo "==> 发布完成"
echo "当前版本目录：${RELEASE_DIR}"
echo "前端正式地址：${VITE_API_BASE_URL}"
echo "建议后续执行："
echo "1. curl -I ${APP_WEB_BASE_URL}"
echo "2. sudo journalctl -u ${SERVICE_NAME} -n 100 --no-pager"
echo "3. 复制 shared/scripts/run-daily-report-jobs.sh 并先执行一次 preview 联调"
echo "4. 依据《生产部署指南》执行业务冒烟"
