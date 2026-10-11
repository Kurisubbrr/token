#!/usr/bin/env bash
set -uo pipefail
source "$(dirname "$0")/env.sh"
"${TOKEN_ROOT}/deploy/apple-container.sh" status
backend_status=$?
if curl -fsS --max-time 5 http://127.0.0.1:3000/ >/dev/null; then
    printf 'frontend     healthy (http://localhost:3000)\n'
else
    printf 'frontend     stopped\n'
    exit 1
fi
exit "${backend_status}"
