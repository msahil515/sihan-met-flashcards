#!/usr/bin/env python3
"""Inject page-flip.css link + page-flip.js script into every notes/*/index.html
that already has term-popover wired up.

Idempotent: if the tags are already present, the file is left alone.
"""
from pathlib import Path
import re

NOTES_DIR = Path(__file__).resolve().parent
CSS_LINK = '<link rel="stylesheet" href="/sihan-met-flashcards/notes/page-flip.css">'
JS_TAG   = '<script src="/sihan-met-flashcards/notes/page-flip.js" defer></script>'

POPOVER_CSS_RE  = re.compile(r'<link rel="stylesheet" href="/sihan-met-flashcards/notes/term-popover\.css">')
POPOVER_JS_RE   = re.compile(r'<script src="/sihan-met-flashcards/notes/term-popover\.js"[^>]*></script>')
PAGEFLIP_CSS_RE = re.compile(r'page-flip\.css')
PAGEFLIP_JS_RE  = re.compile(r'page-flip\.js')


def patch(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if "term-popover" not in text:
        return False
    changed = False

    if not PAGEFLIP_CSS_RE.search(text):
        m = POPOVER_CSS_RE.search(text)
        if m:
            text = text[:m.end()] + "\n" + CSS_LINK + text[m.end():]
            changed = True

    if not PAGEFLIP_JS_RE.search(text):
        m = POPOVER_JS_RE.search(text)
        if m:
            text = text[:m.end()] + "\n" + JS_TAG + text[m.end():]
            changed = True

    if changed:
        path.write_text(text, encoding="utf-8")
    return changed


def main():
    targets = sorted(NOTES_DIR.glob("*/index.html"))
    n = 0
    for p in targets:
        if patch(p):
            n += 1
            print(f"  patched {p.relative_to(NOTES_DIR.parent)}")
    print(f"\n{n} pages patched.")


if __name__ == "__main__":
    main()
