#!/usr/bin/env python3
"""Refresh the Admissions Tracker + News Board — for real, not cosmetically.

Runs on a schedule (GitHub Actions, 8 AM & 3 PM IST) and on manual dispatch.
What it actually does each run:

  1. SOURCE FETCH (the real work): goes out to every source URL the board and
     tracker cite (institute admission portals + the news-item source links),
     downloads each page, reduces it to its visible text with volatile bits
     (CSRF/session tokens, timestamps, nonces) stripped, and fingerprints it.
     It compares that fingerprint against the snapshot stored in
     news/sources_state.json from the previous run.
        - First time a URL is seen -> record a baseline, no notice.
        - Page changed since last run -> for a tracked (pinned/curated) source,
          drop a dated "portal updated — re-verify" notice into the feed so a
          new deadline / status flip / fresh notice surfaces on its own.
        - Unreachable / behind a login / hard 4xx-5xx -> counted as "needs
          manual" and logged, NOT pretended to be fresh. This is the honest
          caveat made mechanical: it can only auto-read what's reachable and
          structured; login-walled portals and messy PDFs still need a human.
     A per-run summary ({checked, reachable, changed, manual, ...}) is written
     into news.json as `source_check` and shown on the board.

  2. Stamps the current IST run time into the "Last refreshed" bar at the top of
     both /admissions/ and /news/ (between the <!--LR--> ... <!--/LR--> markers).

  3. Writes last_refreshed into news.json and re-evaluates pinned deadlines,
     moving any that have already closed out of the pinned block.

The commit it produces triggers a GitHub Pages rebuild, so the live site
reflects the new data within a couple of minutes of each scheduled run.
"""
import hashlib
import json
import re
import ssl
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

IST = timezone(timedelta(hours=5, minutes=30))
ROOT = Path(__file__).resolve().parent
STATE_PATH = ROOT / "news" / "sources_state.json"

LR_RE = re.compile(r"(<!--LR-->).*?(<!--/LR-->)", re.DOTALL)

FETCH_TIMEOUT = 12          # seconds per source
MAX_BYTES = 1_500_000       # don't pull more than ~1.5 MB of any one page
UA = ("Mozilla/5.0 (compatible; sihan-tracker-refresh/1.0; "
      "+https://github.com/msahil515/sihan-met-flashcards)")

# Volatile patterns that flip on every request and would otherwise make a page
# look "changed" each run. Stripped before fingerprinting.
VOLATILE_RE = [
    re.compile(r"<script\b.*?</script>", re.DOTALL | re.IGNORECASE),
    re.compile(r"<style\b.*?</style>", re.DOTALL | re.IGNORECASE),
    re.compile(r"<!--.*?-->", re.DOTALL),
    re.compile(r"<[^>]+>"),                                   # all tags
    re.compile(r"(csrf|token|viewstate|nonce|sessionid|jsessionid|phpsessid|"
               r"captcha|_ga|_gid|timestamp)[\"'=:\s][^\s\"'<>]{4,}", re.IGNORECASE),
    re.compile(r"\b[0-9a-f]{16,}\b", re.IGNORECASE),          # long hex blobs
    re.compile(r"\b\d{10,}\b"),                               # long digit runs / epochs
    re.compile(r"\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}(:\d{2})?"), # iso timestamps
    re.compile(r"\b\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?\b", re.IGNORECASE),
]
WS_RE = re.compile(r"\s+")


def now_ist():
    return datetime.now(timezone.utc).astimezone(IST)


def human_stamp(dt):
    # e.g. "4 Jun 2026, 3:00 PM IST"
    return dt.strftime("%-d %b %Y, %-I:%M %p IST")


# ---------------------------------------------------------------------------
# Source fetching + change detection
# ---------------------------------------------------------------------------

def fingerprint(html_bytes):
    """Reduce a page to a stable fingerprint of its visible text."""
    try:
        text = html_bytes.decode("utf-8", "ignore")
    except Exception:
        text = str(html_bytes)
    text = text.lower()
    for rx in VOLATILE_RE:
        text = rx.sub(" ", text)
    text = WS_RE.sub(" ", text).strip()
    text = text[:40000]
    return hashlib.sha256(text.encode("utf-8")).hexdigest(), len(text)


