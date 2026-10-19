package com.sihan.tests;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
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

/* Tests: a full-screen WebView over the bundled app in assets/www.
   Everything is served from the APK, so it runs with no network at all. */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/index.html";
    /* sister app: one QR scan here hands the sync code over to it (see syncqr.js) */
    private static final String OTHER_PKG = "com.sihan.namelock";
    private static final String OTHER_NAME = "Name Lock";
    private static final String SYNC_EXTRA = "sihan_sync";
    private WebView web;
    private PermissionRequest camReq;
    private String pendingCode;
    private boolean loaded;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#101418"));
        w.setNavigationBarColor(Color.parseColor("#101418"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#101418"));
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
                return !HOST.equals(r.getUrl().getHost());
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
        pendingCode = cleanCode(getIntent().getStringExtra(SYNC_EXTRA));
        if (state != null) web.restoreState(state);
        else web.loadUrl(START);
    }

    private WebResourceResponse serve(Uri uri) {
        if (!HOST.equals(uri.getHost())) return null;
        String path = uri.getPath();
        if (path == null || path.equals("/")) path = "/index.html";
        try {
            InputStream in = getAssets().open("www" + path);
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

    /* the sister app sent its sync code: take it on and sync straight away */
    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        String c = cleanCode(i.getStringExtra(SYNC_EXTRA));
        if (c != null) {
            pendingCode = c;
            if (loaded) adoptPending();
        }
    }

    private static String cleanCode(String c) {
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
        @JavascriptInterface
        public String otherApp() {
            try {
                getPackageManager().getPackageInfo(OTHER_PKG, 0);
                return OTHER_NAME;
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void linkOther(String code) {
            Intent i = getPackageManager().getLaunchIntentForPackage(OTHER_PKG);
            if (i == null) return;
            i.putExtra(SYNC_EXTRA, code);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(i);
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
    }
}
