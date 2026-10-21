#!/usr/bin/env python3
"""T095 sweep: give surname-only theorist mentions their first name.

Rule: in every scope (h2/h3 section, and each trap/callout/Q&A box on its own),
the first mention of a mapped surname gets the given name inserted before it,
unless the person is already named in full earlier in that scope, the surname is
part of an eponym (Broca's area, Stanford-Binet, Piaget stages), or the scope also
names a different person with that surname (Anna Freud, Floyd Allport).
Pure insertions into text nodes; tags, headings, links, svg and quotes untouched.

usage: fullnames.py [--apply] [--report out.tsv] FILE...
"""
import re, sys, html

# surname -> given names (site style). Only surnames that are unambiguous in psych text.
GIVEN = {
 # psychodynamic / personality
 "Freud": "Sigmund", "Jung": "Carl", "Adler": "Alfred", "Horney": "Karen", "Fromm": "Erich",
 "Erikson": "Erik", "Mahler": "Margaret", "Winnicott": "Donald", "Kohut": "Heinz",
 "Kernberg": "Otto", "Klein": "Melanie", "Sullivan": "Harry Stack", "Breuer": "Josef",
 "Charcot": "Jean-Martin", "Mesmer": "Franz", "Kretschmer": "Ernst", "Sheldon": "William",
 "Allport": "Gordon", "Cattell": "Raymond", "Eysenck": "Hans", "McCrae": "Robert",
 "Costa": "Paul", "McClelland": "David", "Rotter": "Julian", "Mischel": "Walter",
 "Kelly": "George", "Maslow": "Abraham", "Rogers": "Carl", "Cloninger": "Robert",
 "McAdams": "Dan", "Bandura": "Albert",
 # development
 "Piaget": "Jean", "Vygotsky": "Lev", "Kohlberg": "Lawrence", "Gilligan": "Carol",
 "Bowlby": "John", "Ainsworth": "Mary", "Bronfenbrenner": "Urie", "Baumrind": "Diana",
 "Gesell": "Arnold", "Marcia": "James", "Kagan": "Jerome", "Rothbart": "Mary",
 "Levinson": "Daniel", "Havighurst": "Robert", "Baltes": "Paul", "Schaie": "K. Warner",
 "Vaillant": "George", "Lorenz": "Konrad", "Tinbergen": "Niko", "Harlow": "Harry",
 "Spitz": "René", "Blatt": "Sidney", "Rutter": "Michael", "Lenneberg": "Eric",
 # learning
 "Pavlov": "Ivan", "Skinner": "B. F.", "Watson": "John B.", "Thorndike": "Edward",
 "Tolman": "Edward", "Hull": "Clark", "Guthrie": "Edwin", "Premack": "David",
 "Rescorla": "Robert", "Kamin": "Leon", "Garcia": "John", "Seligman": "Martin",
 "Mowrer": "O. Hobart", "Dollard": "John", "Estes": "William",
 # therapy
 "Ellis": "Albert", "Beck": "Aaron", "Meichenbaum": "Donald", "Wolpe": "Joseph",
 "Linehan": "Marsha", "Glasser": "William", "Berne": "Eric", "Frankl": "Viktor",
 "Perls": "Fritz", "Yalom": "Irvin", "Moreno": "Jacob", "Minuchin": "Salvador",
 "Satir": "Virginia", "Haley": "Jay", "Bateson": "Gregory", "Kinsey": "Alfred",
 # cognition / perception / language
 "Ebbinghaus": "Hermann", "Bartlett": "Frederic", "Broadbent": "Donald",
 "Treisman": "Anne", "Kahneman": "Daniel", "Tversky": "Amos", "Sperling": "George",
 "Neisser": "Ulric", "Loftus": "Elizabeth", "Chomsky": "Noam", "Whorf": "Benjamin Lee",
 "Sapir": "Edward", "Bruner": "Jerome", "Rosch": "Eleanor", "Wason": "Peter",
 "Duncker": "Karl", "Shiffrin": "Richard", "Baddeley": "Alan", "Tulving": "Endel",
 "Craik": "Fergus", "Lockhart": "Robert", "Paivio": "Allan", "Posner": "Michael",
 "Newell": "Allen", "Cherry": "Colin", "Moray": "Neville", "Marr": "David",
 "Biederman": "Irving", "Hubel": "David", "Wiesel": "Torsten", "Hering": "Ewald",
 # gestalt / history
 "Köhler": "Wolfgang", "Kohler": "Wolfgang", "Wertheimer": "Max", "Koffka": "Kurt",
 "Lewin": "Kurt", "Wundt": "Wilhelm", "Titchener": "Edward", "Fechner": "Gustav",
 "Galton": "Francis", "Külpe": "Oswald", "Dewey": "John", "Brentano": "Franz",
 "Descartes": "René", "Hobbes": "Thomas", "Kant": "Immanuel", "Darwin": "Charles",
 "Woodworth": "Robert", "Münsterberg": "Hugo", "Witmer": "Lightner", "Gall": "Franz Joseph",
 "Flourens": "Pierre", "Romanes": "George", "Goddard": "Henry",
 # intelligence / testing
 "Binet": "Alfred", "Terman": "Lewis", "Spearman": "Charles",
 "Thurstone": "L. L.", "Guilford": "J. P.", "Gardner": "Howard", "Sternberg": "Robert",
 "Jensen": "Arthur", "Flynn": "James", "Goleman": "Daniel", "Salovey": "Peter",
 "Cronbach": "Lee", "Torrance": "E. Paul", "Selfridge": "Oliver", "Messick": "Samuel",
 "Osgood": "Charles", "Bogardus": "Emory", "Luria": "Alexander",
 # biopsych
 "Hebb": "Donald", "Lashley": "Karl", "Sperry": "Roger", "Gazzaniga": "Michael",
 "Penfield": "Wilder", "Broca": "Paul", "Wernicke": "Carl", "Selye": "Hans",
 "Cannon": "Walter", "Bard": "Philip", "Lange": "Carl", "Schachter": "Stanley",
 "Plutchik": "Robert", "Ekman": "Paul", "Sherrington": "Charles", "Loewi": "Otto",
 "Kandel": "Eric", "Olds": "James", "Papez": "James", "MacLean": "Paul",
 "LeDoux": "Joseph", "Damasio": "Antonio", "Scoville": "William", "Kleitman": "Nathaniel",
 "Aserinsky": "Eugene", "Dement": "William", "Rizzolatti": "Giacomo", "Sapolsky": "Robert",
 "Golgi": "Camillo",
 # social
 "Zajonc": "Robert", "Festinger": "Leon", "Asch": "Solomon", "Milgram": "Stanley",
 "Zimbardo": "Philip", "Sherif": "Muzafer", "Heider": "Fritz", "Kelley": "Harold",
 "Weiner": "Bernard", "Darley": "John", "Latané": "Bibb", "Latane": "Bibb",
 "Cialdini": "Robert", "Tajfel": "Henri", "Triplett": "Norman", "Ringelmann": "Max",
 "Janis": "Irving", "Moscovici": "Serge", "Hovland": "Carl", "Cacioppo": "John",
 "Fishbein": "Martin", "Ajzen": "Icek", "Pettigrew": "Thomas", "Berkowitz": "Leonard",
 "Batson": "C. Daniel", "Thibaut": "John", "Homans": "George", "Rusbult": "Caryl",
 "Nisbett": "Richard", "Rosenthal": "Robert", "Rosenhan": "David", "Hazan": "Cindy",
 "Rokeach": "Milton", "Goffman": "Erving",
 # clinical / health / positive / org
 "Kraepelin": "Emil", "Bleuler": "Eugen", "Meehl": "Paul", "Jaspers": "Karl",
 "Szasz": "Thomas", "Laing": "R. D.", "Kanner": "Leo",
 "Folkman": "Susan", "Rahe": "Richard", "Kobasa": "Suzanne", "Antonovsky": "Aaron",
 "Csikszentmihalyi": "Mihaly", "Diener": "Ed", "Fredrickson": "Barbara", "Deci": "Edward",
 "Vroom": "Victor", "Herzberg": "Frederick", "McGregor": "Douglas", "Fiedler": "Fred",
}
# Names mostly used as test/method eponyms: only touch clear person uses
# (possessive + lowercase noun, a verb after, or "by X").
STRICT = {"Binet", "Spearman", "Osgood", "Bogardus",
          "Thurstone", "Cherry", "Garcia", "Flynn", "Luria",
          "Bard", "Lange", "Cannon", "Gall", "Estes", "Kelly", "Sheldon",
          "Hebb", "Ebbinghaus", "Cronbach"}
