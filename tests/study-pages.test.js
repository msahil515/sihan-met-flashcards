const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const map = JSON.parse(fs.readFileSync("study-pages.json", "utf8"));
const registry = JSON.parse(fs.readFileSync("scripts/study-page-refs.json", "utf8"));
const bankContext = { window: {} };
vm.createContext(bankContext);
vm.runInContext(fs.readFileSync("take/data-jss2.js", "utf8"), bankContext);
const mock = JSON.parse(JSON.stringify(bankContext.window.PREVIEW_MOCKS["jss-mock-2"]));

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function harness({ data = map, current = mock, omitBank = false, fail = false, scriptURL = "https://example.test/study.js" } = {}) {
  const store = new Map([["study-topics-v1", "unchanged"]]);
  const doc = {
    currentScript: { src: scriptURL },
    activeElement: null,
    createElement() {
      return { textContent: "", set innerHTML(value) { this.textContent = String(value).replace(/<[^>]*>/g, ""); } };
    },
    head: { appendChild() {} },
    getElementById() { return null; }
  };
  const window = {
    dispatchEvent() {},
    navigator: {},
    fetch: fail ? () => Promise.reject(new Error("offline")) : async url => {
      assert.equal(url, new URL("study-pages.json", scriptURL).href);
      return { ok: true, json: async () => clone(data) };
    }
  };
  if (!omitBank) window.PREVIEW_MOCKS = { "jss-mock-2": current };
  const context = { document: doc, window, localStorage: {
    getItem(key) { return store.get(key) || null; }, setItem(key, value) { store.set(key, value); }
  }, CustomEvent: function () {}, Date, Promise, Object, String, URL, console };
  vm.runInNewContext(fs.readFileSync("study.js", "utf8"), context);
  return { api: window.StudyList, store, original: store.get("study-topics-v1") };
}

function item(ref, q) { return { id: ref, r: ref, q, t: "Renamed topic", a: "other", at: 1, d: 0 }; }
function saved(ref) { return map.refs[ref].source.stem.slice(0, 400); }

