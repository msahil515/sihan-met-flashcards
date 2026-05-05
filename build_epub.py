#!/usr/bin/env python3
"""Build the comprehensive Sihan-MET-2026-Prep.epub from notes/*/index.html.

Run from /tmp/sihan-met-flashcards/. Outputs downloads/Sihan-MET-2026-Prep.epub.
"""
import os
import re
import shutil
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
NOTES = ROOT / "notes"
OUT = ROOT / "downloads" / "Sihan-MET-2026-Prep.epub"
BUILD = ROOT / "_epub_build"

# Chapter order: (title, source path relative to notes/, part-header text or None)
CHAPTERS = [
    ("About this book", None, None),
    ("Mock-1 Debrief, Wrong Answers + Adjacent Topics", "mock-1-debrief/index.html",
     "Part 1: Mock-1 Debrief"),
    ("Biopsychology, Full Section Cheatsheet", "biopsych-cheatsheet/index.html",
     "Part 2: Biopsychology"),
    ("Action Potential, Full Primer", "action-potential/index.html", None),
    ("Sleep, Full Primer", "sleep/index.html", None),
    ("Developmental Psychology, Full Cheatsheet", "dev-psych-cheatsheet/index.html",
     "Part 3: Developmental Psychology"),
    ("Bronfenbrenner, Ecological Systems Theory", "bronfenbrenner/index.html", None),
    ("Abnormal Psychology, Full Cheatsheet", "abnormal-psych-cheatsheet/index.html",
     "Part 4: Abnormal Psychology"),
    ("High-Yield Revision, Abnormal + Developmental", "high-yield-abnormal-dev/index.html", None),
    ("Psychological Assessment, Read-First Primer", "assessment/index.html",
     "Part 5: Psychological Assessment"),
    ("Biostatistics + Research Methodology, Full Cheatsheet",
     "biostats-cheatsheet/index.html", "Part 6: Biostatistics + Research Methods"),
    ("Research Methodology, Deep Primer", "research-methodology/index.html", None),
    ("Language Skills, Full Section Cheatsheet", "language-cheatsheet/index.html",
     "Part 7: Language Skills (English + RC)"),
]


CSS = r"""@page { margin: 12px; }
html { line-height: 1.45; font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; }
body { margin: 0; padding: 0; }
h1 { margin: 2.4em 0 0.4em 0; font-size: 1.85em; line-height: 1.25; page-break-before: always; border-bottom: 2px solid #333; padding-bottom: 4px; }
h2 { margin: 1.6em 0 0.3em 0; font-size: 1.35em; line-height: 1.3; color: #1f4d8b; }
h3 { margin: 1.2em 0 0.2em 0; font-size: 1.12em; }
h4 { margin: 1.0em 0 0.2em 0; font-size: 1.0em; color: #555; }
h1, h2, h3, h4 { font-weight: bold; page-break-after: avoid; }
p { margin: 0.7em 0; }
ul, ol { margin: 0.7em 0 0.7em 1.5em; padding: 0; }
li { margin: 0.25em 0; }
strong, b { font-weight: bold; color: #0a3d80; }
em, i { font-style: italic; }
code { font-family: Menlo, Monaco, Consolas, monospace; font-size: 0.92em; background: #f4f4f4; padding: 1px 4px; border-radius: 3px; }
pre { background: #f4f4f4; padding: 8px 10px; border-radius: 4px; overflow-x: auto; margin: 0.8em 0; font-size: 0.9em; }
pre code { background: none; padding: 0; }
blockquote { border-left: 3px solid #888; margin: 0.8em 0 0.8em 1em; padding: 4px 12px; color: #444; background: #fafafa; }
table { width: 100%; border-collapse: collapse; margin: 0.8em 0; font-size: 0.92em; }
th, td { border: 1px solid #888; padding: 5px 7px; text-align: left; vertical-align: top; }
th { background: #eaeef5; font-weight: bold; }
hr { border: 0; border-top: 1px solid #888; margin: 1.5em 0; }
nav, footer { display: none; }
.qcard { border: 1px solid #888; border-radius: 6px; padding: 10px 12px; margin: 0.8em 0; background: #fafafa; }
.qhead { font-size: 0.82em; color: #666; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
.qbody { font-weight: bold; margin: 4px 0; }
.opt-line { margin: 2px 0; padding-left: 8px; }
.opt-line.right { color: #2a6e2a; font-weight: bold; }
.opt-line.wrong { color: #aa2222; }
.verdict { margin: 6px 0; font-size: 0.88em; }
.verdict .tag { display: inline-block; padding: 1px 6px; border: 1px solid #888; border-radius: 4px; margin-right: 6px; }
.verdict .tag.bad { color: #aa2222; border-color: #aa2222; }
.verdict .tag.good { color: #2a6e2a; border-color: #2a6e2a; }
.why { background: #eef3ff; border-left: 3px solid #1f6feb; padding: 6px 10px; margin: 6px 0; font-size: 0.92em; }
.adj { background: #ecf7ec; border-left: 3px solid #2a6e2a; padding: 6px 10px; margin: 8px 0 0 0; font-size: 0.9em; }
.adj b { color: #1a5c1a; }
.banner { background: #f1f5fb; border: 1px solid #1f6feb; border-radius: 6px; padding: 10px 12px; margin: 0 0 14px 0; font-size: 0.9em; }
.banner b { color: #1f4d8b; }
.scorebox { display: block; margin: 10px 0; }
.scorebox .cell { display: inline-block; border: 1px solid #888; border-radius: 4px; padding: 6px 10px; margin: 0 6px 6px 0; font-size: 0.9em; }
.scorebox .cell .lbl { font-size: 0.78em; color: #666; text-transform: uppercase; letter-spacing: 0.06em; }
.scorebox .cell .val { font-size: 1.1em; font-weight: bold; }
.pill { display: inline-block; padding: 0 5px; margin-left: 4px; background: #eaeef5; border: 1px solid #ccc; border-radius: 3px; font-size: 0.78em; color: #555; }
.pill.guess { background: #ffe9b8; border-color: #d8a040; color: #6e4a0c; }
.anchor-list { display: none; }
"""