# Surnames that mostly name a brain area, aphasia, circuit, stain, principle or law:
# only a clear past-tense act by the person counts ("Broca described ...").
VERY_STRICT = {"Broca", "Wernicke", "Papez", "Golgi", "Premack", "Gesell", "Fechner", "Kanner"}
PAST = {"found", "showed", "saw", "wrote", "made", "held", "thought", "said", "was", "himself"}
EPONYM_NOUNS = {"scale", "scales", "model", "law", "effect", "test", "inventory", "experiment",
                "experiments", "hypothesis", "theory", "paradigm", "study", "studies", "principle"}
# Skip a scope for this surname when any of these words appear in it (other bearer).
SCOPE_SKIP = {
 "Allport": ["Floyd", "facilitation", "co-action", "coaction", "Wickens"],
 "Cattell": ["McKeen", "mental test", "Columbia", "unctionalis", "Wundt", "Leipzig", "reaction time",
             "Psyche", "Infant", "Witmer", "Boulder", "1890"],
 "Freud": ["1936", "Mechanisms of Defen", "Hampstead"],
 "McClelland": ["Rumelhart", "PDP", "onnectionis", "arallel distributed"],
 "Craik": ["Kenneth", "mental model", "1943"],
 "Weiner": ["Rorschach", "Exner", "Irving"],
 "Ellis": ["Havelock", "Boyce"],
 "Kelley": ["Kelly", "27%", "Truman", "item analysis"],
 "Beck": ["Judith", "Klopfer", "Piotrowski", "Exner", "Rorschach", "Hamilton"],
 "Guthrie": ["PKU", "Phe", "heel"],
 "Rogers": ["Kuiper", "self-reference"],
 "Goddard": ["kindling", "seizure"],
 "Spearman": ["Pearson", "Kendall", "ranks"],
 "Sullivan": ["CIWA"],
 "Rescorla": ["Achenbach", "CBCL"],
 "Jensen": ["poverty"],
 "Milgram": ["Tuskegee"],

 "Eysenck": ["Keane", "Michael", "Sybil"],
 "Gardner": ["Washoe", "chimp", "Beatrix", "Allen Gardner", "Randy"],
 "Sternberg": ["Saul", "scanning"],
 "Thorndike": ["Hagen", "Sattler", "Robert L.", "SB4", "Roid"],
 "Watson": ["Crick", "Glaser", "Tharp"],
 "Harlow": ["Gage", "Phineas"],
 "Sheldon": ["Kennon", "concordance"],
 "Rosenthal": ["seasonal", "light therapy", "SAD", "diathesis", "Zubin"],
 "Kelly": ["Kelley"],
 "Klein": ["George Klein"],
 "Spitz": ["Mark Spitz"],
}
FILE_SKIP = {"Eysenck": ["eysenck"], "Cattell": ["systems-theories", "psycho-didi-history"]}
VERBS = set("""is was has had said says saw sees held holds thought thinks wrote writes took takes made makes
gave gives came put puts also himself herself later first famously originally would could did does who whose
argues argued proposes proposed describes described calls called defines defined believes believed suggests
suggested emphasizes emphasised emphasized emphasises views viewed distinguishes distinguished identifies
identified explains explained states stated adds added offers offered lists listed divides divided treats
treated considers considered insists insisted rejects rejected stresses stressed shows showed finds found
introduces introduced coins coined labels labelled labeled names named terms termed regards regarded focuses
focused focussed sees developed develops studied studies worked works noted notes claimed claims used uses
built builds measured measures tested tests showed demonstrated demonstrates reported reports observed observes
discovered discovers founded founds created creates published publishes described described saw
""".split())
POSS_STOP = {"area", "areas", "aphasia", "syndrome", "disease", "rho", "formula", "box", "test", "tests",
             "scale", "scales", "encephalopathy", "apparatus", "law", "matrices", "sign", "corollary",
             "alpha", "α", "rank", "correlation", "coefficient", "circuit", "illusion", "curve", "stain"}
