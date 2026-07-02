# CRM 智能分析系统 Linux 部署、启动与维护手册

本文面向从 Windows 整体拷贝项目到 Linux 公用服务器的场景。当前个人可用目录为：

```text
/home/liulonghai/AI-agent
```

本文把操作完全分成两条路线：

```text
调试阶段：
  目标是快速验证代码、配置、联软 CRM、AI、企业微信机器人是否能跑通。
  可以临时启动，可以看实时日志，可以频繁改配置和重启。

上产部署：
  目标是正式给用户使用，要求稳定、安全、可维护、尽量不影响公用服务器上的其他人。
  使用构建产物、独立后端进程、独立 Nginx 入口、固定日志和运行目录。
```

如果你只是临时验证功能，看“调试阶段”。如果要给别人长期使用，看“上产部署”。

## 1. 先理解项目组成

这个项目不是单独一个网页，也不是单独一个机器人。它在服务器上通常由这些部分一起工作：

```text
浏览器页面 / 企业微信卡片 / 企业微信机器人
        ↓
前端页面 frontend
        ↓
后端服务 backend
        ↓
联软 CRM OpenAPI / 分析库 / AI 网关 / 企业微信接口
```

各部分职责：

```text
frontend 前端：
  给人看的页面，例如登录页、CRM 智能分析页、结果详情页、免登录结果页。
  调试阶段通常用 frontend dev 访问，默认端口 5173。
  如果要验证构建后的 dist，也可以临时用 frontend preview，默认端口 4173。
  上产部署时建议构建为 frontend/dist，再交给 Nginx 访问。

backend 后端：
  负责业务逻辑，例如登录鉴权、企业微信机器人监听、CRM 数据查询、AI 分析、权限控制、审计记录。
  当前统一监听 3001。

shared/backend.env：
  Linux 运行配置文件，放 CRM 地址、AI 网关地址、企业微信配置、端口等。
  这是敏感配置，不提交代码，不发给别人。

shared/.runtime：
  运行时数据目录，例如企微监听锁、审计记录、临时结果文件。
  它不是源码，更新代码时不能删除。

shared/logs：
  运行日志目录，后端、前端 dev / preview、Nginx 日志都放这里，方便排障。

Nginx：
  上产部署推荐使用的统一入口。
  它负责对外提供前端页面，并把 /api/ 请求转发给后端 3001。
```

## 2. 调试阶段和上产部署的区别

### 2.1 调试阶段是什么

调试阶段适合这些情况：

```text
1. 刚把项目拷到 Linux，先确认能不能跑。
2. 正在联调联软 CRM OpenAPI、AI 网关或企业微信机器人。
3. 配置经常变化，需要频繁改 env 和重启。
4. 只给自己或少数内网同事临时访问。
5. 页面、接口、机器人还在排错。
```

调试阶段可以接受：

```text
1. 临时打开 3001 和 5173。
2. 如果要验证构建产物，也可以临时打开 4173。
3. 手工启动进程。
4. 看实时日志。
5. 失败后直接停掉重来。
```

调试阶段不建议做：

```text
1. 不建议绑定 80/443。
2. 不建议改系统默认 Nginx 站点。
3. 不建议把调试命令当作正式长期运行方式。
4. 不建议把 3001 长期暴露给所有用户。
```

### 2.2 上产部署是什么

上产部署适合这些情况：

```text
1. 功能已经跑通，需要给真实用户长期使用。
2. 企业微信机器人、免登录结果页、图片报告、Web 页面都需要稳定访问。
3. 需要尽量不影响公用服务器上的其他服务。
4. 需要固定日志、固定端口、固定启停脚本。
5. 需要保护密钥、Token、数据库配置和运行数据。
```

上产部署要求：

```text
1. 前端必须先 build，使用 frontend/dist。
2. 后端运行构建产物 backend/dist/src/main.js。
3. 生产配置放 shared/backend.env。
4. 日志放 shared/logs。
5. 运行数据放 shared/.runtime。
6. 推荐用独立 Nginx 配置监听 18080。
7. 后端 3001 尽量只给本机 Nginx 访问。
```

### 2.3 为什么生产不建议用 `pnpm dev`

`pnpm dev` 适合开发，不适合正式生产。原因是：

```text
1. dev 模式通常包含热更新、文件监听和调试能力，更耗资源。
2. 当前根级 dev 脚本偏 Windows PowerShell，不适合作为 Linux 生产启动方式。
3. dev 服务异常退出后，不一定有稳定的 PID 文件和日志。
4. 生产应该运行构建后的稳定产物，减少不确定性。
5. 企业微信卡片和免登录结果页需要稳定的公开访问地址。
```

简单理解：

```text
调试阶段：
  先跑起来，方便看问题。

上产部署：
  按固定架构跑起来，方便长期使用和维护。
```

## 3. 公共准备，只做一次

无论调试还是上产，首次从 Windows 拷贝到 Linux 后，都建议先做本章。

### 3.1 服务器基础要求

需要具备：

```text
Node.js：20.x
pnpm：8.15.9
可访问联软 CRM OpenAPI 或分析库
可访问 AI 网关
可访问企业微信 OpenAPI / WebSocket
当前用户 liulonghai 对 /home/liulonghai/AI-agent 有读写执行权限
```

检查命令：

