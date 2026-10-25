#!/usr/bin/env python3
"""Build an edition-bound, static section-start map from the textbook PDF."""

from __future__ import annotations

import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import sys

import fitz


EXPECTED_SHA256 = "fa29764869e9551e9f6049bcd6b1badf6df59ab6c6bab34594e2e5b0980516e8"
EXPECTED_PAGE_COUNT = 975
PDF_RELATIVE = Path("downloads/final-textbook/Final-Exam-Textbook-BW.pdf")
HTML_PATTERN = "notes-app/merged/final-book-{chapter:02}.html"
DEFAULT_REPORT = Path("/Users/sahil/.whatsapp-watcher/sihan-study-map-report.md")
REFS_RELATIVE = Path("scripts/study-page-refs.json")
MOCK_RELATIVE = Path("take/data-jss2.js")
EXPECTED_MOCK_SHA256 = "7e94c4847c3838d6d22324c94a19ed096ce2f0ef9bd7be797c0732e17a92770d"
EXPECTED_REFS = {
    "m:jss-mock-2:36", "m:jss-mock-2:27", "m:jss-mock-2:9", "m:jss-mock-2:37",
    "m:jss-mock-2:28", "m:jss-mock-2:1", "m:jss-mock-2:20", "m:jss-mock-2:30",
    "m:jss-mock-2:21", "m:jss-mock-2:22", "m:jss-mock-2:15", "m:jss-mock-2:6",
    "m:jss-mock-2:35", "m:jss-mock-2:81", "m:jss-mock-2:82", "m:jss-mock-2:64",
    "m:jss-mock-2:38", "m:jss-mock-2:29", "m:jss-mock-2:2", "m:jss-mock-2:83",
    "m:jss-mock-2:47", "m:jss-mock-2:57", "m:jss-mock-2:48", "m:jss-mock-2:39",
    "m:jss-mock-2:67", "m:jss-mock-2:14", "m:jss-mock-2:86", "m:jss-mock-2:77",
    "m:jss-mock-2:68", "m:jss-mock-2:50", "m:jss-mock-2:51", "m:jss-mock-2:42",
    "m:jss-mock-2:78", "m:jss-mock-2:69", "m:jss-mock-2:61", "m:jss-mock-2:52",
    "m:jss-mock-2:8", "m:jss-mock-2:89", "m:jss-mock-2:80", "m:jss-mock-2:53",
}


