#!/usr/bin/env python3
"""Assemble the fixed BUILD29 NAL READ frontend overlay from committed Git objects.

No network access, tests, SQL, API calls, deployment, secrets, downloads or changes
to the source checkout. The output is NOT a whole-site archive.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import zipfile

BASE = "54ef97149806b98e33ffa47229766f45c8b55082"
PLAN = "integration/nal-read/build29/overlay-plan.json"
TOOL = "scripts/package-nal-read-build29.py"
SHA = re.compile(r"^[a-f0-9]{40}$")
ATTRIBUTE = re.compile(r"""(?:src|href)=["'](/nal/assets/(?:js|css)/[^"']+)["']""")
OLD_VERSION = re.compile(r"\?v=([A-Za-z0-9._-]+)")
FORBIDDEN = re.compile(r"(^|/)(?:\.env[^/]*|node_modules|credentials[^/]*|secrets[^/]*)(?:/|$)")
SHARED = {"nal/assets/js/theme.js", "nal/assets/css/nal.css"}

class BuildError(Exception):
    pass

def git(repo, *args):
    env = {k: os.environ[k] for k in ("PATH", "SYSTEMROOT", "TEMP", "TMP", "LANG") if k in os.environ}
    env.update(GIT_NO_REPLACE_OBJECTS="1", GIT_NO_LAZY_FETCH="1",
               GIT_TERMINAL_PROMPT="0", GIT_CONFIG_NOSYSTEM="1",
               GIT_CONFIG_GLOBAL=os.devnull, GIT_OPTIONAL_LOCKS="0")
    command = ["git", "-C", str(repo), *args]
    result = subprocess.run(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, env=env, timeout=30, check=False)
    if result.returncode:
        raise BuildError("The required committed Git object is unavailable. No fetch attempted.")
    return result.stdout

def index_for(repo, commit):
    records = {}
    for row in git(repo, "ls-tree", "-r", "-l", "-z", commit).split(b"\0"):
        if not row:
            continue
        meta, raw_path = row.split(b"\t", 1)
        mode, kind, sha, size = meta.decode("ascii").split()
        path = raw_path.decode("utf-8")
        records[path] = (mode, kind, sha, int(size) if size != "-" else -1)
    return records

def belongs(path):
    if path == "nal/my/local/index.html":
        return ""
    if re.fullmatch(r"nal/(?:read|my|auth|help)/.+\.html", path) or re.fullmatch(r"nal/shop/read/.+\.html", path):
        return "html"
    if re.fullmatch(r"nal/assets/js/(?:read[^/]*\.(?:js|mjs)|account-[^/]+\.js)", path):
        return "js"
    if re.fullmatch(r"nal/assets/css/(?:nal-read[^/]*\.css|nal-account[^/]*\.css|nal-admin-context\.css|nal-operations\.css|nal-support\.css)", path):
        return "css"
    if path == "nal/data/read-seasons.json":
        return "data"
    return ""

def read(repo, index, path):
    mode, kind, sha, size = index[path]
    if kind != "blob" or mode not in ("100644", "100755") or size < 0 or size > 1024 * 1024:
        raise BuildError("Not a bounded regular text file: " + path)
    data = git(repo, "cat-file", "blob", sha)
    if len(data) != size:
        raise BuildError("Source length mismatch: " + path)
    data.decode("utf-8")
    return data, sha

def validate_links(path, source, included, version):
    if path.endswith(".html"):
        refs = ATTRIBUTE.findall(source)
        if not refs:
            raise BuildError("Page contains no local first-party assets: " + path)
        for ref in refs:
            first, _, qs = ref.partition("?")
            target = first.lstrip("/").split("#", 1)[0]
            if target not in included and target not in SHARED:
                raise BuildError("Unlisted browser dependency " + target + " in " + path)
            params = [x for x in qs.split("#", 1)[0].split("&") if x.startswith("v=")]
            if params != ["v=" + version]:
                raise BuildError("Mixed or absent asset version in " + path + ": " + target)
    elif path.endswith((".js", ".mjs")):
        for match in OLD_VERSION.finditer(source):
            if match.group(1) != version:
                raise BuildError("Mixed dynamic import asset version in " + path)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    try:
        if not SHA.fullmatch(args.source_commit):
            raise BuildError("Use a fixed forty-character source commit")
        repo = Path(git(args.repo.resolve(), "rev-parse", "--show-toplevel").decode().strip()).resolve()
        out = args.out.expanduser().resolve()
        if out.exists() or out == repo or repo in out.parents or not out.parent.is_dir():
            raise BuildError("Choose a new output directory outside the Git checkout")
        git(repo, "merge-base", "--is-ancestor", BASE, args.source_commit)
        index = index_for(repo, args.source_commit)
        plan = json.loads(read(repo, index, PLAN)[0])
        if plan["build"] != 29 or plan["sourceParent"] != BASE or plan["assetVersion"] != "read29-54ef9714":
            raise BuildError("BUILD29 plan and version mismatch")
        if read(repo, index, TOOL)[0] != Path(__file__).read_bytes():
            raise BuildError("Use the packaging tool from the exact source commit")
        selected = {p:belongs(p) for p in index if belongs(p)}
        counts = {kind:sum(x == kind for x in selected.values()) for kind in ("html", "js", "css", "data")}
        if counts != {k:plan["counts"][k] for k in counts} or len(selected) != plan["counts"]["total"]:
            raise BuildError("Frontend scope changed; reconcile before release assembly")
        if any(p not in selected for p in plan["required"]):
            raise BuildError("An essential READ entrypoint is missing")
        if any(FORBIDDEN.search(p) or ".." in PurePosixPath(p).parts for p in selected):
            raise BuildError("Unsafe path in overlay")
        files, inventory = {}, []
        for p in sorted(selected):
            data, sha = read(repo, index, p)
            validate_links(p, data.decode("utf-8"), selected, plan["assetVersion"])
            files["public-overlay/" + p] = data
            inventory.append({"path":p,"kind":selected[p],"gitBlob":sha,"sha256":hashlib.sha256(data).hexdigest(),"bytes":len(data)})
        metadata = {
            "build":29,"status":"PREPARED_NOT_DEPLOYED_NOT_TESTED",
            "sourceCommit":args.source_commit,
            "assetVersion":plan["assetVersion"],"counts":counts,"totalFiles":len(selected),
            "inventory":inventory,"sharedHostDependencies":sorted(SHARED),
            "excludedRuntimeConfig":True,"dbAppliedByThisTool":False,
            "edgeDeployedByThisTool":False,"publicReleaseChanged":False,
            "applicationTestsRun":False,"networkCalls":0,"paidResourcesCreated":0
        }
        files["OVERLAY.json"] = (json.dumps(metadata,ensure_ascii=False,sort_keys=True,indent=2)+"\n").encode()
        files["README.md"] = (
            "# NAL READ BUILD29 frontend-only overlay\n\n"
            "Copy only the public-overlay/nal/ selected paths onto the existing host. "
            "Never delete-sync the host or upload the archive root as the site root. "
            "The host's theme.js, nal.css, PDF/STORE assets and original runtime "
            "configuration must remain in place. Do not enable READ, checkout or payments "
            "from this archive. This is not a deployed or tested product.\n").encode()
        out.mkdir(mode=0o700)
        marker = out / "INCOMPLETE.txt"
        marker.write_text("Build incomplete; do not deploy.",encoding="utf-8")
        for name, data in sorted(files.items()):
            target = out / name
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(data)
        archive = out / ("nal-read-build29-"+args.source_commit[:12]+".zip")
        with zipfile.ZipFile(archive,"x",compression=zipfile.ZIP_DEFLATED,compresslevel=9,allowZip64=False) as zf:
            for name, data in sorted(files.items()):
                info = zipfile.ZipInfo(name,(1980,1,1,0,0,0))
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                zf.writestr(info,data)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        (out / (archive.name+".sha256")).write_text(digest+"  "+archive.name+"\n",encoding="ascii")
        marker.unlink()
        print(json.dumps({"status":metadata["status"],"sourceCommit":args.source_commit,
                          "assetVersion":plan["assetVersion"],"files":len(selected),
                          "archive":archive.name,"sha256":digest},ensure_ascii=False,indent=2))
        return 0
    except (BuildError, OSError, ValueError, KeyError, UnicodeError, subprocess.TimeoutExpired) as error:
        print("BUILD29 frontend assembly did not complete: "+str(error),file=sys.stderr)
        print("No tests, network request, SQL or deployment was executed.",file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
