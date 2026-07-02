#!/usr/bin/env python3
"""将当前工作区源码打包上传到生产机，并按 release 目录切换上线。"""

from __future__ import annotations

import argparse
import getpass
import os
import posixpath
import subprocess
import sys
import tarfile
import tempfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable

import paramiko

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_APP_ROOT = "/srv/crm-intelligent-analytics"
DEFAULT_SERVICE_NAME = "crm-intelligent-analytics"
DEFAULT_APP_USER = "crmapp"
DEFAULT_APP_GROUP = "crmapp"
EXCLUDED_NAMES = {
    ".git",
    ".idea",
    ".vscode",
    "node_modules",
    "dist",
    "coverage",
    "__pycache__",
    ".pytest_cache",
    ".turbo",
}
EXCLUDED_RELATIVE_PATHS = {
    ".playwright-mcp",
    ".runtime",
    "output",
    "backend/.env.local",
    "backend/.env.development.local",
    "backend/.env.production.local",
    "frontend/.env.local",
    "frontend/.env.development.local",
    "frontend/.env.production.local",
}
EXCLUDED_FILE_SUFFIXES = {
    ".tgz",
    ".tar.gz",
    ".zip",
}


@dataclass
class DeployConfig:
    """封装本次发布所需的核心参数。"""

    host: str
    user: str
    password: str
    port: int
    release_name: str
    app_root: str
    service_name: str
    app_user: str
    app_group: str
    verify: bool
    keep_archive: bool

    @property
    def release_dir(self) -> str:
        return posixpath.join(self.app_root, "releases", self.release_name)

    @property
    def current_link(self) -> str:
        return posixpath.join(self.app_root, "current")

    @property
    def shared_env_file(self) -> str:
        return posixpath.join(self.app_root, "shared", "backend.env")

    @property
    def shared_runtime_dir(self) -> str:
        return posixpath.join(self.app_root, "shared", ".runtime")


def parse_args() -> DeployConfig:
    """解析命令行参数，并补齐交互式密码。"""

    parser = argparse.ArgumentParser(
        description="将当前工作区打包上传到生产环境并切换上线。",
    )
    parser.add_argument("--host", required=True, help="生产机地址，例如 10.10.3.241")
    parser.add_argument("--user", default="root", help="SSH 用户名，默认 root")
    parser.add_argument("--port", type=int, default=22, help="SSH 端口，默认 22")
    parser.add_argument(
        "--password",
        help="SSH 密码；未传时优先读取 CRM_DEPLOY_PASSWORD，再回退交互输入。",
    )
    parser.add_argument(
        "--release-name",
        default=datetime.now().strftime("%Y%m%d-%H%M%S"),
        help="发布版本目录名，默认按当前时间生成。",
    )
    parser.add_argument(
        "--app-root",
        default=DEFAULT_APP_ROOT,
        help=f"服务器发布根目录，默认 {DEFAULT_APP_ROOT}",
    )
    parser.add_argument(
        "--service-name",
        default=DEFAULT_SERVICE_NAME,
        help=f"systemd 服务名，默认 {DEFAULT_SERVICE_NAME}",
    )
    parser.add_argument(
        "--app-user",
        default=DEFAULT_APP_USER,
        help=f"发布目录所属用户，默认 {DEFAULT_APP_USER}",
    )
    parser.add_argument(
        "--app-group",
        default=DEFAULT_APP_GROUP,
        help=f"发布目录所属用户组，默认 {DEFAULT_APP_GROUP}",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="发布前先在本地执行 pnpm test 与 pnpm build。",
    )
    parser.add_argument(
        "--keep-archive",
        action="store_true",
        help="保留本地生成的临时 tar.gz，便于重复上传排障。",
    )
    args = parser.parse_args()

    password = args.password or os.environ.get("CRM_DEPLOY_PASSWORD")
    if not password:
        password = getpass.getpass("请输入 SSH 密码: ")

    return DeployConfig(
        host=args.host,
        user=args.user,
        password=password,
        port=args.port,
        release_name=args.release_name,
        app_root=args.app_root,
        service_name=args.service_name,
        app_user=args.app_user,
        app_group=args.app_group,
        verify=args.verify,
        keep_archive=args.keep_archive,
    )