```bash
node -v
pnpm -v
pwd
whoami
```

如果已有 Node.js 20，但没有 pnpm，优先启用 corepack：

```bash
corepack enable
corepack prepare pnpm@8.15.9 --activate
node -v
pnpm -v
```

如果 `corepack` 没有权限写系统目录，需要联系管理员处理，或使用公司已有 Node.js 环境。

### 3.2 整理 Windows 拷贝目录

进入项目目录：

```bash
cd /home/liulonghai/AI-agent
```

确认结构：

```bash
ls -lah
ls -lah backend frontend
```

清理 Windows 不能复用的依赖和旧构建产物：

```bash
rm -rf node_modules backend/node_modules frontend/node_modules
rm -rf backend/dist frontend/dist
rm -rf _release_pack
rm -f crm-agent-release.zip crm-agent-release.tar.gz
```

创建 Linux 运行目录：

```bash
mkdir -p /home/liulonghai/AI-agent/shared/logs
mkdir -p /home/liulonghai/AI-agent/shared/.runtime/contract-review
mkdir -p /home/liulonghai/AI-agent/shared/scripts
touch /home/liulonghai/AI-agent/shared/backend.env
chmod 700 /home/liulonghai/AI-agent
chmod 600 /home/liulonghai/AI-agent/shared/backend.env
```

建立 `.runtime` 软链，避免运行数据被代码更新覆盖：

```bash
cd /home/liulonghai/AI-agent

if [ -d .runtime ] && [ ! -L .runtime ]; then
  mkdir -p shared/.runtime
  cp -a .runtime/. shared/.runtime/ 2>/dev/null || true
  mv .runtime ".runtime.backup.$(date +%Y%m%d%H%M%S)"
fi

ln -sfn shared/.runtime .runtime
```

### 3.3 准备 Linux 运行配置

生产和调试都统一使用：

```text
/home/liulonghai/AI-agent/shared/backend.env
```

编辑配置：

```bash
vi /home/liulonghai/AI-agent/shared/backend.env
```

建议至少包含以下内容。真实密钥不要写进文档、截图或代码仓库。

```bash
# 基础运行环境
NODE_ENV=production
PORT=3001

# 调试阶段如果不用 Nginx，前端源码调试先填 5173
# 上产部署使用 Nginx 后，改为 http://服务器IP:18080
APP_WEB_BASE_URL=http://服务器IP:5173
WECOM_WEB_BASE_URL=http://服务器IP:5173

# 调试阶段前端 dev 访问后端，先填 3001
# 上产部署使用 Nginx 后，改为 http://服务器IP:18080
VITE_API_BASE_URL=http://服务器IP:3001
VITE_APP_BASE_PATH=/

# 运行数据路径
CONTRACT_REVIEW_STORAGE_DIR=/home/liulonghai/AI-agent/shared/.runtime/contract-review
CONTRACT_REVIEW_SKILL_PACK_ROOT_DIR=/home/liulonghai/AI-agent/backend/resources/contract-review-skill-packs
SQL_AUDIT_RECORD_FILE=/home/liulonghai/AI-agent/shared/.runtime/sql-audit-records.jsonl
SQL_AUDIT_ARCHIVE_DIR=/home/liulonghai/AI-agent/shared/.runtime/sql-audit-archive

# 联软 CRM 标准 OpenAPI
CRM_STANDARD_OPEN_API_BASE_URL=请替换为真实地址
CRM_STANDARD_OPEN_API_APP_KEY=请替换为真实appKey
CRM_STANDARD_OPEN_API_APP_SECRET=请替换为真实appSecret
CRM_STANDARD_OPEN_API_TIMEOUT_MS=30000
CRM_STANDARD_OPEN_API_TOKEN_CACHE_BUFFER_SECONDS=120

# AI 分析
ANALYSIS_AI_BASE_URL=请替换为真实AI网关地址
ANALYSIS_AI_MODEL=请替换为真实模型名
OPENAI_API_KEY=请替换为真实密钥

# 企业微信机器人长连接
WECOM_BOT_ID=请替换为真实Bot ID
WECOM_BOT_SECRET=请替换为真实Bot Secret
WECOM_BOT_TRANSPORT_MODE=sdk
WECOM_BOT_WS_URL=wss://openws.work.weixin.qq.com

# 企业微信 Web 登录。WECOM_WEB_LOGIN_APP_ID 通常填写企业 ID / CorpID。
WECOM_WEB_LOGIN_APP_ID=请替换为真实企业ID或CorpID
WECOM_WEB_LOGIN_AGENT_ID=请替换为真实AgentID
WECOM_WEB_LOGIN_SECRET=请替换为真实应用Secret

# 企业微信通讯录同步。如果和 Web 登录共用同一个应用，可先填写同一组 CorpID / AgentID / Secret。
WECOM_DIRECTORY_CORP_ID=请替换为真实企业ID或CorpID
WECOM_DIRECTORY_AGENT_ID=请替换为真实AgentID
WECOM_DIRECTORY_SECRET=请替换为真实应用Secret
WECOM_DIRECTORY_ROOT_DEPARTMENT_NAME=联软科技集团
WECOM_DIRECTORY_PAGE_SIZE=100

# 企业微信主动通知。如果需要用企业微信应用主动发消息，再启用真实发送。
WECOM_NOTIFY_CORP_ID=请替换为真实企业ID或CorpID
WECOM_NOTIFY_AGENT_ID=请替换为真实AgentID
WECOM_NOTIFY_SECRET=请替换为真实应用Secret
WECOM_NOTIFY_REAL_MESSAGE_ENABLED=false
WECOM_NOTIFY_TEST_USER_ID=请替换为联调测试接收人企业微信userid
```

