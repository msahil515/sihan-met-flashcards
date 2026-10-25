const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const map = JSON.parse(fs.readFileSync("study-pages.json", "utf8"));
const registry = JSON.parse(fs.readFileSync("scripts/study-page-refs.json", "utf8"));
const PRIOR_REFS = {
  "m:jss-mock-2:36": {
    "source": {
      "stem": "Which type of intelligence according to Sternberg's Triarchic theory of intelligence includes the ability to easily adopt to the present environment or select a more favourable environment than the existing one or modify the environment to fit one's need?",
      "options": {
        "a": "Componential",
        "b": "Contextual",
        "c": "Incremental",
        "d": "Experimental"
      },
      "correct": "b"
    },
    "locations": [
      {
        "sectionId": "gen-9",
        "pages": [
          83
        ]
      }
    ]
  },
  "m:jss-mock-2:27": {
    "source": {
      "stem": "Which theory of emotion explains the phenomenon of misattribution of arousal (e.g. feeling romantic attraction when actually scared)?",
      "options": {
        "a": "James-Lange theory",
        "b": "Two-factor theory",
        "c": "Cannon-Bard theory",
        "d": "Facial feedback hypothesis"
      },
      "correct": "b"
    },
    "locations": [
      {
        "sectionId": "gen-11",
        "pages": [
          95,
          96
        ]
      }
    ]
  },
  "m:jss-mock-2:9": {
    "source": {
      "stem": "Which of the following secondary tasks is thought to affect the central executive in terms of working memory?",
      "options": {
        "a": "Continually repeating a word",
        "b": "Remembering a spatial configuration",
        "c": "Listening to irrelevant speech",
        "d": "Random number generation"
      },
      "correct": "d"
    },
    "locations": [
      {
        "sectionId": "gen-7",
        "pages": [
          64
        ]
      }
    ]
  },
  "m:jss-mock-2:37": {
    "source": {
      "stem": "Under which grade of insight does \"intellectual insight\" come under?",
      "options": {
        "a": "Grade 3",
        "b": "Grade 4",
        "c": "Grade 5",
        "d": "Grade 6"
      },
      "correct": "c"
    },
    "locations": [
      {
        "sectionId": "cli-2",
        "pages": [
          648
        ]
      }
    ]
  },
  "m:jss-mock-2:28": {
    "source": {
      "stem": "At what age can the Malin's Intelligence Scale be administered to Indian children?",
      "options": {
        "a": "4 years",
        "b": "2 years",
        "c": "5 years",
        "d": "6 years"
      },
      "correct": "d"
    },
    "locations": [
      {
        "sectionId": "asm-6",
        "pages": [
          172
        ]
      }
    ]
  },
  "m:jss-mock-2:1": {
    "source": {
      "stem": "Thematic Apperception Test (TAT) is based on which technique of psychological testing?",
      "options": {
        "a": "Expressive technique",
        "b": "Construction technique",
        "c": "Association technique",
        "d": "Completion technique"
      },
      "correct": "b"
    },
    "locations": [
      {
        "sectionId": "asm-10",
        "pages": [
          194
        ]
      }
    ]
  },
  "m:jss-mock-2:20": {
    "source": {
      "stem": "According to Cialdini, techniques for gaining compliance rest to a large extent on six basic principles. These do NOT include:",
      "options": {
        "a": "Scarcity",
        "b": "Social validation",
        "c": "Friendship/liking",
        "d": "Reward"
      },
      "correct": "d"
    },
    "locations": [
      {
        "sectionId": "soc-7",
        "pages": [
          276,
          277
        ]
      }
    ]
  },
  "m:jss-mock-2:30": {
    "source": {
      "stem": "A 28-year-old man reports a persistent, pervasive pattern of grandiosity, a need for constant admiration, and a distinct lack of empathy. According to Kohut's self-psychology, this pathology arises from a failure in parental:",
      "options": {
        "a": "Mirroring",
        "b": "Idealizing",
        "c": "Twinship",
        "d": "Confrontation"
      },
      "correct": "a"
    },
    "locations": [
      {
        "sectionId": "per-5",
        "pages": [
          374
        ]
      }
    ]
  },
  "m:jss-mock-2:21": {
    "source": {
      "stem": "A client tells you that they are \"no one\" and feels \"empty inside.\" They report chronic fears of abandonment and have a history of intense, unstable relationships. According to psychoanalytic object relations theory, this pathology of the self is most likely a result of:",
      "options": {
        "a": "Fixation at the oral stage of psychosexual development.",
        "b": "A failure in parental mirroring and idealizing, leading to a fragmented self.",
        "c": "Unresolved Oedipal complex and castration anxiety.",
        "d": "Harsh superego demands leading to constant guilt."
      },
      "correct": "b"
    },
    "locations": [
      {
        "sectionId": "per-5",
        "pages": [
          374
        ]
      }
    ]
  },
  "m:jss-mock-2:22": {
    "source": {
      "stem": "In a typical major sleep period, how many cycles of NREM-REM is there:",
      "options": {
        "a": "2-4",
        "b": "4-6",
        "c": "6-10",
        "d": "10-12"
      },
      "correct": "b"
    },
    "locations": [
      {
        "sectionId": "phy-8",
        "pages": [
          485
        ]
      }
    ]
  },
  "m:jss-mock-2:15": {
    "source": {
      "stem": "Gregory Bateson describes a classic example of the interaction between a mother and her son who had fairly well recovered from an acute schizophrenic episode. Bateson described this interaction as follows: '[The son] was glad to see her [his mother] and impulsively put his arm around her shoulders, whereupon she stiffened. He withdrew his arm and she asked, Don't you love me anymore? He then blushed, and she said, Dear, you must not be so easily embarrassed and afraid of your feelings. The patient was able to stay with her only a few minutes more, and following her departure, he assaulted an aide and was put in the isolation room.' Bateson used this interaction to illustrate which ONE of the following concepts?",
      "options": {
        "a": "The cybernetic system",
        "b": "The homeostatic system",
        "c": "The incongruent family dyad",
        "d": "The symptomatic double bind"
      },
      "correct": "d"
    },
    "locations": [
      {
        "sectionId": "cli-7",
        "pages": [
          688,
          689
        ]
      }
    ]
  },
  "m:jss-mock-2:6": {
    "source": {
      "stem": "A patient sees a friend in the street who fails to acknowledge him; he thinks his friend does not like him anymore. He has the following type of cognitive error:",
      "options": {
        "a": "Selective abstraction",
        "b": "Arbitrary inference",
        "c": "Personalization",
        "d": "Magnification"
      },
      "correct": "b"
    },
    "locations": [
      {
        "sectionId": "cli-5",
        "pages": [
          672,
          673
        ]
      }
    ]
  },
  "m:jss-mock-2:35": {
    "source": {
      "stem": "A researcher uses a Scree plot to determine the number of factors to retain in an EFA. The plot shows a sharp drop from eigenvalue 3.5 to 1.8, followed by a gradual plateau where eigenvalues are 0.9, 0.7, and 0.5. According to the Kaiser-Guttman rule and the Scree plot, how many factors should ideally be retained?",
      "options": {
        "a": "5",
        "b": "3",
        "c": "2",
        "d": "1"
      },
      "correct": "c"
    },
    "locations": [
      {
        "sectionId": "res-11",
        "pages": [
          920
        ]
      }
    ]
  }
};
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
const EXPECTED_REFS = [
  "m:jss-mock-2:36", "m:jss-mock-2:27", "m:jss-mock-2:9", "m:jss-mock-2:37",
  "m:jss-mock-2:28", "m:jss-mock-2:1", "m:jss-mock-2:20", "m:jss-mock-2:30",
  "m:jss-mock-2:21", "m:jss-mock-2:22", "m:jss-mock-2:15", "m:jss-mock-2:6", "m:jss-mock-2:35",
  "m:jss-mock-2:81", "m:jss-mock-2:82", "m:jss-mock-2:64", "m:jss-mock-2:38", "m:jss-mock-2:29",
  "m:jss-mock-2:2", "m:jss-mock-2:83", "m:jss-mock-2:47", "m:jss-mock-2:57", "m:jss-mock-2:48",
  "m:jss-mock-2:39", "m:jss-mock-2:67", "m:jss-mock-2:14", "m:jss-mock-2:86", "m:jss-mock-2:77",
  "m:jss-mock-2:68", "m:jss-mock-2:50", "m:jss-mock-2:51", "m:jss-mock-2:42", "m:jss-mock-2:78",
  "m:jss-mock-2:69", "m:jss-mock-2:61", "m:jss-mock-2:52", "m:jss-mock-2:8", "m:jss-mock-2:89",
  "m:jss-mock-2:80", "m:jss-mock-2:53"
];
const NEW_LOCATIONS = {
  "m:jss-mock-2:81": ["gen-6", [50]], "m:jss-mock-2:82": ["asm-4", [155]],
  "m:jss-mock-2:64": ["asm-6", [171]], "m:jss-mock-2:38": ["soc-10", [299]],
  "m:jss-mock-2:29": ["soc-7", [279]], "m:jss-mock-2:2": ["soc-10", [296]],
  "m:jss-mock-2:83": ["soc-1", [234]], "m:jss-mock-2:47": ["soc-10", [297]],
  "m:jss-mock-2:57": ["per-5", [373]], "m:jss-mock-2:48": ["per-6", [377]],
  "m:jss-mock-2:39": ["per-5", [373]], "m:jss-mock-2:67": ["phy-10", [500]],
  "m:jss-mock-2:14": ["dev-4", [561]], "m:jss-mock-2:86": ["dev-10", [599]],
  "m:jss-mock-2:77": ["dev-9", [592]], "m:jss-mock-2:68": ["dev-9", [593]],
  "m:jss-mock-2:50": ["dev-4", [561]], "m:jss-mock-2:51": ["cli-5", [673]],
  "m:jss-mock-2:42": ["cli-6", [687]], "m:jss-mock-2:78": ["cli-4", [664]],
  "m:jss-mock-2:69": ["cli-4", [665]], "m:jss-mock-2:61": ["dis-2", [757]],
  "m:jss-mock-2:52": ["dis-1", [745]], "m:jss-mock-2:8": ["res-2", [858]],
  "m:jss-mock-2:89": ["res-9", [904]], "m:jss-mock-2:80": ["res-10", [910, 911]],
  "m:jss-mock-2:53": ["res-8", [897, 898]]
};

