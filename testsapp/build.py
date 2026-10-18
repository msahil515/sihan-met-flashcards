#!/usr/bin/env python3
"""
Build downloads/Tests.apk: a native Android app (pkg com.sihan.tests) that runs
every mock on the site, grouped by college, game-style and fully offline. Same
wrapper recipe as namelock-app/build.py (own icon, splash, haptics, back button).

Bundled payload (assets/www): tests-app/* + take/{data-*.js, speak.js} under www/take,
so the app's "../take/..." script paths resolve both on the site and in the APK.

Needs: JDK, Android build-tools 34 + platforms;android-34 (homebrew
android-commandlinetools), Pillow, and the shared keystore from build_apk.py.
Usage: python3 testsapp/build.py
"""
import os
import shutil
import subprocess
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
OUT = ROOT / "downloads" / "Tests.apk"
W = Path("/tmp/tests-apk-build")


def run(*cmd):
    print("  $", " ".join(str(c) for c in cmd))
    subprocess.run([str(c) for c in cmd], check=True)


def legacy_icon(size):
    """PNG launcher icon for Android 7.x (no adaptive icons): same sheet + tick as ic_fg.xml."""
    s = size / 108
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(24 * s), fill="#0B8C8A")
    d.rounded_rectangle([32 * s, 28 * s, 76 * s, 80 * s], radius=int(6 * s), fill="white")
    d.line([40 * s, 39 * s, 62 * s, 39 * s], fill="#BFE3E2", width=int(4 * s))
    d.line([40 * s, 47 * s, 56 * s, 47 * s], fill="#BFE3E2", width=int(4 * s))
    d.line([42 * s, 62 * s, 50 * s, 70 * s, 65 * s, 53 * s], fill="#0B8C8A", width=int(7 * s), joint="curve")
    d.ellipse([65 * s, 21 * s, 83 * s, 39 * s], fill="#FFC93C")
    return im


def main():
    if W.exists():
        shutil.rmtree(W)
    res, assets, cls = W / "res", W / "assets" / "www", W / "classes"
    shutil.copytree(HERE / "res", res)
    for name, px in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
        (res / f"mipmap-{name}").mkdir()
        legacy_icon(px * 4).resize((px, px), Image.LANCZOS).save(res / f"mipmap-{name}" / "ic_launcher.png")
    shutil.copytree(ROOT / "tests-app", assets)
    (assets / "take").mkdir()
    for f in sorted((ROOT / "take").glob("data-*.js")) + [ROOT / "take" / "speak.js"]:
        if f.name != "data-mock.js":  # not loaded by take/screen.html either
            shutil.copy2(f, assets / "take" / f.name)

    print("[1/4] resources")
    run(BT / "aapt2", "compile", "--dir", res, "-o", W / "res.zip")
    run(BT / "aapt2", "link", "-o", W / "base.apk", "-I", JAR, "--manifest", HERE / "AndroidManifest.xml",
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