配置理解：

```text
PORT：
  后端监听端口，当前统一使用 3001。

APP_WEB_BASE_URL：
  后端生成企业微信卡片、分析结果链接、免登录结果页链接时使用。
  这个地址必须是浏览器和企业微信客户端都能访问到的地址。

WECOM_WEB_BASE_URL：
  企业微信相关页面或回跳地址使用，一般和 APP_WEB_BASE_URL 保持一致。

VITE_API_BASE_URL：
  前端页面请求后端 API 的地址。
  这是前端构建时写入 dist 的值，修改后必须重新构建前端。

CRM_STANDARD_OPEN_API_*：
  对接联软 CRM 标准 OpenAPI，用于获取客户、渠道商、商机、订单等数据。

ANALYSIS_AI_* / OPENAI_API_KEY：
  AI 网关配置，用于自然语言理解、智能分析报告生成和企业微信回复组织。

WECOM_BOT_*：
  企业微信机器人长连接配置，用于机器人对话接入和回复。

WECOM_WEB_LOGIN_*：
  企业微信 Web 登录配置，用于扫码登录、回跳和 Web 侧身份识别。

WECOM_DIRECTORY_*：
  企业微信通讯录同步配置，用于同步部门和成员，支撑企业微信用户与 CRM 用户映射。

WECOM_NOTIFY_*：
  企业微信应用主动通知配置，用于需要主动给用户发送应用消息的场景。
```

为什么配置放在 `shared/backend.env`：

```text
1. 防止从 Windows 复制新代码时覆盖生产配置。
2. 防止密钥、Token、数据库密码误提交到代码仓库。
3. 方便备份和迁移，真正重要的生产差异都集中在 shared 目录。
4. 同一份代码可以部署到测试环境和生产环境，只换 env 即可。
```

### 3.4 安装依赖和构建

进入项目根目录：

```bash
cd /home/liulonghai/AI-agent
```

加载配置：

```bash
set -a
. /home/liulonghai/AI-agent/shared/backend.env
set +a
```

安装依赖：

```bash
pnpm install --frozen-lockfile
```

如果服务器不能访问默认 npm 源，需要切换公司内网镜像：

```bash
pnpm config get registry
pnpm config set registry https://你的npm镜像地址/
pnpm install --frozen-lockfile
```

构建后端和前端：

```bash
pnpm build
```

确认产物存在：

```bash
ls -lah backend/dist/src/main.js
ls -lah frontend/dist
```

## 4. 调试阶段，临时跑通功能

本章只用于调试和联调，不作为长期生产运行方式。

### 4.1 调试阶段推荐端口

```text
后端 API：3001
前端源码调试 dev：5173，推荐
前端构建产物预览 preview：4173，可选
企业微信机器人：不单独占用 HTTP 端口，随后端一起启动
```

调试阶段访问方式：

```text
前端页面：http://服务器IP:5173/
后端接口：http://服务器IP:3001/
```

调试阶段对应配置：

```bash
APP_WEB_BASE_URL=http://服务器IP:5173
WECOM_WEB_BASE_URL=http://服务器IP:5173
VITE_API_BASE_URL=http://服务器IP:3001
VITE_APP_BASE_PATH=/
PORT=3001
```

如果你选择用 `frontend preview` 验证构建产物，则把上面的 `5173` 临时改成 `4173`。

修改 `VITE_API_BASE_URL`、`APP_WEB_BASE_URL`、`WECOM_WEB_BASE_URL` 后：

```text
使用 frontend dev 时：
  重启前端 dev 服务。

使用 frontend preview 或上产 Nginx 时：
  重新构建前端，再重启对应服务。
```

```bash
cd /home/liulonghai/AI-agent
set -a
. /home/liulonghai/AI-agent/shared/backend.env
set +a
pnpm build
```

### 4.2 手工启动后端，适合看实时错误

```bash
cd /home/liulonghai/AI-agent/backend

set -a
. /home/liulonghai/AI-agent/shared/backend.env
set +a

node dist/src/main.js
```

如果日志里看到类似内容，说明后端已经启动：

```text
Nest application successfully started
企业微信机器人入站监听已启用
Authentication successful
```

停止方式：

```text
按 Ctrl+C
```

### 4.3 后台启动后端，适合短期联调

```bash
cd /home/liulonghai/AI-agent/backend

set -a
. /home/liulonghai/AI-agent/shared/backend.env
set +a

nohup node dist/src/main.js >> /home/liulonghai/AI-agent/shared/logs/backend.log 2>&1 &
echo $! > /home/liulonghai/AI-agent/shared/backend.pid
```

查看日志：

```bash
tail -f /home/liulonghai/AI-agent/shared/logs/backend.log
```

停止后端：

