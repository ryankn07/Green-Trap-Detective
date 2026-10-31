#!/usr/bin/env python3
"""Restore the tracked runtime files from the checked-in split gzip/tar bundle."""
from __future__ import annotations

import base64
import gzip
import io
import pathlib
import tarfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
PARTS = [ROOT / f"runtime.bundle.part{i:02d}" for i in (1, 2, 3)]
EXPECTED = {
    "engine/dist/data/projects.json",
    "public/index.html",
    "public/app.js",
    "public/style.css",
}
MAX_FILE_SIZE = 2 * 1024 * 1024


def main() -> None:
    encoded_parts = []
    for part in PARTS:
        if not part.is_file():
            raise SystemExit(f"Missing runtime bundle part: {part.name}")
        encoded_parts.append(part.read_text(encoding="ascii").strip())

    compressed = base64.b64decode("".join(encoded_parts), validate=True)
    try:
        archive_bytes = gzip.decompress(compressed)
    except OSError as exc:
        raise SystemExit(f"Runtime bundle is not a valid gzip stream: {exc}") from exc

    restored: set[str] = set()
    with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:") as archive:
        members = {member.name: member for member in archive.getmembers()}
        missing = EXPECTED - members.keys()
        if missing:
            raise SystemExit("Runtime bundle is missing: " + ", ".join(sorted(missing)))

        for name in sorted(EXPECTED):
            member = members[name]
            if not member.isfile() or member.size < 1 or member.size > MAX_FILE_SIZE:
                raise SystemExit(f"Invalid runtime bundle entry: {name}")
            source = archive.extractfile(member)
            if source is None:
                raise SystemExit(f"Cannot read runtime bundle entry: {name}")
            data = source.read()
            if len(data) != member.size:
                raise SystemExit(f"Truncated runtime bundle entry: {name}")
            target = ROOT / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            restored.add(name)
            print(f"Restored {name} ({len(data)} bytes)")

    if restored != EXPECTED:
        raise SystemExit("Runtime bundle restoration was incomplete")

    import json
    projects = json.loads((ROOT / "engine/dist/data/projects.json").read_text(encoding="utf-8"))
    if not isinstance(projects, list) or len(projects) != 25:
        raise SystemExit("Recovered project data failed validation (expected 25 projects)")
    print(f"Validated {len(projects)} project records and all runtime files.")


if __name__ == "__main__":
    main()
