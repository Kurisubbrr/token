#!/usr/bin/env bash
# Build clean, committed custom source with the current frontend embedded.
set -euo pipefail
TASK_SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
TASK_REPO_DIR="$(CDPATH= cd -- "$TASK_SCRIPT_DIR/.." && pwd)"
TASK_WORKSPACE_DIR="$(CDPATH= cd -- "$TASK_REPO_DIR/.." && pwd)"
TASK_ARCH="all"
TASK_OUTPUT_DIR="$TASK_WORKSPACE_DIR/release-artifacts"
TASK_STAGE=""
TASK_KEEP_FILE=""
usage() {
  cat <<'EOF'
用法: ./local-tools/package-linux.sh [--arch amd64|arm64|all] [--output 目录]
每次重新构建前端，只接受已提交的干净源码和 custom-v* 版本。
可用 GO_BIN、PNPM_BIN 指定工具路径，VERSION 指定 custom-v* 版本号。
EOF
}
while [ "$#" -gt 0 ]; do
  case "$1" in
    --arch|--output)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then usage >&2; exit 2; fi
      if [ "$1" = "--arch" ]; then TASK_ARCH="$2"; else TASK_OUTPUT_DIR="$2"; fi
      shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) printf '未知参数: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done
case "$TASK_ARCH" in
  amd64|arm64) TASK_ARCHES=("$TASK_ARCH") ;;
  all) TASK_ARCHES=(amd64 arm64) ;;
  *) printf '架构只能为 amd64、arm64 或 all。\n' >&2; exit 2 ;;
esac
repo_git() { (cd "$TASK_REPO_DIR" && git "$@"); }
TASK_COMMIT="$(repo_git rev-parse --verify HEAD)"
if [ -n "$(repo_git status --porcelain --untracked-files=all)" ]; then
  printf '源码有未提交修改或未跟踪文件；请提交后重新打包。\n' >&2; exit 1
fi
TASK_VERSION="${VERSION:-$(repo_git describe --tags --exact-match --match 'custom-v*' 2>/dev/null || true)}"
if ! [[ "$TASK_VERSION" =~ ^custom-v[0-9][a-zA-Z0-9._-]{0,142}$ ]]; then
  printf '自定义版本必须为 custom-v*，仅允许字母、数字、点、下划线和短横线。\n' >&2; exit 1
fi
command -v python3 >/dev/null 2>&1 || { printf '生成清单需要 Python 3。\n' >&2; exit 1; }
if [ -n "${GO_BIN:-}" ]; then
  TASK_GO_BIN="$GO_BIN"
elif [ -x "$TASK_WORKSPACE_DIR/runtime/go/bin/go" ]; then
  TASK_GO_BIN="$TASK_WORKSPACE_DIR/runtime/go/bin/go"
else
  TASK_GO_BIN="$(command -v go || true)"
fi
if [ -z "$TASK_GO_BIN" ] || [ ! -x "$TASK_GO_BIN" ]; then
  printf '找不到 Go，请安装 go.mod 要求的版本或设置 GO_BIN。\n' >&2; exit 1
fi
export GOPATH="${GOPATH:-$TASK_WORKSPACE_DIR/runtime-data/go}"
export GOMODCACHE="${GOMODCACHE:-$GOPATH/pkg/mod}"
export GOCACHE="${GOCACHE:-$TASK_WORKSPACE_DIR/runtime-data/go-build}"
export GOTOOLCHAIN="${GOTOOLCHAIN:-local}"
TASK_REQUIRED_GO="$(awk '$1 == "go" { print $2; exit }' "$TASK_REPO_DIR/backend/go.mod")"
TASK_GO_VERSION="$("$TASK_GO_BIN" env GOVERSION)"
if ! awk -v actual="${TASK_GO_VERSION#go}" -v required="$TASK_REQUIRED_GO" 'BEGIN {
  split(actual,a,"."); split(required,r,".");
  for(i=1;i<=3;i++){ if((a[i]+0)>(r[i]+0))exit 0; if((a[i]+0)<(r[i]+0))exit 1; }
  exit 0;
}'; then
  printf 'Go 版本过低，当前 %s，需要 %s 或更新。\n' "$TASK_GO_VERSION" "$TASK_REQUIRED_GO" >&2; exit 1
fi
if [ -n "${PNPM_BIN:-}" ]; then
  TASK_PNPM_BIN="$PNPM_BIN"
elif [ -x "$TASK_WORKSPACE_DIR/runtime/node-tools/node_modules/.bin/pnpm" ]; then
  TASK_PNPM_BIN="$TASK_WORKSPACE_DIR/runtime/node-tools/node_modules/.bin/pnpm"
else
  TASK_PNPM_BIN="$(command -v pnpm || true)"
fi
if [ -z "$TASK_PNPM_BIN" ] || [ ! -x "$TASK_PNPM_BIN" ]; then
  printf '找不到 pnpm 9，请安装依赖或设置 PNPM_BIN。\n' >&2; exit 1
fi
export PATH="$(dirname -- "$TASK_PNPM_BIN"):$PATH"
case "$("$TASK_PNPM_BIN" --version)" in
  9.*) ;;
  *) printf '项目要求 pnpm 9。\n' >&2; exit 1 ;;