ABOUT_HTML = """\
<h1 id="about-this-book">About this book</h1>
<p>Compiled 2026-05-05 for Sihan's Manipal Entrance Test (MET) on 23 May 2026.</p>
<p><strong>What's inside</strong></p>
<ul>
  <li><strong>Mock-1 debrief</strong> — every wrong answer with a why and adjacent topics most likely to retest the same trick.</li>
  <li><strong>Biopsychology</strong> — full section cheatsheet plus deep primers on action potentials and sleep.</li>
  <li><strong>Developmental + Abnormal Psychology</strong> — section cheatsheets, Bronfenbrenner deep dive, high-yield revision sheet.</li>
  <li><strong>Psychological Assessment</strong> — read-first primer.</li>
  <li><strong>Biostatistics + Research Methodology</strong> — full section cheatsheet plus deep primer.</li>
  <li><strong>Language Skills</strong> — full section cheatsheet (grammar, vocab, RC).</li>
</ul>
<p><strong>How to use it.</strong> This book is your offline revision substrate. Read the section cheatsheet first, then the deep primers on the harder topics. The mock-1 debrief is structured around <em>what you actually got wrong</em> on 4 May 2026; the adjacent topics around each wrong answer are the highest-yield places to spend the next week. Re-attempt mock-1 cold in 7 days; target 80%+ in biopsych, language, biostats.</p>
<p><strong>Source weakest areas (from mock-1, 2026-05-04):</strong> Biopsych 60%, Language 60%, Biostats 70% (5/10 guesses, so the real number is shakier than the score shows). The book is weighted to those three sections.</p>
<p>Built by Claude. Errors are mine. If something looks wrong, trust DSM-5-TR, Pinel, and your textbook over this; ping Sahil and I'll patch the next build.</p>
"""


def slugify(text):
    text = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return text or "ch"


def extract_body(html_text):
    """Pull the inner content of the wrap div from a notes page, stripping nav/footer/links to other pages."""
    soup = BeautifulSoup(html_text, "html.parser")
    # body content
    wrap = soup.find("div", class_="wrap")
    if wrap is None:
        wrap = soup.body or soup
    # remove nav/footer links and stylesheet/script tags
    for tag in wrap.find_all(["nav", "footer", "script", "style"]):
        tag.decompose()
    # convert internal site links to anchor-only or plain-text labels
    for a in wrap.find_all("a"):
        href = a.get("href", "")
        if href.startswith(("#",)):
            continue
        if href.startswith("../") or href.startswith("./") or "://" not in href and not href.startswith("/"):
            # internal link: replace with bold text only (cross-references won't resolve in epub)
            a.unwrap()
        else:
            # external/anchor: keep
            pass
    # strip any remaining attributes that EPUB doesn't like (download attr etc.)
    for tag in wrap.find_all(True):
        if "download" in tag.attrs:
            del tag.attrs["download"]
    inner = "".join(str(c) for c in wrap.contents)
    return inner


