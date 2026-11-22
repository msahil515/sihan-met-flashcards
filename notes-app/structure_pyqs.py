#!/usr/bin/env python3
"""
Lay out the Final Exam Textbook's past-paper explanations in the structured format (T108).
Also the full General Psychology book (final-general-NN), same markup with newlines between tags,
the Systems & Theories Explained book (div.qx cards, see main_qx), the UGC NET Dec 2019
paper in exam-papers (main_ep; June 2019 and 2020 in main_ep_nokey) and the Requested Topics self-check MCQs (main_rt).

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


# UGC NET December 2019 paper (merged/exam-papers.html, section sec-dec2019). The page printed
# an "Answer: N" line per question from a copied key that does not line up with this paper
# (26 of 97 matched the textbook answers, chance level), so every answer here is worked out
# from standard textbooks; pyq-structured/exam-papers-dec2019.json keeps the old key per item.
EP_ITEM = re.compile(r'^(<p>.*)<ul>\s*<li>\(1\)(.*?)</li>\s*<li>\(2\)(.*?)</li>\s*<li>\(3\)(.*?)</li>\s*'
                     r'<li>\(4\)(.*?)</li>\s*</ul>\s*<p><strong>Answer: [^<]*</strong>.*?</p>\s*$', re.S)
EP_NEG = re.compile(r'\b(not|except|incorrect|false|odd one|excluded)\b', re.I)
EP_INTRO = re.compile(r'(<h2 id="sec-dec2019">).*?(<ol>)', re.S)


def ep_plain(x):
    x = re.sub(r'<br>', '\n', x)
    x = re.sub(r'</li>', '\n', x)
    return re.sub(r'[ \t]+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', x))).strip()


def render_ep(li, d):
    m = EP_ITEM.match(li)
    assert m, (d["i"], li[:200])
    pre, opts = m.group(1).strip(), dict(zip("1234", (t.strip() for t in m.groups()[1:])))
    assert ep_plain(pre) == d["q"], (d["i"], ep_plain(pre)[:80], d["q"][:80])
    k = d["answer"]
    assert sorted(d["wrong"]) == sorted(set(opts) - {k}), d["i"]
    label = "Best answer" if d["confidence"] == "unsure" else "Answer"
    olist = "".join(f'<li><span class="px-l">{L}</span>{t}</li>' for L, t in opts.items())
    concept = "".join(f'<p><span class="px-k">{c["h"]}</span>{c["t"]}</p>' for c in d["concept"])
    if d.get("doubt"):
        concept += f'<p><span class="px-k">Not certain</span>{d["doubt"]}</p>'
    if "old_key" not in d:  # June 2019 / 2020: no key was ever printed, nothing to unlearn
        pass
    elif d["old_key"] is None:
        concept += ('<p><span class="px-k">Old key</span>This page used to mark this question as withdrawn. '
                    'That key does not line up with this paper, so it is answered here like the rest.</p>')
    elif d["old_key"] != k:
        concept += (f'<p><span class="px-k">Old key</span>This page used to show ({d["old_key"]}) here, from a key '
                    'that does not line up with this paper. See below for why it is wrong.</p>')
    first = re.search(r'<strong>(.*?)</strong>', pre, re.S).group(1)
    head = ("Why the other options are not the answer" if EP_NEG.search(html.unescape(first))
            else "Why the other options are wrong")
    wrong = "".join(f'<li><span class="px-l">({L}) {opts[L]}</span>{d["wrong"][L]}</li>' for L in opts if L != k)
    return (f'<li class="px">{pre}\n<ul class="px-o">{olist}</ul>'
            f'<div class="px-a"><div class="px-v">&#10003; {label}: ({k}) {opts[k]}</div>'
            f'<div class="px-who">{d["who"]}</div></div>'
            f'<div class="px-c"><div class="px-h">The concept</div>{concept}</div>'
            f'<div class="px-w"><div class="px-h">{head}</div><ul>{wrong}</ul></div></li>')


def main_ep(name):
    path = os.path.join(MERGED, f"{name}.html")
    data = json.load(open(os.path.join(DATA, "exam-papers-dec2019.json"), encoding="utf-8"))
    s = open(path, encoding="utf-8").read()
    a, b = s.find('<h2 id="sec-dec2019">'), s.find('<h2 id="sec-jun2019">')
    sec = s[a:b]
    if 'class="px"' in sec:
        print(f"{name}: Dec 2019 already structured, skipped")
        return
    o1, o2 = sec.find('<ol>') + 4, sec.rfind('</ol>')
    items = re.findall(r'<li><p>.*?</li>\s*(?=<li><p>|$)', sec[o1:o2], re.S)
    assert len(items) == len(data) == 99, (len(items), len(data))
    body = "\n".join(render_ep(li[4:].strip()[:-5], d) for li, d in zip(items, data))
    sec = sec[:o1] + "\n" + body + "\n" + sec[o2:]
    changed = sum(1 for d in data if d["old_key"] and d["old_key"] != d["answer"])
    unsure = sum(1 for d in data if d["confidence"] == "unsure")
    intro = (
        '<h2 id="sec-dec2019">3. December 2019 NET paper (answers worked out)</h2>\n'
        '<p>This is the UGC NET Psychology December 2019 question paper, reproduced from the source document. '
        'This page used to print an answer key against it, but that key does not line up with this paper\'s '
        'questions: it gave the <strong>pituitary</strong> as Descartes\' seat of mind-body interaction, the '
        '<strong>key word system</strong> for acronyms, and agreed with the textbook answer on only 26 of 97 '
        'questions, about what random answers would get. So every answer below is now worked out from the '
        f'standard textbooks: {changed} of the 97 differ from the old key, and the two it marked withdrawn are '
        'answered too. '
        'Each question shows the answer and who it comes from, the concept in short chunks, and one line on why '
        'each other option is wrong. The source document ran from Q1 to Q100 with one numbering gap, so 99 '
        'questions are reproduced here.</p>\n'
        '<div class="callout trap"><div class="co-h">Trap</div><p>These answers are worked out, not an official '
        f'key. <strong>Best answer</strong> marks the {unsure} questions that are ambiguous or come from a niche '
        'source; read the "Not certain" line there, it names the runner-up option. "Old key" lines show what this '
        'page said before, so you can unlearn it.</p></div>\n')
    sec = EP_INTRO.sub(lambda m: intro + m.group(2), sec, count=1)
    s = s[:a] + sec + s[b:]
    s = s.replace("The December 2019 paper is reproduced with its official answer key;",
                  "The December 2019 paper has every answer worked out and explained (the key once printed "
                  "against it did not line up with the paper);", 1)
    s = s.replace('<a href="#sec-dec2019">December 2019 NET paper (with answer key)</a>',
                  '<a href="#sec-dec2019">December 2019 NET paper (answers worked out)</a>', 1)
    open(path, "w", encoding="utf-8").write(s)
    print(f"{name}: {len(data)} Dec 2019 questions laid out, {changed} keyed answers changed, {unsure} best-answer")


# UGC NET June 2019 and 2020 papers (same page, sections sec-jun2019 and sec-2020). No answer key
# was ever found for either, so every item said "Answer: not in key" (2020 also showed one
# candidate's pick from a response sheet). Answers worked out from standard textbooks and
# checked against a second, blind solve. Data: pyq-structured/exam-papers-jun2019.json, -2020.json.
EP_NOKEY = [
    ("sec-jun2019", "sec-2020", "exam-papers-jun2019",
     '<h2 id="sec-jun2019">4. June 2019 NET paper (answers worked out)</h2>\n'
     '<p>This is the UGC NET Psychology June 2019 question paper, reproduced verbatim from the source document. '
     'No official answer key was ever found for it, so every answer below is worked out from the standard '
     'textbooks and checked against a second, separate solve. Each question shows the answer and who it comes '
     'from, the concept in short chunks, and one line on why each other option is wrong. The paper is heavy on '
     'Assertion-Reason items, Match List I with List II items, and two passage-based statistics clusters '
     '(Q91 to 95 and Q96 to 100), each preceded by its passage.</p>\n'),
    ("sec-2020", None, "exam-papers-2020",
     '<h2 id="sec-2020">5. 2020 NET paper (answers worked out)</h2>\n'
     '<p>This is the UGC NET Psychology 2020 paper, reproduced from a candidate\'s computer-based-test response '
     'sheet (digialm portal). No official answer key was ever found for it, so every answer below is worked out '
     'from the standard textbooks and checked against a second, separate solve. The picks that candidate made '
     'are no longer shown: they were one test-taker\'s choices, not answers. Each question shows the answer and '
     'who it comes from, the concept in short chunks, and one line on why each other option is wrong.</p>\n'),
]


def main_ep_nokey(name):
    path = os.path.join(MERGED, f"{name}.html")
    s = open(path, encoding="utf-8").read()
    for sid, nxt, data_name, intro in EP_NOKEY:
        data = json.load(open(os.path.join(DATA, f"{data_name}.json"), encoding="utf-8"))
        a = s.find(f'<h2 id="{sid}">')
        b = s.find(f'<h2 id="{nxt}">') if nxt else len(s)
        sec = s[a:b]
        if 'class="px"' in sec:
            print(f"{name}: {sid} already structured, skipped")
            continue
        o1, o2 = sec.find('<ol>') + 4, sec.rfind('</ol>')
        items = re.findall(r'<li><p>.*?</li>\s*(?=<li><p>|$)', sec[o1:o2], re.S)
        assert len(items) == len(data) == 100, (sid, len(items), len(data))
        body = "\n".join(render_ep(li[4:].strip()[:-5], d) for li, d in zip(items, data))
        sec = sec[:o1] + "\n" + body + "\n" + sec[o2:]
        unsure = sum(1 for d in data if d["confidence"] == "unsure")
        trap = ('<div class="callout trap"><div class="co-h">Trap</div><p>These answers are worked out, not an '
                f'official key. <strong>Best answer</strong> marks the {unsure} questions that are ambiguous, '
                'come from a niche source or look miscopied; read the "Not certain" line there, it names the '
                'runner-up option.</p></div>\n')
        sec = re.sub(rf'<h2 id="{sid}">.*?(<ol>)', lambda m: intro + trap + m.group(1), sec, count=1, flags=re.S)
        s = s[:a] + sec + s[b:]
        print(f"{name}: {len(data)} {sid} questions laid out, {unsure} best-answer")
    s = s.replace('the June 2019 paper and the 2020 paper are reproduced verbatim from the source documents, and '
                  'because no official answer key was supplied for them, every question there is marked "Answer: '
                  'not in key" rather than guessed.',
                  'the June 2019 and 2020 papers had no answer key at all, so every answer there is worked out '
                  'and explained the same way.', 1)
    s = s.replace('<a href="#sec-jun2019">June 2019 NET paper</a>',
                  '<a href="#sec-jun2019">June 2019 NET paper (answers worked out)</a>', 1)
    s = s.replace('<a href="#sec-2020">2020 NET paper</a>',
                  '<a href="#sec-2020">2020 NET paper (answers worked out)</a>', 1)
    open(path, "w", encoding="utf-8").write(s)


# Requested Topics (merged/requested-topics.html): 49 self-check MCQs, "stem<br>(a) ..<br>..
# <b>Answer:</b> (x). one line". Data: pyq-structured/requested-topics.json.
RT_LI = re.compile(r'<li>((?:(?!</?li>).)*?<b>Answer:</b>(?:(?!</?li>).)*?)</li>', re.S)
RT_PAT = re.compile(r'^(.*?)<br>\s*\(a\)\s*(.*?)<br>\s*\(b\)\s*(.*?)<br>\s*\(c\)\s*(.*?)<br>\s*\(d\)\s*(.*?)<br>\s*'
                    r'<b>Answer:</b>\s*\(([a-d])\)\.?\s*(.*)$', re.S)


def main_rt(name):
    path = os.path.join(MERGED, f"{name}.html")
    data = json.load(open(os.path.join(DATA, f"{name}.json"), encoding="utf-8"))
    s = open(path, encoding="utf-8").read()
    if 'class="px"' in s:
        print(f"{name}: already structured, skipped")
        return
    ms = list(RT_LI.finditer(s))
    assert len(ms) == len(data), (len(ms), len(data))
    out, last = [], 0
    for m, d in zip(ms, data):
        q, a, b, c, dd, k, _ = RT_PAT.match(m.group(1)).groups()
        q = q.strip()
        assert q == d["q"], (d["i"], q[:80])
        opts = dict(a=a.strip(), b=b.strip(), c=c.strip(), d=dd.strip())
        assert sorted(d["wrong"]) == sorted(set(opts) - {k}), d["i"]
        olist = "".join(f'<li><span class="px-l">{L}</span>{t}</li>' for L, t in opts.items())
        concept = "".join(f'<p><span class="px-k">{x["h"]}</span>{x["t"]}</p>' for x in d["concept"])
        head = ("Why the other options are not the answer" if NEG.search(html.unescape(q))
                else "Why the other options are wrong")
        wrong = "".join(f'<li><span class="px-l">({L}) {opts[L]}</span>{d["wrong"][L]}</li>' for L in opts if L != k)
        out += [s[last:m.start()],
                f'<li class="px"><p class="q">{q}</p><ul class="px-o">{olist}</ul>'
                f'<div class="px-a"><div class="px-v">&#10003; Answer: ({k}) {opts[k]}</div>'
                f'<div class="px-who">{d["who"]}</div></div>'
                f'<div class="px-c"><div class="px-h">The concept</div>{concept}</div>'
                f'<div class="px-w"><div class="px-h">{head}</div><ul>{wrong}</ul></div></li>']
        last = m.end()
    open(path, "w", encoding="utf-8").write("".join(out) + s[last:])
    print(f"{name}: {len(ms)} questions laid out")


def main(names):
    for name in names:
        if name == "systems-theories-explained":
            main_qx(name)
            continue
        if name == "exam-papers":
            main_ep(name)
            main_ep_nokey(name)
            continue
        if name == "requested-topics":
            main_rt(name)
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
         + [f"final-general-{n:02d}" for n in range(1, 12)] + ["systems-theories-explained", "exam-papers", "requested-topics"])