class Headings(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.current_tag: str | None = None
        self.current_attrs: dict[str, str] = {}
        self.parts: list[str] = []
        self.items: list[tuple[str, str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("h2", "h3") and self.current_tag is None:
            self.current_tag = tag
            self.current_attrs = {key: value or "" for key, value in attrs}
            self.parts = []

    def handle_data(self, data: str) -> None:
        if self.current_tag:
            self.parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == self.current_tag:
            text = " ".join("".join(self.parts).split())
            self.items.append((tag, self.current_attrs.get("id", ""), text))
            self.current_tag = None
            self.current_attrs = {}
            self.parts = []


def normalized_title(value: str) -> str:
    value = html.unescape(value)
    value = re.sub(r"\s*(?:low|medium|high)\s+yield\s*[·•].*$", "", value, flags=re.I)
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_current_questions(root: Path) -> list[dict]:
    source = root / MOCK_RELATIVE
    actual_hash = sha256(source)
    if actual_hash != EXPECTED_MOCK_SHA256:
        raise ValueError(f"current mock source fingerprint mismatch: {actual_hash}")
    script = """const fs = require('fs'), vm = require('vm');
const context = {window: {}}; vm.createContext(context);
vm.runInContext(fs.readFileSync(process.argv[1], 'utf8'), context, {filename: process.argv[1]});
const questions = context.window.PREVIEW_MOCKS?.['jss-mock-2']?.questions;
if (!Array.isArray(questions)) throw new Error('jss-mock-2 questions unavailable');
process.stdout.write(JSON.stringify(questions));
"""
    result = subprocess.run(
        ["node", "-e", script, str(source)], check=True, capture_output=True, text=True
    )
    return json.loads(result.stdout)


def reviewed_refs(root: Path, section_ids: set[str], page_count: int) -> dict:
    def unique_object(pairs: list[tuple[str, object]]) -> dict:
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate JSON key in reviewed registry: {key}")
            result[key] = value
        return result

    registry = json.loads((root / REFS_RELATIVE).read_text(encoding="utf-8"), object_pairs_hook=unique_object)
    if not isinstance(registry, dict) or set(registry) != {"refs"}:
        raise ValueError("review registry must contain only the refs dictionary")
    refs = registry.get("refs")
    if not isinstance(refs, dict) or set(refs) != EXPECTED_REFS:
        raise ValueError("review registry must contain exactly the 40 approved refs")
    questions = load_current_questions(root)
    seen_indices: set[int] = set()
    for ref, mapping in refs.items():
        match = re.fullmatch(r"m:jss-mock-2:(\d+)", ref)
        if not match:
            raise ValueError(f"unsupported ref identity: {ref}")
        index = int(match.group(1))
        if index in seen_indices or index >= len(questions):
            raise ValueError(f"missing or duplicate current question for {ref}")
        seen_indices.add(index)
        if not isinstance(mapping, dict) or set(mapping) != {"source", "locations"}:
            raise ValueError(f"invalid mapping fields for {ref}")
        source = mapping.get("source")
        if not isinstance(source, dict) or set(source) != {"stem", "options", "correct"}:
            raise ValueError(f"invalid source snapshot for {ref}")
        if not isinstance(source["stem"], str) or not source["stem"].strip():
            raise ValueError(f"invalid stem snapshot for {ref}")
        options = source["options"]
        if not isinstance(options, dict) or set(options) != {"a", "b", "c", "d"} or any(not isinstance(options[key], str) for key in "abcd"):
            raise ValueError(f"invalid option snapshot for {ref}")
        if not isinstance(source["correct"], str) or source["correct"] not in "abcd" or len(source["correct"]) != 1:
            raise ValueError(f"invalid correct-answer key for {ref}")
        q = questions[index]
        if not isinstance(q, dict) or not isinstance(q.get("options"), dict):
            raise ValueError(f"invalid current question at {ref}")
        current = {"stem": str(q.get("q", "")).strip(),
                   "options": {key: str(q.get("options", {}).get(key, "")).strip() for key in "abcd"},
                   "correct": q.get("correct")}
        expected = {"stem": source["stem"].strip(),
                    "options": {key: str(options[key]).strip() for key in "abcd"},
                    "correct": source["correct"]}
        if current != expected:
            raise ValueError(f"current question identity changed for {ref}")
        stored = source["stem"][:400]
        prefix_matches = [i for i, question in enumerate(questions)
                          if str(question.get("q", "")).strip()[:400] == stored]
        if prefix_matches != [index]:
            raise ValueError(f"stored question context is ambiguous in the current mock for {ref}")
        locations = mapping.get("locations")
        if not isinstance(locations, list) or not locations:
            raise ValueError(f"missing locations for {ref}")
        for location in locations:
            if not isinstance(location, dict) or set(location) != {"sectionId", "pages"} or not isinstance(location["sectionId"], str):
                raise ValueError(f"invalid location for {ref}")
            if location["sectionId"] not in section_ids:
                raise ValueError(f"unknown section ID for {ref}: {location['sectionId']}")
            pages = location["pages"]
            if not isinstance(pages, list) or not pages or any(type(page) is not int or not 1 <= page <= page_count for page in pages):
                raise ValueError(f"invalid page list for {ref}")
            if pages != sorted(set(pages)):
                raise ValueError(f"invalid page list for {ref}")
    bateson = refs["m:jss-mock-2:15"]["source"]["stem"]
    if len(bateson) != 720:
        raise ValueError("Bateson reviewed full stem snapshot changed")
    if len(bateson[:400]) != 400:
        raise ValueError("Bateson stored context is not exactly 400 characters")
    return refs


def build(root: Path) -> tuple[dict, str]:
    pdf_path = root / PDF_RELATIVE
    actual_hash = sha256(pdf_path)
    if actual_hash != EXPECTED_SHA256:
        raise ValueError(f"master PDF fingerprint mismatch: {actual_hash}")

    document = fitz.open(pdf_path)
    if len(document) != EXPECTED_PAGE_COUNT:
        raise ValueError(f"master PDF page count mismatch: {len(document)}")

    outline: dict[str, list[dict]] = {}
    for level, title, page in document.get_toc():
        if level < 3:
            continue
        outline.setdefault(normalized_title(title), []).append(
            {"title": title, "page": page, "level": level}
        )

    chapters: list[dict] = []
    sections: list[dict] = []
    unresolved: list[dict] = []
    total_sections = 0

    for chapter in range(1, 10):
        relative_html = Path(HTML_PATTERN.format(chapter=chapter))
        parser = Headings()
        parser.feed((root / relative_html).read_text(encoding="utf-8"))
        h2 = next((text for tag, _, text in parser.items if tag == "h2"), "")
        chapter_sections = []
        for tag, section_id, title in parser.items:
            if tag != "h3":
                continue
            match = re.match(rf"{chapter}\.(\d+)\s+", title)
            if not match:
                continue
            total_sections += 1
            section_number = int(match.group(1))
            hits = outline.get(normalized_title(title), [])
            if not section_id:
                unresolved.append({"chapter": chapter, "section": title, "reason": "semantic HTML heading has no ID"})
                continue
            if len(hits) != 1:
                unresolved.append({
                    "chapter": chapter,
                    "section": title,
                    "reason": "no exact PDF outline match" if not hits else "PDF outline match is ambiguous",
                    "candidates": [entry["title"] for entry in hits],
                })
                continue
            hit = hits[0]
            if not 1 <= hit["page"] <= EXPECTED_PAGE_COUNT:
                unresolved.append({"chapter": chapter, "section": title, "reason": f"outline page outside edition: {hit['page']}"})
                continue
            page_text = document[hit["page"] - 1].get_text()
            if normalized_title(title) not in normalized_title(page_text):
                unresolved.append({"chapter": chapter, "section": title, "reason": "semantic heading not found in the PDF text on its outline page"})
                continue
            record = {
                "id": section_id,
                "chapter": chapter,
                "section": section_number,
                "title": re.sub(r"\s*(?:low|medium|high)\s+yield\s*[·•].*$", "", title, flags=re.I).strip(),
                "startPage": hit["page"],
                "provenance": {
                    "semanticHtml": relative_html.as_posix(),
                    "htmlId": section_id,
                    "pdfOutlineTitle": hit["title"],
                    "pdfOutlineLevel": hit["level"],
                    "pageTextHeadingVerified": True,
                },
            }
            sections.append(record)
            chapter_sections.append(record)

        chapters.append({
            "number": chapter,
            "title": h2,
            "sectionCount": len(chapter_sections),
            "sections": [section["id"] for section in chapter_sections],
        })

    pages = [section["startPage"] for section in sections]
    if any(not 1 <= page <= EXPECTED_PAGE_COUNT for page in pages):
        raise ValueError("generated page is outside the edition")

    refs = reviewed_refs(root, {section["id"] for section in sections}, EXPECTED_PAGE_COUNT)
    data = {
        "schemaVersion": 2,
        "edition": {
            "title": "The Final Exam Textbook, original B&W master",
            "printedPagination": "Sihan confirmed printed page numbers match this original master",
            "sourceFile": PDF_RELATIVE.as_posix(),
            "sha256": actual_hash,
            "byteLength": pdf_path.stat().st_size,
            "pageCount": EXPECTED_PAGE_COUNT,
            "pageNumbering": "one-based physical PDF pages, matching the confirmed printed page numbers",
        },
        "mappingPolicy": "Section starts are verified navigation context; question refs contain reviewed exact teaching pages only. No aliases or section-start fallback.",
        "chapters": chapters,
        "sections": sections,
        "refs": refs,
    }
    report = make_report(data, total_sections, unresolved)
    return data, report


def make_report(data: dict, total_sections: int, unresolved: list[dict]) -> str:
    sections = data["sections"]
    by_chapter = {chapter["number"]: chapter for chapter in data["chapters"]}
    lines = [
        "# Sihan textbook section page-map report",
        "",
        "Generated from the read-only original B&W master PDF and semantic chapter HTML.",
        "",
        f"- Edition: {data['edition']['title']}",
        f"- SHA-256: `{data['edition']['sha256']}`",
        f"- PDF pages: {data['edition']['pageCount']}",
        "- Pagination basis: Sihan confirmed his printed page numbers match this master.",
        f"- Verified section starts: {len(sections)} of {total_sections}",
        f"- PDF page-text heading checks: {sum(section['provenance']['pageTextHeadingVerified'] for section in sections)} of {len(sections)} mapped headings present on their mapped pages.",
        f"- Reviewed question-reference mappings: {len(data['refs'])}",
        "- Aliases: 0; none were needed for exact semantic-heading matches.",
        "- Question locations use only the reviewed primary teaching pages; each listed page was checked independently.",
        "",
        "## Subject coverage",
        "",
        "| Chapter | Subject | Verified sections | Total sections | Coverage |",
        "|---:|---|---:|---:|---:|",
    ]
    for chapter in data["chapters"]:
        number = chapter["number"]
        expected = sum(item["chapter"] == number for item in unresolved) + chapter["sectionCount"]
        lines.append(f"| {number} | {chapter['title']} | {chapter['sectionCount']} | {expected} | {chapter['sectionCount']}/{expected} |")
    lines.extend(["", "## Ambiguous or missing coverage", ""])
    if unresolved:
        for item in unresolved:
            suffix = f" Candidates: {', '.join(item.get('candidates', []))}." if item.get("candidates") else ""
            lines.append(f"- Chapter {item['chapter']}, {item['section']}: {item['reason']}.{suffix}")
    else:
        lines.append("- None. All numbered semantic section headings matched one PDF outline entry.")
    lines.extend(["", "## Reviewed question pages", "", "| Ref | Section | Physical pages |", "|---|---|---:|"])
    for ref, mapping in data["refs"].items():
        for location in mapping["locations"]:
            lines.append(f"| `{ref}` | `{location['sectionId']}` | {', '.join(map(str, location['pages']))} |")
    lines.extend([
        "", "## Limits and review caveats", "",
        "Section starts remain navigation context only and are never used as question-page fallback. The 40 refs have no aliases, inferred end pages, area fallback or user-specific fields.",
        "- Bateson Q16's current full stem is 720 characters; the exported saved question is exactly its first 400 characters. This prefix uniquely matches current mock index 15. The unseen historical suffix and options cannot be established from the export.",
        "- Groupthink Q39's current full stem is 442 characters; its saved 400-character prefix uniquely matches current mock index 38. The mapping snapshot retains the complete current stem, options and key.",
        "- The borderline item says object-relations theory while its keyed explanation invokes Kohut. The page mapping preserves that wording distinction and does not equate the theories.",
        "- MISIC's mapped page supports administration from age 6 and describes ages 6 to 15. The mock explanation's upper-age wording is not harmonised.",
        "- The TAT mapping supports Lindzey's construction classification. It does not merge that taxonomy with Frank's classification.",
        "- Construct-validity Q83 has an awkward option that overlaps convergent-validity language. Page 155 teaches the construct/theory interpretation; construct and convergent validity are not treated as synonyms.",
        "- F-distribution Q81 labels a distribution one-tailed. Page 911 supports an upper-tail ANOVA test, which is not the same as claiming that a distribution itself is a testing rule. The mapping does not alter the question.",
        "- Endophenotype Q53 uses genetic-mechanism wording. Page 745 supports measurable intermediate traits; the mapping does not restate these as direct DNA or genotype measures.",
        "- Formal-operations Q15 requires the postformal contrast on page 561; a generic section start is not substituted.",
        "- Sihan confirmed printed numbering against the original master. No byte/page equivalence with the three supplied volume PDFs was reviewed; no volume offsets are inferred.",
        "- This is source-grounded exam navigation, not an independent scholarly review of textbook claims.",
        "",
    ])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()
    output_path = args.output or args.root / "study-pages.json"
    try:
        data, report = build(args.root.resolve())
        output_path.parent.mkdir(parents=True, exist_ok=True)
        args.report.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        args.report.write_text(report, encoding="utf-8")
    except (OSError, ValueError, fitz.FileDataError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(f"Wrote {len(data['sections'])} section starts to {output_path}")
    print(f"Wrote coverage report to {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
