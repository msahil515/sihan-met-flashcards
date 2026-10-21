#!/usr/bin/env python3
"""The figures pass for the Study with Psycho Didi shelf.

Puts the original Psycho Didi diagrams back into the 12 chapter pages
(notes/psycho-didi-<chapter>/index.html), each under the heading it belongs to.
Idempotent: it strips every existing <div class="bfigs pd-figs"> block, the
intro note and the CSS block first, so re-running after an edit to figs.json
just re-lays them out.

Sources
  psycho-didi-figs/pNNN-x.webp  crops of every content page of the 127-page PDF
                                (_resources/documents/Psycho didi Mphil notes .pdf,
                                150 dpi). Only the chapter cover pages and the
                                title-only banners are left out.
  psycho-didi-figs/figs.json    [{file, page, chapter, anchor, title, desc, w, h}],
                                anchor = exact text of the h2/h3 to sit under.

Run:  python3 notes/psycho_didi_figs.py && python3 notes-app/build_app.py
"""
import html, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
FIGDIR = os.path.join(ROOT, "psycho-didi-figs")
SRC = "/sihan-met-flashcards/notes/psycho-didi-figs/"
# The 36 MB of figures are left out of the MET Prep APK (build_apk.py) so it stays
# well under GitHub's 100 MB file limit. That APK has no internet permission, so
# there a missing image swaps itself for a one-line pointer to the online Library.
OFFLINE = "this.closest('figure').classList.add('pd-off')"

CSS = """/* pd-figs start */
.pd-figs{display:flex;flex-wrap:wrap;gap:16px;margin:16px 0 24px}
.pd-figs .bfig{flex:1 1 100%;min-width:0;margin:0;background:var(--panel-2);border:1px solid var(--border);border-radius:8px;padding:10px}
.pd-figs .bfig a{display:block}
.pd-figs .bfig img{display:block;width:100%;height:auto;margin:0 auto;border-radius:4px;background:#fff}
.pd-figs .bfig figcaption{font-family:var(--sans);font-size:12.5px;line-height:1.55;color:var(--ink2);margin-top:8px}
.pd-figs .bfig figcaption b{color:var(--text);font-weight:700}
.pd-figs .bfig figcaption span{display:block;margin-top:3px;font-size:11px;letter-spacing:.03em;color:var(--muted)}
.pd-figs .pd-off a{display:none}
.pd-figs .pd-off figcaption{margin-top:0}
.pd-figs .pd-off figcaption::after{content:"This diagram is only in the online Library (msahil515.github.io/sihan-met-flashcards/notes-app), not in the offline app.";display:block;margin-top:4px;font-size:12px;color:var(--muted)}
.pd-figs-note{border-left:3px solid var(--accent);background:var(--panel-2);padding:10px 16px;margin:16px 0;border-radius:0 6px 6px 0;font-size:14.5px}
/* pd-figs end */
"""

NOTE = ('<div class="pd-figs-note"><b>Original diagrams.</b> {n} diagrams from the Psycho Didi PDF '
        '(pages {p0} to {p1}) sit under the section they belong to, exactly as drawn. '
        'Tap one to open it full size and zoom in.</div>')


def heading_text(inner):
    return html.unescape(re.sub(r"<[^>]+>", "", inner)).strip()


def figure(f):
    src = SRC + f["file"]
    title = html.escape(f["title"])
    # a small panel should not be blown up past the size the page draws it at
    cap = round(f["w"] * 0.6)
    return ('<figure class="bfig" id="pd-{id}"><a href="{src}" target="_blank" rel="noopener">'
            '<img src="{src}" width="{w}" height="{h}" style="max-width:{cap}px" loading="lazy" decoding="async" '
            'onerror="{off}" alt="{title}"></a>'
            '<figcaption><b>{title}.</b> {desc} <span>Psycho Didi notes &middot; p.&nbsp;{page}</span></figcaption></figure>'
            ).format(id=f["file"][:-5], src=src, w=f["w"], h=f["h"], cap=cap, off=OFFLINE,
                     title=title, desc=html.escape(f["desc"]), page=f["page"])


def main():
    figs = json.load(open(os.path.join(FIGDIR, "figs.json"), encoding="utf-8"))
    missing = [f["file"] for f in figs if not os.path.isfile(os.path.join(FIGDIR, f["file"]))]
    if missing:
        sys.exit(f"missing image files: {missing[:5]}")
    by_ch = {}
    for f in figs:
        by_ch.setdefault(f["chapter"], []).append(f)

    for ch, items in sorted(by_ch.items()):
        path = os.path.join(ROOT, ch, "index.html")
        t = open(path, encoding="utf-8").read()
        # strip the previous pass
        t = re.sub(r'<div class="bfigs pd-figs">.*?</div>\n?', "", t, flags=re.S)
        t = re.sub(r'<div class="pd-figs-note">.*?</div>\n?', "", t, flags=re.S)
        t = re.sub(r"/\* pd-figs start \*/.*?/\* pd-figs end \*/\n?", "", t, flags=re.S)

        # CSS into the page's own <style> (build_app carries it into the Library reader)
        m = re.search(r"<style>(?!html\.gate-locked)", t)
        t = t[:m.end()] + "\n" + CSS + t[m.end():]

        groups = {}
        for f in sorted(items, key=lambda f: f["file"]):
            groups.setdefault(f["anchor"], []).append(f)
        heads = list(re.finditer(r"<(h[23])\b[^>]*>(.*?)</\1>", t, re.S))
        by_text = {}
        for h in heads:
            by_text.setdefault(heading_text(h.group(2)), h)
        unplaced = [a for a in groups if a not in by_text]
        if unplaced:
            sys.exit(f"{ch}: anchors not found: {unplaced}")
        # insert from the bottom up so earlier offsets stay valid
        for anchor in sorted(groups, key=lambda a: by_text[a].end(), reverse=True):
            block = '\n<div class="bfigs pd-figs">' + "".join(figure(f) for f in groups[anchor]) + "</div>\n"
            e = by_text[anchor].end()
            t = t[:e] + block + t[e:]

        pages = sorted({f["page"] for f in items})
        note = NOTE.format(n=len(items), p0=pages[0], p1=pages[-1])
        fm = re.search(r'<div class="focus">.*?</div>\n', t, re.S) or re.search(r"<h1[^>]*>.*?</h1>\n", t, re.S)
        t = t[:fm.end()] + note + "\n" + t[fm.end():]

        open(path, "w", encoding="utf-8").write(t)
        print(f"{ch:30s} {len(items):3d} figures under {len(groups):2d} headings (pp. {pages[0]}-{pages[-1]})")


if __name__ == "__main__":
    main()