def should_exclude(path: Path) -> bool:
    """判断某个路径是否应从发布包中排除。"""

    if path == REPO_ROOT:
        return False

    # 根目录下这类“公司 *.json”通常是本地临时导出的排障或分析文件，不应进入生产发布包。
    if (
        path.parent == REPO_ROOT
        and path.is_file()
        and path.suffix.lower() == ".json"
        and path.name != "package.json"
        and path.name.startswith("公司 ")
    ):
        return True

    relative_path = path.relative_to(REPO_ROOT).as_posix()
    if relative_path in EXCLUDED_RELATIVE_PATHS:
        return True
    if path.is_file() and any(path.name.endswith(suffix) for suffix in EXCLUDED_FILE_SUFFIXES):
        return True

    return any(part in EXCLUDED_NAMES for part in path.parts)


def iter_workspace_files() -> Iterable[Path]:
    """遍历当前工作区内应进入发布包的文件。"""

    for path in REPO_ROOT.rglob("*"):
        if should_exclude(path):
            continue
        if path.is_file():
            yield path


def create_archive(release_name: str) -> Path:
    """创建仅包含当前工作区源码的 tar.gz。"""

    archive_path = Path(tempfile.gettempdir()) / f"crm-{release_name}.tar.gz"
    with tarfile.open(archive_path, "w:gz") as tar:
        for file_path in iter_workspace_files():
            tar.add(file_path, arcname=file_path.relative_to(REPO_ROOT).as_posix())
    return archive_path


def run_local_verification() -> None:
    """在本地执行发布前验证，提前拦住明显不可上线的版本。"""

    commands = ["pnpm test", "pnpm build"]
    for command in commands:
        safe_print(f"$ {command}")
        subprocess.run(
            build_local_shell_command(command),
            cwd=REPO_ROOT,
            check=True,
        )


def build_local_shell_command(command: str) -> list[str]:
    """兼容 Windows 与类 Unix 环境，构造可执行的本地命令。"""

    if os.name == "nt":
        return [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            command,
        ]

    return ["bash", "-lc", command]


def connect_ssh(config: DeployConfig) -> paramiko.SSHClient:
    """建立 SSH 连接。"""

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=config.host,
        port=config.port,
        username=config.user,
        password=config.password,
        timeout=20,
        banner_timeout=20,
        auth_timeout=20,
    )
    return client


def exec_remote(
    client: paramiko.SSHClient,
    command: str,
    *,
    timeout: int = 1800,
) -> str:
    """执行远程命令，失败时直接抛错终止发布。"""

    safe_print(f"[remote] $ {command}")
    stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    output = stdout.read().decode("utf-8", errors="replace")
    error_output = stderr.read().decode("utf-8", errors="replace")
    if output.strip():
        safe_print(output.strip())
    if error_output.strip():
        safe_print(error_output.strip())
    if exit_code != 0:
        raise RuntimeError(f"远程命令执行失败: {command}")
    return output


def safe_print(message: str) -> None:
    """兼容 Windows 终端编码，避免日志中的特殊空白字符导致脚本中断。"""

    target_encoding = sys.stdout.encoding or "utf-8"
    normalized_message = message.encode(target_encoding, errors="replace").decode(
        target_encoding,
        errors="replace",
    )
    print(normalized_message)


def upload_archive(
    client: paramiko.SSHClient,
    archive_path: Path,
    config: DeployConfig,
) -> str:
    """上传本地发布包到服务器临时目录。"""

    remote_archive_path = posixpath.join("/tmp", archive_path.name)
    safe_print(f"上传发布包到 {remote_archive_path}")
    with client.open_sftp() as sftp:
        sftp.put(str(archive_path), remote_archive_path)
    return remote_archive_path


