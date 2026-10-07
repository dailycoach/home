#!/usr/bin/env python3
"""Assemble committed NAL source into a reproducible OFFLINE integration capsule.

Python 3.10+ and an existing local Git checkout are sufficient. No pip install,
network, Supabase CLI, DB driver, tests, source execution, deployment or env loading.
Run after committing BUILD19: python scripts/package-nal-read-build19.py --out <new-dir>
The destination must be outside the repository and its parent must already exist.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import zipfile
from dataclasses import dataclass
from typing import Any

MANIFEST = "integration/nal-read/build19/manifest.json"
SCRIPT = "scripts/package-nal-read-build19.py"
MAX_FILE = 2 * 1024 * 1024
MAX_TOTAL = 32 * 1024 * 1024
MAX_GIT_OUTPUT = 32 * 1024 * 1024
SHA = re.compile(r"^[0-9a-f]{40}$")
ID = re.compile(r"^[a-z0-9-]{1,80}$")
TEXT_SUFFIXES = {".html", ".css", ".js", ".mjs", ".ts", ".json", ".md", ".sql", ".py"}


class PackageError(Exception):
    """An input/output problem, never a statement about runtime correctness."""


@dataclass(frozen=True)
class Entry:
    mode: str
    kind: str
    oid: str
    size: int | None


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def safe_path(value: str) -> str:
    if not isinstance(value, str) or not value or any(c in value for c in "\\\x00\r\n\t"):
        raise PackageError("Invalid repository path in package input")
    p = PurePosixPath(value)
    if p.is_absolute() or any(part in (".", "..") for part in p.parts) or str(p) != value:
        raise PackageError("Package paths must be normalized repository-relative paths")
    return value


def glob_matches(path: str, pattern: str) -> bool:
    # Unlike fnmatch, **/ also matches zero directories. No shell is involved.
    expression = re.escape(pattern)
    expression = expression.replace(r"\*\*/", "(?:.*/)?").replace(r"\*\*", ".*")
    expression = expression.replace(r"\*", "[^/]*").replace(r"\?", "[^/]")
    return re.fullmatch(expression, path) is not None


def git(repo: Path, *args: str) -> bytes:
    # Fixed read-only commands only. Do not inherit Git object overrides, optional
    # lazy fetching, credential helpers or configuration from the shell environment.
    env = {k: os.environ[k] for k in ("PATH", "SYSTEMROOT", "TEMP", "TMP", "TMPDIR", "LANG") if k in os.environ}
    env.update({"GIT_NO_REPLACE_OBJECTS": "1", "GIT_NO_LAZY_FETCH": "1", "GIT_TERMINAL_PROMPT": "0",
                "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull, "GIT_OPTIONAL_LOCKS": "0"})
    command = ["git", "--no-optional-locks", "-c", "core.fsmonitor=false", "-c",
               "core.hooksPath=" + os.devnull, "-C", str(repo), *args]
    try:
        result = subprocess.run(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, check=False, timeout=30, env=env)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise PackageError("A local Git read could not finish; no remote fetch is attempted") from exc
    if result.returncode:
        # Do not print arbitrary Git stderr, which can include local configuration.
        raise PackageError("A required committed object is unavailable in this local checkout; no fetch was attempted")
    if len(result.stdout) > MAX_GIT_OUTPUT:
        raise PackageError("Git object listing exceeds package bounds")
    return result.stdout


def tree(repo: Path, commit: str) -> dict[str, Entry]:
    result: dict[str, Entry] = {}
    for raw in git(repo, "ls-tree", "-r", "-l", "-z", commit).split(b"\x00"):
        if not raw:
            continue
        metadata, raw_name = raw.split(b"\t", 1)
        mode, kind, oid, size = metadata.decode("ascii").split()
        name = raw_name.decode("utf-8")
        result[name] = Entry(mode, kind, oid, None if size == "-" else int(size))
    return result


def read_blob(repo: Path, entries: dict[str, Entry], path: str) -> tuple[bytes, Entry]:
    safe_path(path)
    item = entries.get(path)
    if item is None:
        raise PackageError("Required committed source is missing: " + path)
    if item.kind != "blob" or item.mode not in ("100644", "100755"):
        raise PackageError("Symlinks, submodules and non-file entries are not exported: " + path)
    if item.size is None or item.size > MAX_FILE or PurePosixPath(path).suffix not in TEXT_SUFFIXES:
        raise PackageError("Source is outside the text/size scope: " + path)
    data = git(repo, "cat-file", "blob", item.oid)
    if len(data) != item.size:
        raise PackageError("Git object size changed unexpectedly: " + path)
    try:
        data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise PackageError("Binary content is not exported: " + path) from exc
    if data.startswith(b"version https://git-lfs.github.com/spec/v1"):
        raise PackageError("An LFS pointer cannot stand in for source bytes: " + path)
    return data, item


def parse_json(data: bytes, label: str) -> dict[str, Any]:
    try:
        value = json.loads(data)
    except (ValueError, UnicodeError) as exc:
        raise PackageError("Invalid committed package metadata: " + label) from exc
    if not isinstance(value, dict):
        raise PackageError("Package metadata must be an object: " + label)
    return value


def build(repo: Path) -> tuple[dict[str, bytes], dict[str, Any]]:
    tooling_commit = git(repo, "rev-parse", "--verify", "HEAD^{commit}").decode().strip()
    if not SHA.fullmatch(tooling_commit):
        raise PackageError("Expected a full committed Git object ID")
    tools_tree = tree(repo, tooling_commit)
    manifest_bytes, _ = read_blob(repo, tools_tree, MANIFEST)
    manifest = parse_json(manifest_bytes, MANIFEST)
    if manifest.get("formatVersion") != 1 or manifest.get("build") != 19 or manifest.get("repository") != "dailycoach/home":
        raise PackageError("This generator only accepts the committed BUILD19 manifest")
    source_commit, source_tree = manifest.get("sourceCommit", ""), manifest.get("sourceTree", "")
    if not SHA.fullmatch(source_commit) or not SHA.fullmatch(source_tree):
        raise PackageError("The source commit and tree must be full immutable IDs")
    actual_tree = git(repo, "rev-parse", "--verify", source_commit + "^{tree}").decode().strip()
    if actual_tree != source_tree:
        raise PackageError("The pinned source commit does not have the pinned tree")
    git(repo, "merge-base", "--is-ancestor", source_commit, tooling_commit)
    committed_script, _ = read_blob(repo, tools_tree, SCRIPT)
    # Permit checkout CRLF normalization, but not execution of a different edited tool.
    local_script = Path(__file__).read_bytes().replace(b"\r\n", b"\n")
    if local_script != committed_script.replace(b"\r\n", b"\n"):
        raise PackageError("Run the committed BUILD19 generator, not an uncommitted edited copy")
    entries = tree(repo, source_commit)
    excluded = manifest.get("excludedPatterns")
    if not isinstance(excluded, list) or not all(isinstance(p, str) for p in excluded):
        raise PackageError("An explicit exclusion list is required")
    archive: dict[str, bytes] = {}
    inventory: list[dict[str, Any]] = []
    total_size = 0

    def add_source(path: str, destination: str, group: str, *, tool: bool = False) -> dict[str, Any]:
        nonlocal total_size
        safe_path(destination)
        if destination in archive:
            raise PackageError("Duplicate archive destination: " + destination)
        if not tool and any(glob_matches(path, p) for p in excluded):
            raise PackageError("An excluded file was requested explicitly: " + path)
        data, item = read_blob(repo, tools_tree if tool else entries, path)
        total_size += len(data)
        if total_size > MAX_TOTAL:
            raise PackageError("The bounded source capsule is too large")
        archive[destination] = data
        record = {"archivePath": destination, "repositoryPath": path, "group": group,
                  "commit": tooling_commit if tool else source_commit, "gitBlob": item.oid,
                  "sourceMode": item.mode, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}
        inventory.append(record)
        return record

    db = manifest.get("database", {})
    if db.get("profile") != "after-reviewed-fix03-before-build04":
        raise PackageError("Unknown database assembly profile")
    baseline = []
    for path in db.get("baselineReferences", []):
        baseline.append(add_source(path, "reference/baseline/" + path, "baseline-reference"))
    layers, layer_ids, layer_paths = [], {"baseline-fix03"}, set()
    unscheduled = {row["path"] for row in db.get("doNotSchedule", [])}
    for position, item in enumerate(db.get("layers", []), 1):
        name, path = item.get("id", ""), item.get("path", "")
        requirements = item.get("requires", [])
        if not ID.fullmatch(name) or name in layer_ids or path in layer_paths or path in unscheduled:
            raise PackageError("Invalid, repeated or superseded database layer")
        if not requirements or any(required not in layer_ids for required in requirements):
            raise PackageError("Layer dependencies must precede the layer: " + name)
        if not path.startswith("docs/NAL_READ_BUILD") or not path.endswith(".sql"):
            raise PackageError("Only explicitly listed BUILD SQL source is scheduled")
        copied = add_source(path, f"sql/sequence/{position:02d}-{name}.sql", "database-layer")
        layer_ids.add(name)
        layer_paths.add(path)
        layers.append({**item, "position": position, "archivePath": copied["archivePath"],
                       "sha256": copied["sha256"], "targetAppliedState": "unknown"})
    if len(layers) != 19:
        raise PackageError("BUILD19 expects exactly the declared 19 incremental SQL sources")
    required_ext = set(manifest.get("allowedSourceExtensions", []))
    exported_paths: set[str] = set()
    group_counts: dict[str, int] = {}
    for group in manifest.get("groups", []):
        name = group.get("id", "")
        if not ID.fullmatch(name) or name in group_counts:
            raise PackageError("Invalid or repeated source group")
        patterns = group.get("patterns", [])
        if not patterns or not all(isinstance(p, str) for p in patterns):
            raise PackageError("Each source group needs explicit path patterns")
        selected = [path for path in sorted(entries)
                    if PurePosixPath(path).suffix in required_ext
                    and any(glob_matches(path, p) for p in patterns)
                    and not any(glob_matches(path, p) for p in excluded)]
        if not selected or any(path not in selected for path in group.get("required", [])):
            raise PackageError("Required sources are missing from group: " + name)
        for path in selected:
            if path in exported_paths:
                raise PackageError("A source is assigned to more than one source group: " + path)
            exported_paths.add(path)
            add_source(path, "source/" + path, name)
        group_counts[name] = len(selected)
    expected_tools = {MANIFEST, SCRIPT, "integration/nal-read/build19/README.md",
                      "integration/nal-read/build19/runtime-plan.json",
                      "integration/nal-read/build19/target-evidence.template.json",
                      "docs/NAL_READ_BUILD19_INTEGRATION.md"}
    if set(manifest.get("packagingFiles", [])) != expected_tools:
        raise PackageError("Unexpected packaging tool inputs")
    for path in sorted(expected_tools):
        add_source(path, "package-tools/" + path, "packaging-tool", tool=True)
    runtime = parse_json(archive["package-tools/integration/nal-read/build19/runtime-plan.json"], "runtime-plan")
    if runtime.get("sourceCommit") != source_commit:
        raise PackageError("Runtime plan and source commit differ")
    record = {
        "status": "PACKAGED_SOURCE_NOT_DEPLOYED_NOT_TESTED",
        "build": 19, "sourceCommit": source_commit, "sourceTree": source_tree,
        "packagingCommit": tooling_commit, "databaseLayerCount": len(layers),
        "baselineReferenceCount": len(baseline), "sourceGroupCounts": group_counts,
        "sourceFileCount": len(inventory), "sourceBytes": total_size,
        "targetState": "unknown", "testsRun": False, "sqlExecuted": False,
        "networkRequests": 0, "deployed": False, "salesEnabled": False,
        "coverage": "Explicit source groups only; existing storefront assets/config and runtime evidence are not included"
    }
    archive["PACKAGE.json"] = json_bytes(record)
    archive["FILE-INVENTORY.json"] = json_bytes(sorted(inventory, key=lambda x: x["archivePath"]))
    archive["DATABASE-PLAN.json"] = json_bytes({
        "profile": db["profile"], "targetState": "unknown", "executable": False,
        "baselinePolicy": db["baselinePolicy"], "baselineReferences": baseline,
        "layers": layers, "doNotSchedule": db["doNotSchedule"], "copyMode": db["copyMode"],
        "warning": "This is NOT an apply list for an unobserved target. Preserve the individual transactions. Reconcile actual history and generate a migration in the authorized integration stage."
    })
    archive["RUNTIME-PLAN.json"] = json_bytes(runtime)
    archive["templates/backend.disabled.json"] = json_bytes({"enabled": False, "url": "", "publishableKey": ""})
    archive["templates/target-evidence.json"] = archive["package-tools/integration/nal-read/build19/target-evidence.template.json"]
    archive["START-HERE.md"] = (
        "# NAL READ BUILD19 integration source capsule\n\n"
        "Source commit: `" + source_commit + "`. Packaging commit: `" + tooling_commit + "`.\n\n"
        "This directory contains source, not a running site or deployment approval. "
        "No database or provider was contacted and no tests ran.\n\n"
        "Read DATABASE-PLAN.json before considering SQL. reference/baseline is NOT a second apply queue. "
        "sql/sequence retains 19 independent, unapplied-source transactions; never replay them blindly "
        "over a partly updated target. No apply runner or migration-history repair is included.\n\n"
        "source/ is an explicitly scoped code capsule, NOT a complete static site. Existing STORE/PDF "
        "assets, current backend JSON, gateway settings, keys and target evidence are excluded. "
        "Do not deploy this archive to a public site: it includes private server source and SQL.\n\n"
        "The disabled JSON template has no target or usable key and is not injected into the source. "
        "Templates are not current settings. Do not overwrite a live environment with them.\n\n"
        "The first-season manuscript/presets are editing inputs, not approved or seeded records. "
        "Follow the Korean operator handoff in package-tools/integration/nal-read/build19/README.md.\n\n"
        "Checksums establish byte identity only, not SQL correctness, security review, runtime health "
        "or sales readiness. No old HTML cache labels or dynamic-loader versions have been rewritten.\n"
    ).encode("utf-8")
    # The checksum index deliberately excludes itself to avoid circular hashing.
    archive["CHECKSUMS.sha256"] = ("".join(hashlib.sha256(data).hexdigest() + "  " + name + "\n"
                                          for name, data in sorted(archive.items()))).encode("utf-8")
    return archive, record


def write_package(destination: Path, archive: dict[str, bytes], record: dict[str, Any]) -> dict[str, Any]:
    if not destination.parent.is_dir():
        raise PackageError("Create the output parent directory first")
    # Refuse all existing output, including empty directories. No overwrite switch.
    destination.mkdir(mode=0o700, exist_ok=False)
    marker = destination / "INCOMPLETE.txt"
    marker.write_text("Package creation has not finished. Do not treat this directory as a completed capsule.\n", encoding="utf-8")
    filename = "nal-read-build19-" + record["sourceCommit"][:12] + ".zip"
    target = destination / filename
    # Stable order, timestamps, modes and uncompressed bytes avoid zlib-version variance.
    with target.open("xb") as stream:
        with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_STORED, allowZip64=False) as zf:
            for name, data in sorted(archive.items()):
                safe_path(name)
                zi = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                zi.create_system = 3
                zi.external_attr = 0o100644 << 16
                zi.compress_type = zipfile.ZIP_STORED
                zf.writestr(zi, data)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    (destination / (filename + ".sha256")).write_text(digest + "  " + filename + "\n", encoding="utf-8")
    summary = {**record, "archiveFile": filename, "archiveSha256": digest, "archiveEntries": len(archive)}
    (destination / "SUMMARY.json").write_bytes(json_bytes(summary))
    marker.unlink()
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd(), help="Existing local checkout; never cloned or fetched")
    parser.add_argument("--out", type=Path, required=True, help="New output directory outside checkout; parent must exist")
    args = parser.parse_args()
    try:
        repo = Path(git(args.repo.resolve(), "rev-parse", "--show-toplevel").decode().strip()).resolve()
        destination = args.out.expanduser().resolve()
        if destination == repo or repo in destination.parents or destination.exists():
            raise PackageError("Output must be a new directory outside the repository")
        archive, record = build(repo)
        summary = write_package(destination, archive, record)
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0
    except (PackageError, OSError, ValueError, KeyError, TypeError, zipfile.LargeZipFile) as exc:
        print("BUILD19 package not completed: " + str(exc), file=sys.stderr)
        print("No test, database or deployment command was executed. Any INCOMPLETE.txt output must not be used.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
