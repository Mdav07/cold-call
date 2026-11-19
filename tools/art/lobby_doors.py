"""The lobby's two front doors, set in the front wall: a glass street door for the Tutorial (it leads out
across the street) and a mahogany office door with a brass plate for the Daily Case.

Appends door_glass and door_wood (walkable: the door tile is the exit) or redraws them in place.

    python3 -I tools/art/lobby_doors.py public/tiles/plumpurse.png app/floor/maps/tiles.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from door_mats import T, append_or_replace  # noqa: E402

Color = tuple[int, int, int, int]


def glass_door() -> Image.Image:
    frame: Color = (58, 62, 72, 255)
    frame_hi: Color = (96, 102, 116, 255)
    glass: Color = (126, 178, 200, 255)
    glass_lo: Color = (98, 146, 170, 255)
    shine: Color = (214, 238, 246, 255)
    bar: Color = (196, 200, 210, 255)
    im = Image.new("RGBA", (T, T), frame)
    px = im.load()
    for y in range(T):
        for x in range(T):
            if x in (0, T - 1) or y == 0:
                px[x, y] = frame
            elif x in (1, T - 2) or y == 1:
                px[x, y] = frame_hi
            elif x in (7, 8):  # the two leaves meet in the middle
                px[x, y] = frame
            else:
                px[x, y] = glass if y < 10 else glass_lo
    # A diagonal shine on each leaf, and push bars across.
    for i in range(4):
        px[3 + i, 6 - i] = shine
        px[10 + i, 6 - i] = shine
    for x in range(3, 13):
        if x not in (7, 8):
            px[x, 9] = bar
    return im


def wood_door() -> Image.Image:
    frame: Color = (150, 112, 52, 255)
    wood: Color = (112, 52, 34, 255)
    wood_lo: Color = (84, 38, 26, 255)
    panel: Color = (96, 44, 30, 255)
    brass: Color = (222, 184, 98, 255)
    brass_lo: Color = (156, 118, 52, 255)
    im = Image.new("RGBA", (T, T), wood)
    px = im.load()
    for y in range(T):
        for x in range(T):
            if x in (0, T - 1) or y == 0:
                px[x, y] = frame
            elif x in (1, T - 2):
                px[x, y] = wood_lo
    # Two recessed panels.
    for y0, y1 in ((4, 8), (10, 14)):
        for y in range(y0, y1 + 1):
            for x in range(4, 12):
                edge = y in (y0, y1) or x in (4, 11)
                px[x, y] = wood_lo if edge else panel
    # Brass nameplate at the top and a knob on the right.
    for x in range(5, 11):
        px[x, 2] = brass
    px[5, 2] = px[10, 2] = brass_lo
    px[12, 9] = brass
    px[12, 10] = brass_lo
    return im


def main() -> None:
    sheet_path, catalog_path = Path(sys.argv[1]), Path(sys.argv[2])
    catalog = json.loads(catalog_path.read_text())
    sheet = Image.open(sheet_path).convert("RGBA")
    sheet = append_or_replace(sheet, catalog, "door_glass", glass_door(), "walk")
    sheet = append_or_replace(sheet, catalog, "door_wood", wood_door(), "walk")
    sheet.save(sheet_path)
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n")


if __name__ == "__main__":
    main()