esac
mkdir -p "$TASK_OUTPUT_DIR"
TASK_OUTPUT_DIR="$(CDPATH= cd -- "$TASK_OUTPUT_DIR" && pwd)"
case "$TASK_OUTPUT_DIR" in
  "$TASK_REPO_DIR"|"$TASK_REPO_DIR"/*)
    printf '输出目录必须位于源码仓库外。\n' >&2; exit 1 ;;
esac
TASK_STAGE="$(mktemp -d "$TASK_OUTPUT_DIR/.token-package.XXXXXX")"
cleanup() {
  if [ -n "$TASK_KEEP_FILE" ] && [ -f "$TASK_KEEP_FILE" ]; then
    mkdir -p "$TASK_REPO_DIR/backend/internal/web/dist"
    cp "$TASK_KEEP_FILE" "$TASK_REPO_DIR/backend/internal/web/dist/.keep"
  fi
  if [ -n "$TASK_STAGE" ] && [ -d "$TASK_STAGE" ]; then rm -rf -- "$TASK_STAGE"; fi
}
trap cleanup EXIT
if [ -f "$TASK_REPO_DIR/backend/internal/web/dist/.keep" ]; then
  TASK_KEEP_FILE="$TASK_STAGE/frontend-dist.keep"
  cp "$TASK_REPO_DIR/backend/internal/web/dist/.keep" "$TASK_KEEP_FILE"
fi
printf '构建当前前端…\n'
(cd "$TASK_REPO_DIR/frontend" && "$TASK_PNPM_BIN" run build)
if [ -n "$TASK_KEEP_FILE" ]; then cp "$TASK_KEEP_FILE" "$TASK_REPO_DIR/backend/internal/web/dist/.keep"; fi
if [ ! -s "$TASK_REPO_DIR/backend/internal/web/dist/index.html" ]; then
  printf '缺少前端构建结果 index.html。\n' >&2; exit 1
fi
TASK_BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
TASK_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TASK_LDFLAGS="-s -w -X main.Version=$TASK_VERSION -X main.Commit=$TASK_COMMIT -X main.Date=$TASK_BUILD_DATE -X main.BuildType=source"
for TASK_TARGET in "${TASK_ARCHES[@]}"; do
  TASK_NAME="token-custom-$TASK_VERSION-linux-$TASK_TARGET-$TASK_STAMP"
  TASK_PACKAGE_DIR="$TASK_STAGE/$TASK_NAME"
  mkdir -p "$TASK_PACKAGE_DIR/backend"
  (
    cd "$TASK_REPO_DIR/backend"
    CGO_ENABLED=0 GOOS=linux GOARCH="$TASK_TARGET" "$TASK_GO_BIN" build \
      -tags embed -trimpath -ldflags="$TASK_LDFLAGS" -o "$TASK_PACKAGE_DIR/token" ./cmd/server
  )
  chmod 755 "$TASK_PACKAGE_DIR/token"
  cp -R "$TASK_REPO_DIR/backend/resources" "$TASK_PACKAGE_DIR/backend/resources"
  for TASK_FILE in Dockerfile docker-compose.yml .env.example init-env.sh README.md VERSIONING.md; do
    cp "$TASK_REPO_DIR/deploy/linux-local/$TASK_FILE" "$TASK_PACKAGE_DIR/$TASK_FILE"
  done
  cp "$TASK_REPO_DIR/deploy/docker-entrypoint.sh" "$TASK_PACKAGE_DIR/docker-entrypoint.sh"
  cp "$TASK_REPO_DIR/LICENSE" "$TASK_PACKAGE_DIR/LICENSE"
  if [ -f "$TASK_REPO_DIR/NOTICE" ]; then cp "$TASK_REPO_DIR/NOTICE" "$TASK_PACKAGE_DIR/NOTICE"; fi
  chmod 755 "$TASK_PACKAGE_DIR/init-env.sh" "$TASK_PACKAGE_DIR/docker-entrypoint.sh"
  printf 'version=%s\ncommit=%s\nsource_modified=false\nbuilt_at=%s\nos=linux\narch=%s\nfrontend=embedded\nbuild_type=source\n' \
    "$TASK_VERSION" "$TASK_COMMIT" "$TASK_BUILD_DATE" "$TASK_TARGET" > "$TASK_PACKAGE_DIR/BUILD-INFO.txt"
  printf '.env\n*.env\ndata\npostgres_data\nredis_data\n' > "$TASK_PACKAGE_DIR/.dockerignore"
  python3 "$TASK_REPO_DIR/local-tools/release_manifest.py" --repo-root "$TASK_REPO_DIR" \
    --package-dir "$TASK_PACKAGE_DIR" --version "$TASK_VERSION" --commit "$TASK_COMMIT" --arch "$TASK_TARGET"
  TASK_ARCHIVE="$TASK_OUTPUT_DIR/$TASK_NAME.tar.gz"
  if [ -e "$TASK_ARCHIVE" ]; then printf '目标已存在，未覆盖: %s\n' "$TASK_ARCHIVE" >&2; exit 1; fi
  COPYFILE_DISABLE=1 tar -czf "$TASK_STAGE/$TASK_NAME.tar.gz" -C "$TASK_STAGE" "$TASK_NAME"
  mv "$TASK_STAGE/$TASK_NAME.tar.gz" "$TASK_ARCHIVE"
  (
    cd "$TASK_OUTPUT_DIR"
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum "$TASK_NAME.tar.gz" > "$TASK_NAME.tar.gz.sha256"
    else
      shasum -a 256 "$TASK_NAME.tar.gz" > "$TASK_NAME.tar.gz.sha256"
    fi
  )
  printf '已生成: %s\n' "$TASK_ARCHIVE"
done
