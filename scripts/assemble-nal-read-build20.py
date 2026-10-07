#!/usr/bin/env python3
"""Build a coordinated NAL integration candidate from a committed local checkout.

No network, SQL execution, test, CLI install, deployment or environment-file reads.
The output is a public OVERLAY plus private API/DB/editorial material, not a site ZIP.
Python 3.10+ and local Git objects are required. No automatic fetch or overwrite.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import posixpath
import re
import subprocess
import sys
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import zipfile

BASE = '3825e1582cb3a636f233eb6d4d46102759485ef5'
SELF = 'scripts/assemble-nal-read-build20.py'
PLAN = 'integration/nal-read/build20/assembly.json'
MAX_FILE, MAX_TOTAL = 2 * 1024 * 1024, 32 * 1024 * 1024
SHA = re.compile(r'^[0-9a-f]{40}$')
DOLLAR = re.compile(r'\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$')


class AssemblyError(Exception):
    pass


def encode(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode('utf-8')


def path_name(value):
    if not isinstance(value, str) or not value or any(c in value for c in '\\\x00\r\n\t'):
        raise AssemblyError('Invalid source path')
    p = PurePosixPath(value)
    if p.is_absolute() or '..' in p.parts or str(p) != value:
        raise AssemblyError('Source path is not normalized')
    return value


def git(repo, *args):
    env = {k: os.environ[k] for k in ('PATH', 'SYSTEMROOT', 'TEMP', 'TMP', 'LANG') if k in os.environ}
    env.update(GIT_NO_REPLACE_OBJECTS='1', GIT_NO_LAZY_FETCH='1', GIT_TERMINAL_PROMPT='0',
               GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull, GIT_OPTIONAL_LOCKS='0')
    command = ['git', '--no-optional-locks', '-c', 'core.fsmonitor=false', '-c',
               'core.hooksPath=' + os.devnull, '-C', str(repo), *args]
    try:
        done = subprocess.run(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, timeout=30, env=env, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise AssemblyError('Local Git read failed; no remote fetch was attempted') from error
    if done.returncode or len(done.stdout) > MAX_TOTAL:
        raise AssemblyError('Required local committed object is unavailable or exceeds bounds')
    return done.stdout


def file_index(repo, commit):
    found = {}
    for row in git(repo, 'ls-tree', '-r', '-l', '-z', commit).split(b'\0'):
        if not row:
            continue
        metadata, name = row.split(b'\t', 1)
        mode, kind, oid, size = metadata.decode('ascii').split()
        found[name.decode('utf-8')] = (mode, kind, oid, None if size == '-' else int(size))
    return found


def read_source(repo, index, path):
    path_name(path)
    item = index.get(path)
    if item is None:
        raise AssemblyError('Missing committed source: ' + path)
    mode, kind, oid, size = item
    if kind != 'blob' or mode not in ('100644', '100755') or size is None or size > MAX_FILE:
        raise AssemblyError('Not an allowed regular source file: ' + path)
    data = git(repo, 'cat-file', 'blob', oid)
    actual = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    if len(data) != size or actual != oid:
        raise AssemblyError('Source object identity mismatch: ' + path)
    data.decode('utf-8')
    if data.startswith(b'version https://git-lfs.github.com/spec/v1'):
        raise AssemblyError('A pointer cannot replace source bytes: ' + path)
    return data, oid


def matches(path, pattern):
    expression = re.escape(pattern).replace(r'\*\*/', '(?:.*/)?').replace(r'\*\*', '.*')
    expression = expression.replace(r'\*', '[^/]*').replace(r'\?', '[^/]')
    return re.fullmatch(expression, path) is not None


def statements(source):
    """Locate outer SQL statement spans without entering comments or quoted bodies.

    This is a boundary lexer, NOT a PostgreSQL parser or SQL correctness check.
    Deliberately reject unsupported/missing delimiters rather than guessing.
    """
    output, words = [], []
    first, i, length = None, 0, len(source)
    while i < length:
        char = source[i]
        if char.isspace():
            i += 1
            continue
        if source.startswith('--', i):
            end = source.find('\n', i + 2)
            i = length if end < 0 else end + 1
            continue
        if source.startswith('/*', i):
            depth, i = 1, i + 2
            while i < length and depth:
                if source.startswith('/*', i):
                    depth, i = depth + 1, i + 2
                elif source.startswith('*/', i):
                    depth, i = depth - 1, i + 2
                else:
                    i += 1
            if depth:
                raise AssemblyError('Unclosed SQL block comment')
            continue
        if first is None:
            first = i
        if char in ("'", '"'):
            quote, escaped = char, char == "'" and i > 0 and source[i-1] in 'Ee' and (i < 2 or not (source[i-2].isalnum() or source[i-2] == '_'))
            i += 1
            while i < length:
                if escaped and source[i] == '\\':
                    i += 2
                elif source[i] == quote:
                    if i + 1 < length and source[i+1] == quote:
                        i += 2
                    else:
                        i += 1
                        break
                else:
                    i += 1
            else:
                raise AssemblyError('Unclosed SQL quoted value')
            words.append('<QUOTED>')
            continue
        tag = DOLLAR.match(source, i) if char == '$' else None
        if tag:
            end = source.find(tag.group(), tag.end())
            if end < 0:
                raise AssemblyError('Unclosed SQL dollar body')
            i = end + len(tag.group())
            words.append('<BODY>')
            continue
        if char == ';':
            if words:
                output.append((first, i + 1, tuple(words)))
            first, words, i = None, [], i + 1
            continue
        token = re.match(r'[A-Za-z_][A-Za-z_0-9]*', source[i:])
        if token:
            words.append(token.group().upper())
            i += len(token.group())
        else:
            words.append(char)
            i += 1
    if words:
        raise AssemblyError('SQL source has an unterminated outer statement')
    return output


def incremental_body(data):
    source = data.decode('utf-8')
    parts = statements(source)
    if len(parts) < 3 or parts[0][2] != ('BEGIN',) or parts[-1][2] != ('COMMIT',):
        raise AssemblyError('Expected one exact BEGIN/COMMIT envelope per layer')
    allowed = {'SET', 'CREATE', 'ALTER', 'GRANT', 'REVOKE', 'DO', 'INSERT', 'UPDATE', 'DELETE', 'SELECT', 'COMMENT'}
    for _, _, tokens in parts[1:-1]:
        if tokens[0] not in allowed or (tokens[0] == 'SET' and tokens[1:2] != ('LOCAL',)):
            raise AssemblyError('Unsupported outer statement in incremental source')
        if tokens[:2] in (('CREATE', 'DATABASE'), ('ALTER', 'SYSTEM')) or 'CONCURRENTLY' in tokens:
            raise AssemblyError('Layer cannot be placed inside a single forward transaction')
    # Remove ONLY the two outer statements, not similarly named function-body text.
    a, b = parts[0], parts[-1]
    body = source[:a[0]] + source[a[1]:b[0]] + source[b[1]:]
    return body, {'beginSpan': [a[0], a[1]], 'commitSpan': [b[0], b[1]]}


REFERENCE = re.compile(r'''(?P<q>["'])(?P<value>(?:/nal/assets/|\./|\.\./)[^"'\s<>`]+)(?P=q)''')


def align_assets(path, data, assets, bundle):
    source = data.decode('utf-8')
    edits = []
    if path.endswith(('.js', '.mjs')):
        # Existing computed loader suffixes have literal build labels; no fetch monkey patch.
        source, n = re.subn(r'\?v=build[0-9]+(?:-[0-9a-f]{12,40})?(?=[\'"`])', '?v=' + bundle, source)
        if n:
            edits.append({'kind': 'literal-loader-label', 'count': n})
    def replace(match):
        value = match.group('value')
        parsed = urlsplit(value)
        relative = parsed.path.lstrip('/') if parsed.path.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(path), parsed.path))
        if relative not in assets:
            return match.group()
        args = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True) if k != 'v'] + [('v', bundle)]
        changed = urlunsplit(('', '', parsed.path, urlencode(args), parsed.fragment))
        if changed != value:
            edits.append({'kind': 'asset-reference', 'source': value, 'output': changed})
        return match.group('q') + changed + match.group('q')
    return REFERENCE.sub(replace, source).encode('utf-8'), edits


def assemble(repo, commit):
    if not SHA.fullmatch(commit):
        raise AssemblyError('Use a full committed source SHA, not a moving branch name')
    git(repo, 'merge-base', '--is-ancestor', BASE, commit)
    index = file_index(repo, commit)
    cache = {}
    def read(path):
        if path not in cache:
            cache[path] = read_source(repo, index, path)
        return cache[path]
    tool, _ = read(SELF)
    if Path(__file__).read_bytes().replace(b'\r\n', b'\n') != tool.replace(b'\r\n', b'\n'):
        raise AssemblyError('Use the assembler belonging to the requested committed source')
    plan = json.loads(read(PLAN)[0])
    if plan.get('build') != 20 or plan.get('requiredAncestor') != BASE:
        raise AssemblyError('Unexpected assembly plan')
    manifest_data, manifest_oid = read(plan['sourceManifest'])
    if manifest_oid != plan['sourceManifestBlob']:
        raise AssemblyError('The declared layer manifest changed; reconcile the plan first')
    manifest = json.loads(manifest_data)
    baseline = json.loads(read(plan['baselineObservation'])[0])
    checks = baseline['baselineFunctions']
    if len(checks) != 7 or any(not re.fullmatch(r'[0-9a-f]{32}', c['definitionMd5']) or c['securityDefiner'] is not False for c in checks):
        raise AssemblyError('Incomplete observed baseline contract')
    migrations = baseline['requiredReadMigrationVersions']
    if len(migrations) != 5 or any(not re.fullmatch(r'[0-9]{14}', x) for x in migrations):
        raise AssemblyError('Invalid required baseline migration identifiers')
    bundle = 'build20-' + commit[:12]
    outputs, inventory, transformations, total = {}, [], [], 0
    def add(destination, data):
        nonlocal total
        path_name(destination)
        if destination in outputs:
            raise AssemblyError('Duplicate output path: ' + destination)
        total += len(data)
        if total > MAX_TOTAL:
            raise AssemblyError('Assembly exceeds its output bound')
        outputs[destination] = data
    def copy(path, destination, group, transformed=None):
        original, oid = read(path)
        result = original if transformed is None else transformed
        add(destination, result)
        inventory.append({'path': path, 'destination': destination, 'group': group, 'gitBlob': oid,
                          'sourceSha256': hashlib.sha256(original).hexdigest(),
                          'outputSha256': hashlib.sha256(result).hexdigest(), 'bytes': len(result)})
    layers = manifest['database']['layers']
    if len(layers) != plan['sqlLayerCount'] or len(layers) != 19:
        raise AssemblyError('Expected nineteen incremental sources')
    known, assembled, layer_map = {'baseline-fix03'}, [], []
    for number, layer in enumerate(layers, 1):
        if layer['id'] in known or any(x not in known for x in layer['requires']):
            raise AssemblyError('Invalid layer dependency order')
        known.add(layer['id'])
        raw, oid = read(layer['path'])
        body, spans = incremental_body(raw)
        digest = hashlib.sha256(raw).hexdigest()
        assembled.append('\n-- LAYER ' + str(number) + ': ' + layer['path'] + '\n-- Source SHA256 ' + digest + '\n' + body + '\n')
        copy(layer['path'], 'private/database/original-layers/' + str(number).zfill(2) + '-' + layer['id'] + '.sql', 'sql-original')
        layer_map.append({**layer, **spans, 'gitBlob': oid, 'sourceSha256': digest})
    guard = read(plan['preconditions'])[0].decode('utf-8')
    replacements = {'__SOURCE_COMMIT__': commit,
                    '__BASELINE_FUNCTIONS__': json.dumps(checks, separators=(',', ':')).replace("'", "''"),
                    '__READ_MIGRATIONS__': ','.join("'" + x + "'" for x in migrations)}
    for key, value in replacements.items():
        if guard.count(key) != 1:
            raise AssemblyError('Unexpected precondition template')
        guard = guard.replace(key, value)
    marker_json = json.dumps({'build': 20, 'sourceCommit': commit, 'layerCount': 19}, separators=(',', ':'))
    marker = ("\nCREATE FUNCTION nal_private.read_build20_integration() RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $nal_build20_marker$\n"
              " SELECT '" + marker_json + "'::jsonb\n$nal_build20_marker$;\n"
              "REVOKE ALL ON FUNCTION nal_private.read_build20_integration() FROM PUBLIC,anon,authenticated;\n"
              "GRANT EXECUTE ON FUNCTION nal_private.read_build20_integration() TO service_role;\n")
    forward = '-- GENERATED CANDIDATE, NOT APPLIED OR TESTED. Source: ' + commit + '\nBEGIN;\nSET LOCAL lock_timeout=\'5s\';\nSET LOCAL statement_timeout=\'30s\';\n' + guard + ''.join(assembled) + marker + 'COMMIT;\n'
    add(plan['databaseOutput'], forward.encode('utf-8'))
    add('private/database/LAYERS.json', encode(layer_map))
    copy(plan['baselineObservation'], 'private/database/baseline-observation.json', 'observed-metadata')
    copy(plan['preconditions'], 'private/database/preconditions.sql.in', 'assembly-template')
    selected = {}
    excluded = manifest['excludedPatterns']
    extensions = set(manifest['allowedSourceExtensions'])
    for group in manifest['groups']:
        paths = [p for p in sorted(index) if PurePosixPath(p).suffix in extensions and any(matches(p, x) for x in group['patterns']) and not any(matches(p, x) for x in excluded)]
        if not paths or any(p not in paths for p in group['required']):
            raise AssemblyError('Missing source group: ' + group['id'])
        selected[group['id']] = paths
    public_paths = set(selected['frontend'])
    assets = {p for p in public_paths if p.startswith('nal/assets/') and p.endswith(('.js', '.mjs', '.css'))}
    for group, paths in selected.items():
        prefix = 'public-overlay/' if group == 'frontend' else 'private/edge/' if group == 'edge' else 'private/editorial-input/' if group == 'content' else 'private/reference/'
        for path in paths:
            original, _ = read(path)
            result, edits = align_assets(path, original, assets, bundle) if group == 'frontend' and path.endswith(('.html', '.js', '.mjs', '.css')) else (original, [])
            copy(path, prefix + path, group, result)
            if edits:
                transformations.append({'path': path, 'changes': edits})
    # This metadata is not a runtime health result, a key, or a feature switch.
    add('public-overlay/nal/data/read-release.json', encode({'build': 20, 'bundle': bundle, 'sourceCommit': commit}))
    add('private/ASSET-TRANSFORMATIONS.json', encode(transformations))
    copy('integration/nal-read/build19/runtime-plan.json', 'private/runtime-reference.json', 'runtime-reference')
    # The BUILD19 runtime map supplies endpoint relationships, not the deployed source SHA.
    add('private/runtime-version.json', encode({'sourceCommit': commit, 'bundle': bundle,
        'edgeSourceCount': len(selected['edge']), 'runtimeState': 'not_observed_by_assembler',
        'referenceMapSourceCommit': manifest['sourceCommit'], 'databaseCandidate': plan['databaseOutput']}))
    copy(PLAN, 'private/assembly.json', 'assembly-plan')
    copy(SELF, 'private/tools/assemble-nal-read-build20.py', 'assembler')
    copy('integration/nal-read/build20/README.md', 'START-HERE.md', 'handoff')
    record = {'status': 'ASSEMBLED_NOT_DEPLOYED_NOT_TESTED', 'sourceCommit': commit, 'bundle': bundle,
              'sqlLayers': 19, 'publicOverlayFiles': len(selected['frontend']) + 1,
              'edgeSourceFiles': len(selected['edge']), 'transformedFiles': len(transformations),
              'sqlExecuted': False, 'testsRun': False, 'networkRequests': 0, 'salesEnabled': False,
              'targetAuthorization': 'not granted by this build'}
    add('ASSEMBLY.json', encode(record))
    add('FILE-INVENTORY.json', encode(sorted(inventory, key=lambda x: x['destination'])))
    add('CHECKSUMS.sha256', ''.join(hashlib.sha256(data).hexdigest() + '  ' + path + '\n' for path, data in sorted(outputs.items())).encode())
    return outputs, record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path.cwd())
    parser.add_argument('--source-commit', required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    try:
        repo = Path(git(args.repo.resolve(), 'rev-parse', '--show-toplevel').decode().strip()).resolve()
        out = args.out.expanduser().resolve()
        if out.exists() or out == repo or repo in out.parents or not out.parent.is_dir():
            raise AssemblyError('Choose a new output directory outside the repository with an existing parent')
        files, record = assemble(repo, args.source_commit)
        out.mkdir(mode=0o700)
        incomplete = out / 'INCOMPLETE.txt'
        incomplete.write_text('Assembly did not finish. Do not deploy or apply this output.\n', encoding='utf-8')
        for name, data in sorted(files.items()):
            target = out / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as stream:
                stream.write(data)
            target.chmod(0o600)
        archive = out / ('nal-read-build20-' + args.source_commit[:12] + '.zip')
        with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_STORED, allowZip64=False) as zf:
            for name, data in sorted(files.items()):
                info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
                info.create_system, info.external_attr = 3, 0o100600 << 16
                zf.writestr(info, data)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        (out / (archive.name + '.sha256')).write_text(digest + '  ' + archive.name + '\n', encoding='utf-8')
        incomplete.unlink()
        print(json.dumps({**record, 'archive': archive.name, 'archiveSha256': digest}, ensure_ascii=False, indent=2))
        return 0
    except (AssemblyError, OSError, ValueError, TypeError, KeyError, UnicodeError, zipfile.LargeZipFile) as error:
        print('BUILD20 assembly not completed: ' + str(error), file=sys.stderr)
        print('No SQL, test, network fetch or deployment command was executed.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
