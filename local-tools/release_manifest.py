#!/usr/bin/env python3
"""Release metadata and conservative startup migration compatibility fingerprint."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
from typing import Dict

MANIFEST_NAME = "RELEASE-MANIFEST.json"
MIGRATION_PATTERNS = (
    "backend/migrations/*.sql",
    "backend/migrations/migrations.go",
    "backend/internal/repository/migrations*.go",
    "backend/internal/repository/ent.go",
    "backend/internal/repository/security_secret_bootstrap.go",
    "backend/internal/repository/simple_mode*.go",
    "backend/internal/setup/*.go",
    "backend/cmd/server/*.go",
    "backend/ent/migrate/*.go",
    "backend/ent/schema/*.go",
    "backend/internal/repository/dashboard_aggregation_repo.go",
    "backend/internal/service/dashboard_aggregation_service.go",
)
REQUIRED_SOURCE_FILES = (
    "backend/migrations/migrations.go",
    "backend/internal/repository/migrations_runner.go",
    "backend/internal/repository/ent.go",
    "backend/internal/setup/setup.go",
    "backend/cmd/server/main.go",
)

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()

def migration_files(repo_root: Path) -> Dict[str, str]:
    """Hash exact file bytes. Keep new startup database writers in this gate."""
    repo_root = Path(repo_root).resolve()
    for relative in REQUIRED_SOURCE_FILES:
        if not (repo_root / relative).is_file():
            raise ValueError("缺少启动迁移源码: " + relative)
    paths = {
        path
        for pattern in MIGRATION_PATTERNS
        for path in repo_root.glob(pattern)
        if path.is_file() and not path.name.endswith("_test.go")
    }
    if not any(path.suffix == ".sql" for path in paths):
        raise ValueError("缺少 backend/migrations/*.sql")
    if any(path.is_symlink() for path in paths):
        raise ValueError("迁移源码不能使用符号链接")
    return {
        path.relative_to(repo_root).as_posix(): sha256_file(path)
        for path in sorted(paths, key=lambda item: item.relative_to(repo_root).as_posix())
    }

def migration_fingerprint(files: Dict[str, str]) -> str:
    canonical = json.dumps(
        files, sort_keys=True, separators=(",", ":"), ensure_ascii=True
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()

def source_commit(repo_root: Path) -> str:
    def git(*args):
        return subprocess.check_output(
            ["git"] + list(args), cwd=str(repo_root),
            universal_newlines=True, stderr=subprocess.PIPE
        ).strip()
    commit = git("rev-parse", "--verify", "HEAD")
    if git("status", "--porcelain", "--untracked-files=all"):
        raise ValueError("源码有未提交修改或未跟踪文件；请提交后重新打包")
    return commit

def package_files(package_dir: Path) -> Dict[str, str]:
    result = {}
    for path in sorted(package_dir.rglob("*")):
        relative = path.relative_to(package_dir).as_posix()
        if path.is_symlink():
            raise ValueError("部署包不能包含符号链接: " + relative)
        if path.is_dir():
            continue
        if not path.is_file():
            raise ValueError("部署包包含非普通文件: " + relative)
        if relative != MANIFEST_NAME:
            result[relative] = sha256_file(path)
    for required in ("token", "Dockerfile", "docker-compose.yml", "docker-entrypoint.sh", "BUILD-INFO.txt"):
        if required not in result:
            raise ValueError("部署包缺少文件: " + required)
    return result

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--fingerprint-only", action="store_true")
    parser.add_argument("--package-dir", type=Path)
    parser.add_argument("--version")
    parser.add_argument("--commit")
    parser.add_argument("--arch", choices=("amd64", "arm64"), default="amd64")
    args = parser.parse_args()
    try:
        repo_root = args.repo_root.resolve()
        migrations = migration_files(repo_root)
        fingerprint = migration_fingerprint(migrations)
        if args.fingerprint_only:
            print(fingerprint)
            return 0
        if args.package_dir is None or not args.version:
            parser.error("生成清单需要 --package-dir 和 --version")
        if not re.fullmatch(r"custom-v[0-9][A-Za-z0-9._-]{0,142}", args.version):
            raise ValueError("自定义版本必须为 custom-v*，且仅允许字母、数字、点、下划线和短横线")
        commit = source_commit(repo_root)
        if args.commit is not None and args.commit != commit:
            raise ValueError("构建期间 HEAD 已变化；请重新打包")
        package_dir = args.package_dir.resolve()
        if not package_dir.is_dir():
            raise ValueError("部署包目录不存在")
        manifest = {
            "schema_version": 1,
            "version": args.version,
            "commit": commit,
            "source_modified": False,
            "frontend": "embedded",
            "build_type": "source",
            "arch": args.arch,
            "migration_fingerprint": fingerprint,
            "migration_files": migrations,
            "files": package_files(package_dir),
        }
        (package_dir / MANIFEST_NAME).write_text(
            json.dumps(manifest, ensure_ascii=True, sort_keys=True, indent=2) + "\n",
            encoding="utf-8"
        )
        return 0
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        print("生成发布清单失败: " + str(exc), file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
