#!/usr/bin/env python3
"""
Lay out the Final Exam Textbook's past-paper explanations in the structured format (T108).
Also the full General Psychology book (final-general-NN), same markup with newlines between tags,
and the Systems & Theories Explained book (div.qx cards, see main_qx).

Sihan, 3 Jul: the explanation under each question "should look well structured and not
just paragraphs", then "Put it in the notes app". Each question in the "From the past
papers" list of merged/final-book-NN.html becomes:
  options one per line -> Answer block (answer + theorist/source) -> The concept (short
  labelled chunks) -> one line per wrong option saying whose idea it is / why it fails.

The split text lives in pyq-structured/final-book-NN.json (made from each question's
original explanation, every fact kept; wrong-option lines the original skipped were
added and fact-checked). This rewrites merged/final-book-NN.html in place; items already
in the new layout are left alone, so re-running is safe. Run build_app.py afterwards.
"""
import html, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
MERGED = os.path.join(ROOT, "merged")
DATA = os.path.join(ROOT, "pyq-structured")

OLD = re.compile(r'<li><p class="q">(.*?)</p>\s*<p class="opts">(.*?)</p>\s*<p class="a">'
                 r'<b>Answer( \(keyed\):| keyed:| as keyed:| \(as keyed\):|:) \(([a-e])\)\s*(.*?)</b>\s*(.*?)</p></li>', re.S)
NEG = re.compile(r'\b(NOT|INCORRECT|EXCEPT|FALSE|incorrect|not true|not correct)\b')


def split_opts(opts):
    """'(a) x (b) y ...' -> {'a': 'x', ...}; letters taken in order so 'Both (a) and (c)' stays whole."""
    o, rest = {}, opts.strip()
    for L in "abcde":
        m = re.search(r'(?:^|\s)\(' + L + r'\)\s', rest)
        if not m:
            break
        if o:
            o[list(o)[-1]] = rest[:m.start()].strip()
        o[L] = ""
        rest = rest[m.end():]
    o[list(o)[-1]] = rest.strip()
    return o


def stem(qhtml):
    s = re.sub(r'\s*<span class="src">.*?</span>', '', qhtml).strip()
    return html.unescape(re.sub(r'<[^>]+>', '', s)).strip()


def render(m, d):
    qhtml, opts_s, kw, k, ans = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
    opts = split_opts(opts_s)
    assert k in opts and sorted(d["wrong"]) == sorted(set(opts) - {k}), (d["i"], k, list(opts))
    ans = ans.strip().rstrip(".") or opts[k]
    label = "Answer (as keyed)" if kw != ":" else "Answer"
    olist = "".join(f'<li><span class="px-l">{L}</span>{t}</li>' for L, t in opts.items())
    who = f'<div class="px-who">{d["who"]}</div>' if d.get("who") else ""
    concept = "".join(f'<p><span class="px-k">{c["h"]}</span>{c["t"]}</p>' for c in d["concept"])
    head = ("Why the other options are not the answer" if NEG.search(stem(qhtml))
            else "Why the other options are wrong")
    wrong = "".join(f'<li><span class="px-l">({L}) {opts[L]}</span>{d["wrong"][L]}</li>'
                    for L in opts if L != k)
    return (f'<li class="px"><p class="q">{qhtml}</p>'
            f'<ul class="px-o">{olist}</ul>'
            f'<div class="px-a"><div class="px-v">&#10003; {label}: ({k}) {ans}</div>{who}</div>'
            f'<div class="px-c"><div class="px-h">The concept</div>{concept}</div>'
            f'<div class="px-w"><div class="px-h">{head}</div><ul>{wrong}</ul></div></li>')


# Systems & Theories Explained (merged/systems-theories-explained.html): one div.qx card per
# question with the answer, one long concept paragraph ending in Panwar's key line, and a trap
# paragraph per wrong option. Data: pyq-structured/systems-theories-explained.json.
QX = re.compile(r'<div class="qx" id="q-([^"]+)"><h3><span class="qnum">Q(\d+)</span>(.*?)</h3>'
                r'<div class="exp-verdict ok">&#10003; Answer: ([A-D]) &nbsp;&middot;&nbsp; <span class="exp-ans">(.*?)</span></div>'
                r'<div class="exp-concept">(.*?)</div>'
                r'<div class="traps"><div class="traps-h">Why the other options are traps</div>(.*?)</div></div>$', re.S | re.M)
