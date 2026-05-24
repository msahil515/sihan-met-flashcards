#!/usr/bin/env python3
"""Build full-text search for the notes section.

Two jobs:

1. Walk EVERY note page (notes/<slug>/index.html plus standalone .html notes),
   split each page into chunks at its headings, and write `search-index.json`.
   The dedicated results page (notes/search.html) loads this and matches against
   the full text of every page, so a term that lives deep inside any note page
   surfaces, with a link straight to the chunk it lives in. This is what fixes
   "search isn't looking through everything": before, only one hop of links off
   the landing page was indexed, so anything not directly linked was invisible.

2. Re-bake `data-fulltext` onto the landing-page cards (keeps the quick inline
   filter on notes/index.html honest) and make sure every note page pulls in
   note-highlight.js so a `?q=` deep link highlights + scrolls to the match.

Re-run after any note page changes:  python3 notes/build_search_index.py
"""
import glob
import html
import json
import os
import re
import sys

NOTES_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(NOTES_DIR, "index.html")
JSON_OUT = os.path.join(NOTES_DIR, "search-index.json")
HIGHLIGHT_TAG = '<script src="/sihan-met-flashcards/notes/note-highlight.js"></script>'

TAG_RE = re.compile(r"<[^>]+>")
SCRIPT_STYLE_RE = re.compile(r"<(script|style)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
WS_RE = re.compile(r"\s+")
CARD_RE = re.compile(r'<(a|div)\b([^>]*\bclass="[^"]*\bcard\b[^"]*"[^>]*)>', re.IGNORECASE)
HREF_RE = re.compile(r'href="([^"]+)"')
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)
BODY_RE = re.compile(r"<body\b[^>]*>(.*?)</body>", re.IGNORECASE | re.DOTALL)
# A heading, capturing its attributes (for the id) and inner text.
HEADING_RE = re.compile(r'<h([1-4])\b([^>]*)>(.*?)</h\1>', re.IGNORECASE | re.DOTALL)
ID_RE = re.compile(r'\bid="([^"]+)"')

CHUNK_TEXT_CAP = 1400          # per-chunk text stored in the index
PAGE_NOTE_GLOBS = ["*/index.html", "*.html"]
SKIP_FILES = {"index.html", "search.html"}


def strip_text(markup):
    markup = SCRIPT_STYLE_RE.sub(" ", markup)
    markup = TAG_RE.sub(" ", markup)
    markup = html.unescape(markup)
    return WS_RE.sub(" ", markup).strip()


def clean_title(raw):
    t = strip_text(raw)
    # Titles run long ("Personality — the full book ... — NIMHANS + MET 2026").
    # Keep the lead clause; it reads as the page name.
    t = re.split(r"\s+[—–|:]\s+", t)[0]
    return t.strip() or "Notes"


def page_records():
    """Yield {url, title, chunks:[{heading, anchor, text}]} for every note page."""
    files = set()
    for pat in PAGE_NOTE_GLOBS:
        files.update(glob.glob(os.path.join(NOTES_DIR, pat)))

    for fpath in sorted(files):
        rel = os.path.relpath(fpath, NOTES_DIR)
        base = os.path.basename(fpath)
        if base in SKIP_FILES and os.path.dirname(rel) == "":
            continue

        with open(fpath, encoding="utf-8") as f:
            doc = f.read()

        title_m = TITLE_RE.search(doc)
        title = clean_title(title_m.group(1)) if title_m else (os.path.dirname(rel) or base)

        body_m = BODY_RE.search(doc)
        body = body_m.group(1) if body_m else doc
        body = SCRIPT_STYLE_RE.sub(" ", body)

        # URL relative to notes/ (search.html lives in notes/).
        url = os.path.dirname(rel) + "/" if rel.endswith("index.html") else rel

        chunks = []
        headings = list(HEADING_RE.finditer(body))
        if not headings:
            text = strip_text(body)
            if text:
                chunks.append({"heading": title, "anchor": "", "text": text[:CHUNK_TEXT_CAP]})
        else:
            intro = strip_text(body[: headings[0].start()])
            if intro:
                chunks.append({"heading": "(intro)", "anchor": "", "text": intro[:CHUNK_TEXT_CAP]})
            for i, hm in enumerate(headings):
                end = headings[i + 1].start() if i + 1 < len(headings) else len(body)
                heading_text = strip_text(hm.group(3)) or "(section)"
                id_m = ID_RE.search(hm.group(2))
                anchor = id_m.group(1) if id_m else ""
                text = strip_text(body[hm.start():end])
                if text:
                    chunks.append({
                        "heading": heading_text[:160],
                        "anchor": anchor,
                        "text": text[:CHUNK_TEXT_CAP],
                    })

        if chunks:
            yield {"url": url, "title": title, "chunks": chunks}