(async () => {
  assert.equal(map.schemaVersion, 2);
  assert.equal(map.edition.sha256, "fa29764869e9551e9f6049bcd6b1badf6df59ab6c6bab34594e2e5b0980516e8");
  assert.equal(map.edition.pageCount, 975);
  assert.equal(map.sections.length, 97);
  assert.equal(Object.keys(map.refs).length, 40);
  assert.deepEqual(Object.keys(map.refs).sort(), EXPECTED_REFS.slice().sort(), "only the explicit reviewed union is present");
  assert.deepEqual(map.refs, registry.refs, "the generated map exactly preserves the reviewed registry payload");
  for (const [ref, baseline] of Object.entries(PRIOR_REFS)) assert.deepEqual(map.refs[ref], baseline, `${ref} prior reviewed mapping is unchanged`);
  assert.equal(Object.keys(NEW_LOCATIONS).length, 27);
  for (const [ref, [sectionId, pages]] of Object.entries(NEW_LOCATIONS)) {
    assert.deepEqual(map.refs[ref].locations, [{ sectionId, pages }], `${ref} independently reviewed teaching-page location`);
  }
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
  for (const ref of EXPECTED_REFS) {
    const resolved = good.api.resolvePage(item(ref, saved(ref)));
    assert.equal(resolved.state, "matched", `${ref} resolves with its saved stem`);
    assert.deepEqual(JSON.parse(JSON.stringify(resolved.locations)), map.refs[ref].locations, `${ref} uses its reviewed page locations`);
  }
  assert.deepEqual(Array.from(good.api.resolvePage(item("m:jss-mock-2:27", saved("m:jss-mock-2:27"))).locations[0].pages), [95, 96]);
  assert.match(good.api.exportText([item("m:jss-mock-2:27", saved("m:jss-mock-2:27"))], "open"), /Original textbook pp\. 95-96/);
  assert.equal(good.api.resolvePage(item("m:jss-mock-2:27", "")).state, "saved-mismatch");
  assert.equal(good.api.resolvePage(item("m:jss-mock-2:27", saved("m:jss-mock-2:27").slice(0, -1))).state, "saved-mismatch");
  assert.equal(good.api.resolvePage(item("m:jss-mock-2:27", saved("m:jss-mock-2:27"))).state, "matched", "renames do not change identity");
  assert.equal(good.api.resolvePage(item("m:unknown:1", "anything")).state, "none");
  assert.equal(good.api.resolvePage(item("c:card-1", "definition")).state, "none");
  assert.match(good.api.exportText([item("c:card-1", "definition")], "open"), /No verified page match yet/);
  assert.equal(good.store.get("study-topics-v1"), good.original, "page lookup must not mutate storage");

  const groupthink = "m:jss-mock-2:38";
  const groupthinkStem = map.refs[groupthink].source.stem;
  assert.equal(groupthinkStem.length, 442);
  assert.equal(saved(groupthink).length, 400);
  const groupthinkPrefixMatches = mock.questions.map((q, i) => q.q.trim().slice(0, 400) === saved(groupthink) ? i : -1).filter(i => i >= 0);
  assert.deepEqual(groupthinkPrefixMatches, [38], "the saved groupthink prefix is unique");
  assert.equal(good.api.resolvePage(item(groupthink, saved(groupthink))).state, "matched");
  const changedGroupthinkSuffix = clone(mock);
  changedGroupthinkSuffix.questions[38].q += " Changed content after the stored 400 characters.";
  const groupthinkSuffixGuard = harness({ current: changedGroupthinkSuffix });
  await groupthinkSuffixGuard.api.loadPageMap();
  assert.equal(groupthinkSuffixGuard.api.resolvePage(item(groupthink, saved(groupthink))).state, "source-mismatch");

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
