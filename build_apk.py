#!/usr/bin/env python3
"""
Build Sihan's two offline Android APKs from the current site, reusing the proven
WebView wrapper (classes.dex + AndroidManifest + resources.arsc) shipped in the
original MET-Prep.apk as a template. No Android SDK needed: we swap the bundled
`assets/` payload, optionally rename the package/label for the notes-only build,
re-zip, and sign with jarsigner (v1 / JAR signing, same scheme as the original).

Outputs:
  downloads/MET-Prep.apk   -> whole site  (pkg com.sihan.metprep, label "MET Prep")
  downloads/MET-Notes.apk  -> notes only  (pkg com.sihan.notes26, label "MET Note")
"""
import hashlib
import os
import re
import shutil
import subprocess
import sys
import zlib
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WORKBASE = Path(os.environ.get("APK_WORKBASE", "/tmp/apk-build"))  # outside the repo (avoid copy recursion)
TEMPLATE_APK = ROOT / "downloads" / "_template.apk"   # pristine copy of original
# Keystore path is overridable so CI can decode it from a secret to a temp file.
KEYSTORE = Path(os.environ.get("SIHAN_MET_KEYSTORE",
                               Path.home() / ".sihan-met-keystore" / "sihan-met.jks"))
KS_PASS = os.environ.get("SIHAN_MET_KS_PASS", "sihanmet2026")
KS_ALIAS = os.environ.get("SIHAN_MET_KS_ALIAS", "sihanmet")


def _find_tool(name, *fallbacks):
    """Locate an Android build-tool: env override -> PATH -> known fallbacks.

    Lets the same script build locally (homebrew android-commandlinetools) and
    in CI (Ubuntu's `apksigner`/`zipalign` apt packages, which land on PATH).
    """
    env = os.environ.get(name.upper())
    if env:
        return env
    found = shutil.which(name)
    if found:
        return found
    for fb in fallbacks:
        if Path(fb).exists():
            return str(fb)
    return name  # let subprocess surface a clear "not found"


# Android build-tools. Local: `brew install --cask android-commandlinetools` then
# `sdkmanager "build-tools;34.0.0"`. CI: `apt-get install apksigner zipalign`.
# Both produce v1+v2+v3 signatures; the scheme is what matters, not the version.
_BT = Path("/opt/homebrew/share/android-commandlinetools/build-tools/34.0.0")
ZIPALIGN = _find_tool("zipalign", _BT / "zipalign")
APKSIGNER = _find_tool("apksigner", _BT / "apksigner")

# Sections to drop from the notes-only build (everything that isn't "the notes").
NOTES_EXCLUDE_TOP = {"quiz", "tests", "results", "plan", "checklist", "games"}


def run(cmd):
    print("  $", " ".join(str(c) for c in cmd))
    subprocess.run(cmd, check=True)


def extract_template(workdir: Path):
    """Unpack template APK minus its old signature into workdir."""
    if workdir.exists():
        shutil.rmtree(workdir)
    workdir.mkdir(parents=True)
    with zipfile.ZipFile(TEMPLATE_APK) as z:
        for info in z.infolist():
            if info.filename.startswith("META-INF/") or info.filename.startswith("assets/"):
                continue
            z.extract(info, workdir)
    # Drop any stale assets dir; we rebuild it.
    assets = workdir / "assets"
    if assets.exists():
        shutil.rmtree(assets)


# ---------------------------------------------------------------------------
# Asset payload builders
# ---------------------------------------------------------------------------
def _copy(src: Path, dst: Path):
    if src.is_dir():
        shutil.copytree(src, dst, dirs_exist_ok=True)
    else:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def build_assets_full(assets: Path):
    """Whole site: copy everything except git/build cruft and nested APKs."""
    assets.mkdir(parents=True, exist_ok=True)
    skip_top = {".git", ".gitignore", "build_apk.py", "build_epub.py", "_template.apk"}
    for item in ROOT.iterdir():
        if item.name in skip_top:
            continue
        _copy(item, assets / item.name)
    # Never nest APKs or build cruft inside the APK.
    dl = assets / "downloads"
    for junk in set(dl.glob("*.apk")):
        junk.unlink()


def build_assets_notes(assets: Path):
    """Notes-only: notes pages + shared css/icons + offline epub/pdf + a notes home."""
    assets.mkdir(parents=True, exist_ok=True)
    for name in ("site.css", "notes-style.css", "manifest.webmanifest", "sw.js"):
        if (ROOT / name).exists():
            _copy(ROOT / name, assets / name)
    _copy(ROOT / "icons", assets / "icons")
    _copy(ROOT / "notes", assets / "notes")
    # Offline compiled notes (epub/pdf) are notes too; keep them, drop apks.
    dl_src, dl_dst = ROOT / "downloads", assets / "downloads"
    dl_dst.mkdir(parents=True, exist_ok=True)
    for f in dl_src.iterdir():
        if f.suffix.lower() in {".epub", ".pdf"}:
            _copy(f, dl_dst / f.name)

    rewrite_notes_links(assets / "notes")
    write_notes_home(assets / "index.html")
    write_notes_downloads_index(dl_dst / "index.html")