FUNC = set("""The A An This That These Those Like Unlike For In On At By But And Or While When Where Whereas
Although Though Since After Before Both Then So Per As According Following Under Contrary Thus Here Later
Early Only Even Also Classic Classical Remember Note Trap Tip Key Why How What Which Who If Because Not No
Yes Neither Either Each Every Many Most Some All Against Versus With Without From To Of Is Was Answer Q A.
Name Option Mark Did Does Do Unlike Than Pure Post Pre Neo Ask Say Know Read See Use Its His Her Their
Correct Wrong Exam Memory High Low Then Now Today Did Was Were Are Be
""".split())
BASEVERBS = set("""disagree agree argue propose describe call define believe suggest emphasise emphasize view see
hold claim note use say think show find introduce coin explain state add offer give put treat consider reject
stress focus label name split divide distinguish identify study measure test report observe found create""".split())
# (X, Y) adjacent with and/&: given names for members not safely in GIVEN
PAIRS = {
 ("Lazarus", "Folkman"): {"Lazarus": "Richard"}, ("Salovey", "Mayer"): {"Mayer": "John"},
 ("Mayer", "Salovey"): {"Mayer": "John"}, ("Rothbart", "Bates"): {"Bates": "John"},
 ("Olds", "Milner"): {"Milner": "Peter"}, ("Moscovici", "Zavalloni"): {"Zavalloni": "Marisa"},
 ("Jones", "Nisbett"): {"Jones": "Edward E."}, ("Jones", "Davis"): {"Jones": "Edward E.", "Davis": "Keith"},
 ("Newell", "Simon"): {"Simon": "Herbert"}, ("Atkinson", "Shiffrin"): {"Atkinson": "Richard"},
 ("Baddeley", "Hitch"): {"Hitch": "Graham"}, ("Thomas", "Chess"): {"Thomas": "Alexander", "Chess": "Stella"},
 ("Holmes", "Rahe"): {"Holmes": "Thomas"}, ("Petty", "Cacioppo"): {"Petty": "Richard"},
 ("Collins", "Quillian"): {"Collins": "Allan", "Quillian": "Ross"}, ("Collins", "Loftus"): {"Collins": "Allan"},
 ("Freedman", "Fraser"): {"Freedman": "Jonathan", "Fraser": "Scott"},
 ("Bateman", "Fonagy"): {"Bateman": "Anthony", "Fonagy": "Peter"}, ("Clarkin", "Kernberg"): {"Clarkin": "John"},
 ("Watson", "Rayner"): {"Rayner": "Rosalie"}, ("Schachter", "Singer"): {"Singer": "Jerome"},
 ("Masters", "Johnson"): {"Masters": "William", "Johnson": "Virginia"},
 ("McGurk", "MacDonald"): {"McGurk": "Harry", "MacDonald": "John"}, ("Rosenthal", "Jacobson"): {"Jacobson": "Lenore"},
 ("Hazan", "Shaver"): {"Shaver": "Phillip"}, ("Dollard", "Miller"): {"Miller": "Neal"},
 ("Brown", "Kulik"): {"Brown": "Roger", "Kulik": "James"}, ("Bandura", "Walters"): {"Walters": "Richard"},
 ("Allport", "Odbert"): {"Odbert": "Henry"}, ("Seligman", "Maier"): {"Maier": "Steven"},
 ("Loftus", "Palmer"): {"Palmer": "John"}, ("Marr", "Nishihara"): {"Nishihara": "Keith"},
 ("Woodworth", "Sells"): {"Sells": "Saul"}, ("Deci", "Ryan"): {"Ryan": "Richard"},
 ("Tajfel", "Turner"): {"Turner": "John"}, ("Peterson", "Seligman"): {"Peterson": "Christopher"},
 ("Festinger", "Carlsmith"): {"Carlsmith": "J. Merrill"}, ("Garcia", "Koelling"): {"Garcia": "John", "Koelling": "Robert"},
 ("Hodgkin", "Huxley"): {"Hodgkin": "Alan", "Huxley": "Andrew"}, ("Yerkes", "Dodson"): {"Yerkes": "Robert", "Dodson": "John"},
 ("Kuder", "Richardson"): {"Kuder": "G. Frederic", "Richardson": "Marion"},
}

