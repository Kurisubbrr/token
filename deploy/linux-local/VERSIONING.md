# 自定义版本更新与回退

本流程从自己的 GitHub 仓库构建自定义程序。前端与后端一起打包，构建类型始终为 source，不调用上游 GoReleaser，也不使用官方程序覆盖定制。

## 当前线上基线

首次建立版本管理时，保存线上完整二进制、运行资源、部署文件、镜像标识和校验值，并另行保存数据库与应用数据备份。基线用于恢复当前线上程序。

如果原 BUILD-INFO.txt 记录 source_modified=true，表示构建时有未提交修改。已有 Git 提交无法精确重建该程序；完整保留线上二进制可以回退，但不能声称已经找回那些未提交源码。今后发布只接受干净、已提交的源码，记录完整提交号。

GitHub 保存源码和不含凭据的部署材料。公开仓库不保存 .env、数据库、Redis、应用卷、用户文件或密钥。这些内容保存在服务器受限备份目录。

## 发布新版本

修改源码、完成检查并提交后，创建未使用的 custom-v* 标签，例如：

    git tag custom-v0.2.15-20261020.1
    git push origin main
    git push origin custom-v0.2.15-20261020.1

Custom release 工作流安装 pnpm 9、Node 20 和 backend/go.mod 要求的 Go，重新构建前端并嵌入 Linux amd64 程序，生成部署包、SHA256 和 RELEASE-MANIFEST.json，再发布同名 GitHub Release。发布不覆盖，修正后使用新标签。也可手动运行工作流并指定已有 custom-v* 标签。

自定义版本只允许字母、数字、点、下划线和短横线，不允许加号。不要手动对自定义版本运行旧 Release 工作流，它使用 BuildType=release 的上游发布流程。

本地或服务器源码构建的命令相同：

    cd frontend
    pnpm install --frozen-lockfile
    cd ..
    VERSION=custom-v0.2.15-20261020.1 ./local-tools/package-linux.sh --arch amd64

默认输出到源码目录旁的 release-artifacts/。可用 --output 指定仓库外的输出目录。脚本拒绝未提交修改、未跟踪文件及跳过前端重建。

## 日常操作

    tokenctl status
    tokenctl list
    tokenctl backup
    tokenctl update custom-v0.2.15-20261020.1
    tokenctl rollback

status 查看当前版本与运行状态；list 查看本机保存的版本；backup 创建数据与配置备份；update <tag> 获取校验后的自定义版本；rollback 回到上一个版本。指定已保存版本使用 tokenctl rollback <release-id>，离线包使用 tokenctl update /绝对路径/部署包.tar.gz。

更新和回退保留共享 .env、固定 Compose 项目名及原命名数据卷。不要重新运行 init-env.sh 生成生产密钥，不要改变 COMPOSE_PROJECT_NAME、删除数据卷或运行 docker compose down -v。PostgreSQL 与 Redis 主版本升级单独安排。

更新前备份并保存原程序；新版本健康检查失败时恢复原程序。程序回退继续使用当前数据，不自动覆盖用户更新后的记录。数据恢复是单独的维护操作，必须确认备份时间、停止业务写入并核对恢复范围。

## 数据库兼容性保护

应用启动时自动执行数据库迁移。旧程序无法撤销迁移，因此自动更新及自动回退只允许迁移指纹相同的版本。SQL、迁移执行器、安装初始化、启动种子、Ent 模型或分区维护代码变化时停止操作，先在隔离数据库副本验证，再安排专门升级。

migration_files 保存以下文件的仓库相对路径与原始字节 SHA256：

- backend/migrations/*.sql 和 migrations.go；
- 迁移执行器、InitEnt、密钥初始化及简易模式种子；
- internal/setup、cmd/server、ent/schema、ent/migrate 下的非测试 Go 文件；
- 仪表盘分区维护的服务和仓库源码。

路径按字典序排列，以 json.dumps(files, sort_keys=True, separators=(',', ':'), ensure_ascii=True) 的 UTF-8 字节计算 SHA256，不附加换行，得到 migration_fingerprint。这是保守检查，不保证所有业务变更可逆。新增启动时修改数据库的代码时，必须同步扩充指纹范围。

    python3 local-tools/release_manifest.py --fingerprint-only

该命令只输出指纹，兼容服务器 Python 3.6。生成清单时还会要求源码干净。files 覆盖部署包内全部普通文件（清单自身除外），files["token"] 为程序校验值。

数据库 schema_migrations 的 SQL 校验值依照执行器对内容去除首尾空白后计算，与发布清单对原始文件字节的校验不同。建立初始基线时须另行核对线上数据库迁移记录，不能只看版本号。