def fetch(url):
    """Fetch a URL over verified TLS. Returns (status, fingerprint, length, note).

    status is 'ok' or 'manual'. 'manual' means we could not safely auto-read it
    (login wall, broken cert, hard error, unreachable, PDF, or JS-rendered) and a
    human should check it by hand. We never disable TLS verification: a portal we
    can't reach over a trusted connection is treated as "needs manual", which is
    exactly the honest caveat, not silently trusted.
    """
    ctx = ssl.create_default_context()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA,
                                                    "Accept": "text/html,*/*"})
        with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT, context=ctx) as r:
            code = r.getcode()
            ctype = (r.headers.get("Content-Type") or "").lower()
            data = r.read(MAX_BYTES)
            if "pdf" in ctype or url.lower().endswith(".pdf"):
                return "manual", None, 0, "pdf (read by hand)"
            if not data:
                return "manual", None, 0, "empty response"
            fp, length = fingerprint(data)
            if length < 80:
                # almost no visible text => JS-rendered / login splash
                return "manual", fp, length, "thin/JS-rendered (verify by hand)"
            return "ok", fp, length, f"http {code}"
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            return "manual", None, 0, f"http {e.code} (login wall)"
        if e.code == 404:
            return "manual", None, 0, "http 404 (link moved)"
        return "manual", None, 0, f"http {e.code}"
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        reason = str(getattr(e, "reason", e))
        if "CERTIFICATE" in reason.upper() or "SSL" in reason.upper():
            return "manual", None, 0, "cert/TLS issue (verify by hand)"
        return "manual", None, 0, f"unreachable: {reason[:60]}"
    except Exception as e:  # noqa: BLE001 - never let one source kill the run
        return "manual", None, 0, f"error: {str(e)[:60]}"


def collect_sources(news_data):
    """Build the list of sources to check.

    Returns (tracked, directory):
      tracked  = [(url, label)] from news.json pinned+feed (change -> feed notice)
      directory = [url]          from the admissions portal links (audited only)
    Only external http(s) URLs; relative links (../admissions/) are skipped.
    """
    tracked, seen = [], set()

    def add(url, label):
        if not url or not url.lower().startswith("http"):
            return
        u = url.strip()
        if u in seen:
            return
        seen.add(u)
        tracked.append((u, label))

    for it in news_data.get("pinned", []) + news_data.get("feed", []):
        src = it.get("source") or {}
        add(src.get("url"), src.get("label") or it.get("title", "source"))

    directory = []
    adm = ROOT / "admissions" / "index.html"
    if adm.exists():
        html = adm.read_text(encoding="utf-8")
        for m in re.finditer(r'href="(https?://[^"]+)"', html):
            u = m.group(1)
            if u not in seen and u not in directory:
                directory.append(u)

    return tracked, directory


def make_notice(url, label, dt):
    return {
        "id": "src-change-" + hashlib.sha1(url.encode()).hexdigest()[:10],
        "category": "Notification",
        "title": f"Portal updated — re-verify: {label}",
        "date": dt.strftime("%Y-%m-%d"),
        "body": ("This source page changed since the last auto-check. A deadline, "
                 "status, or notice may have moved, so confirm the current date "
                 "on the portal before acting on it."),
        "source": {"label": "Open the source", "url": url},
        "auto": True,
    }


