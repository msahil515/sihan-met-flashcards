const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../name-lock/app/viva.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(source, context, { filename: "name-lock/app/viva.js" });
const viva = context.window.NL_VIVA;

test("legacy dissertation and JSS levels retain their IDs and content", () => {
  const expected = {
    dis: "f11e94a8f46e6794517ebba1956d72fdc67b973762eaa7fa4d477c748dd30de4",
    jss: "101ce6d3084e98848bb1bbb9d8ac3d5dd16f4cd67800c9dd4e5ec8aad27c267b", // re-pinned 28 Nov 2026: fact-check, 9 legacy cards edited, IDs unchanged
  };
  for (const world of Object.keys(expected)) {
    const originalLevels = viva[world].levels.slice(0, world === "dis" ? 10 : 14);
    const snapshot = originalLevels.map(({ k, name, icon, sub, final, cards }) => ({ k, name, icon, sub, final, cards }));
    const hash = crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    assert.equal(hash, expected[world], `${world} legacy bank changed`);
  }
});

test("new interview levels are appended, stable, and complete", () => {
  const levels = viva.jss.levels;
  assert.deepEqual(Array.from(levels.slice(-2), level => level.k), ["pragyan", "yourdost-practice"]);
  assert.equal(levels.at(-3).k, "final");
  for (const level of levels.slice(-2)) {
    assert.equal(level.cards.length, 13);
    assert.equal(level.cards.filter(card => card.q.startsWith("Hypothetical case:")).length, 6);
    assert.ok(level.cards.every(card => card.id && card.q && card.a && card.n));
    assert.ok(level.cards.every(card => /https:\/\//.test(card.n) || /Personal experience template/.test(card.n)));
    assert.ok(level.cards.every(card => !/\[[^\]]+\]\(https?:\/\//.test(card.n)), "source references must display as plain text");
  }
});

test("all card IDs remain unique and experience prompts are explicitly fill-in", () => {
  const ids = ["dis", "jss", "sjc", "cv"].flatMap(world => viva[world].levels.flatMap(level => (level.cards || []).map(card => card.id)));
  assert.equal(new Set(ids).size, ids.length);
  for (const level of viva.jss.levels.slice(-2)) {
    const card = level.cards.find(item => item.id.endsWith("-exp1"));
    assert.ok(card, `${level.k} has an experience template`);
    assert.match(card.a, /Personal experience template/);
    assert.match(card.a, /real|true for you/i);
    assert.match(card.h, /Never invent/);
  }
});

test("specific theory cards cite sources that cover their definitions", () => {
  const cards = new Map(viva.jss.levels.slice(-2).flatMap(level => level.cards.map(card => [card.id, card])));
  const references = {
    "jss-pragyan-t1": ["iris.peabody.vanderbilt.edu/module/bp/cresource/q1/p02/", "cci.health.wa.gov.au/~/media/CCI/Consumer%20Modules/Back%20from%20The%20Bluez/"],
    "jss-pragyan-t2": ["openstax.org/books/psychology-2e/pages/6-3-operant-conditioning", "iris.peabody.vanderbilt.edu/module/bp/cresource/q1/p05/"],
    "jss-pragyan-t3": ["afirm.fpg.unc.edu/sites/afirm.fpg.unc.edu/files/imce/resources/PP%20EBP%20Brief%20Packet.pdf", "openstax.org/books/psychology-2e/pages/6-3-operant-conditioning", "iris.peabody.vanderbilt.edu/module/bp/cresource/q1/p06/"],
    "jss-yd-t1": ["beckinstitute.org/about/understanding-cbt/"],
    "jss-yd-t2": ["cci.health.wa.gov.au/~/media/CCI/Mental-Health-Professionals/Depression/Depression---Information-Sheets/Depression-Information-Sheet---12---What-are-Core-Beliefs.pdf"],
    "jss-yd-t3": ["cci.health.wa.gov.au/~/media/CCI/Consumer-Modules/Back-from-The-Bluez/Back-from-the-Bluez---02---Behavioural-Strategies.pdf"],
    "jss-yd-t4": ["Beck-Institute-CTRS-R-Scoring-Rubric-and-CBT-Checklist.pdf", "Panic-Information-Sheet---06---Behavioural-Experiments-for-Negative-Predictions.pdf"],
    "jss-yd-t5": ["beckinstitute.org/about/understanding-cbt/"],
  };
  for (const [id, urls] of Object.entries(references)) {
    assert.ok(cards.has(id), `${id} exists`);
    for (const url of urls) assert.ok(cards.get(id).n.includes(url), `${id} cites ${url}`);
  }
  const punishment = cards.get("jss-pragyan-t2").a;
  assert.match(punishment, /Positive punishment adds an aversive consequence and decreases behaviour/);
  assert.match(punishment, /negative punishment removes a valued consequence and decreases behaviour/);
  assert.match(punishment, /not a recommendation to use punishment as a child intervention/);
  const sld = cards.get("jss-pragyan-t6");
  assert.match(sld.q, /specific learning disorder \(SLD\)/);
  assert.match(sld.a, /general learning difficulty/);
  assert.ok(sld.n.includes("psychiatry.org/patients-families/specific-learning-disorder/what-is-specific-learning-disorder"));
});

test("St John's world: complete cards, a Panel Final, and a fill-in for the JSS result", () => {
  const levels = viva.sjc.levels;
  assert.deepEqual(Array.from(levels, level => level.k), ["open", "dept", "fit", "case", "tools", "dev", "gen", "final"]);
  assert.equal(levels.at(-1).final, 12);
  const cards = levels.flatMap(level => level.cards || []);
  assert.equal(cards.length, 92);
  assert.ok(cards.every(card => card.id.startsWith("sjc-") && card.q && card.a));
  assert.ok(cards.every(card => !card.f === !card.fa), "follow-up always has its answer");
  assert.ok(cards.every(card => !/\u2014/.test(JSON.stringify(card))), "no em dashes");
  const jssResult = cards.find(card => card.id === "sjc-o6");
  assert.match(jssResult.a, /Personal experience template/);
  assert.match(jssResult.h, /Never invent/);
});

test("Concept Viva world: 8 levels of 11 full cards, a Panel Final, no repeats of other worlds", () => {
  const levels = viva.cv.levels;
  assert.deepEqual(Array.from(levels, level => level.k), ["dis", "pair", "why", "ther", "test", "pers", "learn", "bio", "final"]);
  assert.equal(levels.at(-1).final, 12);
  for (const level of levels.slice(0, -1)) assert.equal(level.cards.length, 11, level.k);
  const cards = levels.flatMap(level => level.cards || []);
  assert.ok(cards.every(card => card.id.startsWith("cv-") && card.q && card.a && card.n && card.t && card.f && card.fa));
  assert.ok(cards.every(card => !/[\u2013\u2014]/.test(JSON.stringify(card))), "no em or en dashes");
  const words = text => text.split(/\s+/).filter(Boolean).length;
  assert.ok(cards.every(card => words(card.a) >= 60 && words(card.a) <= 130), "model answers are 30 to 45 seconds out loud");
  const others = new Set(["jss", "sjc"].flatMap(world => viva[world].levels.flatMap(level => (level.cards || []).map(card => card.q.toLowerCase()))));
  assert.ok(cards.every(card => !others.has(card.q.toLowerCase())), "no question repeats a JSS or St John's card");
});
