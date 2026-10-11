#!/usr/bin/env bash
# Build and install the current source into the local Linux app container.
set -euo pipefail
source "$(dirname "$0")/env.sh"
export GOPATH="${GOPATH:-${TOKEN_WORKSPACE}/runtime-data/go}"
export GOMODCACHE="${GOMODCACHE:-${GOPATH}/pkg/mod}"
export GOCACHE="${GOCACHE:-${TOKEN_WORKSPACE}/runtime-data/go-build}"
export GOTOOLCHAIN="${GOTOOLCHAIN:-local}"

if [[ "${1:-}" != "--skip-frontend" ]]; then
    (cd "${TOKEN_ROOT}/frontend" && pnpm run build)
fi
if [[ ! -s "${TOKEN_ROOT}/backend/internal/web/dist/index.html" ]]; then
    printf 'Frontend build is missing; run this script without --skip-frontend.\n' >&2
    exit 1
fi
version="$("${TOKEN_ROOT}/backend/scripts/resolve-version.sh")"
commit="$(git -C "${TOKEN_ROOT}" rev-parse HEAD)"
build_date="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
binary="${TOKEN_ROOT}/.dev/token-linux-arm64"
printf 'Building backend from the current source…\n'
(
    cd "${TOKEN_ROOT}/backend"
    CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -tags embed -trimpath \
        -ldflags="-s -w -X main.Version=${version} -X main.Commit=${commit} -X main.Date=${build_date} -X main.BuildType=source" \
        -o "${binary}.new" ./cmd/server
)
mv "${binary}.new" "${binary}"
if ! container inspect token-apple >/dev/null 2>&1; then
    printf 'Start the local environment with local-tools/start.command first.\n' >&2
    exit 1
fi
container exec -i token-apple sh -c 'cat > /app/storage/runtime/token.next' < "${binary}"
expected_hash="$(shasum -a 256 "${binary}" | awk '{print $1}')"
actual_hash="$(container exec token-apple sha256sum /app/storage/runtime/token.next | awk '{print $1}')"
if [[ "${expected_hash}" != "${actual_hash}" ]]; then
    printf 'Backend transfer checksum failed; the running binary was not replaced.\n' >&2
    exit 1
fi
container exec token-apple sh -c '
set -e
chown token:token /app/storage/runtime/token.next
chmod 755 /app/storage/runtime/token.next
cp /app/storage/runtime/token /app/storage/runtime/token.previous
mv /app/storage/runtime/token.next /app/storage/runtime/token
'
container stop --time 30 token-apple >/dev/null
container start token-apple >/dev/null
for attempt in {1..90}; do
    if curl -fsS --max-time 3 http://127.0.0.1:8080/health >/dev/null; then
        printf 'Source backend is running: http://localhost:8080\n'
        exit 0
    fi
    sleep 1
done
container logs -n 40 token-apple >&2
printf 'The source backend did not become healthy. The previous binary is preserved.\n' >&2
exit 1
