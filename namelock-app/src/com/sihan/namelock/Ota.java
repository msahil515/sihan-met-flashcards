package com.sihan.namelock;

import android.app.Activity;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Iterator;

/* Live-site content updates without a new APK (manifest built by ota.py).
   filesDir/ota/<v>/ holds every file that differs from what the APK bundles, for
   manifest version v. The version in use is fixed when the app starts, so a page
   never mixes old and new files; a download finishes in the background and is
   picked up on the next launch. Every file is sha256-checked against the manifest,
   and any failure leaves the current version untouched. Only one update runs per
   process: reopening the app (or an activity restart) while a download is in flight
   must not start a second one, which used to commit a half-filled version dir. */
final class Ota {
    /* path segments may not start with a dot, so no ".." */
    private static final String SAFE = "[A-Za-z0-9_\\-][A-Za-z0-9_.\\-]*(/[A-Za-z0-9_\\-][A-Za-z0-9_.\\-]*)*";
    private static final String SITE = "https://msahil515.github.io/sihan-met-flashcards/";
    private final Activity act;
    private final String app;
    private final File root;
    private final String stamp; /* install/update time of this APK: a new APK resets OTA */
    private File live;          /* dir served this run, or null for bundled only */
    private static boolean running; /* an update thread is in flight in this process */

    Ota(Activity act, String app) {
        this.act = act;
        this.app = app;
        root = new File(act.getFilesDir(), "ota");
        String s = "0";
        try { s = String.valueOf(act.getPackageManager().getPackageInfo(act.getPackageName(), 0).lastUpdateTime); } catch (Exception e) {}
        stamp = s;
        String[] cur = readText(new File(root, "current")).split("\n");
        if (cur.length == 2 && cur[1].equals(stamp) && new File(root, cur[0]).isDirectory()) live = new File(root, cur[0]);
        File[] old = root.listFiles();
        /* *.part may be an in-flight download from an earlier activity; update() clears stale ones */
        if (old != null) for (File f : old) if (f.isDirectory() && !f.equals(live) && !f.getName().endsWith(".part")) rm(f);
    }

    /* updated copy if this run has one, else the bundled asset */
    InputStream open(String path) throws Exception {
        if (live != null && path.substring(1).matches(SAFE)) {
            File f = new File(live, path);
            if (f.isFile()) return new FileInputStream(f);
        }
        return act.getAssets().open("www" + path);
    }

    void checkAsync() {
        synchronized (Ota.class) {
            if (running) return;
            running = true;
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (update()) toast("Content updated. Close and reopen the app to load it.");
                } catch (Exception e) { /* offline or mid-deploy: try again next launch */
                } finally {
                    synchronized (Ota.class) { running = false; }
                }
            }
        }).start();
    }

    private boolean update() throws Exception {
        /* single-flight, so any *.part here is left over from a killed process */
        File[] stale = root.listFiles();
        if (stale != null) for (File f : stale) if (f.getName().endsWith(".part")) rm(f);
        byte[] body = get(SITE + "downloads/ota/" + app + ".json?t=" + System.currentTimeMillis());
        String v = sha(body).substring(0, 16);
        if (live != null && live.getName().equals(v)) return false;
        JSONObject files = new JSONObject(new String(body, "UTF-8")).getJSONObject("files");
        JSONObject base = new JSONObject(new String(readAll(act.getAssets().open("ota-base.json")), "UTF-8")).getJSONObject("files");
        File tmp = new File(root, v + ".part");
        int fetched = 0, reused = 0, need = 0;
        try {
            for (Iterator<String> it = files.keys(); it.hasNext(); ) {
                String path = it.next();
                if (!path.matches(SAFE)) throw new Exception("bad path " + path);
                JSONArray e = files.getJSONArray(path);
                String want = e.getString(1);
                JSONArray b = base.optJSONArray(path);
                if (b != null && want.equals(b.getString(1))) continue; /* bundled copy is current */
                File dst = new File(tmp, path);
                File have = live == null ? null : new File(live, path);
                byte[] data = have != null && have.isFile() ? readAll(new FileInputStream(have)) : null;
                if (data != null && want.equals(sha(data))) reused++;
                else { data = get(SITE + e.getString(0) + "?v=" + want.substring(0, 12)); fetched++; }
                if (!want.equals(sha(data))) throw new Exception("hash mismatch " + path);
                dst.getParentFile().mkdirs();
                FileOutputStream out = new FileOutputStream(dst);
                try { out.write(data); } finally { out.close(); }
                need++;
            }
            tmp.mkdirs();
            if (count(tmp) != need) throw new Exception("incomplete " + v);
            File dir = new File(root, v);
            rm(dir);
            if (!tmp.renameTo(dir)) throw new Exception("rename");
            File c = new File(root, "current.part");
            FileOutputStream out = new FileOutputStream(c);
            try { out.write((v + "\n" + stamp).getBytes("UTF-8")); } finally { out.close(); }
            if (!c.renameTo(new File(root, "current"))) throw new Exception("rename current");
        } finally {
            rm(tmp);
        }
        /* tell only when what the app serves changes: something new was fetched,
           or a previously downloaded file is no longer used (back to the bundled copy) */
        return fetched > 0 || (live != null && reused != count(live));
    }

    private static int count(File f) {
        File[] kids = f.listFiles();
        if (kids == null) return f.isFile() ? 1 : 0;
        int n = 0;
        for (File k : kids) n += count(k);
        return n;
    }

    private void toast(final String t) {
        act.runOnUiThread(new Runnable() {
            @Override
            public void run() { Toast.makeText(act, t, Toast.LENGTH_LONG).show(); }
        });
    }

    private static byte[] get(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setUseCaches(false);
        try {
            if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode() + " " + url);
            return readAll(c.getInputStream());
        } finally {
            c.disconnect();
        }
    }

    private static byte[] readAll(InputStream in) throws Exception {
        try {
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            byte[] buf = new byte[65536];
            for (int n; (n = in.read(buf)) > 0; ) o.write(buf, 0, n);
            return o.toByteArray();
        } finally {
            in.close();
        }
    }

    private static String sha(byte[] b) throws Exception {
        StringBuilder s = new StringBuilder();
        for (byte x : MessageDigest.getInstance("SHA-256").digest(b)) s.append(String.format("%02x", x));
        return s.toString();
    }

    private static String readText(File f) {
        try { return new String(readAll(new FileInputStream(f)), "UTF-8").trim(); } catch (Exception e) { return ""; }
    }

    private static void rm(File f) {
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) rm(k);
        f.delete();
    }
}
