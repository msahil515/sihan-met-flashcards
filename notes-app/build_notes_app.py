#!/usr/bin/env python3
"""
Build the standalone "Notes for Exam" app content bundle.

Reads every notes/<slug>/index.html (and a couple of loose .html notes) from the
flashcards site, strips the old chrome (gate, nav, install button, page-flip,
service-worker scripts), preserves each page's scoped <style> blocks for full
fidelity, and writes:
  notes-app/content/<slug>.html   -> clean book-reader page per note
  notes-app/manifest.json         -> shelves -> chapters (titles, blurbs, meta)
  notes-app/search-index.json     -> {slug, title, section, text} for search

Nothing is omitted: every notes page becomes a chapter. Redundancy is reduced
structurally (one canonical shelf per note, curated ordering), not by deleting
content.
"""
import os, re, json, html

ROOT = os.path.dirname(os.path.abspath(__file__))          # .../notes-app
SITE = os.path.dirname(ROOT)                                # repo root
NOTES = os.path.join(SITE, "notes")
OUT_CONTENT = os.path.join(ROOT, "content")

# ---- Shelves (curated) --------------------------------------------------
# section key -> (display name, subtitle, accent color, gradient a, gradient b)
SECTIONS = [
    ("biopsych",     "Biopsychology & Neuro",     "Brain, neurons, hormones, sleep", "#c2410c", "#7c2d12"),
    ("cognitive",    "Cognitive Psychology",      "Memory, attention, perception, thought", "#7e22ce", "#581c87"),
    ("developmental","Developmental",             "Lifespan, attachment, stage theories", "#0e7490", "#155e63"),
    ("abnormal",     "Abnormal Psychology",       "DSM/ICD, disorders, classification", "#be123c", "#831843"),
    ("assessment",   "Assessment & Tests",        "Intelligence, personality, projective tests", "#1d4ed8", "#1e3a8a"),
    ("therapy",      "Therapy, Counselling & Ethics","Psychotherapies, learning, ethics", "#15803d", "#14532d"),
    ("research",     "Research & Biostats",       "Methods, statistics, design", "#0f766e", "#134e4a"),
    ("personality",  "Personality",               "Trait, type, dynamic theories", "#a16207", "#713f12"),
    ("social",       "Social, General & Founders","Social psych, effects, theorists, foundations", "#4338ca", "#312e81"),
    ("revision",     "Mocks, Debriefs & Revision","Mock breakdowns, weak-spot fixes, revision packs", "#475569", "#1e293b"),
    ("reference",    "Complete Reference",        "Everything in one place", "#334155", "#0f172a"),
    ("more",         "More",                      "Other notes", "#52525b", "#27272a"),
]
SECTION_IDX = {k: i for i, (k, *_rest) in enumerate(SECTIONS)}

# slug -> section. (priority within section is set by this listing order)
ASSIGN = {
    "biopsych": ["action-potential", "hpa-axis", "sleep", "cranial-nerves",
                 "biopsych-cheatsheet", "biopsych-carlson", "disorders-genetic"],
    "cognitive": ["cognitive"],
    "developmental": ["dev-psych-cheatsheet", "bronfenbrenner"],
    "abnormal": ["abnormal-psych-cheatsheet", "icd", "disorders-genetic",
                 "high-yield-abnormal-dev", "abnormal-today-sprint"],
    "assessment": ["assessment", "psych-tests-deep", "intelligence-tests-deep"],
    "therapy": ["psychotherapy-cheatsheet", "counselling-sharf",
                "therapy-components", "learning-conditioning", "ethics-terms"],
    "research": ["research-methodology", "biostats-cheatsheet", "degrees-of-freedom"],
    "personality": ["personality"],
    "social": ["social-psych", "general-psych", "effects", "phenomena",
               "differentiators", "theories", "theorists", "originators"],
    "revision": ["revision-pack", "master", "met-mock-1-debrief", "mock-1-debrief",
                 "nimhans-mock-1-debrief", "nimhans-pyq-breakdown", "mphil-mock-review",
                 "pep-lite-notes", "targeted-remediation-2026-04-22"],
    "reference": ["textbook"],
}
# build slug -> (section, order)
SLUG_SECTION = {}
for sec, slugs in ASSIGN.items():
    for i, s in enumerate(slugs):
        # a slug may appear under one canonical section only -> first wins
        if s not in SLUG_SECTION:
            SLUG_SECTION[s] = (sec, i)

