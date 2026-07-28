#!/usr/bin/env python3
"""
Assemble the single "Amity" book source for the Library app.

Sihan asked: "put every bit of study material relevant to amity studies in the
notes for exam app under one book named as amity." Three live pages on the site
hold that material:

  amity/index.html           -> The Amity Task brief (campuses, syllabus map,
                                 PYQ depth A-E, forum read, fees, timeline, interview)
  amity-study-pack/index.html-> Entrance Study Pack (topic drills, english/aptitude
                                 chunk, scripted interview, three-campus read, drill plan)
  amity-syllabus/index.html  -> Full Jaipur AIBAS MA syllabus, paper by paper

This script fuses all three into ONE self-contained source page
(notes/amity-book/index.html) with a combined stylesheet and a top contents box,
each source becoming a titled part. build_app.py then carries it into the app as
the "Amity" book (kind="note", chrome stripped, scoped styles preserved).
"""
import os, re, html

ROOT = os.path.dirname(os.path.abspath(__file__))     # .../notes-app
SITE = os.path.dirname(ROOT)                           # repo root

SOURCES = [
    ("brief",     "amity",          "Part 1 · The Amity Brief",
     "The one-page brief on both target campuses: where they differ, the full syllabus map, the depth the entrance actually goes to, what the forums report, fees, the exam timeline and the interview."),
    ("studypack", "amity-study-pack","Part 2 · Entrance Study Pack",
     "What you sit down and drill: the topic patterns people actually reported, the general-psych recall battery, the english/aptitude chunk, the scripted interview and a three-campus read."),
    ("syllabus",  "amity-syllabus", "Part 3 · Full Syllabus (Jaipur AIBAS)",
     "The official Amity (AIBAS) MA Clinical/Counselling syllabus, transcribed paper by paper across all four semesters."),
]

GATE_STYLE = "html.gate-locked body{display:none!important}"

def read(slug):
    p = os.path.join(SITE, slug, "index.html")
    with open(p, encoding="utf-8") as f:
        return f.read()

def collect_styles(raw, seen):
    out = []
    for m in re.finditer(r"<style[^>]*>(.*?)</style>", raw, re.S | re.I):
        css = m.group(1)
        if GATE_STYLE in css:
            continue
        key = re.sub(r"\s+", "", css)
        if key in seen:
            continue
        seen.add(key)
        out.append(css.strip())
    return out

def inner_content(raw):
    """Return the content inside <div class='wrap'>, minus the leading <nav>,
    the <h1>, and the small muted 'built for you' date line right after it."""
    bm = re.search(r"<body[^>]*>(.*)</body>", raw, re.S | re.I)
    body = bm.group(1) if bm else raw
    body = re.sub(r"<script[^>]*>.*?</script>", "", body, flags=re.S | re.I)
    body = re.sub(r"<style[^>]*>.*?</style>", "", body, flags=re.S | re.I)
    body = re.sub(r"<noscript[^>]*>.*?</noscript>", "", body, flags=re.S | re.I)
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    # unwrap leading <div class="wrap">
    bs = body.strip()
    m = re.match(r'<div\s+class="wrap"\s*>', bs, re.I)
    if m:
        inner = bs[m.end():]
        ci = inner.rfind("</div>")
        if ci != -1:
            inner = inner[:ci] + inner[ci + len("</div>"):]
        bs = inner.strip()
    # drop first <nav>...</nav>
    bs = re.sub(r"<nav[^>]*>.*?</nav>", "", bs, count=1, flags=re.S | re.I)
    # capture the source <h1> text (for the part subtitle), then drop it
    h1m = re.search(r"<h1[^>]*>(.*?)</h1>", bs, re.S | re.I)
    src_h1 = re.sub(r"<[^>]+>", "", h1m.group(1)).strip() if h1m else ""
    bs = re.sub(r"<h1[^>]*>.*?</h1>", "", bs, count=1, flags=re.S | re.I)
    # drop the small muted date/provenance <p> that immediately follows the h1
    bs = re.sub(r'^\s*<p style="color: var\(--muted\)[^>]*>.*?</p>',
                "", bs.strip(), count=1, flags=re.S | re.I)
    return src_h1.strip(), bs.strip()

def main():
    seen = set()
    all_styles = []
    parts = []
    toc_rows = []
    for key, slug, part_title, part_blurb in SOURCES:
        raw = read(slug)
        all_styles += collect_styles(raw, seen)
        src_h1, content = inner_content(raw)
        if key == "brief":
            # drop the admin "Curate Amity material here" section (a placeholder
            # for folding in future sends, not study content)
            content = re.sub(
                r'<h2[^>]*id="curate"[^>]*>.*?(?=<h2[^>]*id="sources")',
                "", content, flags=re.S | re.I)
        anchor = f"amity-{key}"
        toc_rows.append(f'<li><a href="#{anchor}">{html.escape(part_title)}</a></li>')
        sub = f' <span style="font-weight:400;color:var(--muted)">— {html.escape(src_h1)}</span>' if src_h1 else ""
        parts.append(
            f'<section id="{anchor}" class="amity-part">\n'
            f'<h2 class="amity-part-h">{html.escape(part_title)}{sub}</h2>\n'
            f'<p class="amity-part-blurb">{html.escape(part_blurb)}</p>\n'
            f'{content}\n</section>'
        )

    styles = "\n".join(all_styles) + """
/* --- amity-book join layer --- */
.amity-part { margin: 0 0 14px; }
.amity-part-h { margin-top: 6px; padding-top: 18px; border-top: 3px solid var(--accent, #1d4ed8); }
#amity-brief .amity-part-h { border-top: none; padding-top: 0; }
.amity-part-blurb { color: var(--muted); font-size: 14px; margin: -2px 0 18px; max-width: 60ch; }
"""

    toc = (
        '<div class="booktoc" style="background:var(--panel-2,#f4f1ea);'
        'border:1px solid var(--border,#d9d2c2);border-radius:8px;padding:14px 20px;'
        'margin:0 0 26px;font-size:14px;line-height:1.8;">'
        '<b style="display:block;text-transform:uppercase;letter-spacing:.04em;'
        'font-size:11.5px;color:var(--muted);margin-bottom:6px;">In this book</b>'
        '<ol style="margin:0;padding-left:20px;">' + "".join(toc_rows) + '</ol></div>'
    )

    lead = ('<p class="lede">Everything Amity, in one place. The brief, the entrance '
            'study pack and the full Jaipur syllabus, fused into a single book so you '
            'can read it end to end. Covers both target campuses (Amity Jaipur, AICP/AIBAS, '
            'and Amity Greater Noida, AIPS), the MA Clinical Psychology entrance topic '
            'patterns, the english/aptitude section, the interview, the forum and fees read, '
            'and the paper-by-paper syllabus.</p>')

    doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Amity — MA Clinical Psychology (Complete Prep)</title>
<style>
{styles}
</style>
</head>
<body>
<div class="wrap">
<h1>Amity — MA Clinical Psychology</h1>
{lead}
{toc}
{''.join(parts)}
</div>
</body>
</html>
"""
    out_dir = os.path.join(SITE, "notes", "amity-book")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "index.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(doc)
    # quick word count of the visible text
    text = re.sub(r"<style[^>]*>.*?</style>", "", doc, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    words = len(text.split())
    print(f"wrote {out}  ({len(doc):,} bytes, ~{words:,} words across {len(parts)} parts)")

if __name__ == "__main__":
    main()
