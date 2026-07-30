#!/usr/bin/env python3
"""
Build the "Library" from the CONSOLIDATED books.

This replaces the old build_notes_app.py approach (which stapled every one of
the ~44 notes/<slug>/index.html pages in as its own chapter). Sihan's ask:
"one concept living in 20 sub notes becomes one clean entry, but detail stays,
nothing cut short." So the ~44 overlapping notes are merged into 13 clean books:

  - 9 MERGED books   -> notes-app/merged/<slug>.html  (authored: many notes
                        fused into one entry per concept, redundancy collapsed,
                        every unique detail kept)
  - 4 PASSTHROUGH    -> a single source note that had no real redundancy is
                        carried over verbatim (chrome stripped, scoped styles
                        preserved): cognitive, personality, lookalikes, textbook

Outputs: content/<slug>.html (reader pages), manifest.json, search-index.json,
and stamps sw.js with a content hash.
"""
import os, re, json, html, hashlib

ROOT = os.path.dirname(os.path.abspath(__file__))     # .../notes-app
SITE = os.path.dirname(ROOT)                           # repo root
NOTES = os.path.join(SITE, "notes")
MERGED = os.path.join(ROOT, "merged")
OUT_CONTENT = os.path.join(ROOT, "content")

# ---- Shelves (display order) -------------------------------------------
SECTIONS = [
    ("strategy",  "Exam Strategy",        "What actually gets tested, the repeated questions, the high-yield map", "#9d174d", "#831843"),
    ("depth",     "Textbooks in Full Depth", "The actual textbooks rewritten as explanatory prose, chapter by chapter, nothing compressed into fragments", "#7c2d12", "#431407"),
    ("core",      "Core Subjects",        "The syllabus, one merged book per subject", "#1d4ed8", "#1e3a8a"),
    ("syllabus",  "Rodrick Sir's Syllabus","Every file in the shared Drive, built unit by unit to full depth, nothing left out", "#15803d", "#14532d"),
    ("stats",     "Statistics & Psychometrics", "Statistics for the entrances built from scratch, with a diagram on every idea that has a shape", "#0f766e", "#134e4a"),
    ("systems",   "Systems & Theories",    "The whole history of psychology, every school taught from the ground up", "#0e7490", "#155e75"),
    ("amity",     "Amity",                 "Everything Amity MA Clinical in one book", "#b45309", "#78350f"),
    ("rml",       "RML — CET-166",         "The whole RML MA Clinical entrance syllabus taught from scratch", "#b91c1c", "#7f1d1d"),
    ("sgt",       "SGT University",        "The general-psychology core the SGT MA Clinical entrance samples, taught from scratch", "#2f7fc9", "#1e4e7a"),
    ("psychodidi","Study with Psycho Didi", "The full MPhil Clinical / UGC NET JRF notes set (Psycho Didi, AIR-1 CIP), folded in chapter by chapter", "#7c3aed", "#4c1d95"),
    ("reference", "Quick Reference",       "Effects, theorists, lookalikes, the one-page cram", "#7e22ce", "#581c87"),
    ("mocks",     "Mocks & Weak Spots",    "Every debrief reorganised by what kept costing marks", "#be123c", "#831843"),
    ("interview", "Interview Prep",        "Your own clinical voice, straight from your YD sessions", "#0f766e", "#134e4a"),
]