```bash
if [ -f /home/liulonghai/AI-agent/shared/backend.pid ]; then
  kill "$(cat /home/liulonghai/AI-agent/shared/backend.pid)" 2>/dev/null || true
  rm -f /home/liulonghai/AI-agent/shared/backend.pid
fi
```

### 4.4 启动前端 dev，默认 5173

这是调试阶段最常用的前端启动方式，适合看页面问题、接口问题和样式问题。

```bash
cd /home/liulonghai/AI-agent

set -a
. /home/liulonghai/AI-agent/shared/backend.env
set +a

nohup pnpm --dir frontend dev --host 0.0.0.0 --port 5173 >> /home/liulonghai/AI-agent/shared/logs/frontend-dev.log 2>&1 &
echo $! > /home/liulonghai/AI-agent/shared/frontend-dev.pid
```

访问：

```text
http://服务器IP:5173/
```

停止前端 dev：

```bash
if [ -f /home/liulonghai/AI-agent/shared/frontend-dev.pid ]; then
  kill "$(cat /home/liulonghai/AI-agent/shared/frontend-dev.pid)" 2>/dev/null || true
  rm -f /home/liulonghai/AI-agent/shared/frontend-dev.pid
fi
```

如果你要验证构建后的 `frontend/dist`，可以额外使用 preview。注意，preview 不是调试主入口，它默认用于预览 build 产物。

```bash
cd /home/liulonghai/AI-agent

set -a
. /home/liulonghai/AI-agent/shared/backend.env
set +a

pnpm --dir frontend build
nohup pnpm --dir frontend preview --host 0.0.0.0 --port 4173 >> /home/liulonghai/AI-agent/shared/logs/frontend-preview.log 2>&1 &
echo $! > /home/liulonghai/AI-agent/shared/frontend-preview.pid
```

preview 访问：

```text
http://服务器IP:4173/
```

停止前端 preview：

```bash
if [ -f /home/liulonghai/AI-agent/shared/frontend-preview.pid ]; then
  kill "$(cat /home/liulonghai/AI-agent/shared/frontend-preview.pid)" 2>/dev/null || true
  rm -f /home/liulonghai/AI-agent/shared/frontend-preview.pid
fi
```

### 4.5 调试阶段验证清单

后端本机验证：

```bash
curl -i http://127.0.0.1:3001/api/v1/auth/session
```

前端本机验证：

```bash
curl -I http://127.0.0.1:5173/
```

浏览器验证：

```text
1. 打开 http://服务器IP:5173/。
2. 登录页面或工作台能正常加载。
3. 打开 CRM 智能分析页面。
4. 发起一个简单问题，例如“山东区域最近三个月商机情况”。
5. 确认页面能返回结果。
```

企业微信机器人验证：

```text
1. 在企业微信里向机器人提问。
2. 看 shared/logs/backend.log 是否收到消息。
3. 确认机器人能返回文字、表格摘要、图片报告或结果链接。
4. 点击结果链接，确认能打开 http://服务器IP:5173 下的页面。
```

CRM 和 AI 验证：

```text
1. CRM 标准 OpenAPI 能获取 token。
2. 六类对象查询能返回数据。
3. 当前企业微信用户能映射到联软 CRM 用户。
4. 当前角色权限能查询到预期范围的数据。
5. AI 网关能返回自然语言分析结果。
```

### 4.6 调试阶段常见问题

页面打不开：

```bash
ss -lntp | grep ':5173 ' || true
tail -n 100 /home/liulonghai/AI-agent/shared/logs/frontend-dev.log
```

后端打不开：

```bash
ss -lntp | grep ':3001 ' || true
tail -n 200 /home/liulonghai/AI-agent/shared/logs/backend.log
```

接口跨域或请求失败：

```text
检查 VITE_API_BASE_URL 是否是 http://服务器IP:3001。
如果使用 frontend dev，修改后重启前端 dev。
如果使用 frontend preview，修改后重新 pnpm build，并重启 frontend preview。
```

企业微信机器人不回复：

```bash
tail -n 300 /home/liulonghai/AI-agent/shared/logs/backend.log
cat /home/liulonghai/AI-agent/.runtime/wecom-bot-listener.lock 2>/dev/null || true
```

端口被占用：

```bash
ss -lntp | grep ':3001 ' || true
ss -lntp | grep ':5173 ' || true
ss -lntp | grep ':4173 ' || true
```

如果确认是自己的旧进程，再停止；不要随意杀公用服务器上不认识的进程。

## 5. 上产部署，正式长期使用

本章用于正式上线。原则是稳定、安全、可维护、不影响其他人。

### 5.1 上产推荐架构

```text
用户浏览器 / 企业微信卡片
        ↓
http://服务器IP:18080
        ↓
Nginx 独立配置
        ↓
frontend/dist 静态文件
        ↓
/api/ 代理到 127.0.0.1:3001
        ↓
backend 后端服务
        ↓
联软 CRM / AI 网关 / 企业微信接口
```

上产推荐端口：

```text
Nginx 对外入口：18080
后端 API：3001，只给本机 Nginx 转发
前端 preview：不使用
企业微信机器人：随后端一起启动，不单独占用 HTTP 端口
```

上产访问方式：

```text
http://服务器IP:18080/
```

### 5.2 为什么上产推荐独立 Nginx

可以把 Nginx 理解为“服务器门口的接待台”。外部用户先访问 Nginx，Nginx 再决定：

