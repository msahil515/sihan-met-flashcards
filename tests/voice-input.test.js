const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function harness(options = {}) {
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; this.value = ""; this.selectionStart = 0; this.selectionEnd = 0; this.hidden = false; this.style = {}; this.isConnected = true; }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    insertBefore(child, before) { child.parentNode = this; this.children.splice(this.children.indexOf(before), 0, child); return child; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    setAttribute() {}
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
    dispatchEvent(event) { this.dispatched = event.type; }
    focus() { this.focused = true; }
  }
  const mutations = [];
  const document = { hidden: false, documentElement: new Element("html"), listeners: {}, createElement: tag => new Element(tag), addEventListener(name, fn) { this.listeners[name] = fn; } };
  const root = { document, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, MutationObserver: class { constructor(fn) { mutations.push(fn); } observe() {} }, Event: class { constructor(type, init) { this.type = type; this.bubbles = init.bubbles; } }, speechSynthesis: { cancel() { root.ttsStopped = true; } } };
  if (options.native) root.NLNative = { startVoice: (id, lang) => { root.started = [id, lang]; }, cancelVoice: id => { root.cancelled = id; } };
  if (options.Recognition) root.SpeechRecognition = options.Recognition;
  const context = vm.createContext({ window: root, document, Event: root.Event });
  vm.runInContext(fs.readFileSync(require.resolve("../voice-input.js"), "utf8"), context);
  const parent = new Element("section"), field = new Element("textarea");
  field.value = options.value || "";
  field.selectionStart = field.selectionEnd = options.caret == null ? field.value.length : options.caret;
  parent.appendChild(field);
  let identity = "q1";
  const controls = root.NLVoice.attach(field, { getIdentity: () => identity });
  const wrap = parent.children[0], button = wrap.children[1];
  return { root, document, field, wrap, button, controls, mutations, setIdentity: value => { identity = value; } };
}

{
  const h = harness({ native: true, value: "alpha omega", caret: 5 });
  h.button.listeners.click();
  assert.match(h.root.started[0], /^voice-/);
  assert.match(h.root.started[0], /-1$/);
  assert.equal(h.root.started[1], "en-US");
  assert.equal(h.root.ttsStopped, true);
  const id = h.root.started[0];
  h.root.NLVoice.onResult(id, "result", "hello\n'🌍'");
  h.root.NLVoice.onResult(id, "result", "duplicate");
  assert.equal(h.field.value, "alpha hello\n'🌍' omega");
  assert.equal(h.field.dispatched, "input");
  assert.equal(h.field.selectionStart, 16);
}

{
  const oldPage = harness({ native: true, value: "old" });
  oldPage.button.listeners.click();
  const oldId = oldPage.root.started[0];
  assert.match(oldId, /^[A-Za-z0-9_-]{1,64}$/);
  const newPage = harness({ native: true, value: "new" });
  newPage.button.listeners.click();
  const newId = newPage.root.started[0];
  assert.match(newId, /^[A-Za-z0-9_-]{1,64}$/);
  assert.notEqual(oldId, newId, "native request IDs differ across page reloads");
  newPage.root.NLVoice.onResult(oldId, "result", "old callback");
  assert.equal(newPage.field.value, "new");
}

{
  const h = harness({ native: true, value: "wordafter", caret: 4 });
  h.button.listeners.click();
  h.root.NLVoice.onResult(h.root.started[0], "result", "voice");
  assert.equal(h.field.value, "word voice after");
}

{
  const h = harness({ native: true, value: "draft" });
  h.button.listeners.click();
  const id = h.root.started[0];
  h.field.value = "manual edit";
  h.root.NLVoice.onResult(id, "result", "spoken");
  assert.equal(h.field.value, "manual edit spoken");
  h.button.listeners.click();
  const cancelled = h.root.started[0];
  h.wrap.children[3].listeners.click();
  assert.equal(h.root.cancelled, cancelled);
  h.root.NLVoice.onResult(cancelled, "result", "late");
  assert.equal(h.field.value, "manual edit spoken");
}