def resolve(href):
    """Map an href on the notes landing page to a local html file, or None."""
    if not href or href[0] in "#?":
        return None
    if re.match(r"^(https?:|mailto:|tel:|javascript:)", href, re.IGNORECASE):
        return None
    path = href.split("#")[0].split("?")[0]
    if not path:
        return None
    candidate = os.path.normpath(os.path.join(NOTES_DIR, path))
    repo_root = os.path.dirname(NOTES_DIR)
    if not candidate.startswith(repo_root):
        return None
    if os.path.isdir(candidate):
        candidate = os.path.join(candidate, "index.html")
    if candidate.endswith(".html") and os.path.isfile(candidate):
        return candidate
    return None


def rebake_cards():
    """Refresh data-fulltext on landing-page cards for the quick inline filter."""
    with open(INDEX, encoding="utf-8") as f:
        doc = f.read()

    page_cache = {}

    def page_text(fpath):
        if fpath not in page_cache:
            with open(fpath, encoding="utf-8") as f:
                page_cache[fpath] = strip_text(f.read()).lower()
        return page_cache[fpath]

    out, pos, annotated = [], 0, 0
    matches = list(CARD_RE.finditer(doc))
    for i, m in enumerate(matches):
        attrs = re.sub(r'\s*data-fulltext="[^"]*"', "", m.group(2))
        hrefs = HREF_RE.findall(m.group(0))
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(doc)
        hrefs += HREF_RE.findall(doc[m.end():body_end])

        texts, seen = [], set()
        for href in hrefs:
            fpath = resolve(href)
            if fpath and fpath not in seen:
                seen.add(fpath)
                texts.append(page_text(fpath))

        out.append(doc[pos:m.start()])
        if texts:
            blob = html.escape(WS_RE.sub(" ", " ".join(texts))[:120000], quote=True)
            out.append(f'<{m.group(1)}{attrs} data-fulltext="{blob}">')
            annotated += 1
        else:
            out.append(f"<{m.group(1)}{attrs}>")
        pos = m.end()
    out.append(doc[pos:])

    with open(INDEX, "w", encoding="utf-8") as f:
        f.write("".join(out))
    return annotated, len(page_cache)


def inject_highlight_script():
    """Ensure every note page loads note-highlight.js (idempotent)."""
    injected = 0
    for fpath in glob.glob(os.path.join(NOTES_DIR, "**", "*.html"), recursive=True):
        if os.path.basename(fpath) == "search.html":
            continue
        if os.path.relpath(fpath, NOTES_DIR) == "index.html":
            continue
        with open(fpath, encoding="utf-8") as f:
            doc = f.read()
        if "note-highlight.js" in doc or "</body>" not in doc:
            continue
        doc = doc.replace("</body>", f"{HIGHLIGHT_TAG}\n</body>", 1)
        with open(fpath, "w", encoding="utf-8") as f:
            f.write(doc)
        injected += 1
    return injected


def main():
    records = list(page_records())
    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump({"pages": records}, f, ensure_ascii=False, separators=(",", ":"))
    chunk_total = sum(len(r["chunks"]) for r in records)
    print(f"search-index.json: {len(records)} pages, {chunk_total} chunks "
          f"({os.path.getsize(JSON_OUT) // 1024} KB).")

    annotated, n_pages = rebake_cards()
    print(f"Re-baked data-fulltext on {annotated} cards from {n_pages} pages.")

    injected = inject_highlight_script()
    print(f"Injected note-highlight.js into {injected} note pages.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
