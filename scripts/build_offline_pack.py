#!/usr/bin/env python3
"""Build downloads/MET-Prep-Offline.zip: the whole site as one folder that runs
from file:// on a laptop with no internet (double-click START.html).

What changes in the copy (the live site is untouched):
  * /sihan-met-flashcards/... paths become relative to each page.
  * Folder links ("quiz/x/") get "index.html", since file:// shows a folder
    listing instead of the index page.
  * Links to files too big to bundle (APKs, print PDFs, Psycho Didi figures)
    point at the live site instead.
  * Browsers block fetch() on file://, so every .json/.md file and every
    Library chapter also ships as a small .js twin under _offline/, and a shim
    at the top of each page answers fetch() from those twins.
  * Library chapters are shown via srcdoc, because on file:// Chrome will not
    let the Library script reach into an iframe loaded from another file.
  * force-sync.js (the "Update" pill) is a no-op: there is nothing to update.

Run from the repo root:  python3 scripts/build_offline_pack.py
"""
import base64
import json
import os
import re
import shutil
import sys
import zipfile
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
LIVE = "https://msahil515.github.io/sihan-met-flashcards/"
NAME = "MET-Prep-Offline"
BUILD = Path("/tmp/offpack-build")
OUT_ZIP = ROOT / "downloads" / (NAME + ".zip")

SKIP_TOP = {".git", ".github", ".gitignore", "scripts", "testsapp", "namelock-app",
            "redesign-preview", "theme-preview", "downloads"}
SKIP_DIRS = {"__pycache__", "node_modules", ".DS_Store"}
SKIP_PATHS = {"notes/psycho-didi-figs",   # 35 MB, live-only in the APK too
              "notes-app/merged"}         # build input for the Library, not served
DOWNLOADS_KEEP = {"index.html", "build-guide.html", "the-pdf-skill.html", "backup"}

ABS = re.compile(r"(?<![\w.:/-])/sihan-met-flashcards/")
ATTR = re.compile(r"""(\s(?:href|src|data-href|action)=)(["'])([^"'<>]*?)\2""", re.I)
NAV = re.compile(r"""(location\.(?:replace|assign)\(\s*|location\.href\s*=\s*)(["'])([^"'+]*/)\2""")
SCHEME = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|//|#|\$\{)", re.I)

SHIM = r"""<script>/* offline pack */(function(){if(location.protocol!=="file:")return;
var R=new URL("__PREFIX__",location.href).href,RP=new URL(R).pathname,real=window.fetch&&window.fetch.bind(window),S={};
window.__OFFLINE_PACK=R;window.__offPut=function(k,t){S[k]=t;};
function rel(u){try{var x=new URL(u,location.href);}catch(e){return null;}if(x.protocol!=="file:")return null;
var p=decodeURIComponent(x.pathname);return p.indexOf(RP)===0?p.slice(RP.length):null;}
function twin(k){if(k in S)return Promise.resolve(S[k]);return new Promise(function(ok,no){var s=document.createElement("script");
s.src=R+"_offline/"+k.split("/").map(encodeURIComponent).join("/")+".js";s.onload=function(){s.remove();(k in S)?ok(S[k]):no();};
s.onerror=function(){s.remove();no();};(document.head||document.documentElement).appendChild(s);});}
window.__offTwin=twin;
window.fetch=function(i,o){var u=typeof i==="string"?i:(i&&i.url)||String(i),k=rel(u);if(k===null)return real(i,o);
var t=/\.json$/i.test(k)?"application/json":/\.html?$/i.test(k)?"text/html":"text/plain";
return twin(k).then(function(b){return new Response(b,{status:200,headers:{"Content-Type":t+"; charset=utf-8"}});},
function(){return new Response("",{status:404});});};
function fix(a){var h=a.getAttribute("href");if(!h||/^(#|javascript:|mailto:|tel:|https?:)/i.test(h))return;
var x;try{x=new URL(h,location.href);}catch(e){return;}if(x.protocol!=="file:")return;
var p=x.pathname,i=p.indexOf("/sihan-met-flashcards/");if(p.indexOf(RP)!==0&&i===0)p=RP+p.slice(22);
if(/\/$/.test(p))p+="index.html";if(p!==x.pathname){x.pathname=p;a.href=x.href;}}
window.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(a)fix(a);},true);
})();</script>
"""

