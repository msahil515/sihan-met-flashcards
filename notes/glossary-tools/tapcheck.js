// Tap-to-define check over every notes page: node tapcheck.js pages.txt out.jsonl
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const exe = process.env.HOME+'/Library/Caches/ms-playwright/chromium-1148/chrome-mac/Chromium.app/Contents/MacOS/Chromium';
  const b = await chromium.launch({ executablePath: exe });
  const pages = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n');
  const out = fs.createWriteStream(process.argv[3]);
  const ctx = await b.newContext({ viewport: {width:390, height:844}, serviceWorkers: 'block' });
  let total = 0, bad = 0, errsAll = [], clickFails = 0, zero = [];
  for (const pg of pages) {
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8765/sihan-met-flashcards/' + pg.replace(/index\.html$/, ''), {waitUntil: 'load'});
    try { await p.waitForFunction(() => window.TP_GLOSSARY, null, {timeout: 8000}); } catch (e) { errs.push('glossary never loaded'); }
    await p.waitForTimeout(250);
    const res = await p.evaluate(() => {
      const G = window.TP_GLOSSARY; if (!G) return {terms: [], bad: 0};
      const PAGE0 = location.pathname.toLowerCase();
      let PAGE = PAGE0.split('sihan-met-flashcards/')[1] || PAGE0; if (PAGE === '' || /\/$/.test(PAGE)) PAGE += 'index.html';
      const heads = [...document.querySelectorAll('h1, h2, h3')];
      const head = el => { let f = ''; for (const h of heads) { if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) f = h.textContent; else break; } return f.replace(/\s+/g,' ').trim(); };
      let bad = 0; const terms = [];
      for (const el of document.querySelectorAll('.tp-term')) {
        const kind = el.dataset.tpKind, key = el.dataset.tpKey, si = +el.dataset.tpSense;
        const e = (kind === 'a' ? G.abbr : G.terms)[key]; const s = e && e.s[si];
        if (!s || !s.d) { bad++; continue; }
        const blk = el.closest('p, li, td, th, dd, dt, blockquote, figcaption, div');
        terms.push({kind, key, si, n: e.s.length, c: s.c || '', text: el.textContent.trim().slice(0,60), head: head(el).slice(0,90), para: (blk ? blk.textContent : '').replace(/\s+/g,' ').trim().slice(0, 260)});
      }
      return {terms, bad};
    });
    // tap the first 3 terms and check the popover shows the right definition
    const els = [];
    for (const el of await p.$$('.tp-term')) { if (await el.isVisible()) els.push(el); if (els.length >= 3) break; }
    for (const el of els) {
      try {
        await el.scrollIntoViewIfNeeded({timeout: 2000}); await el.click({timeout: 2000});
        const ok = await p.evaluate(t => { const pop = document.getElementById('tp-popover'); const G = window.TP_GLOSSARY;
          const e = (t.dataset.tpKind === 'a' ? G.abbr : G.terms)[t.dataset.tpKey]; const s = e.s[+t.dataset.tpSense];
          const r = pop.getBoundingClientRect();
          return pop.classList.contains('tp-show') && pop.querySelector('.tp-pop-body').textContent === (s.x || '') + s.d && r.left >= 0 && r.right <= innerWidth + 1; }, el);
        if (!ok) clickFails++;
        await p.mouse.click(5, 5);
      } catch (e) { clickFails++; }
    }
    total += res.terms.length; bad += res.bad; const inSvg = await p.evaluate(() => document.querySelectorAll('svg .tp-term').length); if (inSvg) errs.push('tp-term inside svg: ' + inSvg);
    if (!res.terms.length) zero.push(pg);
    if (errs.length) errsAll.push([pg, errs.slice(0, 3)]);
    for (const t of res.terms) out.write(JSON.stringify({page: pg, ...t}) + '\n');
    await p.close();
  }
  out.end();
  console.log(JSON.stringify({pages: pages.length, tappable: total, badRefs: bad, clickFails, zeroPages: zero, errors: errsAll}, null, 1));
  await b.close();
})();