# ---- Books -------------------------------------------------------------
# kind "merged"  -> merged/<slug>.html (inner article HTML, uses book.css classes)
# kind "note"    -> notes/<src>/index.html (or notes/<src>.html), chrome stripped
BOOKS = [
    # --- Exam Strategy ---
    dict(slug="master-guide", shelf="strategy", kind="merged", search_cap=40000,
         short="Master Guide for Clinical Psychology (Amit Panwar)",
         blurb="The cheat-map of exactly what CIP, IHBAS, RML and NIMHANS test: the exam pattern analysis, the questions that actually repeat across papers, the high-yield strategy, plus an A–Z terminology glossary, 24 named therapies (founder · concepts · techniques) and 25 landmark experiments (who · year · where · what)."),
    # --- Textbooks in Full Depth (the un-condensing pass) ---
    dict(slug="pinel", shelf="depth", kind="merged", search_cap=40000,
         short="Biopsychology — Pinel & Barnes",
         blurb="All eighteen chapters of Pinel's Biopsychology written out as real explanatory prose rather than bullet fragments: every concept built from scratch in full sentences, every mechanism walked through step by step, the experiment or patient behind each claim named, the theorist named wherever there is one, and worked examples where a concept only clicks once you push a case through it. Same chapter order as the book, so it doubles as a map of it. Read a chapter cold and you finish it understanding the concept, not just recognising the words."),
    # --- Core Subjects (one merged book per subject) ---
    dict(slug="biopsychology", shelf="core", kind="merged",
         short="Biopsychology & Neuroscience",
         blurb="Neurons, action potentials, neurotransmitters, brain anatomy, cranial nerves, the HPA axis, sleep and neuro/genetic disorders, fused into one primer."),
    dict(slug="cognitive", shelf="core", kind="note", src="cognitive",
         short="Cognitive Psychology",
         blurb="Memory, attention, perception, language, thinking and reasoning, the full cognitive deep dive."),
    dict(slug="developmental", shelf="core", kind="merged",
         short="Developmental Psychology",
         blurb="Lifespan theories, attachment, Piaget, Erikson, Kohlberg and Bronfenbrenner's systems, merged."),
    dict(slug="abnormal", shelf="core", kind="merged",
         short="Abnormal Psychology",
         blurb="DSM-5 and ICD classification, every major disorder, diagnostic criteria and the high-yield traps, merged into one."),
    dict(slug="abnormal-barlow-durand", shelf="core", kind="note", src="abnormal-barlow-durand",
         short="Abnormal Psychology — Barlow & Durand",
         blurb="The actual textbook on the shelf: Barlow & Durand's integrative approach, disorder by disorder, opening each with a clinical case, with side-by-side DSM-5-TR vs ICD-11 criteria boxes and the triple-vulnerability model."),
    dict(slug="personality", shelf="core", kind="note", src="personality",
         short="Personality",
         blurb="Trait, type, psychodynamic, humanistic and behavioural theories of personality, the full deep dive."),
    dict(slug="social", shelf="core", kind="merged",
         short="Social & General Psychology",
         blurb="Attribution, attitudes, conformity, groups, prejudice plus the general-psych core and every landmark study, merged."),
    dict(slug="assessment", shelf="core", kind="merged",
         short="Assessment & Testing",
         blurb="Reliability, validity, norms, and every intelligence, personality and projective test, merged with full detail."),
    dict(slug="therapy", shelf="core", kind="merged",
         short="Therapy, Counselling & Ethics",
         blurb="Learning and conditioning, every therapy school from Freud to SFBT, common factors and ethics, merged."),
    dict(slug="research", shelf="core", kind="merged",
         short="Research Methods & Statistics",
         blurb="Research design, sampling, distributions, every statistical test, and degrees of freedom from scratch, merged."),
    # --- Rodrick Sir's Syllabus (built from the shared Drive, unit by unit) ---
    dict(slug="unit3-psychometrics", shelf="syllabus", kind="merged",
         short="Unit 3 — Psychometrics & Test Construction",
         blurb="Scales of measurement, item writing and item analysis, reliability, validity, norms and standard scores, interest and aptitude tests, plus the applications of testing, built from Rodrick Sir's decks to full depth."),
    dict(slug="unit4-biopsych", shelf="syllabus", kind="merged",
         short="Unit 4 — Biological Basis of Behaviour",
         blurb="Neurons and the action potential, neurotransmitters, the nervous system and brain divisions, the motor and sensory systems, hunger, emotion, hormones, the glandular system, sleep, behavioural genetics and the research methods of biopsychology."),
    dict(slug="unit5-cognition1", shelf="syllabus", kind="merged",
         short="Unit 5 — Attention, Perception & Memory",
         blurb="Attention forms and models, classical and operant conditioning, the fundamental learning theories, memory processes and forgetting, perception, depth and form perception, and signal detection theory."),
    dict(slug="unit6-thinking", shelf="syllabus", kind="merged",
         short="Unit 6 — Intelligence, Creativity & Thinking",
         blurb="Every theory of intelligence, creativity and nurturing it, thinking and categorization, reasoning, problem solving and the factors that shape it, decision making, decision styles and the heuristics and biases."),
    dict(slug="unit7-personality", shelf="syllabus", kind="merged",
         short="Unit 7 — Personality, Emotion & Motivation",
         blurb="The full personality treatment (psychodynamic, trait/type, humanistic, behavioural and social-cognitive) plus emotion, stress, motivation, emotional and social development, and exploratory behaviour and curiosity."),
    dict(slug="unit8-social", shelf="syllabus", kind="merged",
         short="Unit 8 — Social Psychology",
         blurb="History and theories of social psychology, social perception and attribution, social influence and group dynamics, leadership, prosocial behaviour, aggression, intergroup relations and applied social psychology."),
    dict(slug="unit9-development", shelf="syllabus", kind="merged",
         short="Unit 9 — Human Development & Intervention",
         blurb="Lifespan development and its theories, psychopathology, the full set of psychotherapies, and successful aging, with the interventions for each."),
    dict(slug="unit10-emerging", shelf="syllabus", kind="merged",
         short="Unit 10 — Emerging Areas",
         blurb="Gender and feminist psychology, feminist therapy, poverty, wellbeing models, character strengths, post-traumatic growth and cyberpsychology."),
    dict(slug="research-stats", shelf="syllabus", kind="merged",
         short="Research Methods & Statistics",
         blurb="Research paradigms and methods, designs and sampling, the t-tests, ANOVA and experimental designs, MANOVA and ANCOVA, and the non-parametric family, with a which-test-when decision table."),
    dict(slug="exam-papers", shelf="syllabus", kind="merged", search_cap=40000,
         short="UGC NET Psychology — Past Papers & Syllabus",
         blurb="The official ten-unit syllabus, how the exam works, and three past papers (2020, December 2019 and June 2019) reproduced question by question with the official answer key marked where it exists."),
    # --- Statistics & Psychometrics ---
    dict(slug="statistics", shelf="stats", kind="note", src="statistics", search_cap=40000,
         short="Statistics, from scratch with diagrams",
         blurb="The whole statistics syllabus these entrances test, built from zero to textbook depth across 17 sections with 27 computed diagrams: scales of measurement, central tendency and dispersion, skew and kurtosis, the normal curve and every standard score, sampling distributions and the central limit theorem, hypothesis testing with Type I and Type II error, power and effect size, the t tests, one-way and factorial and repeated-measures ANOVA with every post hoc test, ANCOVA, MANOVA and MANCOVA and the assumptions each one rests on, correlation in all its forms with partial and semi-partial, simple and multiple and logistic regression, the whole non-parametric family and when to switch, and the psychometrics side (reliability, validity, item analysis, item response theory, factor analysis, standardisation and norms). Ends with a which-test decision tree, a formula sheet, and a who-did-what index of sixty statisticians."),
    # --- Systems & Theories ---
    dict(slug="systems-theories", shelf="systems", kind="merged", search_cap=40000,
         short="Systems & Theories of Psychology",
         blurb="The full history-and-systems unit taught from the ground up to NIMHANS depth: structuralism, functionalism, Gestalt, behaviorism, psychoanalysis and the whole psychodynamic tree, humanistic and existential, the cognitive revolution, and Indian psychology, with every key theorist, date, and exam trap inline. Read top to bottom to see how each school answers the one before it. The companion notes to the 119-question Systems & Theories mock."),
    dict(slug="systems-theories-explained", shelf="systems", kind="merged", search_cap=40000,
         short="Systems & Theories — Answer Explanations",
         blurb="Every one of the 119 Systems & Theories mock questions written out the way the test screen shows them: the correct answer and the theorist it belongs to up top, the concept built from scratch below, then each wrong option nailed to whose idea it actually is. The full-depth explanations, now readable straight through in the library, grouped by school."),
    # --- Amity ---
    dict(slug="amity", shelf="amity", kind="merged",
         short="Amity — MA Clinical Psychology",
         blurb="The whole entrance built to the official six-section syllabus and taught from scratch to NIMHANS depth: abnormal psychology & psychopathology, biopsychology, research methods & advanced statistics, psychological testing & psychodiagnostics, psychotherapy & ethics/law, and general & developmental psychology, plus two appendices off your own paper. Read it cover to cover and you walk in ready."),
    # --- RML ---
    dict(slug="rml-study-material", shelf="rml", kind="note", src="rml-study-material", search_cap=40000,
         short="RML Clinical Psychology, from scratch",
         blurb="The whole RML MA Clinical Psychology (CET-166) subject syllabus taught from zero across 12 sections, tuned to how the RML paper actually behaves: ICD-deep abnormal, who-developed-which-therapy and the acronyms, Indian psychology past and present, and the five carrying domains (stats, research methods, social, clinical, personality and developmental). Every theorist named in full, every test names its author, every therapy names its founder."),
    # --- SGT ---
    dict(slug="sgt-study-material", shelf="sgt", kind="note", src="sgt-study-material", search_cap=40000,
         short="SGT Clinical Psychology, from scratch",
         blurb="SGT publishes no syllabus, so this teaches the general-psychology core its MA Clinical entrance actually samples, taught from zero across fourteen chapters: biopsychology, developmental, abnormal and clinical, assessment and testing, psychotherapy and counselling, statistics and research methodology, general awareness (history and schools), and full stand-alone chapters on learning and conditioning, memory and cognition, motivation and emotion, social psychology, personality, and intelligence. Every theorist named in full, every test names its author, every therapy names its founder, plus a two-stage attack plan and an interview brief for the second gate."),
    # --- Quick Reference ---
    dict(slug="concepts", shelf="reference", kind="merged",
         short="Effects, Theories & Originators",
         blurb="Every named effect, phenomenon, theory, complex and 'who originated what', one cross-referenced lookup."),
    dict(slug="lookalikes", shelf="reference", kind="note", src="differentiators",
         short="Lookalikes",
         blurb="Confusable term pairs side by side, the fast way to stop mixing up the ones that look alike."),
    dict(slug="textbook", shelf="reference", kind="note", src="textbook",
         short="The Complete Textbook",
         blurb="The whole syllabus on one page, the single-scroll cram reference when you want everything at once."),
    # --- Mocks & Weak Spots ---
    dict(slug="mocks", shelf="mocks", kind="merged",
         short="Mock Debriefs & Weak-Spot Fixes",
         blurb="Every mock debrief reorganised by weak spot, the misses that recurred and exactly how to fix them."),
    # --- Study with Psycho Didi (the 127-page MPhil Clinical / UGC NET JRF set, chapter by chapter) ---
    dict(slug="psycho-didi-history", shelf="psychodidi", kind="note", src="psycho-didi-history",
         short="History of Psychology",
         blurb="The Western timeline from the first course and Wundt's lab to positive psychology, the Greek theorists and 17th-century philosophers, every school with its founder, plus the history of psychology and clinical psychology in India and the Indian systems."),
    dict(slug="psycho-didi-research", shelf="psychodidi", kind="note", src="psycho-didi-research",
         short="Research & Statistics",
         blurb="Research designs and sampling, reliability and validity, distributions and hypothesis testing, and the parametric vs non-parametric test families, laid out in comparison tables."),
    dict(slug="psycho-didi-biology", shelf="psychodidi", kind="note", src="psycho-didi-biology",
         short="Biological Basis of Behaviour",
         blurb="Neuron structure and the action potential, neurotransmitters and their disorders, CNS/PNS, brain anatomy and the limbic system, the cranial nerves, the endocrine system and the autonomic nervous system."),
    dict(slug="psycho-didi-psychopathology", shelf="psychodidi", kind="note", src="psycho-didi-psychopathology", search_cap=40000,
         short="Psychopathology",
         blurb="The core clinical chapter: MSE and classification, then every DSM-5 group disorder by disorder with duration cutoffs and criteria, the named/eponymous and culture-bound syndromes, and a psychopharmacology reference, with the classic differential-diagnosis traps flagged."),
    dict(slug="psycho-didi-testing", shelf="psychodidi", kind="note", src="psycho-didi-testing", search_cap=40000,
         short="Psychological Testing",
         blurb="Intelligence, personality, projective and neuropsychological tests paired to their authors, age ranges and what they measure, plus reliability and validity types, test construction, norms and IQ classification ranges."),
    dict(slug="psycho-didi-interventions", shelf="psychodidi", kind="note", src="psycho-didi-interventions",
         short="Psychological Interventions",
         blurb="Every therapy family from psychodynamic and behavioural to CBT's three waves, humanistic/existential, gestalt and TA, each technique tied to its founder, with the transference, desensitisation and Beck-vs-Ellis confusables called out."),
    dict(slug="psycho-didi-health", shelf="psychodidi", kind="note", src="psycho-didi-health",
         short="Health, Ethics & Laws",
         blurb="Stress models and coping, health-behaviour models, then the ethical principles, informed consent and confidentiality, and the Indian mental-health legislation (Mental Healthcare Act 2017, RCI, RPWD)."),
    dict(slug="psycho-didi-cognitive", shelf="psychodidi", kind="note", src="psycho-didi-cognitive", search_cap=40000,
         short="Cognitive Psychology",
         blurb="Sensation and perception, attention models, the memory stores and forgetting, learning, language, thinking and problem solving, and reasoning and decision-making, each named model tied to its theorist."),
    dict(slug="psycho-didi-personality", shelf="psychodidi", kind="note", src="psycho-didi-personality",
         short="Personality & Motivation",
         blurb="Psychodynamic, trait, type, humanistic and social-learning theories of personality, each with its theorist, plus the motivation and emotion theories (James-Lange, Cannon-Bard, Schachter-Singer, Maslow, McClelland)."),
    dict(slug="psycho-didi-developmental", shelf="psychodidi", kind="note", src="psycho-didi-developmental",
         short="Developmental Psychology",
         blurb="The stage theories as tables (Piaget, Erikson, Kohlberg, Freud's psychosexual) with age ranges, plus Vygotsky, attachment, prenatal and physical development, language development and ageing."),
    dict(slug="psycho-didi-social", shelf="psychodidi", kind="note", src="psycho-didi-social",
         short="Social Psychology",
         blurb="Attitudes and attribution, conformity, obedience and group processes, prejudice, prosocial behaviour and aggression, with each classic study pinned to its researcher (Asch, Milgram, Festinger, Latané & Darley)."),
    dict(slug="psycho-didi-cheatsheets", shelf="psychodidi", kind="note", src="psycho-didi-cheatsheets", search_cap=40000,
         short="Cheat Sheets",
         blurb="The rapid-revision recall bank: who-did-what for theories, tests, therapies and experiments, the named effects, a compressed DSM table and the full discipline timeline, all as scannable tables."),
    # --- Interview Prep ---
    dict(slug="therapy-style", shelf="interview", kind="note", src="therapy-style",
         short="Your Therapeutic Style",
         blurb="Interview-ready profile built only from your own YD sessions: 14 named techniques with the real mechanics, the most-difficult-case walkthrough, and answers you can give out loud."),
]

