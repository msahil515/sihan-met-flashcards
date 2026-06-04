#!/usr/bin/env python3
"""Refresh the Admissions Tracker + News Board.

Runs on a schedule (GitHub Actions, 8 AM & 3 PM IST) and on manual dispatch.
What it actually does each run:
  1. Stamps the current IST run time into the "Last refreshed" bar at the top of
     both /admissions/ and /news/ (between the <!--LR--> ... <!--/LR--> markers).
  2. Writes last_refreshed into news.json so the live feed knows when it was
     last rebuilt.
  3. Drops any pinned news item whose deadline has already passed out of the
     pinned list (so the board genuinely re-evaluates, not just bumps a clock).

The commit it produces triggers a GitHub Pages rebuild, so the live site
reflects the new stamp within a couple of minutes of each scheduled run.
"""
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

IST = timezone(timedelta(hours=5, minutes=30))
ROOT = Path(__file__).resolve().parent

LR_RE = re.compile(r"(<!--LR-->).*?(<!--/LR-->)", re.DOTALL)


def now_ist():
    return datetime.now(timezone.utc).astimezone(IST)


def human_stamp(dt):
    # e.g. "4 Jun 2026, 3:00 PM IST"
    return dt.strftime("%-d %b %Y, %-I:%M %p IST")


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


def refresh_news_json(dt):
    p = ROOT / "news" / "news.json"
    if not p.exists():
        print("skip (missing): news/news.json")
        return False
    data = json.loads(p.read_text(encoding="utf-8"))
    iso = dt.isoformat(timespec="minutes")
    data["last_refreshed"] = iso

    # Re-evaluate pinned deadlines: move any that have already closed out of the
    # pinned block and into the feed so the board self-corrects on each run.
    pinned = data.get("pinned", [])
    feed = data.get("feed", [])
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
    data["pinned"] = still_pinned
    data["feed"] = feed

    p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"news.json last_refreshed -> {iso}")
    return True


def main():
    dt = now_ist()
    print(f"=== refresh run @ {human_stamp(dt)} ===")
    changed = False
    changed |= stamp_html(Path("admissions/index.html"), dt)
    changed |= stamp_html(Path("news/index.html"), dt)
    changed |= refresh_news_json(dt)
    print("done" if changed else "nothing changed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
