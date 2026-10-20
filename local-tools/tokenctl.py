#!/usr/bin/env python3
"""Private, conservative single-host release manager (Python 3.6+).

Operational data stays on this host. A normal rollback never restores a database.
"""
from __future__ import print_function

import argparse
import contextlib
import datetime
import fcntl
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request


ROOT = '/opt/token-ops'
MAX_ARCHIVE = 1024 * 1024 * 1024
MAX_UNPACKED = 2 * MAX_ARCHIVE
REPOSITORY = 'Kurisubbrr/token'
VOLUMES = {'app_data': 'token-custom_app_data',
           'postgres_data': 'token-custom_postgres_data',
           'redis_data': 'token-custom_redis_data'}
CONTAINERS = {'token': 'token-custom-token-1',
              'postgres': 'token-custom-postgres-1',
              'redis': 'token-custom-redis-1'}
DESTINATIONS = {'token': ('app_data', '/app/data'),
                'postgres': ('postgres_data', '/var/lib/postgresql'),
                'redis': ('redis_data', '/data')}
ALLOWED_HOSTS = {'api.github.com', 'github.com', 'objects.githubusercontent.com',
                 'release-assets.githubusercontent.com',
                 'github-releases.githubusercontent.com'}
SHA256 = re.compile(r'^[a-f0-9]{64}$')
IDENTIFIER = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$')
ASSET = re.compile(r'^token-custom-[A-Za-z0-9._-]*linux-amd64[A-Za-z0-9._-]*\.tar\.gz$')


class OpsError(Exception):
    pass


def private_dir(path):
    os.makedirs(path, mode=0o700, exist_ok=True)
    if os.path.islink(path) or not os.path.isdir(path):
        raise OpsError('Private directory is unsafe.')
    os.chmod(path, 0o700)


def private_file(path):
    if os.path.islink(path):
        raise OpsError('A private file must not be a symbolic link.')
    os.chmod(path, 0o600)