```text
访问页面文件：
  从 /home/liulonghai/AI-agent/frontend/dist 返回给浏览器。

访问 /api/ 接口：
  转发给本机后端 http://127.0.0.1:3001。

访问前端路由：
  返回 index.html，让 Vue 继续处理。
```

这样做的好处：

```text
1. 对外只有一个入口，浏览器和企业微信都访问 18080。
2. 页面和 API 同源，减少跨域问题。
3. 后端 3001 不直接暴露，安全性更好。
4. 企业微信卡片、图片报告、免登录结果页都可以统一用 APP_WEB_BASE_URL。
5. 公用服务器上只新增自己的 Nginx 配置，不改别人站点。
```

为什么不直接使用 `80/443`：

```text
80/443 是 HTTP/HTTPS 默认端口，公用服务器上经常已经被其他系统使用。
第一版推荐先用 18080 验证，不影响别人。
如果后续需要正式域名和 HTTPS，再和管理员一起规划 80/443。
```

### 5.3 上产前修改配置

编辑：

```bash
vi /home/liulonghai/AI-agent/shared/backend.env
```

上产推荐配置：

```bash
NODE_ENV=production
PORT=3001
APP_WEB_BASE_URL=http://服务器IP:18080
WECOM_WEB_BASE_URL=http://服务器IP:18080
VITE_API_BASE_URL=http://服务器IP:18080
VITE_APP_BASE_PATH=/
```

说明：

```text
APP_WEB_BASE_URL 是企业微信卡片和免登录结果页使用的地址。
VITE_API_BASE_URL 是前端页面调用接口使用的地址。
使用 Nginx 后，前端和 API 都走 http://服务器IP:18080。
浏览器不再直接访问 3001。
```

修改配置后重新构建：

```bash
cd /home/liulonghai/AI-agent
set -a
. /home/liulonghai/AI-agent/shared/backend.env
set +a
pnpm build
```

### 5.4 创建正式后端启停脚本

创建启动脚本：

```bash
cat > /home/liulonghai/AI-agent/shared/scripts/start-backend.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/liulonghai/AI-agent"
PID_FILE="$APP_DIR/shared/backend.pid"
LOG_FILE="$APP_DIR/shared/logs/backend.log"
ENV_FILE="$APP_DIR/shared/backend.env"

mkdir -p "$APP_DIR/shared/logs"

if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE" || true)"
  if [ -n "$OLD_PID" ] && ps -p "$OLD_PID" -o args= | grep -q "$APP_DIR/backend/dist/src/main.js"; then
    echo "后端已在运行，PID=$OLD_PID"
    exit 0
  fi
  echo "PID 文件指向的不是本项目后端进程，清理旧 PID 文件。"
  rm -f "$PID_FILE"
fi

cd "$APP_DIR/backend"

set -a
. "$ENV_FILE"
set +a

nohup node "$APP_DIR/backend/dist/src/main.js" >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "后端已启动，PID=$(cat "$PID_FILE")，日志：$LOG_FILE"
EOF

chmod +x /home/liulonghai/AI-agent/shared/scripts/start-backend.sh
```

创建停止脚本：

```bash
cat > /home/liulonghai/AI-agent/shared/scripts/stop-backend.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/liulonghai/AI-agent"
PID_FILE="$APP_DIR/shared/backend.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "未找到 PID 文件，后端可能未通过本脚本启动。"
  exit 0
fi

PID="$(cat "$PID_FILE" || true)"

if [ -z "$PID" ]; then
  rm -f "$PID_FILE"
  echo "PID 文件为空，已清理。"
  exit 0
fi

if ! ps -p "$PID" -o args= | grep -q "$APP_DIR/backend/dist/src/main.js"; then
  echo "PID=$PID 当前不像本项目后端进程，为避免误杀公用服务器上的其他服务，本次不停止。"
  rm -f "$PID_FILE"
  exit 0
fi

echo "正在停止后端，PID=$PID"
kill "$PID"

for i in $(seq 1 20); do
  if ! ps -p "$PID" >/dev/null 2>&1; then
    rm -f "$PID_FILE"
    echo "后端已停止。"
    exit 0
  fi
  sleep 1
done

echo "后端未在预期时间内退出，请检查日志后再决定是否手工处理。"
exit 1
EOF

chmod +x /home/liulonghai/AI-agent/shared/scripts/stop-backend.sh
```

创建状态脚本：

```bash
cat > /home/liulonghai/AI-agent/shared/scripts/status-backend.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/liulonghai/AI-agent"
PID_FILE="$APP_DIR/shared/backend.pid"

if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE" || true)"
  if [ -n "$PID" ] && ps -p "$PID" -o args= | grep -q "$APP_DIR/backend/dist/src/main.js"; then
    echo "后端运行中，PID=$PID"
    exit 0
  fi
  echo "PID 文件存在，但进程不匹配或已退出。"
  exit 1
fi

echo "后端未通过本脚本启动，未找到 PID 文件。"
exit 1
EOF

chmod +x /home/liulonghai/AI-agent/shared/scripts/status-backend.sh
```

正式启停：

