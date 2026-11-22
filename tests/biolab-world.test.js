const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const context = { window: {} };
for (const f of ["viva.js", "stats.js", "biolab.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(root, "name-lock/app", f), "utf8"), context, { filename: "name-lock/app/" + f });
}
const lab = context.window.NL_BIOG;

test("six Biopsych Lab games, in the pitched order", () => {
  assert.deepEqual(Array.from(lab.levels, l => l.k), ["bm", "ld", "nl", "ap", "sc", "hh"]);
  assert.equal(lab.pre, "bg");
  assert.ok(lab.levels.every(l => !l.boss && l.qs.length >= 10));
});

test("every question is well formed", () => {
  const ids = lab.levels.flatMap(l => l.qs.map(q => q.id));
  assert.equal(new Set(ids).size, ids.length, "question ids are unique");
  const other = new Set([
    ...["dis", "jss", "sjc", "cv"].flatMap(w => context.window.NL_VIVA[w].levels.flatMap(l => (l.cards || []).map(c => c.id))),
    ...context.window.NL_STATS.levels.flatMap(l => l.qs.map(q => q.id))
  ]);
  assert.ok(ids.every(id => !other.has(id)), "no clash with stats or viva ids");
  for (const level of lab.levels) {
    for (const q of level.qs) {
      assert.ok(q.id.startsWith(level.k + "-"), q.id);
      assert.ok(q.q && q.q.length > 20, q.id);
      assert.equal(q.o.length, 4, q.id);
      assert.equal(q.w.length, 4, q.id);
      assert.equal(new Set(q.o).size, 4, q.id + " options are distinct");
      assert.ok(q.w.every(w => w.length > 20), q.id + " every option is explained");
      for (const s of [q.q, ...q.o, ...q.w]) assert.ok(!/[–—]/.test(s), q.id + " has no en or em dash");
      assert.ok(lab.secs[q.r], q.id + " links to a notes section");
      if (level.k === "bm") {
        assert.ok(q.fig && lab.svg[q.fig.v], q.id + " has a brain view");
        assert.equal(lab.svg[q.fig.v].split('data-r="' + q.fig.hl + '"').length - 1, 1, q.id + " region " + q.fig.hl + " is on the diagram once");
        assert.match(lab.fig(q.fig), new RegExp('data-r="' + q.fig.hl + '" data-on="1"'), q.id + " lights its region");
      } else assert.equal(q.fig, undefined, q.id);
    }
  }
});

test("every notes link lands on a real page and anchor", () => {
  for (const [k, [p]] of Object.entries(lab.secs)) {
    const [file, hash] = p.split("#");
    const html = fs.readFileSync(path.join(root, file), "utf8");
    if (hash) assert.match(html, new RegExp('id="' + hash + '"'), k);
  }
});

test("the Lab is routed, loaded and cached", () => {
  const app = fs.readFileSync(path.join(root, "name-lock/app/app.js"), "utf8");
  assert.match(app, /location\.hash === "#biolab"\)\{[^\n]*openStats\(BGW\)/);
  assert.match(app, /id="bio-lab"/);
  assert.match(fs.readFileSync(path.join(root, "name-lock/app/index.html"), "utf8"), /<script src="stats\.js"><\/script>\n<script src="biolab\.js"><\/script>/);
  assert.match(fs.readFileSync(path.join(root, "name-lock/app/sw.js"), "utf8"), /"biolab\.js"/);
});
