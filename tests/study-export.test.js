const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function button(attrs) {
  return {
    attrs,
    onclick: null,
    getAttribute(name) { return this.attrs[name] || null; }
  };
}

function harness(seed) {
  const original = JSON.stringify({ it: seed });
  const store = new Map([["study-topics-v1", original]]);
  const doc = {
    head: { appendChild() {} },
    getElementById() { return null; },
    createElement() { return {}; },
    copyResult: true,
    execCommand() { return this.copyResult; }
  };
  const context = {
    document: doc,
    localStorage: {
      getItem(key) { return store.get(key) || null; },
      setItem(key, value) { store.set(key, value); }
    },
    window: { dispatchEvent() {}, navigator: {} },
    CustomEvent: function () {},
    Date,
    Promise,
    Object,
    String,
    console
  };
  vm.runInNewContext(fs.readFileSync("study.js", "utf8"), context);

  const root = {
    _studyExportOpen: false,
    textarea: { value: "", focused: false, selected: false, focus() { this.focused = true; }, select() { this.selected = true; } },
    status: { textContent: "" },
    set innerHTML(html) {
      this.html = html;
      this.filters = [...html.matchAll(/<button data-f="(open|done|all)"/g)].map(match => button({ "data-f": match[1] }));
    },
    querySelectorAll(selector) {
      if (selector === ".stl-seg button") return this.filters;
      return [];
    },
    querySelector(selector) {
      if (selector === ".stl-export-toggle") return this.exportToggle;
      if (selector === ".stl-export textarea") return this.textarea;
      if (selector === ".stl-export-status") return this.status;
      if (selector === "[data-export-copy]") return this.copyButton;
      if (selector === "#stl-new") return { value: "" };
      if (selector === "#stl-addb") return button({});
      return null;
    }
  };
  // The script publishes StudyList on window.
  return { context, doc, root, api: context.window.StudyList, original, store };
}

const seed = {
  "u:social-old": { t: "Older", a: "social", f: "Old mock", q: "old?", r: "m:old:1", at: 1, u: 1, d: 0, x: 0 },
  "u:social-new": { t: "Café \"quote\"", a: "social", f: "Mock", q: "First line\n第二行?", r: "m:mock:2", at: 3, u: 3, d: 0, x: 0 },
  "u:general": { t: "General", a: "general", f: "General mock", q: "Definition", r: "m:g:0", at: 2, u: 2, d: 0, x: 0 },
  "c:done": { t: "Completed", a: "social", f: "Card source", q: "Done definition", r: "c:card-1", at: 4, u: 4, d: 10, x: 0 },
  "u:removed": { t: "Removed", a: "clinical", f: "Old", q: "Hidden", r: "u:removed", at: 5, u: 5, d: 0, x: 1 }
};

const h = harness(seed);
const api = h.api;
const root = h.root;
root.exportToggle = button({});
root.copyButton = button({});
api.render(root);
root.exportToggle.onclick();
assert.match(root.textarea.value, /Filter: To study/);
assert.match(root.textarea.value, /Entries: 3/);
assert.ok(root.textarea.value.indexOf("General") < root.textarea.value.indexOf('Café "quote"'));
assert.match(root.textarea.value, /First line\n第二行\?/);
assert.match(root.textarea.value, /Reference ID: m:mock:2/);
assert.doesNotMatch(root.textarea.value, /Removed|u:removed/);
assert.match(root.textarea.value, /separate mapping update will use the original textbook master/);

const all = root.querySelectorAll(".stl-seg button").find(b => b.getAttribute("data-f") === "all");
all.onclick();
assert.match(root.textarea.value, /Filter: All/);
assert.match(root.textarea.value, /Entries: 4/);
assert.ok(root.textarea.value.indexOf("Reference ID: m:mock:2") < root.textarea.value.indexOf("Reference ID: c:card-1"));

const done = root.querySelectorAll(".stl-seg button").find(b => b.getAttribute("data-f") === "done");
done.onclick();
assert.match(root.textarea.value, /Filter: Done/);
assert.match(root.textarea.value, /Entries: 1/);
assert.match(root.textarea.value, /Completed/);
root.copyButton.onclick();
assert.equal(root.textarea.focused, true);
assert.equal(root.textarea.selected, true);
assert.equal(root.status.textContent, "Copied.");
h.doc.copyResult = false;
root.copyButton.onclick();
assert.equal(root.status.textContent, "Copy unavailable. Select and copy the text above.");
assert.equal(h.store.get("study-topics-v1"), h.original, "export and copy must not change storage");

console.log("study export behavior passed");
