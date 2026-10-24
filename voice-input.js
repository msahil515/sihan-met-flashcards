/* Small, user-started dictation adapter for descriptive answer fields. */
(function (root) {
  "use strict";

  var serial = 0, active = null;

  function onVisibility() {
    if (document.hidden && active && !active.native) stop(true);
  }
  document.addEventListener("visibilitychange", onVisibility);
  root.addEventListener("pagehide", function () { if (active) stop(true); });

  if (root.MutationObserver && document.documentElement) {
    new root.MutationObserver(function () {
      if (active && !active.item.field.isConnected) stop(true);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  function tell(session, status, text) {
    if (!session || active !== session || session.done) return;
    var item = session.item;
    if (status === "result") {
      session.done = true;
      active = null;
      var field = item.field, sameIdentity = true;
      if (!field.isConnected) return;
      try { if (item.getIdentity) sameIdentity = item.getIdentity() === session.identity; }
      catch (e) { sameIdentity = false; }
      if (!sameIdentity) {
        finishUi(item, "Answer changed. Dictation discarded.");
        return;
      }
      var value = text || "";
      if (!value) { finishUi(item, "No words recognized. Try again or use your keyboard microphone."); return; }
      var edited = field.value !== session.value;
      var start = edited ? field.value.length : session.start;
      var end = edited ? start : session.end;
      var before = field.value.slice(0, start), after = field.value.slice(end);
      var gap = before && !/\s$/.test(before) ? " " : "";
      var tail = after && !/\s$/.test(value) && !/^\s/.test(after) ? " " : "";
      field.value = before + gap + value + tail + after;
      var caret = before.length + gap.length + value.length;
      field.focus();
      field.setSelectionRange(caret, caret);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      finishUi(item, "Dictation added. You can edit your answer.");
    } else if (status === "cancel" || status === "error") {
      session.done = true;
      active = null;
      finishUi(item, status === "cancel" ? "Dictation cancelled." : "Dictation unavailable. Try your keyboard microphone.");
    }
  }

  function finishUi(item, message) {
    item.button.textContent = "🎙";
    item.stopButton.hidden = item.cancelButton.hidden = true;
    item.button.setAttribute("aria-label", "Start voice typing");
    item.status.textContent = message;
  }

  function stop(cancel) {
    var session = active;
    if (!session) return;
    if (session.browser) {
      var recognition = session.browser;
      if (cancel) tell(session, "cancel");
      try { cancel ? recognition.abort() : recognition.stop(); } catch (e) {}
    } else if (root.NLNative && root.NLNative.cancelVoice && cancel) {
      try { root.NLNative.cancelVoice(session.id); } catch (e) {}
      tell(session, "cancel");
    } else if (!cancel && session.native) {
      session.item.status.textContent = "Finish in the voice dialog to insert the words, or cancel to discard.";
    } else {
      tell(session, "cancel");
    }
  }

  function start(item) {
    if (active) stop(true);
    var value = item.field.value;
    var token = root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    var session = {
      item: item,
      id: "voice-" + token + "-" + (++serial).toString(36),
      value: value,
      start: item.field.selectionStart == null ? value.length : item.field.selectionStart,
      end: item.field.selectionEnd == null ? value.length : item.field.selectionEnd,
      identity: null,
      browser: null,
      native: false,
      done: false
    };
    try { session.identity = item.getIdentity ? item.getIdentity() : null; }
    catch (e) { session.identity = null; }
    active = session;
    if (root.speechSynthesis && root.speechSynthesis.cancel) root.speechSynthesis.cancel();
    item.status.textContent = "Listening. Tap stop when you are done, or cancel to discard.";
    item.button.textContent = "■";
    item.stopButton.hidden = item.cancelButton.hidden = false;
    item.button.setAttribute("aria-label", "Dictation in progress");

    if (root.NLNative && typeof root.NLNative.startVoice === "function") {
      session.native = true;
      item.stopButton.hidden = true;
      item.status.textContent = "Speak, then finish in the voice dialog to insert the words. Cancel here to discard.";
      try { root.NLNative.startVoice(session.id, item.lang); }
      catch (e) { tell(session, "error"); }
      return;
    }
    var Recognition = root.SpeechRecognition || root.webkitSpeechRecognition;
    if (!Recognition) { tell(session, "error"); return; }
    try {
      var recognition = new Recognition(), transcript = "";
      session.browser = recognition;
      recognition.lang = item.lang;
      recognition.interimResults = false;
      recognition.continuous = true;
      recognition.onresult = function (event) {
        if (active !== session || session.done) return;
        for (var i = event.resultIndex || 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) transcript += event.results[i][0].transcript;
        }
      };
      recognition.onerror = function () { tell(session, "error"); };
      recognition.onend = function () {
        if (active === session) tell(session, transcript ? "result" : "error", transcript);
      };
      recognition.start();
    } catch (e) { tell(session, "error"); }
  }

  function onNativeResult(id, status, text) {
    if (active && active.id === id) tell(active, status, text);
  }

  function attach(field, options) {
    options = options || {};
    var wrap = document.createElement("div"), button = document.createElement("button"), stopButton = document.createElement("button"), cancelButton = document.createElement("button"), status = document.createElement("span");
    wrap.className = "voice-input";
    wrap.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:8px";
    button.type = "button";
    button.className = "voice-input-button";
    button.style.cssText = "border:1px solid #647f8d;border-radius:8px;padding:7px 12px;background:#202b35;color:inherit;font:inherit";
    button.setAttribute("aria-label", "Start voice typing");
    button.textContent = "🎙";
    stopButton.type = cancelButton.type = "button";
    stopButton.className = cancelButton.className = "voice-input-control";
    stopButton.style.cssText = cancelButton.style.cssText = button.style.cssText;
    stopButton.textContent = "Stop";
    cancelButton.textContent = "Cancel";
    stopButton.hidden = cancelButton.hidden = true;
    status.className = "voice-input-status";
    status.style.cssText = "font-size:.82em;opacity:.8;flex-basis:100%";
    status.setAttribute("aria-live", "polite");
    status.textContent = root.NLNative && root.NLNative.startVoice ? "Voice typing may use your device's online recognition provider." : "Voice typing uses your browser provider. If unavailable, use the keyboard microphone.";
    field.parentNode.insertBefore(wrap, field);
    wrap.appendChild(field);
    wrap.appendChild(button);
    wrap.appendChild(stopButton);
    wrap.appendChild(cancelButton);
    wrap.appendChild(status);
    var item = { field: field, button: button, stopButton: stopButton, cancelButton: cancelButton, status: status, lang: options.lang || "en-US", getIdentity: options.getIdentity };
    button.addEventListener("click", function () { if (!active || active.item !== item) start(item); });
    stopButton.addEventListener("click", function () { if (active && active.item === item) stop(false); });
    cancelButton.addEventListener("click", function () { if (active && active.item === item) stop(true); });
    return { cancel: function () { if (active && active.item === item) stop(true); } };
  }

  root.NLVoice = { attach: attach, onResult: onNativeResult, cancel: function () { stop(true); } };
})(window);