def copy_site():
    if BUILD.exists():
        shutil.rmtree(BUILD)
    dst_root = BUILD / NAME
    for src in ROOT.rglob("*"):
        rel = src.relative_to(ROOT)
        parts = rel.parts
        if parts[0] in SKIP_TOP or any(p in SKIP_DIRS for p in parts):
            continue
        if any(rel.as_posix() == s or rel.as_posix().startswith(s + "/") for s in SKIP_PATHS):
            continue
        if src.is_dir() or src.suffix == ".py" or src.name.endswith(".test.js"):
            continue
        out = dst_root / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, out)
    dl = ROOT / "downloads"
    for name in DOWNLOADS_KEEP:
        s = dl / name
        if s.is_dir():
            shutil.copytree(s, dst_root / "downloads" / name)
        elif s.exists():
            (dst_root / "downloads").mkdir(parents=True, exist_ok=True)
            shutil.copy2(s, dst_root / "downloads" / name)
    return dst_root


def fix_url(val, page_dir, pack):
    """Return the file://-safe form of a relative URL found in page_dir."""
    if not val or SCHEME.match(val) or any(c in val for c in " +'\"\\"):
        return val
    cut = min([i for i in (val.find("?"), val.find("#")) if i >= 0] or [len(val)])
    path, tail = val[:cut], val[cut:]
    if not path or "${" in path or "{{" in path:
        return val
    if path.endswith("/"):
        path += "index.html"
    elif path in (".", ".."):
        path += "/index.html"
    target = (page_dir / unquote(path)).resolve()
    try:
        rel_to_pack = target.relative_to(pack.resolve())
    except ValueError:
        return path + tail
    if not target.exists() and (ROOT / rel_to_pack).exists():
        return LIVE + rel_to_pack.as_posix() + tail   # too big to bundle: use the live copy
    return path + tail


def rewrite_html(f, pack):
    depth = len(f.relative_to(pack).parts) - 1
    prefix = "../" * depth or "./"
    txt = f.read_text(encoding="utf-8", errors="surrogateescape")
    txt = ABS.sub(prefix, txt)
    txt = re.sub(r"<link[^>]*rel=[\"']preload[\"'][^>]*as=[\"']font[\"'][^>]*>\n?", "", txt)  # fonts are inlined
    txt = ATTR.sub(lambda m: m.group(1) + m.group(2) + fix_url(m.group(3), f.parent, pack) + m.group(2), txt)
    txt = NAV.sub(lambda m: m.group(1) + m.group(2) + fix_url(m.group(3), f.parent, pack) + m.group(2), txt)
    # No HTTP charset header on file://, so the charset meta must stay in the first 1 KB.
    shim = '<meta charset="utf-8">\n' + SHIM.replace("__PREFIX__", prefix)
    m = re.search(r"<head[^>]*>", txt, re.I)
    txt = txt[:m.end()] + "\n" + shim + txt[m.end():] if m else shim + txt
    f.write_text(txt, encoding="utf-8", errors="surrogateescape")


def write_twins(pack):
    n = 0
    for f in list(pack.rglob("*")):
        rel = f.relative_to(pack).as_posix()
        if not f.is_file() or rel.startswith("_offline/"):
            continue
        if f.suffix.lower() in (".json", ".md") or re.match(r"notes-app/content/[^/]+\.html$", rel):
            body = f.read_text(encoding="utf-8", errors="replace")
            out = pack / "_offline" / (rel + ".js")
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text("__offPut(%s,%s);\n" % (json.dumps(rel), json.dumps(body)), encoding="utf-8")
            n += 1
    return n


