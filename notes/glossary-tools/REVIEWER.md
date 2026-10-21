# Review glossary entries for tap-to-define

Read /tmp/t088/WRITER.md first. It explains the feature, the schema and the style rules. Another agent wrote the entries in your files. Your job is an independent, skeptical check. Sihan rejected the last version as garbage, so treat each wrong or off-sense popover as a real bug.

## What you own
Your output files, under /tmp/t088/out/, are listed in your prompt. Edit them in place. They are yours alone, and nobody else edits them. Each one pairs with a batch file of the same name under /tmp/t088/batches/.

## Check 1: is every definition correct?
Read every sense's `def` (and `exp` for abbreviations). Fix it in place if it:
- is factually wrong, or has a wrong name, year, number, edition or criterion. Use DSM-5-TR, ICD-11 and standard textbooks.
- gives a doubtful year or attribution. Remove the doubtful part rather than guess.
- defines a different thing from the term, or is too vague to teach anything.
- breaks the style rules: it starts by restating the term, contains an em or en dash, uses American spelling, or runs outside 15-50 words.

If an entry cannot be made correct, turn it into a skip, for example `{"key": "...", "skip": "generic"}`. A missing underline is far better than a wrong definition.

## Check 2: does the right sense show in the right place?
`/tmp/t088/occ/<file>.jsonl` lists real places where the browser underlined each of your keys. Each line has the page, the tapped text, the sense index shown (`si`), the nearest heading and the paragraph. For each occurrence, ask: does the definition of sense `si` fit what the word means in that paragraph?

If it does not:
- adjust that sense's `ctx`, or an earlier sense's `ctx`,
- or add a sense,
- or make the key ctx-limited, so the word stays plain where it is not the defined concept.

Keep the regexes simple, as WRITER.md describes. The context string at runtime is `page path | nearest h1-h3 heading | enclosing block text`, lowercased, where the page path looks like `notes/statistics/index.html` or `notes-app/content/pinel.html`. To see every use of a key, you can grep /tmp/sihan-met-flashcards (read only).

## Then
Run `python3 /tmp/t088/check_batch.py /tmp/t088/batches/<file>.json /tmp/t088/out/<file>.json` for each of your files. Fix any errors it reports.

Reply with:
- counts per file: definitions corrected, senses or ctx changed for placement, entries turned into skips
- the 10 most serious problems you found
- the final check_batch status line for each file

Do not edit anything except your own output files.
