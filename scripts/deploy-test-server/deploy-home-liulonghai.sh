#!/usr/bin/env bash
set -euo pipefail

# /home/liulonghai 生产路径部署入口脚本
# 作用：把应用根目录、服务名、运行用户等固定为生产约定，再调用通用初始化和发布脚本。
# 安全边界：不写入真实密钥，不覆盖已有环境变量；发布前会检查 backend.env 是否仍有占位符。

APP_ROOT="${APP_ROOT:-/home/liulonghai/crm-intelligent-analytics}"
APP_USER="${APP_USER:-crmapp}"
APP_GROUP="${APP_GROUP:-crmapp}"
SERVICE_NAME="${SERVICE_NAME:-crm-intelligent-analytics}"
APP_BASE_PATH="${APP_BASE_PATH:-/insight/}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
GIT_REF="${GIT_REF:-main}"
SERVER_NAME="${SERVER_NAME:-_}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${APP_ROOT}/shared/backend.env"

show_usage() {
  cat <<EOF
用法：
  sudo bash $0 init
  sudo REPO_URL=git@github.com:你的用户名/crm-intelligent-analytics.git bash $0 deploy
  sudo bash $0 status

子命令说明：
  init    安装基础软件，创建 /home/liulonghai 生产目录，写入 systemd 和 Nginx 配置
  deploy  从 GitHub 拉取代码、构建新版本、切换 current、重启服务
  status  查看当前版本、服务状态、Nginx 状态和本机访问验证

可选环境变量：
  APP_ROOT       默认 ${APP_ROOT}
  APP_USER       默认 ${APP_USER}
  SERVICE_NAME   默认 ${SERVICE_NAME}
  APP_BASE_PATH  默认 ${APP_BASE_PATH}
  BACKEND_PORT   默认 ${BACKEND_PORT}
  GIT_REF        默认 ${GIT_REF}
  SERVER_NAME    默认 ${SERVER_NAME}
EOF
}

export_common_env() {
  export APP_ROOT APP_USER APP_GROUP SERVICE_NAME APP_BASE_PATH BACKEND_PORT GIT_REF SERVER_NAME
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "请使用 root 权限执行，例如：sudo bash $0 $1"
    exit 1
  fi
}

check_env_ready() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "未找到环境变量文件：${ENV_FILE}"
    echo "请先执行：sudo bash $0 init"
    exit 1
  fi

  if grep -Eq '请替换|测试服务器IP' "${ENV_FILE}"; then
    echo "环境变量文件仍包含占位内容，请先编辑真实配置：${ENV_FILE}"
    echo "注意：不要把真实密钥提交到 GitHub。"
    exit 1
  fi
}

run_init() {
  require_root "init"
  export_common_env
  bash "${SCRIPT_DIR}/init-ubuntu-github.sh"
  echo
  echo "初始化完成。下一步请编辑环境变量：sudo nano ${ENV_FILE}"
}

run_deploy() {
  require_root "deploy"
  if [[ -z "${REPO_URL:-}" ]]; then
    echo "缺少 REPO_URL。示例："
    echo "sudo REPO_URL=git@github.com:你的用户名/crm-intelligent-analytics.git bash $0 deploy"
    exit 1
  fi

  check_env_ready
  export_common_env
  export REPO_URL
  bash "${SCRIPT_DIR}/deploy-from-github.sh"
}

run_status() {
  require_root "status"
  echo "==> 当前版本"
  if [[ -L "${APP_ROOT}/current" ]]; then
    readlink -f "${APP_ROOT}/current"
  else
    echo "尚未发布 current 版本"
  fi

  echo
  echo "==> 服务状态"
  systemctl status "${SERVICE_NAME}" --no-pager || true

  echo
  echo "==> Nginx 配置检查"
  nginx -t

  echo
  echo "==> 本机前端访问检查"
  curl -I "http://127.0.0.1${APP_BASE_PATH}index.html" || true

  echo
  echo "==> 本机接口鉴权检查"
  curl -i "http://127.0.0.1/api/v1/analysis/capabilities" | head -n 20 || true

  echo
  echo "==> 环境变量文件权限"
  ls -l "${ENV_FILE}" || true
}

case "${1:-}" in
  init)
    run_init
    ;;
  deploy)
    run_deploy
    ;;
  status)
    run_status
    ;;
  -h|--help|help|"")
    show_usage
    ;;
  *)
    echo "未知子命令：$1"
    show_usage
    exit 1
    ;;
esac
