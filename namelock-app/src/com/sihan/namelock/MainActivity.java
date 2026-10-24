package com.sihan.namelock;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.speech.RecognizerIntent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.InputStream;
import java.util.ArrayList;

/* Name Lock: a full-screen WebView over the bundled app in assets/www.
   Everything is served from the APK, so it runs with no network at all. */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/worlds.html";
    /* sister app: one QR scan here hands the sync code over to it (see syncqr.js) */
    private static final String OTHER_PKG = "com.sihan.tests";
    private static final String OTHER_NAME = "Tests";
    private static final String SYNC_EXTRA = "sihan_sync";
    private static final int VOICE_REQUEST = 41;
    private WebView web;
    private PermissionRequest camReq;
    private String pendingCode;
    /* set by LinkActivity (signature-protected), never read from an intent here */
    static String handoff;
    private boolean loaded;
    private Ota ota;
    private final VoiceRequestQueue voiceRequests = new VoiceRequestQueue();

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        ota = new Ota(this, "namelock");
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#12141c"));
        w.setNavigationBarColor(Color.parseColor("#12141c"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#12141c"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        s.setAllowFileAccess(false);
        web.addJavascriptInterface(new Bridge(), "NLNative");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return serve(r.getUrl());
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                loaded = true;
                adoptPending();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                if (HOST.equals(r.getUrl().getHost())) return false;
                /* live-site links (the "To study" notes links) open in the browser */
                String sc = r.getUrl().getScheme();
                if ("https".equals(sc) || "http".equals(sc)) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, r.getUrl())); } catch (Exception e) {}
                }
                return true;
            }
        });
        /* camera for the sync QR scanner (getUserMedia) */
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest r) {
                if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    r.grant(r.getResources());
                } else {
                    camReq = r;
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, 7);
                }
            }
        });
        setContentView(web);
        ota.checkAsync();
        if (state != null) web.restoreState(state);
        else web.loadUrl(START);
    }

    private WebResourceResponse serve(Uri uri) {
        if (!HOST.equals(uri.getHost())) return null;
        String path = uri.getPath();
        if (path == null || path.equals("/")) path = "/worlds.html";
        try {
            InputStream in = ota.open(path);
            return new WebResourceResponse(mime(path), "utf-8", in);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new java.util.HashMap<>(), null);
        }
    }

    private static String mime(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        if (code != 7 || camReq == null) return;
        if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) camReq.grant(camReq.getResources());
        else camReq.deny();
        camReq = null;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != VOICE_REQUEST) return;
        VoiceRequestQueue.Request completed = voiceRequests.complete();
        if (completed != null && !completed.cancelled) {
            if (resultCode != RESULT_OK) { voiceResult(completed.id, "cancel", ""); }
            else {
                ArrayList<String> results = data == null ? null : data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                String text = results == null || results.isEmpty() ? "" : results.get(0);
                voiceResult(completed.id, text.isEmpty() ? "error" : "result", text);
            }
        }
        VoiceRequestQueue.Request next = voiceRequests.current();
        if (next != null) launchVoice(next.id, next.language);
    }

    private boolean trustedVoicePage() {
        Uri uri = web == null || web.getUrl() == null ? null : Uri.parse(web.getUrl());
        return uri != null && "https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private void voiceResult(String id, String status, String text) {
        if (web == null || !trustedVoicePage()) return;
        web.evaluateJavascript("window.NLVoice&&window.NLVoice.onResult(" + org.json.JSONObject.quote(id) + ","
                + org.json.JSONObject.quote(status) + "," + org.json.JSONObject.quote(text) + ")", null);
    }

    @Override
    protected void onDestroy() {
        boolean hadVoice = voiceRequests.current() != null;
        voiceRequests.clear();
        if (hadVoice) finishActivity(VOICE_REQUEST);
        super.onDestroy();
    }

    private void launchVoice(String requestId, String language) {
        if (!trustedVoicePage()) return;
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak your answer, then tap Done");
        try { startActivityForResult(intent, VOICE_REQUEST); }
        catch (Exception e) {
            VoiceRequestQueue.Request next = voiceRequests.failed(requestId);
            voiceResult(requestId, "error", "");
            if (next != null) launchVoice(next.id, next.language);
        }
    }

    private String cleanVoiceLanguage(String language) {
        return language != null && language.matches("[A-Za-z0-9_-]{2,16}") ? language : "en-US";
    }

    /* the sister app sent its sync code (via LinkActivity): take it on and sync straight away */
    @Override
    protected void onResume() {
        super.onResume();
        String c = cleanCode(handoff);
        handoff = null;
        if (c != null) {
            pendingCode = c;
            if (loaded) adoptPending();
        }
    }

    static String cleanCode(String c) {
        if (c == null) return null;
        c = c.toUpperCase().replaceAll("[^A-Z0-9]", "");
        return c.length() >= 6 ? c : null;
    }

    private void adoptPending() {
        if (pendingCode == null) return;
        final String c = pendingCode;
        pendingCode = null;
        web.evaluateJavascript("(function(c){var Y=window.SihanSync;if(!Y)return false;Y.setCode(c);"
                + "Y.syncNow('qr').then(function(){Y.start();});return true;})('" + c + "')",
                new android.webkit.ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String v) {
                        if ("true".equals(v)) Toast.makeText(MainActivity.this, "Sync linked: " + c.substring(0, 4) + "-" + c.substring(4), Toast.LENGTH_LONG).show();
                    }
                });
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    /* Back goes to the app's own screen stack first; it only leaves from Home. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.nlBack ? nlBack() : false", new android.webkit.ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                if (!"true".equals(value)) finish();
            }
        });
    }

    private class Bridge {
        /* only a sister app signed with the same key counts */
        private boolean otherOk() {
            try {
                getPackageManager().getPackageInfo(OTHER_PKG, 0);
                return getPackageManager().checkSignatures(getPackageName(), OTHER_PKG) == PackageManager.SIGNATURE_MATCH;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String otherApp() {
            return otherOk() ? OTHER_NAME : "";
        }

        @JavascriptInterface
        public void linkOther(String code) {
            if (!otherOk()) return;
            Intent i = new Intent();
            i.setClassName(OTHER_PKG, OTHER_PKG + ".LinkActivity");
            i.putExtra(SYNC_EXTRA, code);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                startActivity(i);
            } catch (Exception e) {
                Toast.makeText(MainActivity.this, "Update " + OTHER_NAME + " first", Toast.LENGTH_LONG).show();
            }
        }

        @JavascriptInterface
        public void vibrate(String pattern) {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            String[] parts = pattern.split(",");
            long[] p = new long[parts.length + 1];
            for (int i = 0; i < parts.length; i++) p[i + 1] = Long.parseLong(parts[i].trim());
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(p, -1));
            else v.vibrate(p, -1);
        }

        @JavascriptInterface
        public synchronized void startVoice(String requestId, String language) {
            if (requestId == null || !requestId.matches("[A-Za-z0-9_-]{1,64}")) return;
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    if (!trustedVoicePage()) return;
                    String safeLanguage = cleanVoiceLanguage(language);
                    int state = voiceRequests.request(requestId, safeLanguage);
                    if (state == VoiceRequestQueue.START) launchVoice(requestId, safeLanguage);
                    else if (state == VoiceRequestQueue.BUSY) voiceResult(requestId, "error", "");
                }
            });
        }

        @JavascriptInterface
        public synchronized void cancelVoice(String requestId) {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    if (requestId != null && voiceRequests.cancel(requestId)) finishActivity(VOICE_REQUEST);
                }
            });
        }
    }
}