def atomic_json(path, value):
    private_dir(os.path.dirname(path))
    fd, temporary = tempfile.mkstemp(prefix='.write-', dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            os.fchmod(stream.fileno(), 0o600)
            json.dump(value, stream, ensure_ascii=True, indent=2, sort_keys=True)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        directory_fd = os.open(os.path.dirname(path), os.O_RDONLY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def load_json(path):
    try:
        if os.path.islink(path):
            raise OpsError('Private JSON file must not be a symbolic link.')
        with open(path, 'r', encoding='utf-8') as stream:
            return json.load(stream)
    except (ValueError, IOError):
        raise OpsError('Required operational JSON is missing or invalid: ' + os.path.basename(path))


def digest(path):
    result = hashlib.sha256()
    with open(path, 'rb') as stream:
        while True:
            chunk = stream.read(1024 * 1024)
            if not chunk:
                break
            result.update(chunk)
    return result.hexdigest()


def valid_id(value):
    if not isinstance(value, str) or not IDENTIFIER.match(value):
        raise OpsError('Invalid release identifier.')
    return value


def timestamp():
    return datetime.datetime.utcnow().strftime('%Y%m%dT%H%M%S%fZ')


def execute(args, stdout=None):
    """Never propagate subprocess output: it may contain rendered credentials."""
    try:
        # Compose gives shell variables precedence over --env-file. Never inherit
        # deployment settings or an unexpected DOCKER_HOST from the caller.
        environment = {'PATH': '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
                       'HOME': '/root', 'LANG': 'C', 'LC_ALL': 'C',
                       'DOCKER_HOST': 'unix:///var/run/docker.sock'}
        result = subprocess.run(args, stdout=stdout or subprocess.PIPE,
                                stderr=subprocess.PIPE, timeout=1800, env=environment)
    except (OSError, subprocess.TimeoutExpired):
        raise OpsError('An operational command failed or timed out: ' + args[0])
    if result.returncode:
        raise OpsError('An operational command failed: ' + args[0])
    return result.stdout or b''


def json_output(raw):
    try:
        return json.loads(raw.decode('utf-8') if isinstance(raw, bytes) else raw)
    except (ValueError, UnicodeError):
        raise OpsError('An operational command returned invalid JSON.')


def verify_checksum(archive, checksum):
    if not os.path.isfile(archive) or os.path.islink(archive):
        raise OpsError('Release archive is missing or unsafe.')
    if os.path.getsize(archive) > MAX_ARCHIVE:
        raise OpsError('Release archive exceeds the 1 GiB limit.')
    if not os.path.isfile(checksum) or os.path.islink(checksum) or os.path.getsize(checksum) > 8192:
        raise OpsError('A safe matching .sha256 file is required.')
    with open(checksum, 'r', encoding='ascii') as stream:
        lines = [line.strip() for line in stream if line.strip()]
    if len(lines) != 1:
        raise OpsError('Checksum file must contain exactly one digest.')
    match = re.match(r'^([a-fA-F0-9]{64})(?:\s+[* ]?(.+))?$', lines[0])
    if not match or (match.group(2) and match.group(2) != os.path.basename(archive)):
        raise OpsError('Checksum filename does not match the release archive.')
    value = digest(archive)
    if value != match.group(1).lower():
        raise OpsError('Release archive SHA-256 verification failed.')
    return value


def safe_relative(name):
    if not isinstance(name, str) or not name or '\\' in name or '\x00' in name or name.startswith('/'):
        raise OpsError('Unsafe archive path.')
    pieces = name.split('/')
    if '..' in pieces:
        raise OpsError('Archive path traversal is forbidden.')
    pieces = [piece for piece in pieces if piece not in ('', '.')]
    if not pieces:
        raise OpsError('Empty archive path.')
    if any(piece == '.env' or piece.startswith('.env.') and piece != '.env.example'
           or piece in ('.git', '.ssh') or piece.endswith(('.key', '.pem'))
           for piece in pieces):
        raise OpsError('Release archive contains a secret or private operational file.')
    return '/'.join(pieces)


def safe_extract(archive, destination):
    """Extract only regular files/directories into a newly created private folder."""
    private_dir(destination)
    if os.listdir(destination):
        raise OpsError('Archive destination must be empty.')
    try:
        with tarfile.open(archive, 'r:gz') as bundle:
            checked, seen, roots, total = [], set(), set(), 0
            for member in bundle:
                if len(checked) >= 10000:
                    raise OpsError('Release archive contains too many entries.')
                if not member.isdir() and not member.isreg():
                    raise OpsError('Archive links, devices and special files are forbidden.')
                if getattr(member, 'sparse', None):
                    raise OpsError('Sparse archive members are forbidden.')
                relative = safe_relative(member.name)
                if relative in seen:
                    raise OpsError('Duplicate archive path.')
                seen.add(relative)
                roots.add(relative.split('/')[0])
                total += member.size
                if total > MAX_UNPACKED or member.size < 0:
                    raise OpsError('Unpacked release exceeds the size limit.')
                checked.append((member, relative))
            if len(roots) != 1:
                raise OpsError('Release archive must contain one top-level directory.')
            for member, relative in checked:
                target = os.path.join(destination, *relative.split('/'))
                if member.isdir():
                    private_dir(target)
                else:
                    private_dir(os.path.dirname(target))
                    source = bundle.extractfile(member)
                    with source, open(target, 'xb') as output:
                        os.fchmod(output.fileno(), 0o600)
                        shutil.copyfileobj(source, output, 1024 * 1024)
            result = os.path.join(destination, next(iter(roots)))
            if not os.path.isdir(result):
                raise OpsError('Release root is not a directory.')
            return result
    except (tarfile.TarError, EOFError, OSError):
        raise OpsError('Release archive could not be safely extracted.')


def validate_manifest(directory, current):
    manifest = load_json(os.path.join(directory, 'RELEASE-MANIFEST.json'))
    required = {'schema_version': 1, 'source_modified': False,
                'frontend': 'embedded', 'build_type': 'source', 'arch': 'amd64'}
    if not isinstance(manifest, dict) or any(manifest.get(key) != value for key, value in required.items()):
        raise OpsError('Release must be a clean, embedded-frontend Linux amd64 source build.')
    if manifest.get('source_modified') is not False:
        raise OpsError('Dirty source releases are forbidden.')
    valid_id(manifest.get('version'))
    if not re.match(r'^[a-f0-9]{40}$', manifest.get('commit', '')):
        raise OpsError('Release must record a full source commit.')
    migration_files = manifest.get('migration_files')
    if not isinstance(migration_files, dict) or not migration_files:
        raise OpsError('Release is missing its migration compatibility inventory.')
    for name, value in migration_files.items():
        safe_relative(name)
        if not isinstance(value, str) or not SHA256.match(value):
            raise OpsError('Invalid migration compatibility inventory.')
    calculated = hashlib.sha256(json.dumps(migration_files, sort_keys=True,
                                           separators=(',', ':'), ensure_ascii=True).encode('utf-8')).hexdigest()
    if manifest.get('migration_fingerprint') != calculated:
        raise OpsError('Migration compatibility fingerprint is invalid.')
    if calculated != current.get('migration_fingerprint'):
        raise OpsError('Database compatibility changed. Automatic update/rollback is blocked; use a reviewed migration plan.')
    files = manifest.get('files')
    if not isinstance(files, dict) or not {'token', 'Dockerfile', 'docker-entrypoint.sh', 'BUILD-INFO.txt'}.issubset(files):
        raise OpsError('Release file inventory is incomplete.')
    found = set()
    for path, directories, names in os.walk(directory):
        for name in names:
            full_path = os.path.join(path, name)
            relative = os.path.relpath(full_path, directory).replace(os.sep, '/')
            if relative == 'RELEASE-MANIFEST.json':
                continue
            safe_relative(relative)
            if os.path.islink(full_path) or not os.path.isfile(full_path):
                raise OpsError('Release contains an unsafe file.')
            found.add(relative)
            if not isinstance(files.get(relative), str) or not SHA256.match(files[relative]) or digest(full_path) != files[relative]:
                raise OpsError('Release file inventory/hash verification failed.')
    if found != set(files):
        raise OpsError('Release file inventory does not match the archive contents.')
    return manifest


def checked_url(url):
    parsed = urllib.parse.urlsplit(url)
    if (parsed.scheme != 'https' or parsed.hostname not in ALLOWED_HOSTS
            or parsed.username or parsed.password or parsed.port not in (None, 443)):
        raise OpsError('Download URL must use an approved GitHub HTTPS host.')
    return url


def checked_proxy(proxy):
    if proxy is None:
        return None
    if not isinstance(proxy, str) or any(character.isspace() for character in proxy):
        raise OpsError('Download proxy must be an approved local HTTP endpoint.')
    try:
        parsed = urllib.parse.urlsplit(proxy)
        allowed = (parsed.scheme == 'http'
                   and parsed.hostname in ('127.0.0.1', 'localhost', '172.17.0.1')
                   and parsed.port == 7890
                   and parsed.username is None and parsed.password is None
                   and parsed.path in ('', '/') and not parsed.query and not parsed.fragment)
    except ValueError:
        allowed = False
    if not allowed:
        raise OpsError('Download proxy must be an approved local HTTP endpoint.')
    return proxy


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        checked_url(newurl)
        return super(SafeRedirect, self).redirect_request(request, fp, code, msg, headers, newurl)


def download(url, destination, limit, proxy=None):
    checked_url(url)
    checked_proxy(proxy)
    handlers = [SafeRedirect()]
    if proxy is not None:
        handlers.insert(0, urllib.request.ProxyHandler({'http': proxy, 'https': proxy}))
    opener = urllib.request.build_opener(*handlers)
    request = urllib.request.Request(url, headers={'User-Agent': 'tokenctl/1', 'Accept': 'application/vnd.github+json'})
    try:
        with opener.open(request, timeout=60) as response, open(destination, 'xb') as output:
            checked_url(response.geturl())
            os.fchmod(output.fileno(), 0o600)
            total = 0
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > limit:
                    raise OpsError('GitHub download exceeds its size limit.')
                output.write(chunk)
    except (urllib.error.URLError, OSError, ValueError):
        raise OpsError('GitHub download failed. No running release was changed.')


class TokenOps(object):
    def __init__(self, root=ROOT, runner=execute, sleeper=time.sleep):
        self.root, self.run, self.sleep = root, runner, sleeper
        self.config = load_json(os.path.join(root, 'config.json'))
        self.check_config()
        private_dir(root)
        for name in ('releases', 'backups', 'downloads'):
            private_dir(os.path.join(root, name))

    def check_config(self):
        fixed = {'repository': REPOSITORY, 'project': 'token-custom',
                 'compose_file': ROOT + '/compose.yml', 'env_file': ROOT + '/shared/.env',
                 'release_root': '/opt/token-releases', 'current_link': '/opt/token-deploy',
                 'app_container': CONTAINERS['token'], 'postgres_container': CONTAINERS['postgres'],
                 'redis_container': CONTAINERS['redis'], 'volumes': VOLUMES}
        if any(self.config.get(key) != value for key, value in fixed.items()):
            raise OpsError('Operational configuration does not match the fixed production identity.')
        if self.config.get('health_url') not in ('http://127.0.0.1:8080/health', 'http://localhost:8080/health'):
            raise OpsError('Health URL must be the fixed local application endpoint.')
        checked_proxy(self.config.get('download_proxy'))

    @contextlib.contextmanager
    def lock(self):
        path = os.path.join(self.root, 'operation.lock')
        if os.path.islink(path):
            raise OpsError('Unsafe lock file.')
        with open(path, 'a+') as stream:
            os.fchmod(stream.fileno(), 0o600)
            try:
                fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except IOError:
                raise OpsError('Another tokenctl operation is already running.')
            try:
                yield
            finally:
                fcntl.flock(stream, fcntl.LOCK_UN)

    def state(self):
        value = load_json(os.path.join(self.root, 'state.json'))
        if not isinstance(value, dict) or not isinstance(value.get('history'), list):
            raise OpsError('Operational state is invalid.')
        valid_id(value.get('current'))
        if value.get('previous') is not None:
            valid_id(value['previous'])
        for identifier in value['history']:
            valid_id(identifier)
        return value

    def record(self, identifier):
        valid_id(identifier)
        value = load_json(os.path.join(self.root, 'releases', identifier + '.json'))
        if value.get('id') != identifier:
            raise OpsError('Release record identity mismatch.')
        directory = value.get('directory', '')
        release_root = self.config['release_root']
        if not directory.startswith(release_root + '/') or os.path.realpath(directory) != directory:
            raise OpsError('Release directory is unsafe.')
        if not SHA256.match(value.get('binary_sha256', '')) or not SHA256.match(value.get('migration_fingerprint', '')):
            raise OpsError('Release record is incomplete.')
        if not value.get('image', '').startswith('token-custom:') or not re.match(r'^sha256:[a-f0-9]{64}$', value.get('image_id', '')):
            raise OpsError('Release image identity is invalid.')
        return value

    def inspect(self):
        raw = self.run(['docker', 'inspect'] + [CONTAINERS[name] for name in ('token', 'postgres', 'redis')])
        values = json_output(raw)
        return dict((item.get('Name', '').lstrip('/'), item) for item in values)

    def validate_runtime(self, current=None, require_running=True, allow_stopped_app=False):
        values = self.inspect()
        for service, name in CONTAINERS.items():
            item = values.get(name)
            if not item:
                raise OpsError('Required production container is missing.')
            labels = item.get('Config', {}).get('Labels') or {}
            if labels.get('com.docker.compose.project') != self.config['project'] or labels.get('com.docker.compose.service') != service:
                raise OpsError('Container Compose identity does not match production.')
            logical, destination = DESTINATIONS[service]
            mounts = item.get('Mounts', [])
            if len(mounts) != 1 or mounts[0].get('Type') != 'volume' or mounts[0].get('Name') != VOLUMES[logical] or mounts[0].get('Destination') != destination:
                raise OpsError('Production data volume identity does not match; operation stopped.')
            if require_running and not item.get('State', {}).get('Running') and not (service == 'token' and allow_stopped_app):
                raise OpsError('A required production container is not running.')
        if current:
            if values[CONTAINERS['token']].get('Image') != current['image_id']:
                raise OpsError('Running image differs from the recorded release.')
            if os.path.realpath(self.config['current_link']) != current['directory']:
                raise OpsError('Current release link differs from operational state.')
        return values

    def compose(self, override=None):
        args = ['docker', 'compose', '-p', self.config['project'],
                '--env-file', self.config['env_file'], '-f', self.config['compose_file']]
        if override:
            args += ['-f', override]
        return args

    def validate_compose(self, rendered, image):
        services = rendered.get('services', {})
        if set(services) != set(CONTAINERS) or rendered.get('name') != self.config['project']:
            raise OpsError('Compose project/services identity is unsafe.')
        if set(rendered.get('volumes', {})) != set(VOLUMES):
            raise OpsError('Compose must declare only the three production data volumes.')
        for logical, actual in VOLUMES.items():
            if rendered.get('volumes', {}).get(logical, {}).get('name') != actual:
                raise OpsError('Compose named volumes do not match production.')
        for service in CONTAINERS:
            logical, destination = DESTINATIONS[service]
            mounts = services[service].get('volumes', [])
            if len(mounts) != 1 or mounts[0].get('type') != 'volume' or mounts[0].get('source') != logical or mounts[0].get('target') != destination:
                raise OpsError('Compose service volume mappings are unsafe.')
        if services['token'].get('image') != image:
            raise OpsError('Compose application image differs from requested release.')

    def health(self, current, attempts=90):
        for unused in range(attempts):
            try:
                values = self.validate_runtime(current)
                item = values[CONTAINERS['token']]
                status = item.get('State', {}).get('Health', {}).get('Status')
                if status == 'healthy':
                    # Local health checks must never pass through an inherited proxy.
                    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
                    with opener.open(self.config['health_url'], timeout=5) as response:
                        if response.status == 200:
                            return
            except (OpsError, urllib.error.URLError, OSError):
                pass
            self.sleep(2)
        raise OpsError('Application health verification failed.')

    def backup(self, allow_unhealthy_app=False):
        state = self.state()
        current = self.record(state['current'])
        runtime = self.validate_runtime(current, allow_stopped_app=allow_unhealthy_app)
        was_running = runtime[CONTAINERS['token']].get('State', {}).get('Running')
        destination = os.path.join(self.root, 'backups', timestamp() + '-' + current['id'])
        private_dir(destination)
        atomic_json(os.path.join(destination, 'backup.json'), {'complete': False, 'release': current['id']})
        stopped = False
        redis_path = '/tmp/tokenctl-' + timestamp() + '.rdb'
        try:
            if was_running:
                stopped = True
                self.run(['docker', 'stop', '--time', '60', CONTAINERS['token']])
            commands = [('postgres.dump', 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'),
                        ('postgres-globals.sql', 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_dumpall -U "$POSTGRES_USER" --globals-only')]
            for filename, command in commands:
                with open(os.path.join(destination, filename), 'xb') as output:
                    os.fchmod(output.fileno(), 0o600)
                    self.run(['docker', 'exec', CONTAINERS['postgres'], 'sh', '-ec', command], stdout=output)
            with open(os.path.join(destination, 'postgres.dump'), 'rb') as stream:
                if stream.read(5) != b'PGDMP':
                    raise OpsError('PostgreSQL backup format validation failed.')
            volume = json_output(self.run(['docker', 'volume', 'inspect', VOLUMES['app_data']]))
            if len(volume) != 1 or volume[0].get('Name') != VOLUMES['app_data'] or not os.path.isdir(volume[0].get('Mountpoint', '')):
                raise OpsError('Application volume source is invalid.')
            with tarfile.open(os.path.join(destination, 'app-data.tar.gz'), 'w:gz') as archive:
                archive.add(volume[0]['Mountpoint'], arcname='app_data', recursive=True)
            private_file(os.path.join(destination, 'app-data.tar.gz'))
            self.run(['docker', 'exec', CONTAINERS['redis'], 'redis-cli', '--rdb', redis_path])
            redis_backup = os.path.join(destination, 'redis.rdb')
            self.run(['docker', 'cp', CONTAINERS['redis'] + ':' + redis_path, redis_backup])
            private_file(redis_backup)
            with open(redis_backup, 'rb') as stream:
                if stream.read(5) != b'REDIS':
                    raise OpsError('Redis backup format validation failed.')
            for source, filename in [(self.config['env_file'], 'shared.env'),
                                     (self.config['compose_file'], 'compose.yml'),
                                     (os.path.join(self.root, 'config.json'), 'config.json'),
                                     (os.path.join(self.root, 'state.json'), 'state.json')]:
                shutil.copyfile(source, os.path.join(destination, filename))
                private_file(os.path.join(destination, filename))
            legacy_env = os.path.join(current['directory'], '.env')
            if os.path.isfile(legacy_env):
                shutil.copyfile(legacy_env, os.path.join(destination, 'legacy-release.env'))
                private_file(os.path.join(destination, 'legacy-release.env'))
            atomic_json(os.path.join(destination, 'release.json'), current)
            recovery_path = os.path.join(self.root, 'recovery-required.json')
            if os.path.isfile(recovery_path):
                shutil.copyfile(recovery_path, os.path.join(destination, 'previous-recovery.json'))
                private_file(os.path.join(destination, 'previous-recovery.json'))
        finally:
            try:
                self.run(['docker', 'exec', CONTAINERS['redis'], 'rm', '-f', redis_path])
            except OpsError:
                pass
            if stopped:
                self.run(['docker', 'start', CONTAINERS['token']])
        if not allow_unhealthy_app:
            self.health(current)
        files = {}
        for filename in sorted(os.listdir(destination)):
            if filename != 'backup.json':
                path = os.path.join(destination, filename)
                private_file(path)
                files[filename] = digest(path)
        atomic_json(os.path.join(destination, 'backup.json'),
                    {'complete': True, 'release': current['id'], 'created_at': timestamp(), 'files': files})
        return destination

    def fetch_release(self, tag):
        if not tag or len(tag) > 150 or '/' in tag or '\\' in tag:
            raise OpsError('Invalid GitHub release tag.')
        destination = os.path.join(self.root, 'downloads', timestamp())
        private_dir(destination)
        metadata_path = os.path.join(destination, 'release.json')
        api = 'https://api.github.com/repos/' + REPOSITORY + '/releases/tags/' + urllib.parse.quote(tag, safe='')
        download(api, metadata_path, 4 * 1024 * 1024, proxy=self.config.get('download_proxy'))
        metadata = load_json(metadata_path)
        if metadata.get('tag_name') != tag or metadata.get('draft'):
            raise OpsError('GitHub release identity is invalid.')
        assets = metadata.get('assets', [])
        candidates = [item for item in assets if ASSET.match(item.get('name', ''))]
        if len(candidates) != 1:
            raise OpsError('Release must contain exactly one custom Linux amd64 archive.')
        archive_asset = candidates[0]
        checksum_assets = [item for item in assets if item.get('name') == archive_asset['name'] + '.sha256']
        if len(checksum_assets) != 1:
            raise OpsError('GitHub release is missing its matching SHA-256 asset.')
        for asset, limit in ((archive_asset, MAX_ARCHIVE), (checksum_assets[0], 8192)):
            url = asset.get('browser_download_url', '')
            parsed = urllib.parse.urlsplit(checked_url(url))
            expected_prefix = '/' + REPOSITORY + '/releases/download/'
            if parsed.hostname != 'github.com' or not parsed.path.startswith(expected_prefix):
                raise OpsError('Release asset belongs to an unexpected repository.')
            download(url, os.path.join(destination, asset['name']), limit, proxy=self.config.get('download_proxy'))
        return os.path.join(destination, archive_asset['name'])

    def prepare(self, source, current):
        archive = source if os.path.isfile(source) else self.fetch_release(source)
        if not archive.endswith('.tar.gz'):
            raise OpsError('A .tar.gz release archive is required.')
        archive_sha = verify_checksum(archive, archive + '.sha256')
        release_root = self.config['release_root']
        private_dir(release_root)
        stage = tempfile.mkdtemp(prefix='.staging-', dir=release_root)
        os.chmod(stage, 0o700)
        extracted = safe_extract(archive, stage)
        manifest = validate_manifest(extracted, current)
        identifier = valid_id('v' + manifest['version'].lstrip('v') + '-' + timestamp() + '-' + manifest['files']['token'][:12])
        destination = os.path.join(release_root, identifier)
        os.rename(extracted, destination)
        os.rmdir(stage)
        image = 'token-custom:' + identifier
        self.run(['docker', 'build', '--pull=false', '-t', image, destination])
        raw_image_id = self.run(['docker', 'image', 'inspect', '--format', '{{.Id}}', image])
        image_id = raw_image_id.decode('ascii').strip()
        if not re.match(r'^sha256:[a-f0-9]{64}$', image_id):
            raise OpsError('New Docker image identity is invalid.')
        record = {'id': identifier, 'directory': destination, 'image': image,
                  'image_id': image_id, 'binary_sha256': manifest['files']['token'],
                  'migration_fingerprint': manifest['migration_fingerprint'],
                  'archive_sha256': archive_sha, 'commit': manifest['commit'],
                  'created_at': timestamp()}
        atomic_json(os.path.join(self.root, 'releases', identifier + '.json'), record)
        return record

    def link(self, directory):
        target = self.config['current_link']
        if os.path.lexists(target) and not os.path.islink(target):
            raise OpsError('Current deployment path must be a symbolic link.')
        temporary = target + '.next-' + str(os.getpid())
        if os.path.lexists(temporary):
            raise OpsError('Temporary deployment link already exists.')
        try:
            os.symlink(directory, temporary)
            os.replace(temporary, target)
        finally:
            if os.path.lexists(temporary):
                os.unlink(temporary)

    def apply(self, record):
        image_id = self.run(['docker', 'image', 'inspect', '--format', '{{.Id}}', record['image']]).decode('ascii').strip()
        if image_id != record['image_id']:
            raise OpsError('Stored release image changed or is missing.')
        if digest(os.path.join(record['directory'], 'token')) != record['binary_sha256']:
            raise OpsError('Stored release binary checksum changed.')
        fd, override = tempfile.mkstemp(prefix='.image-', suffix='.json', dir=self.root)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                os.fchmod(stream.fileno(), 0o600)
                json.dump({'services': {'token': {'image': record['image'], 'build': None}}}, stream)
            command = self.compose(override)
            rendered = json_output(self.run(command + ['config', '--format', 'json']))
            self.validate_compose(rendered, record['image'])
            self.link(record['directory'])
            self.run(command + ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', 'token'])
            self.health(record)
        finally:
            if os.path.exists(override):
                os.unlink(override)

    def transition(self, target, operation):
        state = self.state()
        current = self.record(state['current'])
        if target['migration_fingerprint'] != current['migration_fingerprint']:
            raise OpsError('Database compatibility changed; automatic rollback/update is blocked.')
        allow_unhealthy_app = operation == 'rollback'
        self.validate_runtime(current, allow_stopped_app=allow_unhealthy_app)
        backup = self.backup(allow_unhealthy_app=allow_unhealthy_app)
        try:
            self.apply(target)
            updated = {'current': target['id'], 'previous': current['id'],
                       'history': state['history'] + [target['id']], 'updated_at': timestamp()}
            atomic_json(os.path.join(self.root, 'state.json'), updated)
            recovery_path = os.path.join(self.root, 'recovery-required.json')
            if os.path.lexists(recovery_path):
                os.unlink(recovery_path)
        except BaseException:
            try:
                self.apply(current)
                atomic_json(os.path.join(self.root, 'state.json'), state)
            except BaseException:
                atomic_json(os.path.join(self.root, 'recovery-required.json'),
                            {'old': current['id'], 'attempted': target['id'], 'backup': backup,
                             'operation': operation, 'created_at': timestamp()})
                raise OpsError('Deployment and automatic recovery failed. State and backup were preserved; inspect recovery-required.json.')
            raise OpsError('Deployment failed; the previous application version was restored. Database contents were not restored.')
        return {'current': target['id'], 'previous': current['id'], 'backup': backup}

    def update(self, source):
        state = self.state()
        current = self.record(state['current'])
        self.validate_runtime(current)
        target = self.prepare(source, current)
        return self.transition(target, 'update')

    def rollback(self, identifier=None):
        state = self.state()
        identifier = identifier or state.get('previous')
        if not identifier:
            raise OpsError('No previous release is recorded.')
        if identifier == state['current']:
            raise OpsError('Requested version is already current.')
        return self.transition(self.record(identifier), 'rollback')

    def status(self):
        state = self.state()
        current = self.record(state['current'])
        values = self.validate_runtime(current)
        return {'current': current['id'], 'previous': state.get('previous'),
                'image': current['image'], 'binary_sha256': current['binary_sha256'],
                'migration_fingerprint': current['migration_fingerprint'],
                'health': values[CONTAINERS['token']].get('State', {}).get('Health', {}).get('Status'),
                'volumes': VOLUMES, 'recovery_required': os.path.exists(os.path.join(self.root, 'recovery-required.json'))}

    def list_releases(self):
        state = self.state()
        releases = []
        for name in sorted(os.listdir(os.path.join(self.root, 'releases'))):
            if name.endswith('.json'):
                record = self.record(name[:-5])
                releases.append({'id': record['id'], 'current': record['id'] == state['current'],
                                 'previous': record['id'] == state.get('previous'),
                                 'binary_sha256': record['binary_sha256']})
        return releases


def main(argv=None):
    parser = argparse.ArgumentParser(description='Update/rollback the customized Token app while preserving production data.')
    commands = parser.add_subparsers(dest='command')
    for name in ('status', 'list', 'backup'):
        commands.add_parser(name)
    commands.add_parser('update').add_argument('source', help='GitHub release tag or local .tar.gz with matching .sha256')
    commands.add_parser('rollback').add_argument('release_id', nargs='?')
    args = parser.parse_args(argv)
    if args.command is None:
        parser.print_help()
        return 2
    if os.geteuid() != 0:
        print('tokenctl must run as root.', file=sys.stderr)
        return 1
    os.umask(0o077)
    try:
        ops = TokenOps()
        with ops.lock():
            if args.command == 'list':
                result = ops.list_releases()
            elif args.command == 'update':
                result = ops.update(args.source)
            elif args.command == 'rollback':
                result = ops.rollback(args.release_id)
            else:
                result = getattr(ops, args.command)()
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except OpsError as error:
        print('tokenctl: ' + str(error), file=sys.stderr)
        return 1
    except (OSError, ValueError, KeyError, TypeError, UnicodeError):
        print('tokenctl: Operation failed; private configuration and command output were suppressed.', file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print('tokenctl: Interrupted. Check status before retrying.', file=sys.stderr)
        return 130


if __name__ == '__main__':
    sys.exit(main())
