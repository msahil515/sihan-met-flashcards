#!/usr/bin/env python3
"""
Build the "Systems & Theories — Answer Explanations" merged book from the live
119-question Systems & Theories mock (quiz/systems-theories/index.html).

Sihan asked to put the test-screen explanation format into the textbook library so it
reads the same way there: the correct answer + theorist up top, the concept
built from scratch in chunks, then each wrong option nailed to who it belongs to.

This reads the mock's QUESTIONS array and renders every question as a structured
explanation card using the notes-app book.css vocabulary (.exp-verdict /
.exp-concept / .traps / .trap). Output: merged/systems-theories-explained.html
(inner article HTML). After running this, run build_app.py to wrap it into a
reader page and re-stamp the SW.
"""
import os, re, json, html

ROOT = os.path.dirname(os.path.abspath(__file__))     # .../notes-app
SITE = os.path.dirname(ROOT)                           # repo root
SRC = os.path.join(SITE, "quiz", "systems-theories", "index.html")
OUT = os.path.join(ROOT, "merged", "systems-theories-explained.html")

# teaching order + labels (from the mock's SECTION_LABELS)
SECTION_ORDER = ["history", "psychodyn", "behavioural", "humanistic", "cognitive", "indian"]
SECTION_LABELS = {
    "history": "History &amp; Schools",
    "psychodyn": "Psychodynamic",
    "behavioural": "Behavioural / Learning",
    "humanistic": "Humanistic / Gestalt",
    "cognitive": "Cognitive / Consciousness",
    "indian": "Indian Psychology",
}


def extract_questions(text):
    """Pull the QUESTIONS = [ ... ] array out of the mock and JSON-parse it."""
    i = text.index("const QUESTIONS = [")
    start = text.index("[", i)
    depth, j, in_str, esc = 0, start, False, False
    while j < len(text):
        c = text[j]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c == "[":
                depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0:
                    return json.loads(text[start:j + 1])
        j += 1
    raise RuntimeError("QUESTIONS array not terminated")


def render_question(q, num):
    correct = q["correct"]
    ans_text = html.escape(q["options"][correct])
    verdict = (f'<div class="exp-verdict ok">&#10003; Answer: {correct.upper()} '
               f'&nbsp;&middot;&nbsp; <span class="exp-ans">{ans_text}</span></div>')
    concept = f'<div class="exp-concept">{q["explanation"]}</div>'

    traps = q.get("traps") or {}
    rows = []
    for l in ("a", "b", "c", "d"):
        if l != correct and q["options"].get(l) and traps.get(l):
            rows.append(
                f'<div class="trap"><span class="trap-opt">{l.upper()}. '
                f'{html.escape(q["options"][l])}</span> {traps[l]}</div>')
    traps_html = ""
    if rows:
        traps_html = ('<div class="traps"><div class="traps-h">'
                      'Why the other options are traps</div>'
                      + "".join(rows) + "</div>")

    qid = q["id"]
    qtext = html.escape(q["q"])
    return (f'<div class="qx" id="q-{qid}">'
            f'<h3><span class="qnum">Q{num}</span>{qtext}</h3>'
            f'{verdict}{concept}{traps_html}</div>')


def main():
    with open(SRC, encoding="utf-8") as f:
        text = f.read()
    questions = extract_questions(text)

    by_sec = {s: [] for s in SECTION_ORDER}
    for q in questions:
        by_sec.setdefault(q["section"], []).append(q)

    parts = []
    parts.append("<h1>Systems &amp; Theories &mdash; Answer Explanations</h1>")
    parts.append(
        '<p class="lead">Every one of the 119 questions from the Systems &amp; '
        'Theories mock, written out the way the test screen shows them: the '
        'correct answer and the theorist it belongs to up top, the concept built '
        'from scratch below, then each wrong option nailed to whose idea it '
        'actually is. Read it straight through to lock in who owns what, or jump '
        'to a school and skim the answer lines. Companion to the '
        '<strong>Systems &amp; Theories</strong> teaching book and the mock '
        'itself.</p>')

    # contents
    toc = ['<div class="booktoc"><b>In this book</b><ol>']
    for s in SECTION_ORDER:
        if by_sec.get(s):
            toc.append(f'<li><a href="#sec-{s}">{SECTION_LABELS[s]} '
                       f'({len(by_sec[s])})</a></li>')
    toc.append("</ol></div>")
    parts.append("".join(toc))

    num = 0
    for s in SECTION_ORDER:
        qs = by_sec.get(s)
        if not qs:
            continue
        parts.append(f'<h2 id="sec-{s}">{SECTION_LABELS[s]}</h2>')
        for q in qs:
            num += 1
            parts.append(render_question(q, num))

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(parts) + "\n")
    print(f"wrote {OUT}: {num} questions across "
          f"{sum(1 for s in SECTION_ORDER if by_sec.get(s))} sections")


if __name__ == "__main__":
    main()