def patch_library_reader(pack):
    """Load each chapter into the reader iframe via srcdoc (same origin as the
    Library page on file://), with a <base> so its relative links still work."""
    app = pack / "notes-app" / "app.js"
    js = app.read_text(encoding="utf-8")
    old = """'<iframe id="reader" title="' + esc(e.title) + '" src="content/' + esc(slug) + '.html"></iframe>' +"""
    assert old in js, "Library reader iframe markup changed; update patch_library_reader"
    js = js.replace(old, """'<iframe id="reader" title="' + esc(e.title) + '"></iframe>' +""")
    hook = "function renderReader(slug, params) {"
    assert hook in js
    js = js.replace(hook, hook + """
    setTimeout(function () {   /* offline pack: srcdoc keeps the chapter same-origin on file:// */
      var fr = document.getElementById("reader"); if (!fr) return;
      window.__offTwin("notes-app/content/" + slug + ".html").then(function (t) {
        var base = '<base href="' + new URL("content/" + slug + ".html", location.href).href + '">';
        fr.srcdoc = /<head[^>]*>/i.test(t) ? t.replace(/<head[^>]*>/i, function (h) { return h + base; }) : base + t;
      });
    }, 0);""", 1)
    app.write_text(js, encoding="utf-8")


def inline_fonts(pack):
    """Chrome refuses web fonts loaded from file://, so embed them in the CSS."""
    for css in pack.rglob("*.css"):
        txt = css.read_text(encoding="utf-8")
        def data_uri(m):
            font = (css.parent / m.group(2)).resolve()
            if not font.is_file():
                return m.group(0)
            return "url(data:font/woff2;base64,%s)" % base64.b64encode(font.read_bytes()).decode()
        new = re.sub(r"""url\((["']?)([^"'():]+\.woff2)\1\)""", data_uri, txt)
        if new != txt:
            css.write_text(new, encoding="utf-8")


def write_extras(pack):
    (pack / "force-sync.js").write_text("/* offline pack: no update button, nothing to sync */\n")
    (pack / "START.html").write_text(
        '<!doctype html><meta charset="utf-8"><title>MET Prep offline</title>'
        '<meta http-equiv="refresh" content="0; url=index.html">'
        '<p style="font:16px sans-serif;padding:24px">Opening <a href="index.html">MET Prep</a>...</p>\n')
    (pack / "READ-ME-FIRST.txt").write_text("""MET PREP, OFFLINE DESKTOP PACK
==============================

The whole site in one folder, working with the WiFi off:
  - every mock and PYQ paper on the test screen, with the full explanations
  - the Library (every book, Final Exam Textbook included) and the notes
  - the trackers, admissions pages, plans and the rest of the site

How to use it
  1. Unzip it and keep the whole folder together.
  2. Double-click START.html. Chrome or Edge work best.
  3. Same passphrase as the site, you type it once.

Your answers are saved in this browser on this laptop. They don't sync with
your phone or tab unless you're online and use Sync.

Needs internet (opens the live site):
  - APK and print PDF downloads, Psycho Didi's diagrams, college websites,
    Google Drive links. The news board shows the copy from the day this pack
    was built.

Built %s from commit %s.
""" % (os.environ.get("PACK_DATE", ""), os.environ.get("PACK_COMMIT", "")))


def zip_pack(pack):
    tmp = OUT_ZIP.with_suffix(".zip.tmp")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in sorted(pack.rglob("*")):
            if f.is_file():
                z.write(f, Path(NAME) / f.relative_to(pack))
    tmp.replace(OUT_ZIP)


def main():
    pack = copy_site()
    for f in pack.rglob("*.html"):
        rewrite_html(f, pack)
    patch_library_reader(pack)
    inline_fonts(pack)
    n = write_twins(pack)
    write_extras(pack)
    if "--no-zip" not in sys.argv:
        zip_pack(pack)
        print("wrote", OUT_ZIP, round(OUT_ZIP.stat().st_size / 1e6, 1), "MB")
    print("pack at", pack, "twins:", n)


if __name__ == "__main__":
    main()
