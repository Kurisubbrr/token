#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/env.sh"
if launchctl print "gui/${UID}/org.local.token.frontend" >/dev/null 2>&1; then
    launchctl bootout "gui/${UID}/org.local.token.frontend"
fi
"${TOKEN_ROOT}/deploy/apple-container.sh" down
printf '本地前端与后端已停止，数据库和文件已保留。\n'