def rewrite_notes_links(notes_dir: Path):
    """Neutralise links that point at sections not bundled in the notes build."""
    excl = "|".join(NOTES_EXCLUDE_TOP)
    # any href reaching into an excluded top-level section -> notes home
    pat_href = re.compile(r'href="[^"]*?/(?:' + excl + r')/[^"]*"')
    for html in notes_dir.rglob("index.html"):
        txt = html.read_text(encoding="utf-8")
        if html.parent == notes_dir:
            # notes landing page: replace the full top nav with a notes-only nav
            txt = re.sub(
                r'<nav class="nav">.*?</nav>',
                '<nav class="nav">\n'
                '      <a href="/sihan-met-flashcards/index.html">Home</a>\n'
                '      <a href="./" class="active">Notes</a>\n'
                '      <a href="../downloads/">Downloads</a>\n'
                '    </nav>',
                txt, flags=re.DOTALL)
        txt = pat_href.sub('href="/sihan-met-flashcards/notes/"', txt)
        html.write_text(txt, encoding="utf-8")


def write_notes_downloads_index(path: Path):
    path.write_text("""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#0d1117">
<title>Offline notes — MET 2026</title>
<link rel="stylesheet" href="/sihan-met-flashcards/site.css"></head>
<body><main>
<div class="page-hero"><div class="crumbs">Downloads</div>
<h1>Offline copies</h1>
<p>The full notes compiled into one file for Kindle / PDF readers.</p></div>
<section><div class="grid cols-2">
<a class="card link" href="Sihan-MET-2026-Prep.epub" download>
<div class="card-head"><div><div class="card-title">EPUB</div>
<div class="card-sub">All cheatsheets + primers, one file</div></div>
<span class="badge good">epub</span></div></a>
<a class="card link" href="Sihan-MET-2026-Prep.pdf" download>
<div class="card-head"><div><div class="card-title">PDF</div>
<div class="card-sub">Same content, print-friendly</div></div>
<span class="badge">pdf</span></div></a>
</div></section>
<p style="margin-top:24px"><a href="/sihan-met-flashcards/notes/">&larr; All notes</a></p>
</main></body></html>
""", encoding="utf-8")


