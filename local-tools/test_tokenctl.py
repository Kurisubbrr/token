"""Safety tests use temporary files and mocked Docker; no server is contacted."""
import copy
import hashlib
import io
import json
import os
import stat
import tarfile
import tempfile
import unittest
from unittest import mock

import tokenctl


def config():
    return {'repository': tokenctl.REPOSITORY, 'project': 'token-custom',
            'compose_file': tokenctl.ROOT + '/compose.yml',
            'env_file': tokenctl.ROOT + '/shared/.env',
            'release_root': '/opt/token-releases', 'current_link': '/opt/token-deploy',
            'app_container': tokenctl.CONTAINERS['token'],
            'postgres_container': tokenctl.CONTAINERS['postgres'],
            'redis_container': tokenctl.CONTAINERS['redis'],
            'volumes': dict(tokenctl.VOLUMES), 'health_url': 'http://127.0.0.1:8080/health'}


def runtime(image_id):
    result = []
    for service, name in tokenctl.CONTAINERS.items():
        logical, destination = tokenctl.DESTINATIONS[service]
        result.append({'Name': '/' + name, 'Image': image_id,
                       'Config': {'Labels': {'com.docker.compose.project': 'token-custom',
                                             'com.docker.compose.service': service}},
                       'State': {'Running': True, 'Health': {'Status': 'healthy'}},
                       'Mounts': [{'Type': 'volume', 'Name': tokenctl.VOLUMES[logical],
                                   'Destination': destination}]})
    return result


def composed(image):
    services = {}
    for service in tokenctl.CONTAINERS:
        logical, destination = tokenctl.DESTINATIONS[service]
        services[service] = {'image': image if service == 'token' else service + ':fixed',
                             'volumes': [{'type': 'volume', 'source': logical, 'target': destination}]}
    return {'name': 'token-custom', 'services': services,
            'volumes': dict((logical, {'name': actual}) for logical, actual in tokenctl.VOLUMES.items())}


class FilesystemTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = os.path.realpath(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def path(self, *parts):
        return os.path.join(self.root, *parts)

    def write(self, name, data):
        path = self.path(name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as stream:
            stream.write(data)
        return path

    def archive(self, entries):
        archive = self.path('release.tar.gz')
        with tarfile.open(archive, 'w:gz') as stream:
            for name, kind, data in entries:
                entry = tarfile.TarInfo(name)
                entry.type = kind
                if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE):
                    entry.linkname = data
                    stream.addfile(entry)
                elif kind == tarfile.REGTYPE:
                    entry.size = len(data)
                    stream.addfile(entry, io.BytesIO(data))
                else:
                    stream.addfile(entry)
        return archive

    def test_checksum_accepts_exact_file_and_rejects_changed_content(self):
        archive = self.write('release.tar.gz', b'original')
        checksum = self.write('release.tar.gz.sha256',
                              (tokenctl.digest(archive) + '  release.tar.gz\n').encode('ascii'))
        self.assertEqual(tokenctl.verify_checksum(archive, checksum), tokenctl.digest(archive))
        self.write('release.tar.gz', b'changed')
        with self.assertRaises(tokenctl.OpsError):
            tokenctl.verify_checksum(archive, checksum)

    def test_checksum_wrong_filename_or_multiple_entries_are_rejected(self):
        archive = self.write('release.tar.gz', b'original')
        for content in [tokenctl.digest(archive) + '  other.tar.gz\n',
                        tokenctl.digest(archive) + '\n' + tokenctl.digest(archive) + '\n']:
            checksum = self.write('release.tar.gz.sha256', content.encode('ascii'))
            with self.assertRaises(tokenctl.OpsError):
                tokenctl.verify_checksum(archive, checksum)

    def test_rejects_traversal_absolute_paths_links_and_secrets(self):
        for index, entry in enumerate([
                ('release/../../outside', tarfile.REGTYPE, b'bad'),
                ('/outside', tarfile.REGTYPE, b'bad'),
                ('release/link', tarfile.SYMTYPE, '../../outside'),
                ('release/link', tarfile.LNKTYPE, '../../outside'),
                ('release/.env', tarfile.REGTYPE, b'PASSWORD=secret'),
                ('release/nested/.env.production', tarfile.REGTYPE, b'PASSWORD=secret'),
                ('release/private.pem', tarfile.REGTYPE, b'private'),
                ('release/fifo', tarfile.FIFOTYPE, b'')]):
            with self.subTest(entry=entry[0]):
                archive = self.archive([entry])
                with self.assertRaises(tokenctl.OpsError):
                    tokenctl.safe_extract(archive, self.path('unpack-' + str(index)))
        self.assertFalse(os.path.exists(os.path.join(os.path.dirname(self.root), 'outside')))

    def test_duplicate_paths_and_multiple_roots_are_rejected(self):
        for index, entries in enumerate([
                [('release/file', tarfile.REGTYPE, b'a'), ('release/file', tarfile.REGTYPE, b'b')],
                [('first/file', tarfile.REGTYPE, b'a'), ('second/file', tarfile.REGTYPE, b'b')]]):
            with self.assertRaises(tokenctl.OpsError):
                tokenctl.safe_extract(self.archive(entries), self.path('duplicate-' + str(index)))

    def test_safe_archive_extraction_ignores_archive_permissions(self):
        archive = self.archive([('release/token', tarfile.REGTYPE, b'binary'),
                                ('release/.env.example', tarfile.REGTYPE, b'PASSWORD=')])
        directory = tokenctl.safe_extract(archive, self.path('safe'))
        with open(os.path.join(directory, 'token'), 'rb') as stream:
            self.assertEqual(stream.read(), b'binary')
        self.assertEqual(stat.S_IMODE(os.stat(directory).st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(os.stat(os.path.join(directory, 'token')).st_mode), 0o600)

    def test_atomic_json_preserves_state_and_private_permissions(self):
        path = self.path('state', 'state.json')
        state = {'current': 'one', 'previous': None, 'history': ['one']}
        tokenctl.atomic_json(path, state)
        self.assertEqual(tokenctl.load_json(path), state)
        state['current'] = 'two'
        tokenctl.atomic_json(path, state)
        self.assertEqual(tokenctl.load_json(path)['current'], 'two')
        self.assertEqual(stat.S_IMODE(os.stat(path).st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(os.stat(os.path.dirname(path)).st_mode), 0o700)

    def manifest_fixture(self):
        directory = self.path('package')
        os.mkdir(directory)
        files = {}
        for name in ('token', 'Dockerfile', 'docker-entrypoint.sh', 'BUILD-INFO.txt'):
            path = self.write('package/' + name, name.encode('ascii'))
            files[name] = tokenctl.digest(path)
        migrations = {'backend/migrations/001.sql': 'a' * 64,
                      'backend/internal/repository/migrations_runner.go': 'b' * 64}
        fingerprint = hashlib.sha256(json.dumps(migrations, sort_keys=True,
                                                separators=(',', ':'), ensure_ascii=True).encode('utf-8')).hexdigest()
        manifest = {'schema_version': 1, 'version': '0.2.16', 'commit': 'c' * 40,
                    'source_modified': False, 'frontend': 'embedded', 'build_type': 'source',
                    'arch': 'amd64', 'migration_files': migrations,
                    'migration_fingerprint': fingerprint, 'files': files}
        path = os.path.join(directory, 'RELEASE-MANIFEST.json')
        tokenctl.atomic_json(path, manifest)
        return directory, path, manifest, {'migration_fingerprint': fingerprint}

    def test_manifest_accepts_exact_clean_release(self):
        directory, path, manifest, current = self.manifest_fixture()
        self.assertEqual(tokenctl.validate_manifest(directory, current), manifest)

    def test_manifest_blocks_dirty_source_or_changed_migration_or_payload(self):
        directory, path, manifest, current = self.manifest_fixture()
        original = copy.deepcopy(manifest)
        for key, value in [('source_modified', True), ('source_modified', 0),
                           ('migration_fingerprint', 'f' * 64), ('frontend', 'external')]:
            manifest = copy.deepcopy(original)
            manifest[key] = value
            tokenctl.atomic_json(path, manifest)
            with self.assertRaises(tokenctl.OpsError):
                tokenctl.validate_manifest(directory, current)
        tokenctl.atomic_json(path, original)
        with self.assertRaises(tokenctl.OpsError):
            tokenctl.validate_manifest(directory, {'migration_fingerprint': 'f' * 64})
        self.write('package/token', b'modified')
        with self.assertRaises(tokenctl.OpsError):
            tokenctl.validate_manifest(directory, current)

    def test_manifest_rejects_unlisted_payload_file(self):
        directory, path, manifest, current = self.manifest_fixture()
        self.write('package/unlisted.sh', b'not in manifest')
        with self.assertRaises(tokenctl.OpsError):
            tokenctl.validate_manifest(directory, current)

    def ops_fixture(self):
        tokenctl.atomic_json(self.path('config.json'), config())
        ops = tokenctl.TokenOps(root=self.root, runner=mock.Mock(), sleeper=lambda seconds: None)
        # Redirect filesystem targets only after fixed production identity validation.
        ops.config['release_root'] = self.path('release-root')
        ops.config['current_link'] = self.path('current')
        ops.config['env_file'] = self.path('shared.env')
        ops.config['compose_file'] = self.path('compose.yml')
        directory = self.path('release-root', 'baseline')
        os.makedirs(directory)
        self.write('release-root/baseline/token', b'baseline binary')
        record = {'id': 'baseline', 'directory': directory, 'image': 'token-custom:baseline',
                  'image_id': 'sha256:' + 'a' * 64,
                  'binary_sha256': tokenctl.digest(os.path.join(directory, 'token')),
                  'migration_fingerprint': 'b' * 64}
        state = {'current': record['id'], 'previous': None, 'history': [record['id']]}
        tokenctl.atomic_json(self.path('releases', 'baseline.json'), record)
        tokenctl.atomic_json(self.path('state.json'), state)
        os.symlink(directory, ops.config['current_link'])
        ops.run.return_value = json.dumps(runtime(record['image_id'])).encode('utf-8')
        return ops, record, state

    def test_fixed_config_rejects_project_repo_or_volume_substitution(self):
        for key, value in [('project', 'other'), ('repository', 'other/repo'),
                           ('volumes', {'app_data': 'other_data'}),
                           ('health_url', 'https://example.com/health')]:
            with self.subTest(key=key):
                value_config = config()
                value_config[key] = value
                tokenctl.atomic_json(self.path('config.json'), value_config)
                with self.assertRaises(tokenctl.OpsError):
                    tokenctl.TokenOps(root=self.root)

    def test_runtime_blocks_wrong_volume_and_project(self):
        ops, current, unused = self.ops_fixture()
        ops.validate_runtime(current)
        for field in ('volume', 'project'):
            values = runtime(current['image_id'])
            if field == 'volume':
                values[0]['Mounts'][0]['Name'] = 'fresh_empty_volume'
            else:
                values[0]['Config']['Labels']['com.docker.compose.project'] = 'other'
            ops.run.return_value = json.dumps(values).encode('utf-8')
            with self.assertRaises(tokenctl.OpsError):
                ops.validate_runtime(current)

    def test_compose_commands_and_rendered_volume_identity(self):
        ops, current, unused = self.ops_fixture()
        command = ops.compose('/private/override.json')
        self.assertEqual(command[:5], ['docker', 'compose', '-p', 'token-custom', '--env-file'])
        self.assertIn(ops.config['env_file'], command)
        render = composed(current['image'])
        ops.validate_compose(render, current['image'])
        render['volumes']['app_data']['name'] = 'new_empty_volume'
        with self.assertRaises(tokenctl.OpsError):
            ops.validate_compose(render, current['image'])

    def test_failed_transition_restores_old_release_and_state(self):
        ops, current, state = self.ops_fixture()
        target = dict(current, id='candidate', image='token-custom:candidate')
        ops.backup = mock.Mock(return_value='/private/backup')
        ops.apply = mock.Mock(side_effect=[tokenctl.OpsError('candidate unhealthy'), None])
        with self.assertRaisesRegex(tokenctl.OpsError, 'previous application version was restored'):
            ops.transition(target, 'update')
        self.assertEqual([call[0][0]['id'] for call in ops.apply.call_args_list], ['candidate', 'baseline'])
        self.assertEqual(ops.state(), state)

    def test_failed_recovery_preserves_state_and_writes_recovery_record(self):
        ops, current, state = self.ops_fixture()
        target = dict(current, id='candidate')
        ops.backup = mock.Mock(return_value='/private/backup')
        ops.apply = mock.Mock(side_effect=tokenctl.OpsError('failed'))
        with self.assertRaisesRegex(tokenctl.OpsError, 'automatic recovery failed'):
            ops.transition(target, 'update')
        self.assertEqual(ops.state(), state)
        recovery = tokenctl.load_json(self.path('recovery-required.json'))
        self.assertEqual(recovery['old'], 'baseline')
        self.assertEqual(recovery['attempted'], 'candidate')

    def test_incompatible_rollback_never_backs_up_or_stops_production(self):
        ops, current, state = self.ops_fixture()
        ops.run.reset_mock()
        target = dict(current, id='incompatible', migration_fingerprint='c' * 64)
        ops.backup = mock.Mock()
        with self.assertRaises(tokenctl.OpsError):
            ops.transition(target, 'rollback')
        ops.backup.assert_not_called()
        ops.run.assert_not_called()

    def test_successful_transition_commits_state_after_health(self):
        ops, current, state = self.ops_fixture()
        target = dict(current, id='candidate')
        ops.backup = mock.Mock(return_value='/private/backup')
        def apply(record):
            self.assertEqual(ops.state(), state)
        ops.apply = mock.Mock(side_effect=apply)
        ops.transition(target, 'update')
        self.assertEqual(ops.state()['current'], 'candidate')
        self.assertEqual(ops.state()['previous'], 'baseline')
        self.assertEqual(ops.state()['history'], ['baseline', 'candidate'])

    def test_rollback_can_recover_a_stopped_current_version(self):
        ops, current, state = self.ops_fixture()
        values = runtime(current['image_id'])
        values[0]['State'] = {'Running': False, 'Health': {'Status': 'unhealthy'}}
        ops.run.return_value = json.dumps(values).encode('utf-8')
        target = dict(current, id='working-old')
        ops.backup = mock.Mock(return_value='/private/backup')
        ops.apply = mock.Mock()
        ops.transition(target, 'rollback')
        ops.backup.assert_called_once_with(allow_unhealthy_app=True)
        self.assertEqual(ops.state()['current'], 'working-old')

    def test_successful_recovery_clears_the_old_recovery_alert(self):
        ops, current, state = self.ops_fixture()
        tokenctl.atomic_json(self.path('recovery-required.json'), {'old': 'baseline'})
        ops.backup = mock.Mock(return_value='/private/backup')
        ops.apply = mock.Mock()
        ops.transition(dict(current, id='working-old'), 'rollback')
        self.assertFalse(os.path.exists(self.path('recovery-required.json')))

    def test_backup_failure_always_restarts_the_application(self):
        ops, current, state = self.ops_fixture()
        calls = []
        def run(args, stdout=None):
            calls.append(args)
            if args[:2] == ['docker', 'inspect']:
                return json.dumps(runtime(current['image_id'])).encode('utf-8')
            if 'pg_dump -U' in ' '.join(args):
                raise tokenctl.OpsError('simulated dump failure')
            return b''
        ops.run = run
        with self.assertRaises(tokenctl.OpsError):
            ops.backup()
        self.assertIn(['docker', 'start', tokenctl.CONTAINERS['token']], calls)
        self.assertEqual(ops.state(), state)

    def test_stopped_application_backup_keeps_it_stopped_and_skips_old_health(self):
        ops, current, state = self.ops_fixture()
        self.write('shared.env', b'PASSWORD=private')
        self.write('compose.yml', b'private compose')
        app_file = self.write('app-volume/item', b'preserved user data')
        values = runtime(current['image_id'])
        values[0]['State']['Running'] = False
        calls = []
        def run(args, stdout=None):
            calls.append(args)
            if args[:2] == ['docker', 'inspect']:
                return json.dumps(values).encode('utf-8')
            if args[:3] == ['docker', 'volume', 'inspect']:
                return json.dumps([{'Name': tokenctl.VOLUMES['app_data'],
                                    'Mountpoint': os.path.dirname(app_file)}]).encode('utf-8')
            if stdout is not None:
                stdout.write(b'PGDMP-snapshot' if 'pg_dump -U' in ' '.join(args) else b'-- roles snapshot')
            if args[:2] == ['docker', 'cp']:
                with open(args[-1], 'wb') as stream:
                    stream.write(b'REDIS-snapshot')
            return b''
        ops.run = run
        ops.health = mock.Mock()
        backup = ops.backup(allow_unhealthy_app=True)
        ops.health.assert_not_called()
        self.assertFalse(any(call[1] in ('stop', 'start') for call in calls))
        metadata = tokenctl.load_json(os.path.join(backup, 'backup.json'))
        self.assertTrue(metadata['complete'])
        self.assertIn('postgres.dump', metadata['files'])
        self.assertIn('redis.rdb', metadata['files'])
        with tarfile.open(os.path.join(backup, 'app-data.tar.gz'), 'r:gz') as archive:
            with archive.extractfile('app_data/item') as stream:
                self.assertEqual(stream.read(), b'preserved user data')

    def test_apply_uses_fixed_project_and_recreates_only_application(self):
        ops, current, state = self.ops_fixture()
        calls = []
        def run(args, stdout=None):
            calls.append(args)
            if args[:3] == ['docker', 'image', 'inspect']:
                return (current['image_id'] + '\n').encode('ascii')
            if args[-3:] == ['config', '--format', 'json']:
                return json.dumps(composed(current['image'])).encode('utf-8')
            return b''
        ops.run = run
        ops.health = mock.Mock()
        ops.apply(current)
        self.assertEqual(calls[-1][-7:], ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', 'token'])
        self.assertIn('token-custom', calls[-1])
        self.assertFalse(any('down' in call or 'postgres' in call or 'redis' in call for call in calls))
        ops.health.assert_called_once_with(current)


class URLTest(unittest.TestCase):
    def test_only_official_https_hosts_are_accepted(self):
        for url in ('https://github.com/Kurisubbrr/token/releases/download/v1/a.tar.gz',
                    'https://release-assets.githubusercontent.com/file'):
            self.assertEqual(tokenctl.checked_url(url), url)
        for url in ('http://github.com/file', 'https://evil.example/file',
                    'https://github.com.evil.example/file', 'https://user:secret@github.com/file',
                    'https://127.0.0.1/file', 'https://github.com:8443/file'):
            with self.subTest(url=url), self.assertRaises(tokenctl.OpsError):
                tokenctl.checked_url(url)

    def test_subprocess_failure_does_not_echo_secrets(self):
        failed = mock.Mock(returncode=1, stdout=b'PASSWORD=hidden', stderr=b'JWT_SECRET=hidden')
        with mock.patch('tokenctl.subprocess.run', return_value=failed):
            with self.assertRaises(tokenctl.OpsError) as caught:
                tokenctl.execute(['docker', 'compose', 'config'])
        self.assertNotIn('hidden', str(caught.exception))
        self.assertNotIn('PASSWORD', str(caught.exception))

    def test_docker_environment_does_not_override_shared_configuration(self):
        result = mock.Mock(returncode=0, stdout=b'', stderr=b'')
        with mock.patch.dict(os.environ, {'POSTGRES_PASSWORD': 'wrong',
                                          'SERVER_PORT': '9999',
                                          'DOCKER_HOST': 'tcp://elsewhere:2375'}):
            with mock.patch('tokenctl.subprocess.run', return_value=result) as run:
                tokenctl.execute(['docker', 'compose', 'config'])
        environment = run.call_args[1]['env']
        self.assertNotIn('POSTGRES_PASSWORD', environment)
        self.assertNotIn('SERVER_PORT', environment)
        self.assertEqual(environment['DOCKER_HOST'], 'unix:///var/run/docker.sock')


    def test_explicit_download_proxy_overrides_environment_and_propagates_to_release_assets(self):
        proxy = 'http://172.17.0.1:7890'
        url = 'https://api.github.com/repos/Kurisubbrr/token/releases/tags/v1'
        with tempfile.TemporaryDirectory() as temporary:
            response = mock.MagicMock()
            response.__enter__.return_value = response
            response.geturl.return_value = url
            response.read.side_effect = [b'payload', b'']
            opener = mock.Mock()
            opener.open.return_value = response
            with mock.patch.dict(os.environ, {'HTTPS_PROXY': 'http://untrusted.example:9999',
                                              'HTTP_PROXY': 'http://untrusted.example:9999'}):
                with mock.patch('tokenctl.urllib.request.build_opener', return_value=opener) as build:
                    output = os.path.join(temporary, 'explicit.bin')
                    tokenctl.download(url, output, 1024, proxy=proxy)
            handlers = build.call_args[0]
            proxy_handlers = [handler for handler in handlers
                              if isinstance(handler, tokenctl.urllib.request.ProxyHandler)]
            self.assertEqual(len(proxy_handlers), 1)
            self.assertEqual(proxy_handlers[0].proxies, {'http': proxy, 'https': proxy})
            self.assertTrue(any(isinstance(handler, tokenctl.SafeRedirect) for handler in handlers))
            with open(output, 'rb') as stream:
                self.assertEqual(stream.read(), b'payload')

            # Omission preserves the previous default opener behavior.
            response.read.side_effect = [b'default', b'']
            with mock.patch('tokenctl.urllib.request.build_opener', return_value=opener) as build:
                tokenctl.download(url, os.path.join(temporary, 'default.bin'), 1024)
            self.assertEqual(len(build.call_args[0]), 1)
            self.assertIsInstance(build.call_args[0][0], tokenctl.SafeRedirect)

            archive_name = 'token-custom-1-linux-amd64-20261020.tar.gz'
            metadata = {'tag_name': 'v1', 'draft': False, 'assets': [
                {'name': name, 'browser_download_url':
                 'https://github.com/Kurisubbrr/token/releases/download/v1/' + name}
                for name in (archive_name, archive_name + '.sha256')]}
            ops = tokenctl.TokenOps.__new__(tokenctl.TokenOps)
            ops.root = os.path.join(temporary, 'ops')
            ops.config = {'download_proxy': proxy}
            def fake_download(download_url, destination, limit, proxy=None):
                with open(destination, 'w', encoding='utf-8') as stream:
                    stream.write(json.dumps(metadata) if destination.endswith('release.json') else 'asset')
            with mock.patch('tokenctl.download', side_effect=fake_download) as fetch:
                fetched = ops.fetch_release('v1')
            self.assertEqual(os.path.basename(fetched), archive_name)
            self.assertEqual(fetch.call_count, 3)
            for call in fetch.call_args_list:
                self.assertEqual(call[1]['proxy'], proxy)

    def test_invalid_download_proxies_are_rejected_before_network_or_file_access(self):
        for proxy in ('https://172.17.0.1:7890', 'http://172.17.0.1:8080',
                      'http://other.example:7890', 'http://user:secret@localhost:7890',
                      'http://@localhost:7890', 'http://localhost:7890/private',
                      'http://localhost:7890?secret=hidden', 'http://localhost:bad',
                      'http://localhost:7890#fragment', 'http://localhost:7890\n', ''):
            with self.subTest(proxy=proxy):
                with mock.patch('tokenctl.urllib.request.build_opener') as build:
                    with mock.patch('tokenctl.open', create=True) as output:
                        with self.assertRaises(tokenctl.OpsError) as caught:
                            tokenctl.download('https://github.com/Kurisubbrr/token/releases',
                                              '/unused-test-destination', 1024, proxy=proxy)
                    output.assert_not_called()
                build.assert_not_called()
                self.assertNotIn('secret', str(caught.exception))
        for proxy in ('http://127.0.0.1:7890', 'http://localhost:7890',
                      'http://172.17.0.1:7890'):
            self.assertEqual(tokenctl.checked_proxy(proxy), proxy)


if __name__ == '__main__':
    unittest.main()
