#!/bin/sh
# Run on the destination Linux server; never reuse development credentials.
set -eu
DEPLOY_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
DEPLOY_ENV="$DEPLOY_DIR/.env"
DEPLOY_TEMP=""
umask 077

if [ "$#" -gt 1 ]; then
  printf '用法: ./init-env.sh [管理员邮箱]\n' >&2
  exit 2
fi
if [ -e "$DEPLOY_ENV" ] || [ -L "$DEPLOY_ENV" ]; then
  printf '.env 已存在，未改动任何密码或密钥。\n'
  exit 0
fi
if [ ! -f "$DEPLOY_DIR/.env.example" ]; then
  printf '缺少 .env.example，请在完整解压的部署目录执行。\n' >&2
  exit 1
fi

random_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    od -An -N "$1" -tx1 /dev/urandom | tr -d ' \n'
  fi
}

DEPLOY_EMAIL="${1:-admin-$(random_hex 6)@token.local}"
case "$DEPLOY_EMAIL" in
  *[!a-zA-Z0-9@._+-]*|*@*@*|@*|*@|.*|*.)
    printf '邮箱含不支持的字符，请使用常规邮箱地址。\n' >&2
    exit 2
    ;;
  *@*.*) ;;
  *) printf '请输入有效管理员邮箱。\n' >&2; exit 2 ;;
esac
DEPLOY_PG_PASSWORD="$(random_hex 32)"
DEPLOY_REDIS_PASSWORD="$(random_hex 32)"
DEPLOY_JWT_SECRET="$(random_hex 32)"
DEPLOY_TOTP_KEY="$(random_hex 32)"
DEPLOY_ADMIN_PASSWORD="$(random_hex 24)"
DEPLOY_TEMP="$(mktemp "$DEPLOY_DIR/.env.init.XXXXXX")"
trap 'if [ -n "$DEPLOY_TEMP" ]; then rm -f -- "$DEPLOY_TEMP"; fi' 0
trap 'exit 1' 1 2 3 15
sed \
  -e "s/__GENERATE_POSTGRES_PASSWORD__/$DEPLOY_PG_PASSWORD/g" \
  -e "s/__GENERATE_REDIS_PASSWORD__/$DEPLOY_REDIS_PASSWORD/g" \
  -e "s/__GENERATE_JWT_SECRET__/$DEPLOY_JWT_SECRET/g" \
  -e "s/__GENERATE_TOTP_ENCRYPTION_KEY__/$DEPLOY_TOTP_KEY/g" \
  -e "s/__GENERATE_ADMIN_EMAIL__/$DEPLOY_EMAIL/g" \
  -e "s/__GENERATE_ADMIN_PASSWORD__/$DEPLOY_ADMIN_PASSWORD/g" \
  "$DEPLOY_DIR/.env.example" > "$DEPLOY_TEMP"
chmod 600 "$DEPLOY_TEMP"
# Hard-link creation is atomic and refuses to overwrite a concurrently made .env.
if ! ln "$DEPLOY_TEMP" "$DEPLOY_ENV" 2>/dev/null; then
  printf '.env 已被其他进程创建，未覆盖。\n' >&2
  exit 1
fi
printf '已生成独立服务器 .env（权限 600）；管理员账号及密码保存在其中。\n'
printf '启动前按需修改 .env，然后执行 docker compose up -d --build。\n'
