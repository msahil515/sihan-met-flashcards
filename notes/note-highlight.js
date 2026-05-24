/* note-highlight.js
   When a note page is opened with ?q=<terms> (e.g. from notes/search.html),
   highlight every occurrence of the terms in the page body, scroll the first
   one into view, and show a small floating bar to jump between matches.
   This is what makes the search "redirect to exactly where the keyword is"
   instead of dropping you at the top of a long page. */
(function () {
  "use strict";
  var params = new URLSearchParams(location.search);
  var q = (params.get("q") || "").trim();
  if (!q) return;

  var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return;

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  // Longest terms first so multi-word phrases win over their fragments.
  terms.sort(function (a, b) { return b.length - a.length; });
  var re = new RegExp("(" + terms.map(esc).join("|") + ")", "gi");

  var root = document.querySelector("main") ||
             document.querySelector(".wrap") ||
             document.body;
  if (!root) return;

  var SKIP = { SCRIPT: 1, STYLE: 1, MARK: 1, NOSCRIPT: 1, TEXTAREA: 1 };
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      var p = n.parentNode;
      if (!p || SKIP[p.nodeName]) return NodeFilter.FILTER_REJECT;
      re.lastIndex = 0;
      return re.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  var nodes = [], n;
  while ((n = walker.nextNode())) nodes.push(n);

  var marks = [];
  nodes.forEach(function (node) {
    re.lastIndex = 0;
    var text = node.nodeValue, frag = document.createDocumentFragment();
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var mk = document.createElement("mark");
      mk.className = "search-hl";
      mk.textContent = m[0];
      frag.appendChild(mk);
      marks.push(mk);
      last = m.index + m[0].length;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });

  if (!marks.length) return;

  var idx = 0;
  var bar = document.createElement("div");
  bar.className = "search-hl-bar";
  bar.innerHTML =
    '<span class="shl-q"></span>' +
    '<span class="shl-pos"></span>' +
    '<button type="button" class="shl-prev" aria-label="Previous match">&#8593;</button>' +
    '<button type="button" class="shl-next" aria-label="Next match">&#8595;</button>' +
    '<button type="button" class="shl-clear" aria-label="Clear highlights">&#10005;</button>';
  bar.querySelector(".shl-q").textContent = "“" + q + "”";
  document.body.appendChild(bar);

  var posEl = bar.querySelector(".shl-pos");
  function go(i) {
    idx = (i + marks.length) % marks.length;
    marks.forEach(function (mk) { mk.classList.remove("search-hl-active"); });
    var cur = marks[idx];
    cur.classList.add("search-hl-active");
    cur.scrollIntoView({ behavior: "smooth", block: "center" });
    posEl.textContent = (idx + 1) + " / " + marks.length;
  }

  bar.querySelector(".shl-prev").addEventListener("click", function () { go(idx - 1); });
  bar.querySelector(".shl-next").addEventListener("click", function () { go(idx + 1); });
  bar.querySelector(".shl-clear").addEventListener("click", function () {
    marks.forEach(function (mk) {
      mk.replaceWith(document.createTextNode(mk.textContent));
    });
    bar.remove();
    history.replaceState(null, "", location.pathname + location.hash);
  });

  document.addEventListener("keydown", function (e) {
    if (!document.body.contains(bar)) return;
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(idx + 1); }
    else if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); go(idx - 1); }
  });

  // Run after layout so scroll lands accurately. If the URL also carried a
  // #anchor the browser jumps there first; go(0) then refines to the match.
  setTimeout(function () { go(0); }, 80);
})();