```bash
# 启动
/home/liulonghai/AI-agent/shared/scripts/start-backend.sh

# 停止
/home/liulonghai/AI-agent/shared/scripts/stop-backend.sh

# 重启
/home/liulonghai/AI-agent/shared/scripts/stop-backend.sh
/home/liulonghai/AI-agent/shared/scripts/start-backend.sh

# 状态
/home/liulonghai/AI-agent/shared/scripts/status-backend.sh

# 日志
tail -f /home/liulonghai/AI-agent/shared/logs/backend.log
```

### 5.5 安全搭建独立 Nginx

确认 Nginx：

```bash
nginx -v
```

Rocky / CentOS 如未安装：

```bash
sudo dnf install -y nginx
```

Ubuntu / Debian 如未安装：

```bash
sudo apt update
sudo apt install -y nginx
```

如果服务器已有 Nginx 在跑，先备份当前配置：

```bash
sudo mkdir -p /root/nginx-backup
sudo nginx -T > /root/nginx-backup/nginx-before-ai-agent-$(date +%Y%m%d%H%M%S).conf
```

确认 `18080` 未被占用：

```bash
sudo ss -lntp | grep ':18080 ' || true
```

如果有输出，说明被占用，换成 `18081`、`18082` 等，并同步修改后续配置。

### 5.6 给 Nginx 读取前端静态文件的权限

确认 Nginx 运行用户：

```bash
grep -E '^user ' /etc/nginx/nginx.conf || true
```

常见用户是 `nginx` 或 `www-data`。

普通方式：

```bash
sudo chmod 711 /home/liulonghai
sudo chmod 711 /home/liulonghai/AI-agent
sudo chmod -R o+rX /home/liulonghai/AI-agent/frontend/dist
sudo chmod 700 /home/liulonghai/AI-agent/shared
sudo chmod 600 /home/liulonghai/AI-agent/shared/backend.env
```

更严格的 ACL 方式，以 `nginx` 用户为例：

```bash
sudo setfacl -m u:nginx:--x /home/liulonghai
sudo setfacl -m u:nginx:--x /home/liulonghai/AI-agent
sudo setfacl -R -m u:nginx:rX /home/liulonghai/AI-agent/frontend/dist
```

如果 Nginx 用户是 `www-data`，把命令里的 `nginx` 改成 `www-data`。

不要给这些文件放开权限：

```text
/home/liulonghai/AI-agent/shared/backend.env
/home/liulonghai/AI-agent/配置/
任何包含密钥、Token、数据库密码的文件
```

### 5.7 新增独立 Nginx 配置

创建配置文件：

```bash
sudo tee /etc/nginx/conf.d/liulonghai-ai-agent.conf >/dev/null <<'EOF'
upstream liulonghai_ai_agent_api {
    server 127.0.0.1:3001;
    keepalive 16;
}

server {
    listen 18080;
    server_name _;

    root /home/liulonghai/AI-agent/frontend/dist;
    index index.html;

    access_log /home/liulonghai/AI-agent/shared/logs/nginx.access.log;
    error_log  /home/liulonghai/AI-agent/shared/logs/nginx.error.log warn;

    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://liulonghai_ai_agent_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_connect_timeout 30s;
    }

    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
        try_files /index.html =404;
    }

    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF
```

检查配置并重载：

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx || sudo systemctl start nginx
```

如果系统不是 systemd，可以使用：

```bash
sudo nginx -s reload
```

### 5.8 防火墙放行上产端口

Rocky / CentOS：

```bash
sudo firewall-cmd --permanent --add-port=18080/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports
```

Ubuntu / Debian：

```bash
sudo ufw allow 18080/tcp
sudo ufw status
```

如果服务器在云平台或机房安全组后面，还需要在安全组里放行 `18080` 的内网访问。

### 5.9 上产启动和验证

启动或重启后端：

```bash
/home/liulonghai/AI-agent/shared/scripts/stop-backend.sh
/home/liulonghai/AI-agent/shared/scripts/start-backend.sh
```

本机验证 Nginx 静态页面：

```bash
curl -I http://127.0.0.1:18080/
```

本机验证 Nginx 代理后端：

```bash
curl -i http://127.0.0.1:18080/api/v1/auth/session
```

外部电脑验证：

```text
http://服务器IP:18080/
```

业务冒烟验证：

```text
1. 打开 http://服务器IP:18080/，确认页面正常加载。
2. 登录后打开 CRM 智能分析，确认接口不再跨域。
3. 通过企业微信机器人提问，确认能收到结果。
4. 点击企业微信卡片“查看结果 / 打开图片报告”，确认打开 http://服务器IP:18080 下的免登录结果页。
5. 查询联软 CRM 数据，确认当前角色权限范围和预期一致。
6. 查看 AI 分析报告，确认摘要、关键发现、表格、建议能正常生成。
```

### 5.10 上产回滚或停用

如果 Nginx 配置有问题，不要动别人的配置，只删除自己的独立配置：

```bash
sudo rm -f /etc/nginx/conf.d/liulonghai-ai-agent.conf
sudo nginx -t
sudo systemctl reload nginx
```

如果只是临时停用后端：

```bash
/home/liulonghai/AI-agent/shared/scripts/stop-backend.sh
```

如果要恢复前一个代码版本，优先恢复备份目录或重新拷贝旧版本代码，但不要删除：

```text
/home/liulonghai/AI-agent/shared/backend.env
/home/liulonghai/AI-agent/shared/.runtime
/home/liulonghai/AI-agent/shared/logs
```

## 6. 从 Windows 更新新版本

更新前先停止后端：

```bash
/home/liulonghai/AI-agent/shared/scripts/stop-backend.sh
```

备份关键目录：

```bash
cd /home/liulonghai
tar -czf "AI-agent-shared-backup-$(date +%Y%m%d%H%M%S).tar.gz" AI-agent/shared
```

覆盖代码时必须保留：

```text
/home/liulonghai/AI-agent/shared
/home/liulonghai/AI-agent/.runtime 软链
```

重新安装依赖和构建：

```bash
cd /home/liulonghai/AI-agent

