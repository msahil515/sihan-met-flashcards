# Writing glossary entries for tap-to-define

## Who this is for
Sihan is a psychology graduate preparing for Indian M.Phil/MA Clinical Psychology entrance exams (JSS AHER on 27 Oct 2026, then IHBAS and CIP). His study site has a notes Library (116 pages: textbooks, cheat sheets, Pinel, DSM-5-TR, stats, research methods, therapy, Indian psychology). On those pages, some terms are underlined, and tapping one opens a small popover with a definition.

He rejected the old version as "garbage". Tapping gave irrelevant text, blank cards, or the sentence the word appeared in. The new rule is that every underlined term shows a real, correct definition of that exact term, in the sense it is used where he tapped it. If a term has no entry, it is simply not underlined. Your entries are the whole glossary, so their quality is the feature.

## Input
Your batch file is a JSON array. Each item has:
- `key`: the lookup key. Bold keys are lowercased and roughly singularised, so "tama" means "tamas" and "self-serving bia" means "self-serving bias". Abbreviation keys are case-sensitive tokens such as "CBT" or "5-HT2A".
- `n`: how often the key appears across the notes.
- `forms` (bold only): how it is actually written on the pages.
- `ctx`: up to 3 real snippets, each `[page path, nearest heading, surrounding text]`.

## Output
Write one JSON array to your output file. Every input key must appear exactly once, either as a skip or as an entry.

Skip:
`{"key": "trap", "skip": "label"}`
Use one of these reasons: `label` (a UI label such as Trap, Key, Recap or Answer), `person` (a person's name; people are not defined), `generic` (an everyday word or a fragment that is not a term on its own, such as "external", "positive", "found", "tell" or "cognitive"), `phrase` (a sentence or slogan rather than a term), `site` (site jargon such as PYQ, MCQ, "RML tilt" or "Panwar key"), or `notabbr` (a capitalised word or name rather than an abbreviation, such as NOT, AND, McCrae or LeDoux).

Entry, bold term:
`{"key": "learned helplessness", "term": "Learned helplessness", "also": ["helplessness, learned"], "senses": [{"def": "...", "ctx": ""}]}`

Entry, abbreviation:
`{"key": "CBT", "senses": [{"exp": "Cognitive behavioural therapy", "def": "...", "ctx": ""}]}`

Field notes:
- `term` is the display name, properly capitalised. Abbreviations have no `term`; `exp` is the expansion instead.
- `also` is optional. List other spellings of the same thing that might be bolded, such as "unconditioned stimulus" for "unconditional stimulus".

## Definitions (`def`)
- 15 to 50 words, never over 60.
- The first sentence says what the term IS, in plain words, at the level of a strong psychology graduate. Do not start with the term itself ("Learned helplessness is ...") and do not restate it as its own definition. Start straight with the content, for example "A state where repeated uncontrollable bad events teach an animal or person that acting is pointless, so they stop trying even when escape becomes possible."
- When it is a named concept, add who and when, with the full name: "Martin Seligman and Steven Maier, 1967 (dogs, shuttle box)". If you are not certain of a year, leave the year out. Never guess.
- Add at most one short exam-useful contrast or trap when there is a classic confusion, for example "Not the same as negative reinforcement, which increases behaviour."
- For an abbreviation, `exp` is the expansion and `def` explains what it is. Do not repeat the expansion as the whole definition.
- Use current facts: DSM-5-TR (2022), ICD-11 and present-day textbooks (Baron, Ciccarelli, Morgan, Pinel, Kaplan & Sadock, Anastasi, Barlow & Durand). Say "DSM-5-TR" or "ICD-11" when a criterion depends on the edition.
- Use British/Indian spelling, as the notes do: behaviour, colour, organisation, defence.
- **Never use an em dash or en dash.** Use commas, semicolons, colons or parentheses.
- Accuracy matters more than coverage. If you are not confident a definition is correct, skip the key as `generic` rather than write something doubtful.

## Senses and context (`ctx`)
Many terms mean different things in different subfields. Some examples:
- regression: statistics vs the defence mechanism
- discrimination: conditioning vs prejudice
- extinction, resistance, accommodation, conservation, closure, power, projection
- ERP: event-related potential vs exposure and response prevention
- CS, CR, SE, PD, MA, CT, AP, SS, RT

For each meaning that actually occurs in these notes, give a separate sense. `ctx` is a case-insensitive regex. It is tested against the string `page path | nearest heading | surrounding paragraph text`, all lowercased. Senses are tried in order and the first match wins.

- `""` (empty) means "always". It is allowed only on the LAST sense, and only when that meaning is safe wherever no earlier sense matched.
- A single-sense entry with an empty `ctx` is right when the term means the same thing everywhere in psychology notes (for example, "learned helplessness" or "OCD").
- When a term is ambiguous and no context clearly signals the meaning, it is better for it to be NOT tappable there. Give every sense a non-empty `ctx` and no default. An occurrence that matches no sense stays plain text.
- Use a non-empty `ctx` on a single sense when the token only sometimes means your term. For example, "ACC" means anterior cingulate cortex only in neuro contexts, so use `cingulate|cortex|frontal|pain|conflict|error|neuro|brain|pinel|bio`.
- Keep the regex simple: plain words, `|`, `\b`, `( )`, `?`, `[ ]` and `.*` only. No lookarounds. Example: `\bstatistic|correlat|predict|least squares|coefficient|toward the mean|\bvariable`
- Page paths help. `notes/statistics/`, `biopsych`, `pinel`, `abnormal`, `therapy`, `social` and `research` are all in the context string.

## Check your work
Run `python3 /tmp/t088/check_batch.py <your batch file> <your output file>`. Fix every error it lists. Then read its "Sense picked per snippet" lines. For each multi-sense or ctx-limited key, every snippet must pick the correct sense, or `-` where the word there is not the defined concept. Adjust the ctx until it does. You may grep the repo `/tmp/sihan-met-flashcards` (read only) to see more uses of a term.

Do not edit anything outside your own output file.

When you are done, reply with:
- counts: entries, skips by reason, multi-sense entries
- any definition you were unsure of
- the final check_batch status line
