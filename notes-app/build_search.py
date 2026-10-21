#!/usr/bin/env python3
"""Write search-full.json: the whole text of every book, for the Library's
"Search every book" screen.

search-index.json (build_app.py) keeps only the first few thousand
characters of each book, so a word on page 200 of Pinel was never found.
This reads the built reader pages in content/ and indexes all of them.
build_app.py calls it at the end of every build; it can also be run alone:

    python3 notes-app/build_search.py
"""
import os, re, json, html

ROOT = os.path.dirname(os.path.abspath(__file__))


def page_text(page):
    m = re.search(r'<article class="wrap nfe-article">(.*)</article>', page, re.S)
    body = m.group(1) if m else page
    body = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", body, flags=re.S | re.I)
    body = re.sub(r"<[^>]+>", " ", body)
    return re.sub(r"\s+", " ", html.unescape(body)).strip()


def main():
    with open(os.path.join(ROOT, "manifest.json"), encoding="utf-8") as f:
        manifest = json.load(f)
    out = []
    for shelf in manifest["shelves"]:
        for c in shelf["chapters"]:
            p = os.path.join(ROOT, "content", c["slug"] + ".html")
            if not os.path.isfile(p):
                continue
            with open(p, encoding="utf-8") as f:
                out.append({"slug": c["slug"], "title": c["title"], "text": page_text(f.read())})
    with open(os.path.join(ROOT, "search-full.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"search-full.json: {len(out)} books, {sum(len(b['text']) for b in out):,} characters")


if __name__ == "__main__":
    main()
