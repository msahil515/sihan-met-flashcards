#!/usr/bin/env python3
"""
Over-the-air content for the Tests and Name Lock APKs, so new mocks/cards reach
the installed apps without a fresh APK download.

Each app bundles a fixed set of web files (assets/www). This script lists that
set per app (the APK build scripts copy from the same list) and writes
downloads/ota/<app>.json: {"files": {asset_path: [site_path, sha256]}}.
On launch the app fetches that manifest from the live site, downloads only the
files whose hash differs from what it already has, verifies every hash, and
serves the new copies from the next launch on (see MainActivity.java).

Usage: python3 ota.py     (CI runs it on every push that touches app content)
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "downloads" / "ota"
SHARED = ("sync.js", "syncqr.js", "qrlib.js", "study.js", "study-pages.json", "voice-input.js")  # live at the asset root in both apps


def _tree(src_dir, prefix=""):
    d = ROOT / src_dir
    return [(prefix + p.relative_to(d).as_posix(), p) for p in sorted(d.rglob("*")) if p.is_file()]


def payload(app):
    """[(asset_path, source_file)] bundled under assets/www for `app` ("tests" | "namelock")."""
    if app == "tests":
        files = _tree("tests-app")
        files += [("take/" + f.name, f) for f in sorted((ROOT / "take").glob("data-*.js"))
                  if f.name != "data-mock.js"]  # not loaded by take/screen.html either
        files.append(("take/speak.js", ROOT / "take" / "speak.js"))
    elif app == "namelock":
        files = _tree("name-lock/app") + [("data.js", ROOT / "name-lock" / "data.js")]
    else:
        raise ValueError(app)
    return files + [(f, ROOT / f) for f in SHARED]


def manifest(app):
    return {"files": {a: [src.relative_to(ROOT).as_posix(), hashlib.sha256(src.read_bytes()).hexdigest()]
                      for a, src in payload(app)}}


def dump(m):
    return json.dumps(m, indent=0, sort_keys=True) + "\n"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for app in ("tests", "namelock"):
        m = manifest(app)
        (OUT / f"{app}.json").write_text(dump(m))
        print(f"{app}: {len(m['files'])} files -> downloads/ota/{app}.json")


if __name__ == "__main__":
    main()