SKIP_TAGS = {"script", "style", "svg", "code", "pre", "title", "a", "button", "select", "option",
             "textarea", "h1", "h2", "h3", "h4", "h5", "h6", "nav", "header", "footer", "head", "label"}
INLINE = {"strong", "b", "em", "i", "span", "sup", "sub", "mark", "u", "small", "abbr", "cite", "q", "s"}
VOID = {"br", "hr", "img", "input", "meta", "link", "source", "wbr", "col", "area", "base", "embed", "param", "track"}
BOX_RE = re.compile(r'class="[^"]*\b(callout|trap|traps|qa|why|push)\b')
SKIPBOX_RE = re.compile(r'class="[^"]*\b(booktoc|toc)\b')
L = "A-Za-zÀ-ÖØ-öø-ÿ"
PAIR_RE = re.compile(r"(?<![%s\-–/])(%s)\s+(?:and|&amp;|&)\s+(%s)(?![%s])" % (
    L, "|".join(sorted({x for x, _ in PAIRS})), "|".join(sorted({y for _, y in PAIRS})), L))
SUR_RE = re.compile(r"(?<![%s\-–/])(%s)(?![%s])" % (L, "|".join(sorted(map(re.escape, GIVEN), key=len, reverse=True)), L))


def segments(raw):
    """Yield (kind, start, end, tagname, is_close, attrs) for tags/text."""
    pos = 0
    for m in re.finditer(r"<!--.*?-->|<[^>]+>", raw, re.S):
        if m.start() > pos:
            yield ("text", pos, m.start(), None, False, "")
        t = m.group(0)
        if t.startswith("<!--"):
            yield ("comment", m.start(), m.end(), None, False, "")
        else:
            mm = re.match(r"</?\s*([A-Za-z0-9]+)", t)
            name = mm.group(1).lower() if mm else ""
            yield ("tag", m.start(), m.end(), name, t.startswith("</"), t)
        pos = m.end()
    if pos < len(raw):
        yield ("text", pos, len(raw), None, False, "")