GATE_STYLE = "html.gate-locked body{display:none!important}"

def strip_tags(s):
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()

def extract(html_text):
    """Return (title, blurb, styles, content_html, plain_text)."""
    # collect <style> blocks (anywhere) except the gate one-liner
    styles = []
    for m in re.finditer(r"<style[^>]*>(.*?)</style>", html_text, re.S | re.I):
        css = m.group(1)
        if GATE_STYLE in css:
            continue
        styles.append(css)

    # body inner
    bm = re.search(r"<body[^>]*>(.*)</body>", html_text, re.S | re.I)
    body = bm.group(1) if bm else html_text

    # remove scripts, styles, noscript
    body = re.sub(r"<script[^>]*>.*?</script>", "", body, flags=re.S | re.I)
    body = re.sub(r"<style[^>]*>.*?</style>", "", body, flags=re.S | re.I)
    body = re.sub(r"<noscript[^>]*>.*?</noscript>", "", body, flags=re.S | re.I)
    # remove the leading nav (first <nav>...</nav>)
    body = re.sub(r"<nav[^>]*>.*?</nav>", "", body, count=1, flags=re.S | re.I)
    # remove HTML comments
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    # remove any leftover force-sync / install buttons (id based)
    body = re.sub(r'<button[^>]*id="(pwaInstallBtn|forceSyncBtn)"[^>]*>.*?</button>',
                  "", body, flags=re.S | re.I)

    # unwrap the outermost <div class="wrap"> so we don't double-nest columns
    bs = body.strip()
    m = re.match(r'<div\s+class="wrap"\s*>', bs, re.I)
    if m:
        inner = bs[m.end():]
        ci = inner.rfind("</div>")
        if ci != -1:
            inner = inner[:ci] + inner[ci + len("</div>"):]
        body = inner
    else:
        body = bs

    # title = first <h1>
    tm = re.search(r"<h1[^>]*>(.*?)</h1>", body, re.S | re.I)
    title = strip_tags(tm.group(1)) if tm else None

    # blurb = first <p> after title
    blurb = ""
    pm = re.search(r"<p[^>]*>(.*?)</p>", body, re.S | re.I)
    if pm:
        blurb = strip_tags(pm.group(1))
    if len(blurb) > 160:
        blurb = blurb[:157].rsplit(" ", 1)[0] + "..."

    plain = strip_tags(body)
    return title, blurb, "\n".join(styles), body.strip(), plain