def deploy_archive(
    client: paramiko.SSHClient,
    config: DeployConfig,
    remote_archive_path: str,
) -> None:
    """在服务器侧解包、构建并切换 current。"""

    escaped_archive = remote_archive_path
    escaped_release_dir = config.release_dir
    escaped_app_root = config.app_root
    escaped_current_link = config.current_link
    escaped_env = config.shared_env_file
    escaped_runtime = config.shared_runtime_dir
    escaped_service_name = config.service_name
    escaped_app_user = config.app_user
    escaped_app_group = config.app_group

    remote_script = f"""set -euo pipefail
APP_ROOT="{escaped_app_root}"
RELEASE_DIR="{escaped_release_dir}"
CURRENT_LINK="{escaped_current_link}"
ENV_FILE="{escaped_env}"
RUNTIME_LINK="{escaped_runtime}"
ARCHIVE_PATH="{escaped_archive}"
APP_USER="{escaped_app_user}"
APP_GROUP="{escaped_app_group}"
SERVICE_NAME="{escaped_service_name}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "未找到环境变量文件：$ENV_FILE"
  exit 1
fi

mkdir -p "$APP_ROOT/releases"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
tar -xzf "$ARCHIVE_PATH" -C "$RELEASE_DIR"

cd "$RELEASE_DIR"
set -a
source "$ENV_FILE"
set +a
if [[ -z "${{VITE_API_BASE_URL:-}}" ]]; then
  export VITE_API_BASE_URL="${{APP_WEB_BASE_URL:-}}"
fi

pnpm install --frozen-lockfile --prod=false
pnpm build

rm -rf .runtime
ln -s "$RUNTIME_LINK" .runtime

cat > .release-meta <<'EOF'
release_name={config.release_name}
deployed_at={datetime.now().isoformat()}
source=workspace-archive
operator={config.user}@{config.host}
EOF

chown -R "$APP_USER:$APP_GROUP" "$RELEASE_DIR"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
chown -h "$APP_USER:$APP_GROUP" "$CURRENT_LINK"

systemctl restart "$SERVICE_NAME"
systemctl reload nginx
"""
    exec_remote(client, remote_script, timeout=3600)


def verify_remote_release(client: paramiko.SSHClient, config: DeployConfig) -> None:
    """执行发布后的基础验证，确认应用和 Nginx 均已接住流量。"""

    exec_remote(
        client,
        "for i in $(seq 1 20); do "
        "if curl -s -o /dev/null http://127.0.0.1:3001/; then exit 0; fi; "
        "sleep 2; "
        "done; "
        "echo '后端在 40 秒内未就绪'; exit 1",
        timeout=60,
    )
    verification_commands = [
        f"systemctl is-active {config.service_name}",
        "systemctl is-active nginx",
        f"readlink -f {config.current_link}",
        f"curl -I -s http://{config.host}/ | head -n 5",
        "curl -I -s http://127.0.0.1:3001/ | head -n 5",
        "curl -I -s http://127.0.0.1/api/v1/auth/wecom/callback | head -n 5",
    ]
    for command in verification_commands:
        exec_remote(client, command, timeout=60)


def cleanup_local_archive(archive_path: Path) -> None:
    """删除本地临时打包文件，避免长期堆积。"""

    if archive_path.exists():
        archive_path.unlink()


def main() -> None:
    """主流程：校验、本地打包、上传、线上发布、回收临时文件。"""

    config = parse_args()
    archive_path: Path | None = None
    client: paramiko.SSHClient | None = None
    remote_archive_path: str | None = None

    try:
        if config.verify:
            run_local_verification()

        archive_path = create_archive(config.release_name)
        safe_print(f"本地发布包已生成：{archive_path}")

        client = connect_ssh(config)
        remote_archive_path = upload_archive(client, archive_path, config)
        deploy_archive(client, config, remote_archive_path)
        verify_remote_release(client, config)

        safe_print("发布完成。")
        safe_print(f"版本目录：{config.release_dir}")
    finally:
        if client and remote_archive_path:
            try:
                exec_remote(client, f"rm -f {remote_archive_path}", timeout=60)
            except Exception:
                safe_print(f"警告：未能删除远程临时包 {remote_archive_path}")
        if client:
            client.close()
        if archive_path and not config.keep_archive:
            cleanup_local_archive(archive_path)


if __name__ == "__main__":
    main()