def write_notes_home(path: Path):
    """A clean landing page that links into every note category."""
    notes = path.parent / "notes"
    cards = []
    label = {
        "biopsych-cheatsheet": "Biopsychology cheatsheet",
        "action-potential": "Action potential",
        "cranial-nerves": "Cranial nerves I-XII",
        "hpa-axis": "HPA axis",
        "sleep": "Sleep & circadian",
        "dev-psych-cheatsheet": "Developmental psych cheatsheet",
        "bronfenbrenner": "Bronfenbrenner",
        "abnormal-psych-cheatsheet": "Abnormal psych cheatsheet",
        "abnormal-today-sprint": "Abnormal sprint",
        "disorders-genetic": "Genetic disorders",
        "icd": "ICD breakdown",
        "assessment": "Assessment cheatsheet",
        "psych-tests-deep": "Personality & projective tests",
        "intelligence-tests-deep": "Intelligence tests deep dive",
        "psychotherapy-cheatsheet": "Psychotherapy cheatsheet",
        "learning-conditioning": "Learning & conditioning",
        "personality": "Personality (Schultz & Schultz)",
        "biopsych": "Biopsychology (Pinel)",
        "social-psych": "Social psychology (Baron)",
        "cognitive": "Cognitive psychology (Eysenck)",
        "biostats-cheatsheet": "Biostats cheatsheet",
        "research-methodology": "Research methodology",
        "high-yield-abnormal-dev": "High-yield: abnormal + dev",
        "revision-pack": "Consolidated revision pack",
        "originators": "Originators (who gave what)",
        "effects": "Named effects",
        "phenomena": "Phenomena",
        "theories": "Theories",
        "theorists": "Theorists",
        "ethics-terms": "Ethics terms",
        "general-psych": "General psychology",
        "therapy-components": "Therapy components",
        "master": "Master index",
        "textbook": "Textbook chapters",
        "mock-1-debrief": "Mock 1 debrief",
        "met-mock-1-debrief": "MET Mock 1 debrief",
        "nimhans-mock-1-debrief": "NIMHANS Mock 1 debrief",
        "nimhans-pyq-breakdown": "NIMHANS PYQ breakdown",
        "pep-lite-notes": "PEP Lite Notes index (88 PDFs)",
    }
    # The three core textbooks get their own featured row, segregated from the
    # cheatsheets/sprints/debriefs so they don't get lost in the flat grid.
    textbooks = {
        "personality": ("Personality", "Schultz &amp; Schultz",
                        "Freud, neo-Freudians, traits, Big Five, humanistic, "
                        "social-cognitive, type theories, test→author pairings."),
        "social-psych": ("Social Psychology", "Baron &amp; Byrne",
                         "Attitudes, attribution, conformity, obedience, group "
                         "processes, prejudice, aggression, attraction."),
        "cognitive": ("Cognitive Psychology", "Eysenck &amp; Keane",
                      "Perception, attention, STM/working memory, LTM, language, "
                      "problem solving, judgement &amp; reasoning."),
    }
    tb_cards = []
    for d, (title, author, blurb) in textbooks.items():
        if not (notes / d / "index.html").exists():
            continue
        tb_cards.append(
            f'<a class="card link" href="notes/{d}/">'
            f'<div class="card-head"><div class="card-title">{title}</div>'
            f'<div class="card-sub">{author}</div></div>'
            f'<div class="card-body">{blurb}</div>'
            f'<div class="card-cta">Open full notes →</div></a>')
    tb_grid = "\n".join(tb_cards)

    for d in sorted(p.name for p in notes.iterdir() if p.is_dir() and (p / "index.html").exists()):
        if d in textbooks:
            continue
        title = label.get(d, d.replace("-", " ").title())
        cards.append(
            f'<a class="card link" href="notes/{d}/">'
            f'<div class="card-head"><div class="card-title">{title}</div></div></a>')
    grid = "\n".join(cards)
    path.write_text(f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#0d1117">
<title>MET Notes — Sihan</title>
<link rel="stylesheet" href="/sihan-met-flashcards/site.css">
<link rel="manifest" href="/sihan-met-flashcards/manifest.webmanifest">
<link rel="apple-touch-icon" href="/sihan-met-flashcards/icons/apple-touch-icon.png">
<style>
  .card-title{{font-weight:700}}
  main{{max-width:1100px}}
  /* Featured textbook row: visually distinct from the cheatsheet grid. */
  .tb-grid .card{{
    border:1px solid var(--accent-dim);
    background:linear-gradient(135deg,#13233d,#0f1b2e 60%,#101a16);
  }}
  .tb-grid .card-sub{{
    color:var(--accent); font-weight:600; font-size:12px;
    text-transform:uppercase; letter-spacing:1px; margin-top:2px;
  }}
  .tb-grid .card-body{{color:#c4d2e3; font-size:13px; line-height:1.5; margin-top:8px}}
  .tb-grid .card-cta{{color:var(--accent); font-size:13px; font-weight:600; margin-top:10px}}
</style></head>
<body><main>
<div class="page-hero"><div class="crumbs">Offline library</div>
<h1>MET Notes</h1>
<p>Every study note for the MET / NIMHANS 2026 prep, bundled offline. Start with
the three core textbooks below, then drill the cheatsheets. The full set also
lives in the <a href="notes/">notes index</a> and as an
<a href="downloads/">offline EPUB/PDF</a>.</p></div>
<section><div class="section-head"><h2 class="section-title">The three textbooks</h2>
<span class="section-sub">core source texts</span></div>
<div class="grid cols-3 tb-grid">
{tb_grid}
</div></section>
<section><div class="section-head"><h2 class="section-title">Cheatsheets &amp; notes</h2>
<span class="section-sub">{len(cards)} pages</span></div>
<div class="grid cols-3">
{grid}
</div></section>
</main></body></html>
""", encoding="utf-8")


# ---------------------------------------------------------------------------
# Binary patches for the notes-only package rename
# ---------------------------------------------------------------------------
def patch_manifest(path: Path):
    data = path.read_bytes()
    old = "com.sihan.metprep".encode("utf-16-le")
    new = "com.sihan.notes26".encode("utf-16-le")
    assert len(old) == len(new)
    n = data.count(old)
    data = data.replace(old, new)
    path.write_bytes(data)
    print(f"  manifest: package renamed ({n} hit)")


def patch_dex(path: Path):
    data = bytearray(path.read_bytes())
    for o, n in ((b"com/sihan/metprep", b"com/sihan/notes26"),
                 (b"com.sihan.metprep", b"com.sihan.notes26")):
        assert len(o) == len(n)
        data[:] = data.replace(o, n)
    # Recompute SHA-1 signature over bytes[32:], then adler32 over bytes[12:].
    sig = hashlib.sha1(bytes(data[32:])).digest()
    data[12:32] = sig
    csum = zlib.adler32(bytes(data[12:])) & 0xffffffff
    data[8:12] = csum.to_bytes(4, "little")
    path.write_bytes(bytes(data))
    print("  classes.dex: package renamed + checksum/signature recomputed")


def patch_arsc(path: Path):
    data = bytearray(path.read_bytes())
    # package name (UTF-16, fixed-width null-padded field)
    o16 = "com.sihan.metprep".encode("utf-16-le")
    n16 = "com.sihan.notes26".encode("utf-16-le")
    assert len(o16) == len(n16)
    data[:] = data.replace(o16, n16)
    # app label (UTF-8 string pool)
    o8, n8 = b"MET Prep", b"MET Note"
    assert len(o8) == len(n8)
    data[:] = data.replace(o8, n8)
    path.write_bytes(bytes(data))
    print("  resources.arsc: package + label renamed")


# ---------------------------------------------------------------------------
# Assemble + sign
# ---------------------------------------------------------------------------
def assemble(workdir: Path, out_apk: Path):
    unsigned = out_apk.with_suffix(".unsigned.apk")
    if unsigned.exists():
        unsigned.unlink()
    # resources.arsc must be stored uncompressed; everything else deflated.
    with zipfile.ZipFile(unsigned, "w", zipfile.ZIP_DEFLATED) as z:
        files = sorted(p for p in workdir.rglob("*") if p.is_file())
        # write resources.arsc first, stored
        for p in files:
            rel = p.relative_to(workdir).as_posix()
            if rel == "resources.arsc":
                z.write(p, rel, compress_type=zipfile.ZIP_STORED)
        for p in files:
            rel = p.relative_to(workdir).as_posix()
            if rel == "resources.arsc":
                continue
            z.write(p, rel)
    if out_apk.exists():
        out_apk.unlink()
    # zipalign (4-byte, -p aligns uncompressed .so pages) then sign with
    # apksigner so the APK gets v1 + v2 + v3 signatures. Android 11+ rejects
    # v1-only (jarsigner) APKs that target a recent SDK with "App not installed",
    # which is why the original template ships a v2/v3 block. Match it.
    aligned = out_apk.with_suffix(".aligned.apk")
    if aligned.exists():
        aligned.unlink()
    run([ZIPALIGN, "-p", "-f", "4", str(unsigned), str(aligned)])
    run([APKSIGNER, "sign",
         "--ks", str(KEYSTORE),
         "--ks-pass", f"pass:{KS_PASS}",
         "--key-pass", f"pass:{KS_PASS}",
         "--ks-key-alias", KS_ALIAS,
         "--v1-signing-enabled", "true",
         "--v2-signing-enabled", "true",
         "--v3-signing-enabled", "true",
         "--out", str(out_apk), str(aligned)])
    unsigned.unlink()
    aligned.unlink()
    idsig = out_apk.with_suffix(".apk.idsig")
    if idsig.exists():
        idsig.unlink()
    run([APKSIGNER, "verify", "--print-certs", str(out_apk)])
    print(f"  signed (v1+v2+v3) -> {out_apk}  ({out_apk.stat().st_size:,} bytes)")


def build(kind: str):
    print(f"[build] {kind}")
    workdir = WORKBASE / f"_work_{kind}"
    extract_template(workdir)
    assets = workdir / "assets"
    if kind == "full":
        build_assets_full(assets)
        out = ROOT / "downloads" / "MET-Prep.apk"
    elif kind == "notes":
        build_assets_notes(assets)
        patch_manifest(workdir / "AndroidManifest.xml")
        patch_dex(workdir / "classes.dex")
        patch_arsc(workdir / "resources.arsc")
        out = ROOT / "downloads" / "MET-Notes.apk"
    else:
        raise ValueError(kind)
    assemble(workdir, out)
    shutil.rmtree(workdir)


def ensure_template():
    """Guarantee `downloads/_template.apk` exists.

    The template is gitignored (absent from fresh clones / CI checkouts), but it's
    just the WebView wrapper with no signature/assets. The committed MET-Prep.apk
    already carries that exact wrapper (patched manifest, fullSensor orientation),
    and extract_template() strips META-INF/ + assets/ anyway, so a straight copy of
    the latest MET-Prep.apk is a valid pristine template. This is self-sustaining:
    every rebuild keeps the same wrapper, so reconstructing from it is stable.
    """
    if TEMPLATE_APK.exists():
        return
    built = ROOT / "downloads" / "MET-Prep.apk"
    if not built.exists():
        sys.exit(f"missing template and no MET-Prep.apk to reconstruct from: {TEMPLATE_APK}")
    print(f"[template] reconstructing {TEMPLATE_APK.name} from {built.name}")
    shutil.copy2(built, TEMPLATE_APK)


if __name__ == "__main__":
    kinds = sys.argv[1:] or ["full", "notes"]
    ensure_template()
    for k in kinds:
        build(k)
    print("done")
