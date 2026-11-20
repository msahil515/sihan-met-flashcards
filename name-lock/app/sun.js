/* Sunset City effects for Name Lock (Worlds + the game): warm dust motes that drift
   up through the scene, spark bursts on a canvas above everything, and a count-up.
   Everything is skipped under reduced motion. */
(function(){
"use strict";
var CALM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
var DPR = Math.min(2, window.devicePixelRatio || 1);
var PC = ["#FFE7A0", "#FFC24B", "#FF8257", "#3FD8BF", "#FFF6E0"];
var fx = null, fc = null, parts = [], mo = null, mc = null, motes = [], run = false;

function size(){
  [fx, mo].forEach(function(c){ if (!c) return; var r = c === mo && c.parentNode ? c.parentNode.getBoundingClientRect() : {width: innerWidth, height: innerHeight};
    c.width = Math.max(1, r.width * DPR); c.height = Math.max(1, r.height * DPR); c._w = r.width; c._h = r.height; });
}
addEventListener("resize", size);
function ensureFx(){
  if (fx && fx.isConnected) return;
  fx = document.createElement("canvas"); fx.className = "sun-fx"; fx.setAttribute("aria-hidden", "true");
  fx.style.cssText = "position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:95";
  document.body.appendChild(fx); fc = fx.getContext("2d"); size();
}
function start(){ if (!run){ run = true; requestAnimationFrame(tick); } }

/* spark burst from a point (client px) */
function burst(x, y, n){
  if (CALM) return; ensureFx();
  for (var i = 0; i < (n || 30); i++){
    var a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 7;
    parts.push({x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, life: 1, r: 2 + Math.random() * 3.5, c: PC[i % PC.length], star: i % 4 === 0});
  }
  start();
}
function burstAt(el, n){ if (!el) return burst(innerWidth / 2, innerHeight * .3, n); var r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, n); }

/* motes drift up inside `canvas` (sized to its parent) */
function motesOn(canvas, n){
  mo = canvas; mc = canvas.getContext("2d"); motes = []; size();
  for (var m = 0; m < (n || 34); m++) motes.push({x: Math.random(), y: Math.random(), r: .6 + Math.random() * 1.8, s: .00012 + Math.random() * .0003, p: Math.random() * 6.28});
  if (CALM) return;
  start();
}

function tick(t){
  if (fc){
    fc.setTransform(DPR, 0, 0, DPR, 0, 0); fc.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(function(p){ return p.life > 0; });
    parts.forEach(function(p){
      p.x += p.vx; p.y += p.vy; p.vy += .22; p.vx *= .98; p.life -= .018;
      fc.globalAlpha = Math.max(0, p.life); fc.fillStyle = p.c; fc.shadowColor = p.c; fc.shadowBlur = 10;
      if (p.star){ fc.save(); fc.translate(p.x, p.y); fc.rotate(p.life * 6); fc.fillRect(-p.r * 1.4, -p.r * .35, p.r * 2.8, p.r * .7); fc.fillRect(-p.r * .35, -p.r * 1.4, p.r * .7, p.r * 2.8); fc.restore(); }
      else { fc.beginPath(); fc.arc(p.x, p.y, p.r, 0, 6.283); fc.fill(); }
    });
    fc.globalAlpha = 1; fc.shadowBlur = 0;
  }
  var live = mo && mo.isConnected;
  if (live && !document.hidden){
    var W = mo._w || innerWidth, H = mo._h || innerHeight;
    mc.setTransform(DPR, 0, 0, DPR, 0, 0); mc.clearRect(0, 0, W, H);
    motes.forEach(function(d){
      d.y -= d.s * 16; if (d.y < -.02){ d.y = 1.02; d.x = Math.random(); }
      var x = (d.x + Math.sin(t / 2400 + d.p) * .012) * W, y = d.y * H;
      mc.globalAlpha = .35 + .35 * Math.sin(t / 900 + d.p); mc.fillStyle = "#FFE2B0"; mc.shadowColor = "#FFC27A"; mc.shadowBlur = 8;
      mc.beginPath(); mc.arc(x, y, d.r, 0, 6.283); mc.fill();
    });
  }
  if (!parts.length && !live){ run = false; if (fc) fc.clearRect(0, 0, fx.width, fx.height); return; }
  requestAnimationFrame(tick);
}

function countUp(el, to, ms){
  if (!el) return;
  if (CALM){ el.textContent = to; return; }
  var t0 = performance.now();
  (function step(t){ var k = Math.min(1, (t - t0) / (ms || 900)), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(step); })(t0);
}

window.SUN = {burst: burst, burstAt: burstAt, motes: motesOn, countUp: countUp, calm: CALM};
})();
