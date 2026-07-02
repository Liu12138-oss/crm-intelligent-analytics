#!/usr/bin/env bash
set -euo pipefail

# 测试服务器初始化脚本
# 适用系统：Ubuntu 24.04 LTS
# 作用：安装基础软件、Node.js、pnpm、Nginx，创建应用目录，写入 systemd 和 Nginx 配置。
# 安全边界：本脚本不会拉取代码，不会覆盖已有 backend.env，不会删除旧版本。

APP_ROOT="${APP_ROOT:-/srv/crm-intelligent-analytics}"
APP_USER="${APP_USER:-crmapp}"
APP_GROUP="${APP_GROUP:-crmapp}"
SERVICE_NAME="${SERVICE_NAME:-crm-intelligent-analytics}"
NODE_MAJOR="${NODE_MAJOR:-20}"
PNPM_VERSION="${PNPM_VERSION:-8.15.9}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
APP_BASE_PATH="${APP_BASE_PATH:-/insight/}"
SERVER_NAME="${SERVER_NAME:-_}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "请使用 root 用户执行：sudo bash $0"
  exit 1
fi

if [[ "${APP_BASE_PATH}" != /*/ ]]; then
  echo "APP_BASE_PATH 必须以 / 开头并以 / 结尾，例如 /insight/"
  exit 1
fi

APP_BASE_PATH_NO_TRAILING="${APP_BASE_PATH%/}"

echo "==> 安装系统基础软件"
apt update
apt install -y curl ca-certificates git nginx openssh-client build-essential python3 make g++ unzip

echo "==> 安装 Node.js ${NODE_MAJOR}"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" != "${NODE_MAJOR}" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt install -y nodejs
fi

echo "==> 启用 pnpm ${PNPM_VERSION}"
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
mkdir -p "${APP_ROOT}/.ssh"

if [[ ! -f "${APP_ROOT}/shared/.runtime/app-storage.json" ]]; then
  printf '{}\n' > "${APP_ROOT}/shared/.runtime/app-storage.json"
fi

if [[ ! -f "${APP_ROOT}/shared/backend.env" ]]; then
  cat > "${APP_ROOT}/shared/backend.env" <<EOF
NODE_ENV=production
PORT=${BACKEND_PORT}
APP_WEB_BASE_URL=http://测试服务器IP${APP_BASE_PATH_NO_TRAILING}
VITE_API_BASE_URL=http://测试服务器IP${APP_BASE_PATH_NO_TRAILING}
VITE_APP_BASE_PATH=${APP_BASE_PATH}
AI_PROFILE_MASTER_KEY=请替换为至少32位随机字符串
ANALYSIS_AI_BASE_URL=请替换为AI网关地址
ANALYSIS_AI_MODEL_PROVIDER=internal-openai-gateway
ANALYSIS_AI_MODEL=请替换为模型名
ANALYSIS_AI_WIRE_API=responses
ANALYSIS_AI_STRUCTURED_OUTPUT_MODE=json_schema
OPENAI_API_KEY=请替换为AI密钥
WECOM_BOT_ID=请替换为企业微信机器人ID
WECOM_BOT_SECRET=请替换为企业微信机器人Secret
WECOM_BOT_SIGNATURE=请替换为企业微信机器人签名
EOF
  echo "已创建环境变量模板：${APP_ROOT}/shared/backend.env"
else
  echo "检测到已有 backend.env，保持不覆盖。"
fi

chown -R "${APP_USER}:${APP_GROUP}" "${APP_ROOT}"
chmod 700 "${APP_ROOT}/.ssh"
chmod 600 "${APP_ROOT}/shared/backend.env"

echo "==> 写入 systemd 服务"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=CRM Intelligent Analytics Backend
After=network.target
Wants=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_ROOT}/current/backend
Environment=NODE_ENV=production
EnvironmentFile=${APP_ROOT}/shared/backend.env
ExecStart=/usr/bin/node ${APP_ROOT}/current/backend/dist/src/main.js
Restart=always
RestartSec=5
TimeoutStartSec=60
TimeoutStopSec=30
StandardOutput=journal
StandardError=journal
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"

echo "==> 写入 Nginx 配置"
cat > "/etc/nginx/sites-available/${SERVICE_NAME}.conf" <<EOF
upstream crm_analytics_api {
    server 127.0.0.1:${BACKEND_PORT};
    keepalive 32;
}

server {
    listen 80;
    server_name ${SERVER_NAME};

    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://crm_analytics_api;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_connect_timeout 30s;
    }

    location ${APP_BASE_PATH_NO_TRAILING}/api/ {
        rewrite ^${APP_BASE_PATH_NO_TRAILING}(/api/.*)\$ \$1 break;
        proxy_pass http://crm_analytics_api;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_connect_timeout 30s;
    }

    location = ${APP_BASE_PATH_NO_TRAILING} {
        return 301 ${APP_BASE_PATH};
    }

    location = ${APP_BASE_PATH}index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
        alias ${APP_ROOT}/current/frontend/dist/index.html;
    }

    location ${APP_BASE_PATH}assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        alias ${APP_ROOT}/current/frontend/dist/assets/;
        try_files \$uri =404;
    }

    location ${APP_BASE_PATH} {
        alias ${APP_ROOT}/current/frontend/dist/;
        try_files \$uri \$uri/ ${APP_BASE_PATH}index.html;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sfn "/etc/nginx/sites-available/${SERVICE_NAME}.conf" "/etc/nginx/sites-enabled/${SERVICE_NAME}.conf"
nginx -t
systemctl enable nginx
systemctl restart nginx

echo "==> 初始化完成"
echo "Node.js 版本：$(node -v)"
echo "pnpm 版本：$(pnpm -v)"
echo "应用目录：${APP_ROOT}"
echo "下一步："
echo "1. 编辑 ${APP_ROOT}/shared/backend.env，替换测试服务器 IP 和密钥。"
echo "2. 配置 GitHub SSH 部署密钥。"
echo "3. 执行 deploy-from-github.sh 发布首个版本。"