def check_sources(news_data, dt):
    """Fetch every source, detect changes, write back notices + a summary."""
    prior = {}
    if STATE_PATH.exists():
        try:
            prior = json.loads(STATE_PATH.read_text(encoding="utf-8")).get("sources", {})
        except Exception:
            prior = {}

    tracked, directory = collect_sources(news_data)
    tracked_urls = {u for u, _ in tracked}
    new_state = {}
    feed = news_data.get("feed", [])
    counts = {"checked": 0, "reachable": 0, "manual": 0, "changed": 0,
              "dir_changed": 0, "new_baseline": 0}
    changed_urls = []

    all_sources = tracked + [(u, None) for u in directory]
    for url, label in all_sources:
        status, fp, length, note = fetch(url)
        counts["checked"] += 1
        prev = prior.get(url) or {}
        entry = {
            "status": status,
            "note": note,
            "len": length,
            "checked": dt.isoformat(timespec="minutes"),
            "tracked": url in tracked_urls,
        }
        if status == "ok":
            counts["reachable"] += 1
            entry["fp"] = fp
            prev_fp = prev.get("fp")
            if prev_fp is None:
                counts["new_baseline"] += 1
                entry["change"] = "baseline"
                print(f"  baseline  {url}  ({note})")
            elif prev_fp != fp:
                entry["change"] = "changed"
                # Only curated/tracked sources surface a feed notice + count in
                # the user-facing summary. Directory homepages (banners, tickers)
                # change often and are audit-only, recorded in state but not shown.
                if entry["tracked"]:
                    counts["changed"] += 1
                    changed_urls.append((url, label))
                    print(f"  CHANGED   {url}  ({note}) [tracked -> feed notice]")
                else:
                    counts["dir_changed"] += 1
                    print(f"  changed   {url}  ({note}) [directory, audit-only]")
            else:
                entry["change"] = "same"
                print(f"  same      {url}  ({note})")
        else:
            counts["manual"] += 1
            # preserve the last good fingerprint so a transient outage doesn't
            # reset the baseline and then false-alarm on recovery
            if prev.get("fp"):
                entry["fp"] = prev["fp"]
            entry["change"] = "manual"
            print(f"  manual    {url}  ({note})")
        new_state[url] = entry

    # Insert / refresh a feed notice for each tracked source that changed.
    for url, label in changed_urls:
        notice = make_notice(url, label, dt)
        feed[:] = [f for f in feed if f.get("id") != notice["id"]]
        feed.insert(0, notice)
        print(f"  -> feed notice: {label}")

    news_data["feed"] = feed
    news_data["source_check"] = {
        "ran_at": dt.isoformat(timespec="minutes"),
        "checked": counts["checked"],
        "reachable": counts["reachable"],
        "manual": counts["manual"],
        "changed": counts["changed"],
    }

    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(
        json.dumps({"updated": dt.isoformat(timespec="minutes"), "sources": new_state},
                   indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8")
    print(f"source check: {counts['checked']} checked, {counts['reachable']} reachable, "
          f"{counts['manual']} need manual, {counts['changed']} tracked changed, "
          f"{counts['dir_changed']} directory changed, {counts['new_baseline']} new baseline")
    return True


# ---------------------------------------------------------------------------
# Stamp + pinned re-evaluation (unchanged behaviour)
# ---------------------------------------------------------------------------

def stamp_html(path: Path, dt):
    p = ROOT / path
    if not p.exists():
        print(f"skip (missing): {path}")
        return False
    html = p.read_text(encoding="utf-8")
    new_inner = (
        f"<!--LR-->Last refreshed: <b>{human_stamp(dt)}</b> "
        f"&middot; auto-refreshes 8&nbsp;AM &amp; 3&nbsp;PM IST daily<!--/LR-->"
    )
    if not LR_RE.search(html):
        print(f"WARN: no <!--LR--> marker in {path}")
        return False
    html2 = LR_RE.sub(new_inner, html, count=1)
    if html2 != html:
        p.write_text(html2, encoding="utf-8")
        print(f"stamped: {path}")
        return True
    print(f"unchanged: {path}")
    return False


def refresh_news_json(news_data, dt):
    iso = dt.isoformat(timespec="minutes")
    news_data["last_refreshed"] = iso

    pinned = news_data.get("pinned", [])
    feed = news_data.get("feed", [])
    still_pinned, expired = [], []
    for it in pinned:
        dl = it.get("deadline")
        keep = True
        if dl:
            try:
                if datetime.fromisoformat(dl) < dt:
                    keep = False
            except ValueError:
                keep = True
        (still_pinned if keep else expired).append(it)
    for it in expired:
        it.pop("deadline", None)
        if not any(f.get("title") == it.get("title") for f in feed):
            feed.insert(0, it)
        print(f"unpinned (closed): {it.get('title')}")
    news_data["pinned"] = still_pinned
    news_data["feed"] = feed
    print(f"news.json last_refreshed -> {iso}")
    return True


def main():
    dt = now_ist()
    print(f"=== refresh run @ {human_stamp(dt)} ===")

    news_path = ROOT / "news" / "news.json"
    news_data = None
    if news_path.exists():
        news_data = json.loads(news_path.read_text(encoding="utf-8"))
    else:
        print("skip (missing): news/news.json")

    if news_data is not None:
        print("-- checking sources --")
        check_sources(news_data, dt)

    changed = False
    changed |= stamp_html(Path("admissions/index.html"), dt)
    changed |= stamp_html(Path("news/index.html"), dt)

    if news_data is not None:
        refresh_news_json(news_data, dt)
        news_data["updated"] = dt.isoformat(timespec="minutes")
        news_path.write_text(
            json.dumps(news_data, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8")
        changed = True

    print("done" if changed else "nothing changed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