def build_plain(raw):
    """Plain text + per-char raw offsets (None for separators) + scope id + skip flag."""
    plain, rawpos, scope, skip = [], [], [], []
    stack = []  # (tagname, is_skip, box_scope or None)
    sec = 0
    next_scope = [1]
    def cur():
        sk = any(s for _, s, _ in stack)
        box = None
        for _, _, b in reversed(stack):
            if b is not None:
                box = b; break
        return sk, (box if box is not None else ("s", sec))
    for kind, a, b, name, close, attrs in segments(raw):
        if kind == "text":
            sk, sc = cur()
            for i in range(a, b):
                plain.append(raw[i]); rawpos.append(i); scope.append(sc); skip.append(sk)
            continue
        if kind == "comment":
            continue
        if name in ("h1", "h2", "h3") and not close:
            sec += 1
        if close:
            for j in range(len(stack) - 1, -1, -1):
                if stack[j][0] == name:
                    del stack[j:]; break
        elif name not in VOID and not attrs.endswith("/>"):
            is_skip = name in SKIP_TAGS or bool(SKIPBOX_RE.search(attrs))
            box = None
            if BOX_RE.search(attrs):
                box = ("b", next_scope[0]); next_scope[0] += 1
            stack.append((name, is_skip, box))
        if name not in INLINE:
            sk, sc = cur()
            plain.append("\n"); rawpos.append(None); scope.append(sc); skip.append(True)
    return "".join(plain), rawpos, scope, skip


def norm(s):
    return html.unescape(s).replace(" ", " ")


