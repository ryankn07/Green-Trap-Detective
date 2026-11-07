#!/usr/bin/env python3
"""Derive smaller brand images without modifying either canonical PNG."""
import argparse
import hashlib
import io
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "ui/brand"
NAMES = ("green-trap-detective", "green-coin")
MANIFEST = DIRECTORY / "derivatives.json"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def pixels(data):
    with Image.open(io.BytesIO(data)) as image:
        image.load()
        return image.size, image.convert("RGBA").tobytes()


def favicon():
    with Image.open(DIRECTORY / "green-trap-detective.png") as image:
        small = ImageOps.contain(image.convert("RGBA"), (32, 32), Image.Resampling.LANCZOS)
        icon = Image.new("RGBA", (32, 32))
        icon.alpha_composite(small, ((32-small.width)//2, (32-small.height)//2))
        output = io.BytesIO()
        icon.save(output, format="PNG", optimize=True)
        return output.getvalue()


def generate():
    records = {}
    for name in NAMES:
        source = (DIRECTORY / (name + ".png")).read_bytes()
        with Image.open(io.BytesIO(source)) as image:
            output = io.BytesIO()
            metadata = {key: image.info[key] for key in ("icc_profile", "exif", "xmp") if isinstance(image.info.get(key), bytes)}
            image.convert("RGBA").save(output, format="WEBP", lossless=True, quality=100, method=6, exact=True, **metadata)
            derivative = output.getvalue()
        if pixels(source) != pixels(derivative):
            raise ValueError("Decoded original pixels changed: " + name)
        if len(derivative) >= len(source):
            raise ValueError("Derivative must be smaller: " + name)
        (DIRECTORY / (name + ".webp")).write_bytes(derivative)
        records[name] = {"sourceBytes": len(source), "webpBytes": len(derivative), "sourceSha256": digest(source), "webpSha256": digest(derivative), "dimensions": list(pixels(source)[0])}
    (DIRECTORY / "favicon-32.png").write_bytes(favicon())
    MANIFEST.write_text(json.dumps({"format": "WebP lossless", "assets": records}, indent=2) + "\n", encoding="utf-8")
    check()


def check():
    records = json.loads(MANIFEST.read_text(encoding="utf-8"))["assets"]
    if set(records) != set(NAMES):
        raise ValueError("Unexpected brand manifest entries")
    for name in NAMES:
        original = (DIRECTORY / (name + ".png")).read_bytes()
        derivative = (DIRECTORY / (name + ".webp")).read_bytes()
        record = records[name]
        if pixels(original) != pixels(derivative):
            raise ValueError("Decoded pixels differ: " + name)
        expected = {"sourceBytes": len(original), "webpBytes": len(derivative), "sourceSha256": digest(original), "webpSha256": digest(derivative), "dimensions": list(pixels(original)[0])}
        if record != expected or len(derivative) >= len(original):
            raise ValueError("Stale or larger derivative: " + name)
        print(f"{name}: {len(original):,} -> {len(derivative):,} bytes; exact RGBA pixels retained")
    icon = (DIRECTORY / "favicon-32.png").read_bytes()
    if pixels(icon) != pixels(favicon()):
        raise ValueError("Favicon differs from the 32px derivative of the original logo")
    print(f"Favicon: {len(icon):,} bytes; canonical PNG files unchanged")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    if parser.parse_args().check:
        check()
    else:
        generate()