(async () => {
  assert.equal(map.schemaVersion, 2);
  assert.equal(map.edition.sha256, "fa29764869e9551e9f6049bcd6b1badf6df59ab6c6bab34594e2e5b0980516e8");
  assert.equal(map.edition.pageCount, 975);
  assert.equal(map.sections.length, 97);
  assert.equal(Object.keys(map.refs).length, 13);
  assert.deepEqual(map.refs, registry.refs, "the generated map exactly preserves the reviewed registry payload");
  for (const [ref, mapping] of Object.entries(map.refs)) {
    const index = Number(ref.split(":").pop()), question = mock.questions[index];
    assert.equal(question.q, mapping.source.stem, `${ref} full stem`);
    assert.deepEqual(question.options, mapping.source.options, `${ref} option order and text`);
    assert.equal(question.correct, mapping.source.correct, `${ref} answer key`);
    const prefix = mapping.source.stem.slice(0, 400);
    assert.deepEqual(mock.questions.map((q, i) => q.q.trim().slice(0, 400) === prefix ? i : -1).filter(i => i >= 0), [index], `${ref} stored-context uniqueness`);
  }
  assert.deepEqual(map.refs["m:jss-mock-2:27"].locations[0].pages, [95, 96]);
  assert.deepEqual(map.refs["m:jss-mock-2:30"].locations[0].pages, [374]);
  assert.deepEqual(map.refs["m:jss-mock-2:21"].locations[0].pages, [374]);
  assert.equal(map.sections.find(section => section.id === "cli-2").startPage, 644);
  assert.equal(map.refs["m:jss-mock-2:37"].locations[0].sectionId, "cli-2");
  assert.deepEqual(map.refs["m:jss-mock-2:15"].locations[0].pages, [688, 689]);

  const good = harness();
  await good.api.loadPageMap();
  assert.equal(good.api.pageState(), "ready");
  assert.equal(good.api.pageAssetURL, "https://example.test/study-pages.json");
  assert.equal(good.api.resolvePage(item("m:jss-mock-2:27", saved("m:jss-mock-2:27"))).state, "matched");
  assert.deepEqual(Array.from(good.api.resolvePage(item("m:jss-mock-2:27", saved("m:jss-mock-2:27"))).locations[0].pages), [95, 96]);
  assert.match(good.api.exportText([item("m:jss-mock-2:27", saved("m:jss-mock-2:27"))], "open"), /Original textbook pp\. 95-96/);
  assert.equal(good.api.resolvePage(item("m:jss-mock-2:27", "")).state, "saved-mismatch");
  assert.equal(good.api.resolvePage(item("m:jss-mock-2:27", saved("m:jss-mock-2:27").slice(0, -1))).state, "saved-mismatch");
  assert.equal(good.api.resolvePage(item("m:jss-mock-2:27", saved("m:jss-mock-2:27"))).state, "matched", "renames do not change identity");
  assert.equal(good.api.resolvePage(item("m:unknown:1", "anything")).state, "none");
  assert.equal(good.api.resolvePage(item("c:card-1", "definition")).state, "none");
  assert.match(good.api.exportText([item("c:card-1", "definition")], "open"), /No verified page match yet/);
  assert.equal(good.store.get("study-topics-v1"), good.original, "page lookup must not mutate storage");

  const bateson = "m:jss-mock-2:15";
  assert.equal(saved(bateson).length, 400);
  assert.equal(harness({}).api.pageAssetURL, "https://example.test/study-pages.json");
  const fullStem = map.refs[bateson].source.stem;
  const batesonCurrent = harness();
  await batesonCurrent.api.loadPageMap();
  assert.equal(batesonCurrent.api.resolvePage(item(bateson, fullStem.slice(0, 400))).state, "matched");
  const changedSuffix = clone(mock); changedSuffix.questions[15].q += " Changed content after the stored 400 characters.";
  const suffixGuard = harness({ current: changedSuffix }); await suffixGuard.api.loadPageMap();
  assert.equal(suffixGuard.api.resolvePage(item(bateson, fullStem.slice(0, 400))).state, "source-mismatch");

  const disjoint = clone(map);
  disjoint.refs["m:jss-mock-2:36"].locations[0].pages = [83, 85];
  const disjointHarness = harness({ data: disjoint }); await disjointHarness.api.loadPageMap();
  assert.match(disjointHarness.api.exportText([item("m:jss-mock-2:36", saved("m:jss-mock-2:36"))], "open"), /pp\. 83, 85/);

  for (const mutate of [
    data => { data.schemaVersion = 1; },
    data => { data.edition.sha256 = "wrong"; },
    data => { data.edition.pageCount = 974; },
    data => { data.refs["m:jss-mock-2:36"].locations[0].pages = [976]; },
    data => { data.refs["m:jss-mock-2:36"].locations[0].sectionId = "unknown"; },
    data => { data.refs["m:jss-mock-2:36"].locations[0].pages = [83, 82]; }
  ]) {
    const invalid = clone(map); mutate(invalid);
    const h = harness({ data: invalid });
    await h.api.loadPageMap();
    assert.equal(h.api.pageState(), "unavailable");
    assert.equal(h.api.resolvePage(item("m:jss-mock-2:36", saved("m:jss-mock-2:36"))).state, "unavailable");
  }
  const offline = harness({ fail: true });
  await offline.api.loadPageMap();
  assert.equal(offline.api.pageState(), "unavailable");
  assert.match(offline.api.exportText([item("m:jss-mock-2:36", saved("m:jss-mock-2:36"))], "open"), /unavailable/);
  const android = harness({ scriptURL: "file:///android_asset/www/study.js" });
  assert.equal(android.api.pageAssetURL, "file:///android_asset/www/study-pages.json");
  const androidAssetLoader = harness({ scriptURL: "https://appassets.androidplatform.net/study.js" });
  assert.equal(androidAssetLoader.api.pageAssetURL, "https://appassets.androidplatform.net/study-pages.json");

  for (const [change, expected] of [
    [q => { q.q += " changed suffix"; }, "source-mismatch"],
    [q => { q.options.a += " changed option"; }, "source-mismatch"],
    [q => { q.correct = "a"; }, "source-mismatch"],
    [q => { q.options = { a: "moved", b: "question", c: "source", d: "here" }; }, "source-mismatch"]
  ]) {
    const current = clone(mock); change(current.questions[36]);
    const h = harness({ current }); await h.api.loadPageMap();
    assert.equal(h.api.resolvePage(item("m:jss-mock-2:36", saved("m:jss-mock-2:36"))).state, expected);
  }
  const missing = clone(mock); missing.questions.splice(36, 1);
  const moved = harness({ current: missing }); await moved.api.loadPageMap();
  assert.equal(moved.api.resolvePage(item("m:jss-mock-2:36", saved("m:jss-mock-2:36"))).state, "source-mismatch");
  const snapshotOnly = harness({ omitBank: true }); await snapshotOnly.api.loadPageMap();
  assert.equal(snapshotOnly.api.resolvePage(item("m:jss-mock-2:36", saved("m:jss-mock-2:36"))).state, "matched", "Name Lock uses the reviewed snapshot and saved context");
  assert.equal(snapshotOnly.api.resolvePage(item("m:jss-mock-2:36", "short" )).state, "saved-mismatch");

  console.log("study page mapping behavior passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