def decide(plain, i, j, sur, strict):
    """Is plain[i:j]==sur a person mention we can expand? Returns reason or None(ok)."""
    wide = norm(plain[max(0, i - 400):i]).split("\n")[-1]
    if (wide.count("“") > wide.count("”")) or (wide.count('"') % 2 == 1):
        return "in-quote"
    if re.search(r"Answer:\s*[A-Ea-e]\s*[·\s]*$", wide):
        return "answer-echo"
    eol = plain.find("\n", j)
    if re.match(r"\s*\(?[A-Ea-e][).]\s", wide) and (eol == -1 or eol - i + len(wide) < 110):
        return "option-line"
    before = plain[max(0, i - 60):i]
    after = plain[j:j + 60]
    b = norm(before); a = norm(after)
    if re.search(r"[\-–/]\s*$", b) and not re.search(r"\s[\-–]\s*$", b):
        return "compound-before"
    if re.match(r"[\-–/]\S", a):
        return "compound-after"
    pw = re.search(r"([%s.'’]+)[ \t\u00a0]+$" % L, b)
    prevword = pw.group(1) if pw else ""
    if prevword:
        if re.fullmatch(r"[A-Z]\.", prevword) or re.fullmatch(r"(?:[A-Z]\.){2,}", prevword):
            return "initial-before"
        if prevword in ("von", "van", "de", "der", "le", "la", "di", "du", "St.", "Mc", "y"):
            return "particle-before"
        if prevword[0].isupper() and prevword.rstrip(".'’") not in FUNC:
            return "capword-before"
    # inside a quoted span on this line (quoted question / paper text)?
    line = b.split("\n")[-1]
    if (line.count("“") > line.count("”")) or (line.count('"') % 2 == 1):
        return "in-quote"
    if re.search(r"\(\s*$", b) and re.match(r"\)\s+[a-z]", a):
        return "paren-eponym"
    pe = re.match(r"\s*(?:and|&)\s+[A-Z][%s]+\s+([%s]+)" % (L, L), a)
    if pe and (pe.group(1)[0].isupper() or pe.group(1).lower() in EPONYM_NOUNS):
        return "pair-eponym"
    if sur in VERY_STRICT:
        w0 = re.match(r"\s*([%s]+)" % L, a)
        nw = w0.group(1) if w0 else ""
        return None if (re.fullmatch(r"[a-z]+ed", nw) or nw in PAST) else "very-strict"
    by = re.search(r"\b(by|according to|after|with|to)\s+$", b, re.I) is not None
    m = re.match(r"(['’]s?)(?=\W)\s*([^\s<]*)", a)
    if m and (m.group(1) in ("'s", "’s") or (sur.endswith("s") and m.group(1) in ("'", "’"))):
        nxt = re.sub(r"[^%s]" % L, "", m.group(2))
        if not re.match(r"[%s]" % L, m.group(2)):
            return "poss-punct"
        if not nxt:
            return "poss-empty"
        if nxt[0].isupper():
            return "poss-eponym"
        if nxt.lower() in POSS_STOP:
            return "poss-stop"
        return None
    w = re.match(r"\s*([%s]+)" % L, a)
    nextword = w.group(1) if w else ""
    if nextword and (nextword in VERBS or nextword in BASEVERBS or re.fullmatch(r"[a-z]+ed", nextword)):
        return None
    if strict:
        return None if by and not nextword else "strict"
    if re.match(r",\s*[A-Z][a-z]+\s*(?:[-–—(]|\n|$)", a):
        return "inverted-name"
    if re.match(r"\s*(?:\s[—–]\s|—|→|&rarr;|·|&middot;|\+|(?:in\s+)?(?:1[6-9]|20)\d\d\b)", a):
        return None
    if re.match(r"\s*(?:[,.;:)!?=\n]|\(|$|and\b|&|&amp;|et al|vs\b|versus\b|or\b)", a):
        if nextword and nextword[0].isupper() and not re.match(r"\s*[,.;:)!?=\n(]", a):
            return "cap-after"
        return None
    if by and not nextword:
        return None
    if nextword[:1].isupper():
        return "cap-after"
    return "attrib-use"


