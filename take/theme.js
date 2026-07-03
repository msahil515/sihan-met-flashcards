/* ============================================================
   Shared theme switcher for the MET-prep test experience.
   Five palettes (each with a light + dark variant) + an
   auto/light/dark mode toggle. Applied via html[data-theme]
   + html[data-mode], persisted to localStorage. Higher
   specificity than the page's own :root block, so it wins.

   Mount: put <span id="themeMount"></span> where you want the
   button; otherwise a floating FAB is created bottom-left.
   ============================================================ */
(function () {
  "use strict";

  var THEMES = [
    { id: "clinical", name: "Clean clinical", note: "porcelain · petrol-teal",
      light: { bg:"#F4F6F7", surface:"#FFFFFF", "surface-2":"#EEF1F2", line:"#DCE2E3",
        ink:"#17262B", "ink-soft":"#425258", muted:"#6C7B80",
        primary:"#0B6E6B", "primary-ink":"#08514F", "primary-wash":"#E4F0EF",
        amber:"#C77D2E", "amber-wash":"#FBEEDD",
        good:"#2E7D5B", "good-wash":"#E3F1EA", bad:"#BE4A32", "bad-wash":"#F8E7E2" },
      dark: { bg:"#0E1618", surface:"#152124", "surface-2":"#1B292C", line:"#26383C",
        ink:"#E7EDED", "ink-soft":"#AFC0C1", muted:"#7E9294",
        primary:"#3FB6AF", "primary-ink":"#8FE0DA", "primary-wash":"#123332",
        amber:"#E0A55C", "amber-wash":"#33260F",
        good:"#5FC494", "good-wash":"#14312A", bad:"#E58469", "bad-wash":"#361D18" } },

    { id: "warm", name: "Warm editorial", note: "off-white paper · clay",
      light: { bg:"#F3EDE2", surface:"#FBF7EF", "surface-2":"#EFE7D8", line:"#E0D5C2",
        ink:"#2B2119", "ink-soft":"#5A4C3C", muted:"#8A7B66",
        primary:"#B5623A", "primary-ink":"#8F4A29", "primary-wash":"#F3E2D6",
        amber:"#B5623A", "amber-wash":"#F3E2D6",
        good:"#5E7A4F", "good-wash":"#E7EFDE", bad:"#B0402F", "bad-wash":"#F4E1DC" },
      dark: { bg:"#1E1913", surface:"#28221A", "surface-2":"#332B20", line:"#453A2B",
        ink:"#EDE4D5", "ink-soft":"#C6B7A0", muted:"#9A8A72",
        primary:"#D98A5F", "primary-ink":"#E6B48D", "primary-wash":"#3A2A1D",
        amber:"#D98A5F", "amber-wash":"#3A2A1D",
        good:"#8FB077", "good-wash":"#26311C", bad:"#E08668", "bad-wash":"#361F18" } },

    { id: "slate", name: "Dark slate", note: "charcoal · soft mint",
      light: { bg:"#EEF1F3", surface:"#FFFFFF", "surface-2":"#E6EAED", line:"#D3DADF",
        ink:"#1B2429", "ink-soft":"#45525A", muted:"#6E7C85",
        primary:"#0E9C8E", "primary-ink":"#0A7468", "primary-wash":"#DDF3EF",
        amber:"#C88A3E", "amber-wash":"#F7ECDA",
        good:"#2E8B6B", "good-wash":"#E1F1EA", bad:"#C0503B", "bad-wash":"#F7E6E1" },
      dark: { bg:"#10151A", surface:"#182029", "surface-2":"#1F2A34", line:"#2C3A46",
        ink:"#E4EBF0", "ink-soft":"#AEBECB", muted:"#7C8B99",
        primary:"#4FD6C4", "primary-ink":"#93E9DD", "primary-wash":"#123430",
        amber:"#E2AC63", "amber-wash":"#33270F",
        good:"#63D3A4", "good-wash":"#15332A", bad:"#E88A6F", "bad-wash":"#361E18" } },

    { id: "sage", name: "Calm sage", note: "muted green · cream",
      light: { bg:"#EAEEE3", surface:"#F6F8F0", "surface-2":"#DFE6D3", line:"#CBD5BC",
        ink:"#232B1C", "ink-soft":"#4C583F", muted:"#7A856A",
        primary:"#5B7A4E", "primary-ink":"#425C38", "primary-wash":"#E1EAD5",
        amber:"#B08544", "amber-wash":"#F1E7D2",
        good:"#4F7A4E", "good-wash":"#E1EAD5", bad:"#A9503C", "bad-wash":"#F0E2DC" },
      dark: { bg:"#161A12", surface:"#1F241A", "surface-2":"#272E20", line:"#38412C",
        ink:"#E6EBDD", "ink-soft":"#C0C9AE", muted:"#8B957A",
        primary:"#8FB077", "primary-ink":"#B2CE9E", "primary-wash":"#28311D",
        amber:"#D3AA6A", "amber-wash":"#332810",
        good:"#8FB077", "good-wash":"#28311D", bad:"#D38B72", "bad-wash":"#331E17" } },

    { id: "navy", name: "Deep navy + gold", note: "premium · sharper",
      light: { bg:"#EEF0F5", surface:"#FFFFFF", "surface-2":"#E5E9F0", line:"#D2D8E4",
        ink:"#161E2E", "ink-soft":"#3E4859", muted:"#6B7688",
        primary:"#1E3A6B", "primary-ink":"#152A50", "primary-wash":"#E0E7F3",
        amber:"#B8862B", "amber-wash":"#F5EAD2",
        good:"#2E7D5B", "good-wash":"#E1F0E8", bad:"#B34A3A", "bad-wash":"#F5E4DF" },
      dark: { bg:"#0B1220", surface:"#121C31", "surface-2":"#1A2740", line:"#2A3A57",
        ink:"#E9EEF8", "ink-soft":"#B2BFD6", muted:"#7E8CA6",
        primary:"#D4AF57", "primary-ink":"#E7C878", "primary-wash":"#332811",
        amber:"#D4AF57", "amber-wash":"#332811",
        good:"#4FB088", "good-wash":"#123028", bad:"#E07A63", "bad-wash":"#331B16" } }
  ];

  var K_THEME = "revamp-theme", K_MODE = "revamp-mode";
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function themeId() { var t = get(K_THEME, "clinical"); return THEMES.some(function (x) { return x.id === t; }) ? t : "clinical"; }
  function modePref() { var m = get(K_MODE, "auto"); return (m === "light" || m === "dark") ? m : "auto"; }
  function resolveMode(p) { if (p === "light" || p === "dark") return p; return (mq && mq.matches) ? "dark" : "light"; }

  /* build the palette stylesheet once */
  function varsBlock(vars) {
    var out = "";
    for (var k in vars) out += "--" + k + ":" + vars[k] + ";";
    return out;
  }
  function injectStyles() {
    if (document.getElementById("theme-vars")) return;
    var css = "";
    THEMES.forEach(function (t) {
      css += 'html[data-theme="' + t.id + '"][data-mode="light"]{' + varsBlock(t.light) + '}';
      css += 'html[data-theme="' + t.id + '"][data-mode="dark"]{' + varsBlock(t.dark) + '}';
    });
    var s = document.createElement("style");
    s.id = "theme-vars";
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  function apply() {
    var r = document.documentElement;
    r.setAttribute("data-theme", themeId());
    r.setAttribute("data-mode", resolveMode(modePref()));
  }

  /* run immediately (in <head>) so there's no flash */
  injectStyles();
  apply();
  if (mq) { try { mq.addEventListener("change", apply); } catch (e) { try { mq.addListener(apply); } catch (e2) {} } }

  /* ---------- switcher UI ---------- */
  function swatchDot(t) {
    var p = (resolveMode(modePref()) === "dark") ? t.dark : t.light;
    return '<span style="background:linear-gradient(135deg,' + p.bg + ' 0 50%,' + p.primary + ' 50% 100%);' +
      'width:34px;height:34px;border-radius:9px;border:1.5px solid ' + p.line + ';display:inline-block;flex:none"></span>';
  }

  function buildPanel() {
    var wrap = document.createElement("div");
    wrap.id = "themePanel";
    wrap.style.cssText = "position:fixed;z-index:210;right:14px;bottom:74px;width:260px;max-width:calc(100vw - 28px);" +
      "background:var(--surface,#fff);color:var(--ink,#111);border:1px solid var(--line,#ddd);border-radius:16px;" +
      "box-shadow:0 12px 40px rgba(0,0,0,.28);padding:14px;display:none;font-family:var(--font-ui,system-ui,sans-serif)";
    var modes = ["auto", "light", "dark"];
    var seg = modes.map(function (m) {
      var on = modePref() === m;
      return '<button data-mode="' + m + '" style="flex:1;border:1px solid var(--line,#ddd);' +
        "background:" + (on ? "var(--ink,#111)" : "var(--surface,#fff)") + ";color:" + (on ? "var(--surface,#fff)" : "var(--muted,#888)") + ";" +
        'font:600 12px/1 var(--font-ui,system-ui,sans-serif);padding:8px 0;cursor:pointer;text-transform:capitalize;' +
        (m === "auto" ? "border-radius:9px 0 0 9px" : m === "dark" ? "border-radius:0 9px 9px 0;border-left:none" : "border-left:none") + '">' + m + "</button>";
    }).join("");
    var rows = THEMES.map(function (t) {
      var on = themeId() === t.id;
      return '<button data-theme="' + t.id + '" style="display:flex;align-items:center;gap:11px;width:100%;text-align:left;' +
        "background:" + (on ? "var(--primary-wash,#eee)" : "transparent") + ";border:1px solid " + (on ? "var(--primary,#088)" : "transparent") + ";" +
        'border-radius:12px;padding:8px 9px;margin-top:6px;cursor:pointer">' + swatchDot(t) +
        '<span style="min-width:0"><span style="display:block;font:600 13.5px/1.2 var(--font-ui,system-ui,sans-serif);color:var(--ink,#111)">' + t.name + "</span>" +
        '<span style="display:block;font:500 11px/1.3 var(--font-ui,system-ui,sans-serif);color:var(--muted,#888)">' + t.note + "</span></span>" +
        (on ? '<span style="margin-left:auto;color:var(--primary,#088);font-weight:700">✓</span>' : "") + "</button>";
    }).join("");
    wrap.innerHTML =
      '<div style="font:700 11px/1 var(--font-ui,system-ui,sans-serif);letter-spacing:.09em;text-transform:uppercase;color:var(--muted,#888);margin-bottom:9px">Theme</div>' +
      '<div style="display:flex;margin-bottom:4px">' + seg + "</div>" + rows;
    return wrap;
  }

  var panel = null;
  function refreshPanel() {
    if (!panel) return;
    var np = buildPanel();
    np.style.display = panel.style.display;
    panel.replaceWith(np);
    panel = np;
    bindPanel();
  }
  function bindPanel() {
    panel.querySelectorAll("[data-mode]").forEach(function (b) {
      b.onclick = function () { set(K_MODE, b.getAttribute("data-mode")); apply(); refreshPanel(); };
    });
    panel.querySelectorAll("[data-theme]").forEach(function (b) {
      b.onclick = function () { set(K_THEME, b.getAttribute("data-theme")); apply(); refreshPanel(); };
    });
  }
  function togglePanel() {
    if (!panel) { panel = buildPanel(); document.body.appendChild(panel); bindPanel(); }
    panel.style.display = (panel.style.display === "block") ? "none" : "block";
  }

  function mount() {
    var btnHtml = '🎨 <span style="font-weight:600">Theme</span>';
    var host = document.getElementById("themeMount");
    var btn;
    if (host) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = btnHtml;
      btn.style.cssText = "display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#ddd);" +
        "background:var(--surface,#fff);color:var(--ink,#111);font:600 13px/1 var(--font-ui,system-ui,sans-serif);" +
        "padding:9px 13px;border-radius:11px;cursor:pointer";
      host.appendChild(btn);
    } else {
      btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = btnHtml;
      btn.style.cssText = "position:fixed;z-index:210;right:14px;bottom:16px;display:inline-flex;align-items:center;gap:6px;" +
        "border:1px solid var(--line,#ddd);background:var(--surface,#fff);color:var(--ink,#111);" +
        "font:600 13px/1 var(--font-ui,system-ui,sans-serif);padding:11px 15px;border-radius:99px;cursor:pointer;" +
        "box-shadow:0 6px 20px rgba(0,0,0,.18)";
      document.body.appendChild(btn);
    }
    btn.addEventListener("click", function (e) { e.stopPropagation(); togglePanel(); });
    document.addEventListener("click", function (e) {
      if (panel && panel.style.display === "block" && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target))
        panel.style.display = "none";
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
