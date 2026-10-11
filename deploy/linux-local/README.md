# 自定义前后端的 Linux 部署包

部署包中的 `token` 已嵌入本次构建的前端，包含邮箱/手机号注册和三级账号权限的后端功能。服务器不需要安装 Node.js、pnpm 或 Go。`BUILD-INFO.txt` 记录源代码提交、版本、构建时间和 CPU 架构。包内没有本地开发密码、数据库或用户数据。

## 在本地打包

修改 `frontend/src/` 后，在项目根目录执行：

```sh
./local-tools/package-linux.sh --arch all
```

默认输出到项目旁的 `release-artifacts/`，每个架构包含 `.tar.gz` 和 `.sha256`。也可选择 `--arch amd64` 或 `--arch arm64`。脚本每次重新构建前端并跨编译后端，不依赖官方预编译程序。

## 首次部署到 Linux

服务器需要 Docker Engine 和 Docker Compose v2，以及访问 Docker 镜像仓库和 Alpine 软件仓库的网络。先在服务器运行 `uname -m`：`x86_64` 选 amd64 包，`aarch64`/`arm64` 选 arm64 包。上传匹配的压缩包和校验文件，在同一目录执行：

```sh
sha256sum -c token-custom-版本-linux-架构-时间.tar.gz.sha256
tar -xzf token-custom-版本-linux-架构-时间.tar.gz
cd token-custom-版本-linux-架构-时间
./init-env.sh your-admin@example.com
# 编辑 .env，设置实际监听地址、端口等。
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 token
curl -f http://127.0.0.1:8080/health
```

文件名中的“版本、架构、时间”请替换为实际文件名。`init-env.sh` 不传邮箱时会生成一个随机管理员登录邮箱；管理员密码在 `.env` 的 `ADMIN_PASSWORD`。该脚本只创建不存在的 `.env`，再次执行会保留原来的配置与密钥。

首次创建的账号是超级管理员；升级已有数据库时，最早的有效管理员会自动升级为超级管理员，保留原有登录信息。首次进入后台需要管理员本人确认上游的合规承诺。在系统设置开启注册后，登录按钮下方会显示注册入口，用户可使用邮箱加密码或手机号加密码注册。手机注册接受中国大陆 11 位号码以及 `+86`、`0086` 前缀，不发送短信、不标记手机号已验证。

新注册账号始终为普通用户。超级管理员通过“用户管理 → 编辑 → 角色”将普通用户提升为管理员，或将管理员降级为普通用户。普通管理员没有角色升降权限，也不能修改其他管理员账号；系统设置、备份、插件和更新由超级管理员管理。

普通用户菜单固定为仪表盘、API 密钥、使用记录、我的订阅、兑换、邀请返利、个人资料、充值中心（无手续费）。渠道状态及监控接口仅对管理员开放。充值采用项目自带的站内流程，订单查询入口位于充值中心。

未开启支付或邀请返利时，相应入口显示服务尚未开放。启用实际收款需配置自己的支付渠道、商户凭据、公网域名及支付回调；充值手续费率保持为 `0` 即不收取站内手续费。邀请返利需先确认比例及规则，再由超级管理员开启。

简易模式下，订阅和兑换入口保留，页面显示服务尚未开放，不触发相应业务操作。

默认绑定服务器 `127.0.0.1:8080`，可通过服务器上的 Nginx/Caddy 反向代理访问。需要通过服务器 IP 直接访问时，在 `.env` 设置 `BIND_HOST=0.0.0.0`，并放行所配置的 `SERVER_PORT`。数据库和 Redis 只供容器内部访问。

应用镜像名为 `token-custom:local`，由包内二进制构建；`pull_policy: never` 防止拉取官方镜像覆盖自定义页面。PostgreSQL 18 和 Redis 8 使用独立持久化卷。

## 更新自定义页面

在本地再次打包，上传并解压新包。将原部署目录的 `.env` 复制到新目录（保持权限 600），然后在新目录执行：

```sh
docker compose up -d --build
docker compose ps
curl -f http://127.0.0.1:8080/health
```

保持相同的 `COMPOSE_PROJECT_NAME`，容器会继续使用原有数据卷。更新前先做好备份，不要删除卷，也不要使用 `docker compose down -v`。只停止服务可执行 `docker compose down`。管理员已创建后，修改 `.env` 的 `ADMIN_PASSWORD` 不会重设现有账号密码，请在管理页面修改。

后续更新继续使用这里的源码打包流程。自定义程序标记为 `source` 构建，管理页面会显示源码模式提示并隐藏官方一键更新按钮；容器中的程序文件和程序目录由 root 持有，数据目录可写，运行用户无法通过官方更新接口替换自定义程序。数据库主版本升级与项目功能升级需要分别按上游升级说明处理。

## 文件说明

`Dockerfile`、`docker-compose.yml` 和 `init-env.sh` 是部署模板；应在生成的压缩包解压目录运行，不直接在仓库的 `deploy/linux-local/` 构建。`backend/resources/` 保留运行时定价等资源，`LICENSE` 保留项目许可证，`docker-entrypoint.sh` 沿用上游数据目录权限处理。