{
  const h = harness({ native: true, value: "answer" });
  h.button.listeners.click();
  const id = h.root.started[0];
  h.setIdentity("q2");
  h.root.NLVoice.onResult(id, "result", "stale");
  assert.equal(h.field.value, "answer");
}

{
  const h = harness({ native: true, value: "draft" });
  h.button.listeners.click();
  const id = h.root.started[0];
  assert.equal(h.document.listeners.pagehide, undefined, "pagehide is registered on the window, where the event fires");
  h.root.listeners.pagehide();
  assert.equal(h.root.cancelled, id, "pagehide cancels the native request without relying on activity pause");
  h.root.NLVoice.onResult(id, "result", "stale after pagehide");
  assert.equal(h.field.value, "draft");
}

{
  const h = harness({ native: true, value: "answer" });
  h.button.listeners.click();
  const id = h.root.started[0];
  h.field.isConnected = false;
  h.root.NLVoice.onResult(id, "result", "stale");
  assert.equal(h.field.value, "answer");
}

{
  const h = harness({ value: "typed" });
  h.button.listeners.click();
  assert.equal(h.field.value, "typed");
  assert.match(h.wrap.children.at(-1).textContent, /keyboard microphone/);
}

{
  const instances = [];
  class Recognition {
    constructor() { instances.push(this); }
    start() {}
    stop() {}
    abort() { this.aborted = true; }
  }
  const h = harness({ Recognition, value: "my answer" });
  h.button.listeners.click();
  const instance = instances[0];
  instance.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "browser words" } }] });
  h.wrap.children[2].listeners.click();
  instance.onend();
  assert.equal(h.field.value, "my answer browser words");
}

{
  let instance;
  class Recognition {
    constructor() { instance = this; }
    start() {}
    abort() { this.aborted = true; }
  }
  const h = harness({ Recognition, value: "keep" });
  h.button.listeners.click();
  h.wrap.children[3].listeners.click();
  instance.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "discard" } }] });
  instance.onend();
  assert.equal(h.field.value, "keep");
  assert.match(h.wrap.children.at(-1).textContent, /cancelled/);
}

{
  const instances = [];
  class Recognition {
    constructor() { instances.push(this); }
    start() {}
    abort() { this.aborted = true; }
  }
  const h = harness({ Recognition, value: "draft" });
  h.button.listeners.click();
  const first = instances[0];
  first.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "CANCELLED WORDS" } }] });
  h.wrap.children[3].listeners.click();
  h.button.listeners.click();
  const second = instances[1];
  first.onend();
  first.onerror();
  assert.equal(h.field.value, "draft");
  second.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "NEW WORDS" } }] });
  second.onend();
  assert.equal(h.field.value, "draft NEW WORDS");
  assert.equal(first.aborted, true);
}

{
  let instance;
  class Recognition {
    constructor() { instance = this; }
    start() {}
    abort() { this.aborted = true; }
  }
  const h = harness({ Recognition, value: "draft" });
  h.button.listeners.click();
  h.root.listeners.pagehide();
  assert.equal(instance.aborted, true, "pagehide aborts browser capture immediately");
  instance.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "stale words" } }] });
  instance.onend();
  assert.equal(h.field.value, "draft", "callbacks after pagehide cannot mutate the answer");
}

{
  const instances = [];
  class Recognition {
    constructor() { instances.push(this); }
    start() {}
    abort() { this.aborted = true; }
  }
  const h = harness({ Recognition, value: "draft" });
  h.button.listeners.click();
  const session = instances[0];
  h.field.isConnected = false;
  h.mutations[0]();
  assert.equal(session.aborted, true, "detaching the answer field aborts recognition immediately");
  assert.equal(h.wrap.children[2].hidden, true);
  session.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "late words" } }] });
  session.onend();
  assert.equal(h.field.value, "draft");
}

const nameLockSource = fs.readFileSync(require.resolve("../name-lock/app/app.js"), "utf8");
assert.match(nameLockSource, /Drafts last for this session only\. Leaving or reloading clears them\./);
console.log("voice-input adapter tests passed");