TRAP = re.compile(r'<div class="trap"><span class="trap-opt">([A-D])\. (.*?)</span> .*?</div>', re.S)
NEG_ANY = re.compile(r'\b(not|except|incorrect|false)\b', re.I)
BOOK = re.compile(r'<span class="exp-book"><strong>Panwar key:</strong>\s*(.*?)</span>\s*$', re.S)


def render_qx(m, d):
    qid, n, qhtml, k, ans, expl, traps = m.groups()
    k = k.lower()
    opts = dict(sorted([(k, ans)] + [(L.lower(), t) for L, t in TRAP.findall(traps)]))
    assert list(opts) == list("abcd") and sorted(d["wrong"]) == sorted(set(opts) - {k}), (d["i"], list(opts))
    olist = "".join(f'<li><span class="px-l">{L}</span>{t}</li>' for L, t in opts.items())
    concept = "".join(f'<p><span class="px-k">{c["h"]}</span>{c["t"]}</p>' for c in d["concept"])
    book = BOOK.search(expl)
    if book:
        concept += f'<p><span class="px-k">Panwar key</span>{book.group(1).strip()}</p>'
    # this book's NOT stems are often lower case ("which is not a major construct")
    head = ("Why the other options are not the answer" if NEG_ANY.search(html.unescape(qhtml))
            else "Why the other options are wrong")
    wrong = "".join(f'<li><span class="px-l">({L}) {opts[L]}</span>{d["wrong"][L]}</li>'
                    for L in opts if L != k)
    return (f'<div class="qx px" id="q-{qid}"><h3><span class="qnum">Q{n}</span>{qhtml}</h3>'
            f'<ul class="px-o">{olist}</ul>'
            f'<div class="px-a"><div class="px-v">&#10003; Answer: ({k}) {ans}</div>'
            f'<div class="px-who">{d["who"]}</div></div>'
            f'<div class="px-c"><div class="px-h">The concept</div>{concept}</div>'
            f'<div class="px-w"><div class="px-h">{head}</div><ul>{wrong}</ul></div></div>')


def main_qx(name):
    path = os.path.join(MERGED, f"{name}.html")
    data = json.load(open(os.path.join(DATA, f"{name}.json"), encoding="utf-8"))
    s = open(path, encoding="utf-8").read()
    if 'class="qx px"' in s:
        print(f"{name}: already structured, skipped")
        return
    ms = list(QX.finditer(s))
    assert len(ms) == len(data) == s.count('<div class="qx"'), (name, len(ms), len(data))
    out, last = [], 0
    for m, d in zip(ms, data):
        assert m.group(1) == d["id"] and html.unescape(m.group(3)) == d["q"], (name, d["i"])
        out += [s[last:m.start()], render_qx(m, d)]
        last = m.end()
    open(path, "w", encoding="utf-8").write("".join(out) + s[last:])
    print(f"{name}: {len(ms)} questions laid out")


def main(names):
    for name in names:
        if name == "systems-theories-explained":
            main_qx(name)
            continue
        path = os.path.join(MERGED, f"{name}.html")
        data = json.load(open(os.path.join(DATA, f"{name}.json"), encoding="utf-8"))
        s = open(path, encoding="utf-8").read()
        ol = re.search(r'(<ol class="tb-pyq">)(.*?)(</ol>)', s, re.S)
        if 'class="px"' in ol.group(2):
            print(f"{name}: already structured, skipped")
            continue
        items = re.findall(r'<li>.*?</li>', ol.group(2), re.S)  # old items hold no nested lists
        assert len(items) == len(data), (name, len(items), len(data))
        out = []
        for li, d in zip(items, data):
            m = OLD.fullmatch(li)
            assert m, (name, d["i"], li[:200])
            assert stem(m.group(1)) == d["q"], (name, d["i"], stem(m.group(1))[:80], d["q"][:80])
            out.append(render(m, d))
        s = s[:ol.start(2)] + "\n" + "\n".join(out) + "\n" + s[ol.end(2):]
        open(path, "w", encoding="utf-8").write(s)
        print(f"{name}: {len(out)} questions laid out")


if __name__ == "__main__":
    main(sys.argv[1:] or [f"final-book-{n:02d}" for n in range(1, 10)]
         + [f"final-general-{n:02d}" for n in range(1, 12)] + ["systems-theories-explained"])
