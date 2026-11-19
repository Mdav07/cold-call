"""Lobby mats (Tutorial, Floors 1–3, Daily, Case 2): a small runner with a dark edge, a gold frame with
corner studs and a gold diamond in the middle, laid over the lobby carpet. The engine puts each
door's name on its mat as text, so the tiles carry no letters.

Redraws mat_tutorial, mat_daily, mat_1..3 and mat_case2 in place (same indexes when they already exist).

    python3 -I tools/art/elegant_mats.py public/tiles/plumpurse.png app/floor/maps/tiles.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from door_mats import T, append_or_replace  # noqa: E402

Color = tuple[int, int, int, int]
GOLD: Color = (222, 184, 98, 255)
GOLD_DARK: Color = (156, 118, 52, 255)


def shade(c: Color, k: float) -> Color:
    return (int(c[0] * k), int(c[1] * k), int(c[2] * k), 255)


def mat(floor_tile: Image.Image, field: Color) -> Image.Image:
    im = floor_tile.copy()
    px = im.load()
    edge = shade(field, 0.55)
    lo, hi = 1, T - 2  # a 1 px margin of carpet shows around the rug
    for y in range(lo, hi + 1):
        for x in range(lo, hi + 1):
            if x in (lo, hi) or y in (lo, hi):
                px[x, y] = edge
            elif x in (lo + 1, hi - 1) or y in (lo + 1, hi - 1):
                px[x, y] = GOLD if (x + y) % 2 else GOLD_DARK if (x in (lo + 1, hi - 1) and y in (lo + 1, hi - 1)) else GOLD
            else:
                px[x, y] = field
    # Corner studs inside the frame.
    for x, y in ((lo + 3, lo + 3), (hi - 3, lo + 3), (lo + 3, hi - 3), (hi - 3, hi - 3)):
        px[x, y] = GOLD
    # A gold diamond in the middle (7 px across), with a darker lower half for depth.
    cx, cy = T // 2 - 0.5, T // 2 - 0.5
    for y in range(T):
        for x in range(T):
            d = abs(x - cx) + abs(y - cy)
            if d <= 3:
                px[x, y] = GOLD if y < cy else GOLD_DARK
            elif d <= 3.5 + 0.01 and lo + 2 < x < hi - 2 and lo + 2 < y < hi - 2:
                px[x, y] = shade(field, 0.8)
    return im


def main() -> None:
    sheet_path, catalog_path = Path(sys.argv[1]), Path(sys.argv[2])
    catalog = json.loads(catalog_path.read_text())
    sheet = Image.open(sheet_path).convert("RGBA")
    cols = catalog["columns"]
    fi = catalog["tiles"]["floor_executive"]["index"]
    floor_tile = sheet.crop(((fi % cols) * T, (fi // cols) * T, (fi % cols + 1) * T, (fi // cols + 1) * T))

    teal: Color = (26, 92, 98, 255)
    navy: Color = (30, 44, 86, 255)
    plum: Color = (76, 38, 96, 255)
    # Case 2 (Fatwallet tease): dark charcoal-ink, still gold-framed like the others.
    charcoal: Color = (28, 32, 42, 255)
    for name, field in [
        ("mat_tutorial", teal),
        ("mat_1", navy),
        ("mat_2", navy),
        ("mat_3", navy),
        ("mat_daily", plum),
        ("mat_case2", charcoal),
    ]:
        sheet = append_or_replace(sheet, catalog, name, mat(floor_tile, field), "walk")

    sheet.save(sheet_path)
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n")


if __name__ == "__main__":
    main()
