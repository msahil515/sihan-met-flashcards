/* A reset must survive a sync: sync.js merges answers by union, so before the
   rs stamp a wiped run was refilled from the other device's copy (Sihan,
   21 Nov 2026: "even after resetting it shows the questions that were answered"). */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const store = new Map();
const ctx = {
  localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
  document: { readyState: "complete", addEventListener() {}, hidden: false },
  setTimeout() {}, setInterval() {}, console
};
ctx.window = ctx;
ctx.addEventListener = () => {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + "/../sync.js", "utf8"), ctx);
const merge = (key, l, r, lT = 1, rT = 2) => JSON.parse(ctx.SihanSync.mergeValue(key, JSON.stringify(l), JSON.stringify(r), lT, rT));

const old = { i: 7, ans: { 0: "a", 1: "b", 2: "c" }, mode: "practice", done: false, redo: null, xp: 0 };

// Tests app: reset here, old copy on the other device -> stays wiped, whichever side is newer by clock
let m = merge("tapp-run-x-v1", { i: 0, ans: {}, mode: "practice", done: false, redo: null, xp: 0, rs: 5000 }, old);
assert.deepEqual(m.ans, {}); assert.equal(m.i, 0); assert.equal(m.rs, 5000);
m = merge("tapp-run-x-v1", old, { i: 0, ans: { 4: "d" }, mode: "practice", done: false, redo: null, xp: 0, rs: 5000 }, 9, 1);
assert.deepEqual(m.ans, { 4: "d" });

// Redo the wrong: wrong answers deleted + stamp -> they do not come back
m = merge("tapp-run-x-v1", { ...old, ans: { 0: "a" }, redo: [1, 2], i: 1, rs: 6000 }, { ...old, rs: 5000 });
assert.deepEqual(m.ans, { 0: "a" }); assert.deepEqual(m.redo, [1, 2]);

// Same attempt on both devices (same stamp, or no stamp at all) -> answers still union as before
m = merge("tapp-run-x-v1", { ...old, ans: { 0: "a" }, rs: 5000 }, { ...old, ans: { 1: "b" }, rs: 5000 });
assert.deepEqual(m.ans, { 0: "a", 1: "b" });
m = merge("tapp-run-x-v1", { ...old, ans: { 0: "a" } }, { ...old, ans: { 1: "b" } });
assert.deepEqual(m.ans, { 0: "a", 1: "b" });

// Site engine state + its summary
const site = { i: 3, answers: { 0: "a", 5: "b" }, flags: { 5: 1 }, marks: {}, revealed: { 0: 1 }, visited: { 0: 1, 5: 1 }, filter: "all", wrongSet: null };
m = merge("revamp-preview-x-v1", { i: 0, answers: {}, flags: {}, marks: {}, revealed: {}, visited: { 0: 1 }, filter: "all", wrongSet: null, rs: 7000 }, site);
assert.deepEqual(m.answers, {}); assert.deepEqual(m.flags, {});
m = merge("revamp-preview-x-v1", { ...site, answers: { 0: "a" } }, { ...site, answers: { 9: "c" } });
assert.deepEqual(m.answers, { 0: "a", 9: "c" });
m = merge("take-summary-x", { answered: 0, total: 60, right: 0, wrong: 0, ts: 7000, rs: 7000 }, { answered: 40, total: 60, right: 30, wrong: 10, ts: 6000 });
assert.equal(m.answered, 0);
m = merge("take-summary-x", { answered: 3, ts: 1 }, { answered: 40, ts: 2 });
assert.equal(m.answered, 40);

console.log("sync reset tests passed");
