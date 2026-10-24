const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { chromium } = require("playwright");

// Run with NODE_PATH=/Users/sahil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node tests/study-auto.test.js

const store = new Map();
let writes = 0, events = 0;
const context = {
  document: { currentScript: { src: "file:///study.js" }, head: { appendChild() {} }, getElementById() { return null; }, createElement() { return { set innerHTML(value) { this.textContent = value.replace(/<[^>]*>/g, ""); } }; } },
  localStorage: { getItem(k) { return store.get(k) || null; }, setItem(k, v) { writes++; store.set(k, v); } },
  window: { dispatchEvent() { events++; }, navigator: {} }, CustomEvent: function () {}, Date, Promise, Object, String
};
vm.runInNewContext(fs.readFileSync("study.js", "utf8"), context);
const list = context.window.StudyList;
const item = { id: "m:fixture:0", t: "Original", a: "social", f: "Fixture · Q1", q: "Original question", r: "m:fixture:0", n: "original" };
list.addWrong(item);
const initial = JSON.parse(store.get("study-topics-v1")).it[item.id];
const count = [writes, events];
list.rename(item.id, "My renamed topic");
const renamed = JSON.parse(store.get("study-topics-v1")).it[item.id];
const afterRename = [writes, events];
list.addWrong(item);
assert.deepEqual([writes, events], afterRename, "open wrong item is a strict no-op");
assert.equal(list.get(item.id).t, "My renamed topic");
list.setDone(item.id, true);
const done = JSON.parse(store.get("study-topics-v1")).it[item.id];
list.addWrong({ ...item, t: "Changed source title", q: "Changed source question" });
let reopened = JSON.parse(store.get("study-topics-v1")).it[item.id];
assert.equal(reopened.t, "My renamed topic");
assert.equal(reopened.q, "Original question");
assert.equal(reopened.r, "m:fixture:0");
assert.equal(reopened.at, initial.at);
assert.equal(reopened.u > done.u, true, "reopen timestamp beats the previous edit for sync tie resolution");
list.remove(item.id);
const removed = JSON.parse(store.get("study-topics-v1")).it[item.id];
list.addWrong(item);
reopened = JSON.parse(store.get("study-topics-v1")).it[item.id];
assert.equal(reopened.x, 0);
assert.equal(reopened.u > removed.u, true);
assert.equal(reopened.t, "My renamed topic");
assert.equal(renamed.t, "My renamed topic");
assert.ok(count[0] > 0 && count[1] > 0);

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(6000);
    await page.goto("http://127.0.0.1:8766/tests-app/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!window.TAPP && !!window.StudyList);
    const mockId = "jss-mock-2";
    await page.locator(`[data-go="lobby"][data-id="${mockId}"]`).click();
    await page.locator('[data-m="practice"]').click();
    await page.locator("#app button").filter({ hasText: "Start" }).click();
    const q = await page.evaluate(id => ({ q: TAPP.P[id].questions[0], id }), mockId);
    const wrong = ["a", "b", "c", "d"].find(k => k !== q.q.correct && q.q.options[k]);
    await page.locator(`#opts [data-k="${wrong}"]`).click();
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem("study-topics-v1") || "{}").it || {});
    assert.ok(saved[`m:${mockId}:0`], "practice wrong answer adds the original mock item");
    assert.equal(saved[`m:${mockId}:0`].r, `m:${mockId}:0`);
    await page.evaluate(id => StudyList.remove(`m:${id}:0`), mockId);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!window.TAPP);
    await page.evaluate(() => TAPP.go("home"));
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem("study-topics-v1") || "{}").it || {});
    assert.equal(saved[`m:${mockId}:0`].x, 1, "reload/history does not restore a removed practice miss");

    const examId = "amity-recall";
    await page.evaluate(id => TAPP.go("lobby", id), examId);
    await page.locator('[data-m="full"]').click();
    await page.locator("#app button").filter({ hasText: "Start" }).click();
    const examQ = await page.evaluate(id => TAPP.P[id].questions[0], examId);
    const examWrong = ["a", "b", "c", "d"].find(k => k !== examQ.correct && examQ.options[k]);
    await page.locator(`#opts [data-k="${examWrong}"]`).click();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem("study-topics-v1") || "{}").it || {});
    assert.equal(saved[`m:${examId}:0`], undefined, "full exam keeps the study list unchanged before finish");
    await page.locator(`#opts [data-k="${examQ.correct}"]`).click();
    await page.locator("#pNext").click();
    const second = await page.evaluate(id => TAPP.P[id].questions[1], examId);
    const secondWrong = ["a", "b", "c", "d"].find(k => k !== second.correct && second.options[k]);
    await page.locator(`#opts [data-k="${secondWrong}"]`).click();
    await page.locator("#pGrid").click();
    await page.locator("#gFin").click();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem("study-topics-v1") || "{}").it || {});
    assert.equal(saved[`m:${examId}:0`], undefined, "a wrong selection changed to correct stays out of the final list");
    assert.ok(saved[`m:${examId}:1`], "first full-exam finish adds the final answered wrong question");
    await page.evaluate(id => StudyList.remove(`m:${id}:1`), examId);
    await page.getByText("Review every answer").click();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem("study-topics-v1") || "{}").it || {});
    assert.equal(saved[`m:${examId}:1`].x, 1, "reviewing a completed exam does not resurrect a removed miss");

    await page.evaluate(() => REVENGE.enter());
    await page.locator('.rg-mode[data-m="flip"]').evaluate(el => el.click());
    const revengeKey = await page.evaluate(() => REVENGE._sess().list[0]);
    const revengeQuestion = await page.evaluate(key => {
      const split = key.lastIndexOf(":");
      return { id: key.slice(0, split), index: +key.slice(split + 1), q: TAPP.P[key.slice(0, split)].questions[+key.slice(split + 1)].q };
    }, revengeKey);
    await page.locator("#rgF").evaluate(el => el.click());
    await page.locator("#rgN").evaluate(el => el.click());
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem("study-topics-v1") || "{}").it || {});
    assert.equal(saved[`m:${revengeQuestion.id}:${revengeQuestion.index}`].q, revengeQuestion.q, "a wrong accepted in Revenge Flip saves the original mock question");

    await page.goto("http://127.0.0.1:8766/name-lock/app/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!window.NLAPP && !!window.StudyList);
    const targetCard = await page.evaluate(() => NL_CARDS[0].id);
    await page.evaluate(() => NLAPP.start({ kind: "drill", mode: "name", cat: "all", cards: [NL_CARDS[0]] }));
    await page.waitForFunction(() => document.querySelectorAll("#l-body .opt").length > 1);
    const distractor = await page.locator("#l-body .opt").evaluateAll((buttons, id) => {
      const wrong = buttons.find(button => button.dataset.id !== id);
      window.savedWrongButton = wrong;
      return wrong.dataset.id;
    }, targetCard);
    await page.locator(`#l-body .opt[data-id="${distractor}"]`).evaluate(el => el.click());
    await page.locator("#l-check").evaluate(el => el.click());
    const cardStudyId = `c:${targetCard}`;
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem("study-topics-v1") || "{}").it || {});
    assert.ok(saved[cardStudyId], "Name Lock saves the target card after a wrong answer");
    assert.equal(saved[cardStudyId].t, await page.evaluate(id => NL_CARDS.find(card => card.id === id).name, targetCard));
    const attempts = await page.evaluate(id => NLAPP.P().c[id].n, targetCard);
    await page.evaluate(() => { window.savedWrongButton.disabled = false; window.savedWrongButton.click(); });
    assert.equal(await page.evaluate(id => NLAPP.P().c[id].n, targetCard), attempts, "a repeated Check cannot grade the same Name Lock question twice");
  } finally {
    await browser.close();
  }
  console.log("automatic study behavior passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
