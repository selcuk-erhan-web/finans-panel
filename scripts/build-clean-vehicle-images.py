#!/usr/bin/env python3
"""Remove baked-in checkerboard backgrounds from fleet vehicle PNGs."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "public" / "images" / "vehicles"
PAIRS = [
    ("vito.png", "vito-clean.png"),
    ("bus.png", "bus-clean.png"),
    ("sprinter.png", "sprinter-clean.png"),
]


def is_checker_bg(r: int, g: int, b: int) -> bool:
    if max(r, g, b) - min(r, g, b) > 18:
        return False
    lum = (r + g + b) // 3
    return lum >= 200


def clean_image(src: Path, dst: Path) -> None:
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    pixels = img.load()

    for y in range(h):
        for x in range(w):
            r, g, b, _a = pixels[x, y]
            if is_checker_bg(r, g, b):
                pixels[x, y] = (r, g, b, 0)

    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, format="PNG", optimize=True)
    print(f"✓ {dst.relative_to(ROOT)}")


def main() -> None:
    for src_name, dst_name in PAIRS:
        clean_image(SRC_DIR / src_name, SRC_DIR / dst_name)


if __name__ == "__main__":
    main()