rm -rf node_modules backend/node_modules frontend/node_modules
rm -rf backend/dist frontend/dist

set -a
. /home/liulonghai/AI-agent/shared/backend.env
set +a

pnpm install --frozen-lockfile
pnpm build
```

上产环境重新启动：

```bash
/home/liulonghai/AI-agent/shared/scripts/start-backend.sh
sudo nginx -t
sudo systemctl reload nginx
```

调试环境重新启动：

```bash
/home/liulonghai/AI-agent/shared/scripts/start-backend.sh
nohup pnpm --dir frontend dev --host 0.0.0.0 --port 5173 >> /home/liulonghai/AI-agent/shared/logs/frontend-dev.log 2>&1 &
echo $! > /home/liulonghai/AI-agent/shared/frontend-dev.pid
```

## 7. 企业微信机器人维护

企业微信机器人入站监听随后端一起启动，不是单独的 HTTP 端口服务。

启动成功时日志应包含：

```text
企业微信机器人入站监听已启用
Authentication successful
```

查看日志：

```bash
tail -f /home/liulonghai/AI-agent/shared/logs/backend.log
```

监听锁文件位置：

```text
/home/liulonghai/AI-agent/.runtime/wecom-bot-listener.lock
```

查看锁：

```bash
cat /home/liulonghai/AI-agent/.runtime/wecom-bot-listener.lock 2>/dev/null || true
```

如果后端异常退出，锁文件可能残留。确认没有本项目后端进程后，可以删除锁并重启：

```bash
ps -ef | grep 'backend/dist/src/main.js' | grep -v grep || true
rm -f /home/liulonghai/AI-agent/.runtime/wecom-bot-listener.lock
/home/liulonghai/AI-agent/shared/scripts/start-backend.sh
```

不要在未确认进程归属时删除其他人的锁或杀其他人的进程。

## 8. 日常维护速查

进入项目：

```bash
cd /home/liulonghai/AI-agent
```

启动后端：

```bash
/home/liulonghai/AI-agent/shared/scripts/start-backend.sh
```

停止后端：

```bash
/home/liulonghai/AI-agent/shared/scripts/stop-backend.sh
```

重启后端：

```bash
/home/liulonghai/AI-agent/shared/scripts/stop-backend.sh
/home/liulonghai/AI-agent/shared/scripts/start-backend.sh
```

查看状态：

```bash
/home/liulonghai/AI-agent/shared/scripts/status-backend.sh
```

查看后端日志：

```bash
tail -f /home/liulonghai/AI-agent/shared/logs/backend.log
```

查看 Nginx 日志：

```bash
tail -f /home/liulonghai/AI-agent/shared/logs/nginx.access.log
tail -f /home/liulonghai/AI-agent/shared/logs/nginx.error.log
```

查看端口：

```bash
ss -lntp | grep ':3001 ' || true
ss -lntp | grep ':5173 ' || true
ss -lntp | grep ':4173 ' || true
ss -lntp | grep ':18080 ' || true
```

重新构建：

```bash
cd /home/liulonghai/AI-agent
set -a
. /home/liulonghai/AI-agent/shared/backend.env
set +a
pnpm build
```

## 9. 常见问题

### 9.1 Linux 执行 `pnpm dev` 失败

原因：

```text
当前根级 dev 脚本偏 Windows PowerShell，不适合 Linux 生产。
```

处理：

```text
调试阶段：
  使用 node backend/dist/src/main.js 启动后端，再使用 pnpm --dir frontend dev 启动前端 5173。

上产部署：
  使用 node backend/dist/src/main.js 启动后端，前端交给 Nginx。
```

### 9.2 后端启动提示端口占用

检查：

```bash
ss -lntp | grep ':3001 ' || true
```

如果是自己的旧后端，执行：

```bash
/home/liulonghai/AI-agent/shared/scripts/stop-backend.sh
/home/liulonghai/AI-agent/shared/scripts/start-backend.sh
```

如果不是自己的进程，不要杀。可以临时修改 `PORT`，但要同步修改 Nginx 代理或前端 API 地址。

### 9.3 前端页面打开后接口失败

调试阶段检查：

```text
VITE_API_BASE_URL 是否是 http://服务器IP:3001。
后端 3001 是否正在运行。
服务器防火墙是否允许访问 3001。
```

上产部署检查：

```text
VITE_API_BASE_URL 是否是 http://服务器IP:18080。
Nginx /api/ 是否代理到 127.0.0.1:3001。
后端 3001 是否正在运行。
```

修改 `VITE_API_BASE_URL` 后：

```text
调试阶段使用 frontend dev：
  重启前端 dev。