GATE_STYLE = "html.gate-locked body{display:none!important}"

def strip_tags(s):
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()

def extract_note(html_text):
    """For passthrough notes: return (title, styles, content_html, plain)."""
    styles = []
    for m in re.finditer(r"<style[^>]*>(.*?)</style>", html_text, re.S | re.I):
        css = m.group(1)
        if GATE_STYLE in css:
            continue
        styles.append(css)
    bm = re.search(r"<body[^>]*>(.*)</body>", html_text, re.S | re.I)
    body = bm.group(1) if bm else html_text
    body = re.sub(r"<script[^>]*>.*?</script>", "", body, flags=re.S | re.I)
    body = re.sub(r"<style[^>]*>.*?</style>", "", body, flags=re.S | re.I)
    body = re.sub(r"<noscript[^>]*>.*?</noscript>", "", body, flags=re.S | re.I)
    body = re.sub(r"<nav[^>]*>.*?</nav>", "", body, count=1, flags=re.S | re.I)
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    body = re.sub(r'<button[^>]*id="(pwaInstallBtn|forceSyncBtn)"[^>]*>.*?</button>',
                  "", body, flags=re.S | re.I)
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
    tm = re.search(r"<h1[^>]*>(.*?)</h1>", body, re.S | re.I)
    title = strip_tags(tm.group(1)) if tm else None
    return title, "\n".join(styles), body.strip(), strip_tags(body)