READER_TMPL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — Notes for Exam</title>
<link rel="stylesheet" href="../../notes-style.css">
<link rel="stylesheet" href="/sihan-met-flashcards/notes/term-popover.css">
<link rel="stylesheet" href="../reader.css">
<style>
{styles}
</style>
</head>
<body class="nfe-reader">
<article class="wrap nfe-article">
{content}
</article>
<script src="/sihan-met-flashcards/notes/term-popover.js" defer></script>
</body>
</html>
"""

# a few hand-set short titles (clarity + de-duplication of "Biopsychology")
OVERRIDES = {
    "biopsych-cheatsheet": "Biopsychology",
    "biopsych-carlson": "Biopsychology (Carlson)",
    "cranial-nerves": "Cranial Nerves",
    "disorders-genetic": "Genetic Disorders",
    "icd": "ICD Classification",
    "textbook": "The Textbook",
}

def short_title(title, slug=None):
    if slug and slug in OVERRIDES:
        return OVERRIDES[slug]
    if not title:
        return ""
    # split only on spaced dashes / colon (keep commas so headwords stay intact)
    for sep in (" — ", " – ", " — ", " : ", ": "):
        if sep in title:
            title = title.split(sep)[0].strip()
            break
    # drop a trailing descriptor after a comma when the headword is substantial
    if "," in title:
        head = title.split(",")[0].strip()
        if len(head) >= 12:
            title = head
    title = title.strip()
    if len(title) > 38:
        title = title[:36].rsplit(" ", 1)[0] + "..."
    return title

def main():
    os.makedirs(OUT_CONTENT, exist_ok=True)

    # discover notes: every notes/<dir>/index.html  + loose top-level .html notes
    candidates = []
    for name in sorted(os.listdir(NOTES)):
        p = os.path.join(NOTES, name)
        if os.path.isdir(p) and os.path.isfile(os.path.join(p, "index.html")):
            candidates.append((name, os.path.join(p, "index.html")))
        elif name.endswith(".html") and name not in ("index.html", "search.html"):
            slug = name[:-5]
            candidates.append((slug, p))

    chapters = []   # dicts
    search = []
    for slug, path in candidates:
        with open(path, encoding="utf-8") as f:
            raw = f.read()
        title, blurb, styles, content, plain = extract(raw)
        if not title:
            title = slug.replace("-", " ").title()
        sec, order = SLUG_SECTION.get(slug, ("more", 99))
        # write reader page
        out = READER_TMPL.format(title=html.escape(title), styles=styles, content=content)
        with open(os.path.join(OUT_CONTENT, slug + ".html"), "w", encoding="utf-8") as f:
            f.write(out)
        words = len(plain.split())
        mins = max(1, round(words / 220))
        chapters.append({
            "slug": slug,
            "title": title,
            "short": short_title(title, slug),
            "blurb": blurb,
            "section": sec,
            "order": order,
            "words": words,
            "minutes": mins,
        })
        search.append({
            "slug": slug, "title": title, "section": sec,
            "text": plain[:6000],
        })

    # group into shelves in SECTIONS order, chapters by (order, -words)
    by_sec = {}
    for c in chapters:
        by_sec.setdefault(c["section"], []).append(c)
    shelves = []
    for key, name, subtitle, ga, gb in SECTIONS:
        accent = ga
        items = by_sec.get(key, [])
        if not items:
            continue
        items.sort(key=lambda c: (c["order"], -c["words"]))
        shelves.append({
            "key": key, "name": name, "subtitle": subtitle,
            "accent": accent, "grad": [ga, gb],
            "chapters": [
                {k: c[k] for k in ("slug", "title", "short", "blurb", "words", "minutes")}
                for c in items
            ],
        })

    total_words = sum(c["words"] for c in chapters)
    manifest = {
        "name": "Notes for Exam",
        "chapters": len(chapters),
        "words": total_words,
        "shelves": shelves,
    }
    with open(os.path.join(ROOT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, "search-index.json"), "w", encoding="utf-8") as f:
        json.dump(search, f, ensure_ascii=False)

    # stamp the service-worker cache name with a content hash so updates apply
    import hashlib
    h = hashlib.md5()
    h.update(json.dumps(manifest, sort_keys=True).encode())
    for slug in sorted(os.listdir(OUT_CONTENT)):
        with open(os.path.join(OUT_CONTENT, slug), "rb") as f:
            h.update(f.read())
    stamp = h.hexdigest()[:10]
    sw_path = os.path.join(ROOT, "sw.js")
    if os.path.isfile(sw_path):
        sw = open(sw_path, encoding="utf-8").read()
        sw = re.sub(r'var CACHE = "notes-for-exam-[^"]*";',
                    f'var CACHE = "notes-for-exam-{stamp}";', sw)
        open(sw_path, "w", encoding="utf-8").write(sw)
        print(f"stamped sw cache: notes-for-exam-{stamp}")

    print(f"built {len(chapters)} chapters across {len(shelves)} shelves, "
          f"{total_words:,} words")
    for sh in shelves:
        print(f"  {sh['name']:32s} {len(sh['chapters'])} chapters")

if __name__ == "__main__":
    main()
