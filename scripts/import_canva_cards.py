#!/usr/bin/env python3
"""Import all 32 original Canva card thumbnails to permanent repo assets."""
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "ui/cards-manifest.json"
OUT = ROOT / "ui/cards"

def main():
    cards = json.loads(MANIFEST.read_text(encoding="utf-8"))["cards"]
    OUT.mkdir(parents=True, exist_ok=True)
    imported = []
    failed = []
    for card_id, record in cards.items():
        path = OUT / (card_id + ".png")
        try:
            req = Request(record["url"], headers={
                "User-Agent": "Mozilla/5.0 (compatible; GreenImpactCardImport/1.0)",
                "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8"
            })
            with urlopen(req, timeout=25) as response:
                data = response.read(8 * 1024 * 1024)
            if len(data) < 1000:
                raise ValueError("Downloaded image unexpectedly small")
            with Image.open(io.BytesIO(data)) as img:
                img.load()
                img.convert("RGB").save(path, "PNG", optimize=True)
            imported.append(card_id)
            print(f"Imported {card_id} / page {record['page']} ({path.stat().st_size} B)")
        except Exception as e:
            failed.append((card_id, str(e)))
            print(f"FAILED {card_id}: {e}", flush=True)
    print(f"Result: {len(imported)}/{len(cards)} imported")
    if failed:
        raise RuntimeError(f"Import incomplete: {failed}")

if __name__ == "__main__":
    main()