READER_TMPL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — Library</title>
<link rel="stylesheet" href="../../notes-style.css">
<link rel="stylesheet" href="/sihan-met-flashcards/notes/term-popover.css">
<link rel="stylesheet" href="../book.css">
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

def main():
    os.makedirs(OUT_CONTENT, exist_ok=True)
    # wipe old content pages (the previous 44-chapter build); we rebuild fresh
    for fn in os.listdir(OUT_CONTENT):
        if fn.endswith(".html"):
            os.remove(os.path.join(OUT_CONTENT, fn))

    built = []
    for b in BOOKS:
        slug = b["slug"]
        if b["kind"] == "merged":
            with open(os.path.join(MERGED, slug + ".html"), encoding="utf-8") as f:
                content = f.read().strip()
            styles = ""
            tm = re.search(r"<h1[^>]*>(.*?)</h1>", content, re.S | re.I)
            title = strip_tags(tm.group(1)) if tm else b["short"]
            plain = strip_tags(content)
        else:  # passthrough note
            src = b["src"]
            p = os.path.join(NOTES, src, "index.html")
            if not os.path.isfile(p):
                p = os.path.join(NOTES, src + ".html")
            with open(p, encoding="utf-8") as f:
                raw = f.read()
            title, styles, content, plain = extract_note(raw)
            if not title:
                title = b["short"]

        out = READER_TMPL.format(title=html.escape(title), styles=styles, content=content)
        with open(os.path.join(OUT_CONTENT, slug + ".html"), "w", encoding="utf-8") as f:
            f.write(out)

        words = len(plain.split())
        # reference/glossary books carry their searchable terms past the usual
        # 6000-char window, so let a book opt into a longer search snippet.
        cap = b.get("search_cap", 6000)
        built.append(dict(
            slug=slug, title=title, short=b["short"], blurb=b["blurb"],
            shelf=b["shelf"], words=words, minutes=max(1, round(words / 220)),
            text=plain[:cap],
        ))

    # assemble shelves
    shelves = []
    for key, name, subtitle, ga, gb in SECTIONS:
        items = [c for c in built if c["shelf"] == key]
        if not items:
            continue
        shelves.append(dict(
            key=key, name=name, subtitle=subtitle, accent=ga, grad=[ga, gb],
            chapters=[{k: c[k] for k in ("slug", "title", "short", "blurb", "words", "minutes")}
                      for c in items],
        ))

    total_words = sum(c["words"] for c in built)
    manifest = dict(name="Library", chapters=len(built),
                    words=total_words, shelves=shelves)
    with open(os.path.join(ROOT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)

    search = [{"slug": c["slug"], "title": c["title"], "section": c["shelf"], "text": c["text"]}
              for c in built]
    with open(os.path.join(ROOT, "search-index.json"), "w", encoding="utf-8") as f:
        json.dump(search, f, ensure_ascii=False)

    # stamp SW cache
    h = hashlib.md5()
    h.update(json.dumps(manifest, sort_keys=True).encode())
    for fn in sorted(os.listdir(OUT_CONTENT)):
        with open(os.path.join(OUT_CONTENT, fn), "rb") as f:
            h.update(f.read())
    stamp = h.hexdigest()[:10]
    sw_path = os.path.join(ROOT, "sw.js")
    if os.path.isfile(sw_path):
        sw = open(sw_path, encoding="utf-8").read()
        sw = re.sub(r'var CACHE = "[^"]*";',
                    f'var CACHE = "library-{stamp}";', sw)
        open(sw_path, "w", encoding="utf-8").write(sw)
        print(f"stamped sw cache: library-{stamp}")

    print(f"built {len(built)} books across {len(shelves)} shelves, {total_words:,} words")
    for sh in shelves:
        print(f"  {sh['name']:24s} {len(sh['chapters'])} books")

if __name__ == "__main__":
    main()
