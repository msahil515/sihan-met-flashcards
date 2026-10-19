/* One-time QR link for sync.js.
   The device that already has a sync code shows it as a QR; the new device scans it with the
   camera and is linked, no typing. Used by the Name Lock and Tests apps (web + APK).
   The QR libraries (qrlib.js, ~300 KB) load only when a QR is shown or scanned.
   In the APKs, NLNative.otherApp()/linkOther() hand the code to the sister app on the same
   device, so one scan links both. */
(function () {
  var BASE = ((document.currentScript && document.currentScript.src) || "").replace(/[^\/]*$/, "");
  var PREFIX = "SIHANSYNC:";
  var libP = null;

  function lib() {
    if (window.qrcode && window.jsQR) return Promise.resolve();
    if (libP) return libP;
    libP = new Promise(function (ok, bad) {
      var s = document.createElement("script");
      s.src = BASE + "qrlib.js";
      s.onload = function () { ok(); };
      s.onerror = function () { libP = null; bad(new Error("QR library didn't load")); };
      document.head.appendChild(s);
    });
    return libP;
  }

  function norm(c) { return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }

  /* "SIHANSYNC:ABCD1234" (our QR) or a bare "ABCD-1234" -> "ABCD1234"; anything else -> null */
  function parse(text) {
    var m = /SIHANSYNC:([A-Z0-9-]{6,20})/i.exec(text || "");
    var c = norm(m ? m[1] : /^\s*[A-Z0-9]{4}-?[A-Z0-9]{4}\s*$/i.test(text || "") ? text : "");
    return c.length >= 6 ? c : null;
  }

  /* draw the code as a QR inside el (white box so any camera reads it) */
  function render(el, code) {
    el.innerHTML = '<div style="color:#888;font-weight:800;font-size:13px;padding:20px 0;text-align:center">Making QR…</div>';
    return lib().then(function () {
      var q = qrcode(0, "M");
      q.addData(PREFIX + norm(code));
      q.make();
      el.innerHTML = '<div style="background:#fff;border-radius:16px;padding:12px;width:min(240px,70vw);margin:0 auto;line-height:0">' +
        q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }) + "</div>";
      var svg = el.querySelector("svg");
      if (svg) { svg.style.width = "100%"; svg.style.height = "auto"; svg.style.display = "block"; }
    }, function (e) {
      el.innerHTML = '<div style="color:#ff7a7a;font-weight:800;font-size:13px;padding:12px 0;text-align:center">' + e.message + "</div>";
    });
  }

  function canScan() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

  /* full-screen camera; resolves the scanned code, or null if cancelled; rejects if no camera */
  function scan() {
    if (!canScan()) return Promise.reject(new Error("This device can't open the camera here"));
    return lib().then(function () {
      return new Promise(function (resolve, reject) {
        var ov = document.createElement("div");
        ov.style.cssText = "position:fixed;inset:0;z-index:9999;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:inherit";
        ov.innerHTML = '<video playsinline muted autoplay style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>' +
          '<div style="position:relative;width:min(64vw,64vh,320px);aspect-ratio:1;border:4px solid #22e5ff;border-radius:22px;box-shadow:0 0 0 100vmax rgba(0,0,0,.45),0 0 24px #22e5ff"></div>' +
          '<div style="position:relative;margin-top:22px;color:#fff;font-weight:900;font-size:17px;text-align:center;padding:0 24px;text-shadow:0 1px 6px #000">Point at the sync QR on your other device</div>' +
          '<button style="position:relative;margin-top:22px;padding:13px 30px;border-radius:14px;border:0;background:#fff;color:#111;font-family:inherit;font-weight:900;font-size:15px;letter-spacing:.06em;text-transform:uppercase">Cancel</button>';
        document.body.appendChild(ov);
        var video = ov.querySelector("video"), stream = null, done = false, last = 0;
        var cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true });
        var det = null;
        try { if ("BarcodeDetector" in window) det = new BarcodeDetector({ formats: ["qr_code"] }); } catch (e) { det = null; }

        function stop(val, err) {
          if (done) return;
          done = true;
          if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
          ov.remove();
          if (err) reject(err); else resolve(val);
        }
        ov.querySelector("button").onclick = function () { stop(null); };

        function hit(text) { var c = parse(text); if (c) { if (navigator.vibrate) navigator.vibrate(60); stop(c); } }
        function jsqrFrame() {
          var w = video.videoWidth, h = video.videoHeight;
          if (!w || !h) return;
          var k = Math.min(1, 720 / Math.max(w, h));
          cv.width = Math.round(w * k); cv.height = Math.round(h * k);
          cx.drawImage(video, 0, 0, cv.width, cv.height);
          var img = cx.getImageData(0, 0, cv.width, cv.height);
          var r = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
          if (r) hit(r.data);
        }
        function loop(t) {
          if (done) return;
          if (t - last > 160 && video.readyState >= 2) {
            last = t;
            if (det) det.detect(video).then(function (codes) { codes.forEach(function (c) { hit(c.rawValue); }); }, function () { det = null; });
            else jsqrFrame();
          }
          requestAnimationFrame(loop);
        }
        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
          .then(function (s) {
            if (done) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
            stream = s; video.srcObject = s;
            var p = video.play(); if (p && p.catch) p.catch(function () {});
            requestAnimationFrame(loop);
          }, function (e) {
            stop(null, new Error(e && e.name === "NotAllowedError" ? "Camera permission was denied. Allow it in Settings > Apps and try again." : "Couldn't open the camera"));
          });
      });
    });
  }

  /* APK only: the sister app (Tests <-> Name Lock) on this device, if installed */
  function otherApp() {
    try { return (window.NLNative && NLNative.otherApp && NLNative.otherApp()) || ""; } catch (e) { return ""; }
  }
  function linkOther(code) {
    try { NLNative.linkOther(norm(code)); return true; } catch (e) { return false; }
  }

  window.SihanQR = { render: render, scan: scan, parse: parse, canScan: canScan, otherApp: otherApp, linkOther: linkOther };
})();
