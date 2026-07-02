#!/usr/bin/env bash
set -euo pipefail

# 生产机初始化脚本模板
# 说明：
# 1. 本脚本适用于 Rocky Linux 9.5。
# 2. 默认行为是安装 Node.js、pnpm、Nginx，并创建应用用户和目录。
# 3. 执行前请先阅读并按需修改顶部变量。
# 4. 正式环境若使用公司内网软件源，请先替换 dnf 与 NodeSource 配置。

APP_USER="crmapp"
APP_GROUP="crmapp"
APP_ROOT="/srv/crm-intelligent-analytics"
NODE_MAJOR="20"
PNPM_VERSION="8.15.9"

if [[ "${EUID}" -ne 0 ]]; then
  echo "请使用 root 或 sudo 执行本脚本。"
  exit 1
fi

echo "==> 安装系统依赖"
dnf install -y dnf-plugins-core curl ca-certificates git nginx

echo "==> 安装 Node.js ${NODE_MAJOR}"
curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
dnf install -y nodejs

echo "==> 启用 corepack 并固定 pnpm ${PNPM_VERSION}"
corepack enable
corepack prepare "pnpm@${PNPM_VERSION}" --activate

echo "==> 创建应用用户和目录"
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "${APP_ROOT}" --shell /bin/bash "${APP_USER}"
fi

mkdir -p "${APP_ROOT}/releases"
mkdir -p "${APP_ROOT}/backups"
mkdir -p "${APP_ROOT}/shared/.runtime/contract-review"
mkdir -p "${APP_ROOT}/shared/logs"
mkdir -p "${APP_ROOT}/shared/scripts"
touch "${APP_ROOT}/shared/.runtime/app-storage.json"
touch "${APP_ROOT}/shared/backend.env"
chown -R "${APP_USER}:${APP_GROUP}" "${APP_ROOT}"
chmod 600 "${APP_ROOT}/shared/backend.env"
chmod 750 "${APP_ROOT}/shared/scripts"

echo "==> 启用 Nginx"
systemctl enable nginx

echo "==> 环境初始化完成"
echo "Node.js 版本：$(node -v)"
echo "pnpm 版本：$(pnpm -v)"
echo "应用根目录：${APP_ROOT}"
echo "下一步："
echo "1. 填写 ${APP_ROOT}/shared/backend.env"
echo "2. 将 deploy-examples 下的调度脚本复制到 ${APP_ROOT}/shared/scripts"
echo "3. 部署 systemd 与 Nginx 配置"
echo "4. 执行发布脚本或手动发布版本"