def chapter_xhtml(title, inner_html, anchor_id):
    """Wrap inner content into a valid xhtml chapter."""
    safe_title = title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head>
  <meta charset="utf-8" />
  <title>{safe_title}</title>
  <link rel="stylesheet" type="text/css" href="../styles/stylesheet1.css" />
</head>
<body epub:type="bodymatter">
<section id="{anchor_id}">
{inner_html}
</section>
</body>
</html>
"""


def part_xhtml(title, anchor_id):
    safe = title.replace("&", "&amp;")
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head>
  <meta charset="utf-8" />
  <title>{safe}</title>
  <link rel="stylesheet" type="text/css" href="../styles/stylesheet1.css" />
</head>
<body epub:type="bodymatter">
<section epub:type="part" id="{anchor_id}">
  <h1 style="text-align: center; margin-top: 35%; border-bottom: none;">{safe}</h1>
</section>
</body>
</html>
"""


def title_page_xhtml(title, subtitle, date_str):
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head>
  <meta charset="utf-8" />
  <title>{title}</title>
  <link rel="stylesheet" type="text/css" href="../styles/stylesheet1.css" />
</head>
<body epub:type="frontmatter">
<section epub:type="titlepage" class="titlepage" style="text-align: center; padding-top: 20%;">
  <h1 style="border-bottom: none; font-size: 2.2em;">{title}</h1>
  <p style="font-size: 1.05em; color: #555; margin-top: 1em;">{subtitle}</p>
  <p style="margin-top: 6em; color: #888;">Built by Claude for Sihan</p>
  <p style="color: #888;">{date_str}</p>
