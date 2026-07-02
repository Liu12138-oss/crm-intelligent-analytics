#!/usr/bin/env bash
set -euo pipefail

# 日报生产联调 / 调度脚本模板
# 说明：
# 1. 本脚本默认从 /srv/crm-intelligent-analytics/shared/backend.env 读取配置。
# 2. 企业微信目录同步接口当前走 internal 路径，不依赖登录态。
# 3. 日报 reminders / close / summaries 仍需登录态，因此脚本会先调用 /api/v1/auth/login 换取会话 Cookie。
# 4. 建议首次联调时保持 WECOM_NOTIFY_REAL_MESSAGE_ENABLED=false，先验证“发送预览”和试点组投递，再切换真实发送。

APP_ROOT="${APP_ROOT:-/srv/crm-intelligent-analytics}"
ENV_FILE="${ENV_FILE:-${APP_ROOT}/shared/backend.env}"
COOKIE_JAR="${COOKIE_JAR:-${APP_ROOT}/shared/.runtime/daily-report-scheduler.cookie}"
ACTION="${1:-}"
INPUT_DATE="${2:-}"

if [[ -z "${ACTION}" ]]; then
  echo "用法：$0 <sync-all|preview|reminders|close|summaries|night-batch|morning-batch> [businessDate]"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "未找到环境变量文件：${ENV_FILE}"
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

BASE_URL="${SCHEDULER_BASE_URL:-${APP_WEB_BASE_URL:-}}"
if [[ -z "${BASE_URL}" ]]; then
  echo "缺少 SCHEDULER_BASE_URL 或 APP_WEB_BASE_URL，无法确定调用地址。"
  exit 1
fi

require_scheduler_login() {
  if [[ -z "${SCHEDULER_LOGIN:-}" || -z "${SCHEDULER_PASSWORD:-}" ]]; then
    echo "缺少 SCHEDULER_LOGIN 或 SCHEDULER_PASSWORD，无法自动登录执行日报 cron 接口。"
    exit 1
  fi
}

resolve_today() {
  date '+%F'
}

resolve_yesterday() {
  date -d 'yesterday' '+%F'
}

resolve_business_date() {
  local default_date="$1"
  if [[ -n "${INPUT_DATE}" ]]; then
    echo "${INPUT_DATE}"
    return
  fi
  echo "${default_date}"
}

login_and_cache_cookie() {
  require_scheduler_login
  rm -f "${COOKIE_JAR}"

  local payload
  if [[ -n "${SCHEDULER_CORP_ID:-}" ]]; then
    payload=$(cat <<JSON
{"login":"${SCHEDULER_LOGIN}","password":"${SCHEDULER_PASSWORD}","corpId":"${SCHEDULER_CORP_ID}"}
JSON
)
  else
    payload=$(cat <<JSON
{"login":"${SCHEDULER_LOGIN}","password":"${SCHEDULER_PASSWORD}"}
JSON
)
  fi

  curl --silent --show-error --fail \
    --cookie-jar "${COOKIE_JAR}" \
    --header "Content-Type: application/json" \
    --request POST \
    --data "${payload}" \
    "${BASE_URL}/api/v1/auth/login" >/dev/null
}

call_directory_sync() {
  curl --silent --show-error --fail \
    --header "Content-Type: application/json" \
    --request POST \
    --data '{"resourceType":"all"}' \
    "${BASE_URL}/api/v1/internal/wecom-directory-sync/run"
}

call_delivery_preview() {
  local business_date="$1"
  login_and_cache_cookie
  curl --silent --show-error --fail \
    --cookie "${COOKIE_JAR}" \
    --header "Content-Type: application/json" \
    --request POST \
    --data "{\"businessDate\":\"${business_date}\"}" \
    "${BASE_URL}/api/v1/governance/daily-report-delivery/preview"
}

call_daily_report_job() {
  local endpoint="$1"
  local business_date="$2"
  local timestamp="$3"
  login_and_cache_cookie
  curl --silent --show-error --fail \
    --cookie "${COOKIE_JAR}" \
    --header "Content-Type: application/json" \
    --request POST \
    --data "{\"businessDate\":\"${business_date}\",\"${timestamp}\":\"$(date --iso-8601=seconds)\"}" \
    "${BASE_URL}/api/v1/daily-reports/cron/${endpoint}"
}

case "${ACTION}" in
  sync-all)
    call_directory_sync
    ;;
  preview)
    call_delivery_preview "$(resolve_business_date "$(resolve_today)")"
    ;;
  reminders)
    call_daily_report_job "reminders" "$(resolve_business_date "$(resolve_today)")" "sentAt"
    ;;
  close)
    call_daily_report_job "close" "$(resolve_business_date "$(resolve_today)")" "closedAt"
    ;;
  summaries)
    call_daily_report_job "summaries" "$(resolve_business_date "$(resolve_yesterday)")" "generatedAt"
    ;;
  night-batch)
    call_directory_sync
    call_daily_report_job "reminders" "$(resolve_business_date "$(resolve_today)")" "sentAt"
    ;;
  morning-batch)
    call_directory_sync
    call_daily_report_job "summaries" "$(resolve_business_date "$(resolve_yesterday)")" "generatedAt"
    ;;
  *)
    echo "不支持的动作：${ACTION}"
    exit 1
    ;;
esac
