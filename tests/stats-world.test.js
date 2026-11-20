const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "name-lock/app/stats.js"), "utf8"), context, { filename: "name-lock/app/stats.js" });
vm.runInNewContext(fs.readFileSync(path.join(root, "name-lock/app/viva.js"), "utf8"), context, { filename: "name-lock/app/viva.js" });
const stats = context.window.NL_STATS;
const book = fs.readFileSync(path.join(root, "notes/statistics/index.html"), "utf8");

test("six games and the Normal Curve Boss, in the pitched order", () => {
  assert.deepEqual(Array.from(stats.levels, l => l.k), ["tp", "dd", "vs", "rv", "sr", "eh", "nc"]);
  const boss = stats.levels.at(-1);
  assert.equal(boss.boss, true);
  assert.ok(boss.pass > 0 && boss.pass <= 1);
  assert.ok(stats.levels.slice(0, -1).every(l => !l.boss && l.qs.length >= 10));
});

test("every question is well formed", () => {
  const ids = stats.levels.flatMap(l => l.qs.map(q => q.id));
  assert.equal(new Set(ids).size, ids.length, "question ids are unique");
  const vivaIds = new Set(["dis", "jss", "sjc"].flatMap(w => context.window.NL_VIVA[w].levels.flatMap(l => (l.cards || []).map(c => c.id))));
  assert.ok(ids.every(id => !vivaIds.has(id)), "no clash with viva card ids");
  for (const level of stats.levels) {
    for (const q of level.qs) {
      assert.ok(q.id.startsWith(level.k + "-"), q.id);
      assert.ok(q.q && q.q.length > 20, q.id);
      assert.equal(q.o.length, q.w.length, q.id);
      assert.equal(q.o.length, level.k === "rv" ? 2 : 4, q.id);
      assert.equal(new Set(q.o).size, q.o.length, q.id + " options are distinct");
      assert.ok(q.w.every(w => w.length > 20), q.id + " every option is explained");
      for (const s of [q.q, ...q.o, ...q.w]) assert.ok(!/[–—]/.test(s), q.id + " has no en or em dash");
      assert.match(book, new RegExp('<h2[^>]*id="' + q.r + '"'), q.id + " links to a real stats book section");
    }
  }
});

test("World 6 is built, open and routed", () => {
  const worlds = fs.readFileSync(path.join(root, "name-lock/app/worlds.js"), "utf8");
  const app = fs.readFileSync(path.join(root, "name-lock/app/app.js"), "utf8");
  assert.match(worlds, /id: "stats"[^\n]*\n[^\n]*built: true, open: true/);
  assert.match(worlds, /w\.id === "stats" \? w\.id : "map"/);
  assert.match(app, /location\.hash === "#stats"\)\{[^\n]*openStats\(\)/);
  for (const f of ["index.html", "worlds.html"]) assert.match(fs.readFileSync(path.join(root, "name-lock/app", f), "utf8"), /<script src="stats\.js"><\/script>/);
  assert.match(fs.readFileSync(path.join(root, "name-lock/app/sw.js"), "utf8"), /"stats\.js"/);
});