</section>
</body>
</html>
"""


def build():
    if BUILD.exists():
        shutil.rmtree(BUILD)
    BUILD.mkdir(parents=True)

    # mimetype (must be FIRST and uncompressed in zip)
    (BUILD / "mimetype").write_text("application/epub+zip", encoding="utf-8")

    # META-INF
    meta = BUILD / "META-INF"
    meta.mkdir()
    (meta / "container.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n'
        '  <rootfiles>\n'
        '    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>\n'
        '  </rootfiles>\n'
        '</container>\n',
        encoding="utf-8",
    )

    # EPUB dir
    epub_dir = BUILD / "EPUB"
    epub_dir.mkdir()
    (epub_dir / "styles").mkdir()
    (epub_dir / "styles" / "stylesheet1.css").write_text(CSS, encoding="utf-8")
    (epub_dir / "text").mkdir()

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    book_id = str(uuid.uuid4())
    book_title = "Sihan MET 2026 Prep, Comprehensive"
    subtitle = "Mock-1 debrief, full section cheatsheets, primers, and revision sheets"
    modified = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # title page
    (epub_dir / "text" / "title_page.xhtml").write_text(
        title_page_xhtml(book_title, subtitle, today), encoding="utf-8"
    )

    # build chapters
    manifest_items = [
        ('title_page', 'text/title_page.xhtml', 'application/xhtml+xml', None),
        ('nav', 'nav.xhtml', 'application/xhtml+xml', 'nav'),
        ('css', 'styles/stylesheet1.css', 'text/css', None),
    ]
    spine = ['title_page', 'nav']
    nav_items = []  # (level, title, href)

    chapter_count = 0

    for ch_title, src, part_title in CHAPTERS:
        if part_title:
            chapter_count += 1
            part_id = f"ch{chapter_count:03d}"
            part_anchor = slugify(part_title)
            part_path = epub_dir / "text" / f"{part_id}.xhtml"
            part_path.write_text(part_xhtml(part_title, part_anchor), encoding="utf-8")
            manifest_items.append((part_id, f"text/{part_id}.xhtml", "application/xhtml+xml", None))
            spine.append(part_id)
            nav_items.append((1, part_title, f"text/{part_id}.xhtml#{part_anchor}", []))

        chapter_count += 1
        ch_id = f"ch{chapter_count:03d}"
        anchor = slugify(ch_title)

        if src is None:
            # special: about page
            inner = ABOUT_HTML.replace('id="about-this-book"', f'id="{anchor}"')
            # don't double the heading - use as is, the h1 is already inside
            (epub_dir / "text" / f"{ch_id}.xhtml").write_text(
                chapter_xhtml(ch_title, inner, anchor), encoding="utf-8"
            )
        else:
            html_text = (NOTES / src).read_text(encoding="utf-8")
            inner = extract_body(html_text)
            # extract subsection anchors for nav
            subsoup = BeautifulSoup(inner, "html.parser")
            subitems = []
            for h2 in subsoup.find_all("h2"):
                txt = h2.get_text(" ", strip=True)
                if not txt:
                    continue
                sub_id = h2.get("id") or slugify(txt)
                if not h2.get("id"):
                    h2["id"] = sub_id
                subitems.append((txt, f"text/{ch_id}.xhtml#{sub_id}"))
            inner = str(subsoup)
            (epub_dir / "text" / f"{ch_id}.xhtml").write_text(
                chapter_xhtml(ch_title, inner, anchor), encoding="utf-8"
            )
            nav_items.append((2 if part_title is None else 2, ch_title, f"text/{ch_id}.xhtml#{anchor}", subitems))

        manifest_items.append((ch_id, f"text/{ch_id}.xhtml", "application/xhtml+xml", None))
        spine.append(ch_id)

    # Build nav.xhtml
    nav_lis = []
    for level, title, href, subs in nav_items:
        safe = title.replace("&", "&amp;").replace("<", "&lt;")
        sublis = ""
        if subs:
            inner_lis = "".join(
                f'<li><a href="{h}">{t.replace("&", "&amp;").replace("<", "&lt;")}</a></li>'
                for t, h in subs
            )
            sublis = f"<ol>{inner_lis}</ol>"
        nav_lis.append(f'<li><a href="{href}">{safe}</a>{sublis}</li>')

    nav_xhtml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head>
  <meta charset="utf-8" />
  <title>{book_title}</title>
  <link rel="stylesheet" type="text/css" href="styles/stylesheet1.css" />
</head>
<body epub:type="frontmatter">
<nav epub:type="toc" role="doc-toc" id="toc">
  <h1>{book_title}</h1>
  <ol class="toc">
    {''.join(nav_lis)}
  </ol>
</nav>
<nav epub:type="landmarks" id="landmarks" hidden="hidden">
  <ol>
    <li><a href="text/title_page.xhtml" epub:type="titlepage">Title Page</a></li>
    <li><a href="#toc" epub:type="toc">Table of Contents</a></li>
  </ol>
</nav>
</body>
</html>
"""
    (epub_dir / "nav.xhtml").write_text(nav_xhtml, encoding="utf-8")

    # Build package.opf
    manifest_xml = "\n    ".join(
        (f'<item id="{i}" href="{h}" media-type="{mt}" properties="{p}"/>' if p
         else f'<item id="{i}" href="{h}" media-type="{mt}"/>')
        for i, h, mt, p in manifest_items
    )
    spine_xml = "\n    ".join(f'<itemref idref="{x}"/>' for x in spine)

    opf = f"""<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" xml:lang="en" unique-identifier="epub-id-1">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="epub-id-1">urn:uuid:{book_id}</dc:identifier>
    <dc:title>{book_title}</dc:title>
    <dc:date>{today}</dc:date>
    <dc:language>en</dc:language>
    <dc:creator>Built by Claude for Sihan</dc:creator>
    <dc:description>{subtitle}</dc:description>
    <meta property="dcterms:modified">{modified}</meta>
  </metadata>
  <manifest>
    {manifest_xml}
  </manifest>
  <spine>
    {spine_xml}
  </spine>
</package>
"""
    (epub_dir / "package.opf").write_text(opf, encoding="utf-8")

    # Zip up. mimetype must be first and stored uncompressed.
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        OUT.unlink()

    with zipfile.ZipFile(OUT, "w") as zf:
        # mimetype, no compression
        zi = zipfile.ZipInfo("mimetype")
        zi.compress_type = zipfile.ZIP_STORED
        zf.writestr(zi, "application/epub+zip")
        # everything else with deflate
        for path in sorted(BUILD.rglob("*")):
            if path.is_file() and path.name != "mimetype":
                arcname = str(path.relative_to(BUILD))
                zf.write(path, arcname=arcname, compress_type=zipfile.ZIP_DEFLATED)

    size = OUT.stat().st_size / 1024
    print(f"Built {OUT} ({size:.1f} KB)")
    print(f"Chapters: {chapter_count}")


if __name__ == "__main__":
    build()
