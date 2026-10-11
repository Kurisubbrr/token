#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/env.sh"

if ! container system status >/dev/null 2>&1; then
    container system start --install-root "${CONTAINER_INSTALL_ROOT}" \
        --app-root "${CONTAINER_APP_ROOT}" --enable-kernel-install
fi
"${TOKEN_ROOT}/deploy/apple-container.sh" up

"${TOKEN_ROOT}/local-tools/start-frontend.sh"
for attempt in {1..30}; do
    if curl -fsS --max-time 3 http://127.0.0.1:3000/ >/dev/null; then
        printf '\n前端编辑预览：http://localhost:3000\n后端服务：http://localhost:8080\n登录信息：%s/.dev/admin-credentials.txt\n' "${TOKEN_ROOT}"
        exit 0
    fi
    sleep 1
done
printf 'Frontend did not become ready. Check .dev/frontend.log.\n' >&2
exit 1