def process(path, apply=False, report=None):
    raw = open(path, encoding="utf-8").read()
    plain, rawpos, scope, skip = build_plain(raw)
    # scope texts for ambiguity checks
    scope_text = {}
    for ch, sc in zip(plain, scope):
        scope_text.setdefault(sc, []).append(ch)
    scope_text = {k: norm("".join(v)) for k, v in scope_text.items()}
    named = set()      # (scope, sur) already full or expanded
    other = {}         # (scope, sur) -> True if a different given name appears
    inserts, rows = [], []
    for m in PAIR_RE.finditer(plain):
        X, Y = m.group(1), m.group(2)
        if (X, Y) not in PAIRS or skip[m.start()]:
            continue
        sc = scope[m.start()]
        if (sc, X, Y) in named:
            continue
        tail = norm(plain[m.end():m.end() + 40])
        tw = re.match(r"\s+([%s]+)" % L, tail)
        if tw and (tw.group(1)[0].isupper() or tw.group(1).lower() in EPONYM_NOUNS):
            continue
        named.add((sc, X, Y))
        for who, pos in ((X, m.start(1)), (Y, m.start(2))):
            g = PAIRS[(X, Y)].get(who)
            if not g or (sc, who) in named or rawpos[pos] is None:
                continue
            b = norm(plain[max(0, pos - 60):pos])
            pw = re.search(r"([%s.'’]+)[ \t\u00a0]+$" % L, b)
            if pw and pw.group(1)[0].isupper() and pw.group(1).rstrip(".'’") not in FUNC:
                named.add((sc, who)); continue
            line = b.split("\n")[-1]
            if (line.count("“") > line.count("”")) or (line.count('"') % 2 == 1):
                continue
            if re.search(r"[\-–/]\s*$", b):
                continue
            inserts.append((rawpos[pos], g + " ")); named.add((sc, who))
            rows.append((path, who, "PAIR", plain[max(0, pos - 60):pos + 60].replace("\n", " | ")))
    for m in SUR_RE.finditer(plain):
        sur = m.group(1); i, j = m.start(), m.end()
        sc = scope[i]
        given = GIVEN[sur]
        key = (sc, sur)
        st = scope_text[sc]
        if any(w in path for w in FILE_SKIP.get(sur, [])):
            continue
        if key not in other:
            full = given + " " + sur
            amb = False
            for w in SCOPE_SKIP.get(sur, []):
                if w.lower() in st.lower():
                    amb = True
            for pm in re.finditer(r"([A-Z][%s.'’]+)[ \t\u00a0]+%s(?![%s])" % (L, re.escape(sur), L), st):
                pwd = pm.group(1)
                if pwd.rstrip(".") in FUNC or re.fullmatch(r"[A-Z]\.", pwd):
                    continue
                if pwd != given.split()[-1]:
                    amb = True
            other[key] = amb
        b = norm(plain[max(0, i - 40):i])
        already = re.search(r"%s[ \t\u00a0]*$" % re.escape(given.split()[-1]), b) is not None
        if already:
            named.add(key); continue
        if key in named:
            continue
        if skip[i]:
            continue
        if other[key]:
            rows.append((path, sur, "ambiguous-scope", plain[max(0, i - 50):j + 50].replace("\n", " ")))
            named.add(key); continue
        why = decide(plain, i, j, sur, sur in STRICT)
        ctx = plain[max(0, i - 60):j + 60].replace("\n", " | ")
        if why is None:
            inserts.append((rawpos[i], given + " "))
            named.add(key)
            rows.append((path, sur, "INSERT", ctx))
        else:
            rows.append((path, sur, why, ctx))
            if why in ("initial-before", "capword-before"):
                named.add(key)
    if apply and inserts:
        out = raw
        for p, txt in sorted(set(inserts), reverse=True):
            out = out[:p] + txt + out[p:]
        open(path, "w", encoding="utf-8").write(out)
    return inserts, rows


if __name__ == "__main__":
    args = sys.argv[1:]
    apply = "--apply" in args
    rep = None
    if "--report" in args:
        k = args.index("--report"); rep = args[k + 1]; del args[k:k + 2]
    files = [a for a in args if not a.startswith("--")]
    allrows, total = [], 0
    for f in files:
        ins, rows = process(f, apply)
        total += len(ins); allrows += rows
        print(f"{len(ins):4d}  {f}")
    print("TOTAL inserts", total)
    if rep:
        with open(rep, "w") as fh:
            for r in allrows:
                fh.write("\t".join(r) + "\n")
