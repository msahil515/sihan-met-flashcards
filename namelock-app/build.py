#!/usr/bin/env python3
"""
Build downloads/Name-Lock.apk: a native Android app (pkg com.sihan.namelock) that
runs the Name Lock game fully offline. Unlike build_apk.py this compiles a real
wrapper from source (MainActivity.java + res/), so it gets its own icon, splash,
haptics bridge and back-button handling.

Bundled payload (assets/www): name-lock/app/* + name-lock/data.js + sync.js.

Needs: JDK, Android build-tools 34 + platforms;android-34 (homebrew
android-commandlinetools), Pillow, and the shared keystore from build_apk.py.
Usage: python3 namelock-app/build.py          (phone, portrait-locked)
       python3 namelock-app/build.py --tab    (tab: downloads/Name-Lock-Tab.apk, same package,
       rotates with the device incl. keyboard dock, so it installs over the phone build)
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SDK = Path(os.environ.get("ANDROID_HOME", "/opt/homebrew/share/android-commandlinetools"))
BT = SDK / "build-tools" / "34.0.0"
JAR = SDK / "platforms" / "android-34" / "android.jar"
KEYSTORE = Path(os.environ.get("SIHAN_MET_KEYSTORE", Path.home() / ".sihan-met-keystore" / "sihan-met.jks"))
KS_PASS = os.environ.get("SIHAN_MET_KS_PASS", "sihanmet2026")
KS_ALIAS = os.environ.get("SIHAN_MET_KS_ALIAS", "sihanmet")
TAB = "--tab" in sys.argv
OUT = ROOT / "downloads" / ("Name-Lock-Tab.apk" if TAB else "Name-Lock.apk")
W = Path("/tmp/namelock-apk-build" + ("-tab" if TAB else ""))


def run(*cmd):
    print("  $", " ".join(str(c) for c in cmd))
    subprocess.run([str(c) for c in cmd], check=True)


def legacy_icon(size):
    """PNG launcher icon for Android 7.x (no adaptive icons): same lock as ic_fg.xml."""
    s = size / 108
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(24 * s), fill="#5B4BDB")
    d.arc([42 * s, 29 * s, 66 * s, 53 * s], 180, 360, fill="white", width=int(7 * s))
    d.line([42 * s, 41 * s, 42 * s, 50 * s], fill="white", width=int(7 * s))
    d.line([66 * s, 41 * s, 66 * s, 50 * s], fill="white", width=int(7 * s))
    d.rounded_rectangle([32 * s, 48 * s, 76 * s, 81 * s], radius=int(7 * s), fill="#FFC93C")
    d.ellipse([49 * s, 57 * s, 59 * s, 67 * s], fill="#3B2DB0")
    d.rectangle([51.5 * s, 63 * s, 56.5 * s, 72 * s], fill="#3B2DB0")
    return im


def main():
    if W.exists():
        shutil.rmtree(W)
    res, assets, cls = W / "res", W / "assets" / "www", W / "classes"
    shutil.copytree(HERE / "res", res)
    for name, px in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
        (res / f"mipmap-{name}").mkdir()
        legacy_icon(px * 4).resize((px, px), Image.LANCZOS).save(res / f"mipmap-{name}" / "ic_launcher.png")
    shutil.copytree(ROOT / "name-lock" / "app", assets)
    shutil.copy2(ROOT / "name-lock" / "data.js", assets / "data.js")
    shutil.copy2(ROOT / "sync.js", assets / "sync.js")  # ../../sync.js resolves to the asset root

    manifest = HERE / "AndroidManifest.xml"
    if TAB:  # only difference from the phone build: free rotation, no restart on keyboard dock
        m = manifest.read_text()
        m = m.replace('screenOrientation="portrait"', 'screenOrientation="fullSensor"')
        m = m.replace('keyboardHidden|', 'keyboardHidden|keyboard|navigation|')
        assert "fullSensor" in m and "|keyboard|" in m
        manifest = W / "AndroidManifest.xml"
        manifest.write_text(m)

    print("[1/4] resources")
    run(BT / "aapt2", "compile", "--dir", res, "-o", W / "res.zip")
    run(BT / "aapt2", "link", "-o", W / "base.apk", "-I", JAR, "--manifest", manifest,
        "-A", W / "assets", W / "res.zip")

    print("[2/4] java -> dex")
    cls.mkdir()
    srcs = [str(p) for p in (HERE / "src").rglob("*.java")]
    run("javac", "-source", "8", "-target", "8", "-nowarn", "-Xlint:-options", "-bootclasspath", JAR, "-d", cls, *srcs)
    run(BT / "d8", "--min-api", "24", "--lib", JAR, "--output", W, *[str(p) for p in cls.rglob("*.class")])
    run("zip", "-qj", W / "base.apk", W / "classes.dex")

    print("[3/4] align + sign")
    run(BT / "zipalign", "-p", "-f", "4", W / "base.apk", W / "aligned.apk")
    OUT.parent.mkdir(exist_ok=True)
    run(BT / "apksigner", "sign", "--ks", KEYSTORE, "--ks-pass", f"pass:{KS_PASS}", "--key-pass", f"pass:{KS_PASS}",
        "--ks-key-alias", KS_ALIAS, "--out", OUT, W / "aligned.apk")
    idsig = OUT.with_suffix(".apk.idsig")
    if idsig.exists():
        idsig.unlink()

    print("[4/4] verify")
    run(BT / "apksigner", "verify", "--verbose", OUT)
    print(f"done -> {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
