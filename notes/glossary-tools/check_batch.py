#!/usr/bin/env python3
"""Validate one glossary batch: python3 check_batch.py batches/X.json out/X.json
Prints errors (must be fixed) and, for every snippet, which sense it resolves to."""
import json, re, sys
inp = {x["key"]: x for x in json.load(open(sys.argv[1]))}
out = json.load(open(sys.argv[2]))
errs = []; seen = set()
SAFE = re.compile(r'^[\w\s\\|()?:.*+\-\[\]{},\'/&^$]*$')
for e in out:
    k = e.get("key")
    if k not in inp: errs.append(f"{k}: key not in batch"); continue
    if k in seen: errs.append(f"{k}: duplicate"); continue
    seen.add(k)
    if "skip" in e: continue
    ss = e.get("senses") or []
    if not ss: errs.append(f"{k}: no senses"); continue
    for i, s in enumerate(ss):
        d = s.get("def", "")
        w = len(d.split())
        if "—" in d or "–" in d or "—" in s.get("exp", ""): errs.append(f"{k}[{i}]: em/en dash")
        if w < 10 or w > 60: errs.append(f"{k}[{i}]: def has {w} words (10-60)")
        c = s.get("ctx", "")
        if c == "" and i != len(ss) - 1: errs.append(f"{k}[{i}]: empty ctx only allowed on the last sense")
        if c:
            if not SAFE.match(c) or "(?<" in c or "(?=" in c or "(?!" in c: errs.append(f"{k}[{i}]: ctx uses unsupported syntax")
            try: re.compile(c, re.I)
            except re.error as ex: errs.append(f"{k}[{i}]: bad regex {ex}")
missing = [k for k in inp if k not in seen]
if missing: errs.append(f"{len(missing)} keys missing, e.g. {missing[:8]}")
print("ERRORS:" if errs else "OK: no errors", *errs, sep="\n  ")
print("\nSense picked per snippet (first sense whose ctx matches; - = not tappable there):")
for e in out:
    if "skip" in e or e.get("key") not in inp or len(e.get("senses", [])) < 2 and not (e.get("senses") or [{}])[0].get("ctx"): continue
    picks = []
    for sn in inp[e["key"]]["ctx"]:
        ctx = " | ".join(sn).lower()
        p = "-"
        for i, s in enumerate(e["senses"]):
            c = s.get("ctx", "")
            try:
                if not c or re.search(c, ctx, re.I): p = str(i); break
            except re.error: break
        picks.append(p)
    print(f"  {e['key']}: {' '.join(picks)}")
