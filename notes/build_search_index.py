#!/usr/bin/env python3
"""Bake full-text search into the notes index.

The notes landing page (notes/index.html) has a search box that only filtered
cards by their visible text. So a term that lives *inside* a note page (e.g.
"icarus", which is on the theorists / originators pages) never matched.

This script walks every card, follows the links it points at, reads the text of
those note pages, and stores it in a `data-fulltext` attribute on the card. The
search JS then matches against card text + the text of everything it links to,
so any term on any reachable note page surfaces the card that leads to it.

Re-run this whenever note pages change:  python3 notes/build_search_index.py
"""
import html
import os
import re
import sys

NOTES_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(NOTES_DIR, "index.html")

TAG_RE = re.compile(r"<[^>]+>")
SCRIPT_STYLE_RE = re.compile(r"<(script|style)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
WS_RE = re.compile(r"\s+")
CARD_RE = re.compile(r'<(a|div)\b([^>]*\bclass="[^"]*\bcard\b[^"]*"[^>]*)>', re.IGNORECASE)
HREF_RE = re.compile(r'href="([^"]+)"')


def strip_text(markup):
    markup = SCRIPT_STYLE_RE.sub(" ", markup)
    markup = TAG_RE.sub(" ", markup)
    markup = html.unescape(markup)
    return WS_RE.sub(" ", markup).strip().lower()


def resolve(href):
    """Map an href on the notes page to a local html file, or None."""
    if not href or href[0] in "#?":
        return None
    if re.match(r"^(https?:|mailto:|tel:|javascript:)", href, re.IGNORECASE):
        return None
    path = href.split("#")[0].split("?")[0]
    if not path:
        return None
    candidate = os.path.normpath(os.path.join(NOTES_DIR, path))
    # keep it inside the repo
    repo_root = os.path.dirname(NOTES_DIR)
    if not candidate.startswith(repo_root):
        return None
    if os.path.isdir(candidate):
        candidate = os.path.join(candidate, "index.html")
    if candidate.endswith(".html") and os.path.isfile(candidate):
        return candidate
    return None


def find_card_spans(doc):
    """Return (start, end_of_open_tag, open_tag_text) for each top-level card.

    Cards can nest (a wrapper .card containing pill links), but we only annotate
    the outermost element of each card by tracking tag depth from each match.
    """
    spans = []
    for m in CARD_RE.finditer(doc):
        spans.append(m)
    return spans


def main():
    with open(INDEX, encoding="utf-8") as f:
        doc = f.read()

    # Cache page text so repeated links are cheap.
    page_cache = {}

    def page_text(fpath):
        if fpath not in page_cache:
            with open(fpath, encoding="utf-8") as f:
                page_cache[fpath] = strip_text(f.read())
        return page_cache[fpath]

    out = []
    pos = 0
    annotated = 0
    for m in find_card_spans(doc):
        open_tag = m.group(0)
        attrs = m.group(2)
        # Drop any stale data-fulltext from a previous run.
        attrs = re.sub(r'\s*data-fulltext="[^"]*"', "", attrs)

        # Gather hrefs declared on the card's own open tag (covers `<a class=card href=...>`).
        hrefs = HREF_RE.findall(open_tag)
        # Plus hrefs nested inside the card body (pill rows etc.). Grab the slice
        # from this card's open tag to the next card or end of doc.
        body_start = m.end()
        next_match = CARD_RE.search(doc, m.end())
        body_end = next_match.start() if next_match else len(doc)
        hrefs += HREF_RE.findall(doc[body_start:body_end])

        texts = []
        seen = set()
        for href in hrefs:
            fpath = resolve(href)
            if fpath and fpath not in seen:
                seen.add(fpath)
                texts.append(page_text(fpath))

        out.append(doc[pos:m.start()])
        if texts:
            blob = WS_RE.sub(" ", " ".join(texts))
            # keep attribute size sane (note pages are tens of KB; this is plenty)
            blob = html.escape(blob[:120000], quote=True)
            tag_name = m.group(1)
            new_open = f"<{tag_name}{attrs} data-fulltext=\"{blob}\">"
            out.append(new_open)
            annotated += 1
        else:
            out.append(f"<{m.group(1)}{attrs}>")
        pos = m.end()
    out.append(doc[pos:])

    with open(INDEX, "w", encoding="utf-8") as f:
        f.write("".join(out))

    print(f"Annotated {annotated} cards with full-text from {len(page_cache)} note pages.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