上产部署或使用 frontend preview：
  必须重新构建前端。
```

```bash
cd /home/liulonghai/AI-agent
set -a
. /home/liulonghai/AI-agent/shared/backend.env
set +a
pnpm --dir frontend build
```

### 9.4 企业微信机器人不响应

检查顺序：

```text
1. 后端是否运行。
2. backend.log 是否有企业微信鉴权成功日志。
3. WECOM_BOT_ID / WECOM_BOT_SECRET 是否正确。
4. 服务器是否能访问企业微信 OpenAPI / WebSocket。
5. 是否存在残留监听锁。
6. CRM 数据源和 AI 网关是否导致处理阻塞。
```

命令：

```bash
/home/liulonghai/AI-agent/shared/scripts/status-backend.sh
tail -n 300 /home/liulonghai/AI-agent/shared/logs/backend.log
cat /home/liulonghai/AI-agent/.runtime/wecom-bot-listener.lock 2>/dev/null || true
```

### 9.5 图片或企业微信卡片点开空白

重点检查：

```text
APP_WEB_BASE_URL 必须是企业微信客户端能访问到的地址。
调试阶段通常是 http://服务器IP:5173。
如果临时使用 frontend preview 验证 dist，才是 http://服务器IP:4173。
上产部署通常是 http://服务器IP:18080。
```

如果已经上产，不要让企业微信卡片继续指向 `5173` 或 `4173`。

修改后：

```bash
cd /home/liulonghai/AI-agent
set -a
. /home/liulonghai/AI-agent/shared/backend.env
set +a
pnpm build
/home/liulonghai/AI-agent/shared/scripts/stop-backend.sh
/home/liulonghai/AI-agent/shared/scripts/start-backend.sh
```

### 9.6 Nginx 页面 403

优先检查权限：

```bash
ls -ld /home/liulonghai
ls -ld /home/liulonghai/AI-agent
ls -ld /home/liulonghai/AI-agent/frontend/dist
tail -n 100 /home/liulonghai/AI-agent/shared/logs/nginx.error.log
```

处理方向：

```text
Nginx 只需要读取 frontend/dist。
不要给 shared/backend.env 或配置目录放开权限。
```

### 9.7 Nginx 接口 502

502 通常表示 Nginx 找不到后端。

检查：

```bash
/home/liulonghai/AI-agent/shared/scripts/status-backend.sh
ss -lntp | grep ':3001 ' || true
tail -n 200 /home/liulonghai/AI-agent/shared/logs/backend.log
tail -n 100 /home/liulonghai/AI-agent/shared/logs/nginx.error.log
```

处理：

```bash
/home/liulonghai/AI-agent/shared/scripts/start-backend.sh
```

## 10. 备份和恢复

至少备份这些目录和文件：

```text
/home/liulonghai/AI-agent/shared/backend.env
/home/liulonghai/AI-agent/shared/.runtime
/home/liulonghai/AI-agent/shared/logs
```

备份命令：

```bash
cd /home/liulonghai
tar -czf "AI-agent-runtime-backup-$(date +%Y%m%d%H%M%S).tar.gz" AI-agent/shared
```

恢复时：

```text
1. 先停止后端。
2. 恢复 shared 目录。
3. 确认 .runtime 软链仍指向 shared/.runtime。
4. 重新加载配置并构建。
5. 启动后端。
6. 如果是上产部署，reload Nginx。
```

## 11. 管理员配合事项

调试阶段可能需要管理员配合：

```text
1. 安装 Node.js 20 和 pnpm。
2. 临时开放 3001 和 5173 的内网访问。
3. 如果要验证构建产物 preview，再临时开放 4173。
4. 确认服务器能访问联软 CRM、AI 网关、企业微信接口。
```

上产部署可能需要管理员配合：

```text
1. 安装或启用 Nginx。
2. 允许新增 /etc/nginx/conf.d/liulonghai-ai-agent.conf。
3. 开放 18080 的内网访问。
4. 如果需要正式域名和 HTTPS，再规划 80/443、证书和域名解析。
5. 如果要用 systemd 托管后端，再由管理员创建服务。
```

systemd 示例，仅供管理员参考：

```ini
[Unit]
Description=CRM Intelligent Analytics Backend
After=network.target

[Service]
Type=simple
User=liulonghai
WorkingDirectory=/home/liulonghai/AI-agent/backend
EnvironmentFile=/home/liulonghai/AI-agent/shared/backend.env
ExecStart=/usr/bin/node /home/liulonghai/AI-agent/backend/dist/src/main.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## 12. 一句话原则

```text
调试阶段：
  用 3001 后端 + 5173 前端 dev，目标是快速验证和排障。
  4173 只作为构建产物 preview 的可选验证端口。

上产部署：
  用 18080 Nginx + 3001 后端，目标是稳定、安全、不影响别人。
  上产不使用 5173 或 4173 对外提供服务。

长期规则：
  代码放 /home/liulonghai/AI-agent。
  配置放 shared/backend.env。
  运行数据放 shared/.runtime。
  日志放 shared/logs。
  Linux 生产不跑 pnpm dev。
  公用服务器不杀不认识的进程。
  企业微信卡片能否点开，关键看 APP_WEB_BASE_URL 是否是企业微信客户端能访问的地址。
```
