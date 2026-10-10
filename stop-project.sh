#!/bin/bash
# 仅关闭 start-project.sh 管理的三个服务及其子进程。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec "$ROOT/start-project.sh" --stop
