"""Lobby doormats without baked-in letters: the engine prints the word on them, centred and white.

Redraws mat_tutorial, mat_daily and mat_1..3 in place (same indexes) as plain rugs, and appends
left/right ends so the TUTORIAL and DAILY mats are three tiles wide (left, middle, right).

    python3 -I tools/art/mat_words.py public/tiles/plumpurse.png app/floor/maps/tiles.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from door_mats import CARPET, T, append_or_replace  # noqa: E402

Color = tuple[int, int, int, int]


def rug(fill: Color, outline: Color, part: str) -> Image.Image:
    """One tile of a rug: part is "one" (whole rug in a tile), "l", "m" or "r" (a wide rug)."""
    hi = tuple(min(255, c + 40) for c in outline[:3]) + (255,)
    im = Image.new("RGBA", (T, T), CARPET)
    px = im.load()
    x0 = 2 if part in ("one", "l") else 0
    x1 = 13 if part in ("one", "r") else T - 1
    y0, y1 = 3, 12
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            left_edge = part in ("one", "l") and x == x0
            right_edge = part in ("one", "r") and x == x1
            left_in = part in ("one", "l") and x == x0 + 1
            right_in = part in ("one", "r") and x == x1 - 1
            if left_edge or right_edge or y in (y0, y1):
                px[x, y] = outline
            elif left_in or right_in or y in (y0 + 1, y1 - 1):
                px[x, y] = hi
            else:
                px[x, y] = fill
    return im


def main() -> None:
    sheet_path, catalog_path = Path(sys.argv[1]), Path(sys.argv[2])
    catalog = json.loads(catalog_path.read_text())
    sheet = Image.open(sheet_path).convert("RGBA")

    # Same colours as door_mats.py: plant-pot teal, hunter purple, plant-leaf green.
    teal = ((55, 170, 165, 255), (90, 220, 214, 255))
    purple = ((148, 120, 220, 255), (196, 170, 255, 255))
    leaf = ((123, 173, 44, 255), (168, 220, 72, 255))
    tiles = [
        ("mat_tutorial", rug(*teal, "m")),
        ("mat_tutorial_l", rug(*teal, "l")),
        ("mat_tutorial_r", rug(*teal, "r")),
        ("mat_daily", rug(*purple, "m")),
        ("mat_daily_l", rug(*purple, "l")),
        ("mat_daily_r", rug(*purple, "r")),
        ("mat_1", rug(*leaf, "one")),
        ("mat_2", rug(*leaf, "one")),
        ("mat_3", rug(*leaf, "one")),
    ]
    for name, tile in tiles:
        sheet = append_or_replace(sheet, catalog, name, tile, "walk")

    sheet.save(sheet_path)
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n")


if __name__ == "__main__":
    main()
