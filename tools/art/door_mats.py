"""Add cute doormat tiles for the lobby street / daily doors, and tidy the elevator
so its frame matches the brown wall (no brown 'bleed' into bare gray).

    python3 -I tools/art/door_mats.py public/tiles/plumpurse.png app/floor/maps/tiles.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

T = 16


def mat(fill: tuple[int, int, int, int], accent: tuple[int, int, int, int]) -> Image.Image:
    """A welcome mat: border, fill, and a little chevron pointing 'out' the door."""
    edge = (48, 36, 28, 255)
    stitch = (255, 248, 230, 255)
    im = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    px = im.load()
    for y in range(T):
        for x in range(T):
            if x in (0, T - 1) or y in (0, T - 1):
                px[x, y] = edge
            elif x in (1, T - 2) or y in (1, T - 2):
                px[x, y] = stitch
            else:
                px[x, y] = fill
    # Chevron / arrow toward the bottom (out through the front wall).
    for y, xs in ((5, range(5, 11)), (6, range(6, 10)), (7, range(7, 9)), (8, [7]), (9, [7]), (10, [7])):
        for x in xs:
            px[x, y] = accent
    return im


def elevator(wall: Image.Image) -> Image.Image:
    """Gray double doors set in a wall-colored frame so brown doesn't look like a bleed."""
    im = wall.copy().convert("RGBA")
    px = im.load()
    # Sample the wall so the housing matches neighbouring tiles.
    frame = wall.getpixel((8, 8))
    if frame[3] < 200:
        frame = (60, 40, 30, 255)
    frame_hi = (min(255, frame[0] + 24), min(255, frame[1] + 18), min(255, frame[2] + 12), 255)
    frame_lo = (max(0, frame[0] - 18), max(0, frame[1] - 14), max(0, frame[2] - 10), 255)
    door = (168, 174, 184, 255)
    door_hi = (190, 196, 206, 255)
    seam = (70, 72, 80, 255)
    gold = (240, 200, 80, 255)
    # Full-tile housing first (matches wall).
    for y in range(T):
        for x in range(T):
            px[x, y] = frame
    # Inset door opening.
    for y in range(2, 15):
        for x in range(2, 14):
            px[x, y] = door
    # Center seam (double doors).
    for y in range(2, 15):
        px[7, y] = seam
        px[8, y] = seam
    # Inner highlight on each panel.
    for y in range(3, 14):
        px[3, y] = door_hi
        px[10, y] = door_hi
    # Top bevel + call light.
    for x in range(2, 14):
        px[x, 2] = frame_hi
    for x in range(6, 10):
        px[x, 1] = gold
    # Bottom sill.
    for x in range(2, 14):
        px[x, 14] = frame_lo
    return im


def append_or_replace(sheet: Image.Image, catalog: dict, name: str, tile: Image.Image, kind: str) -> Image.Image:
    cols = catalog["columns"]
    tiles = catalog["tiles"]
    if name in tiles:
        idx = tiles[name]["index"]
    else:
        idx = max(v["index"] for v in tiles.values()) + 1
        tiles[name] = {"index": idx, "kind": kind}
    rows_needed = idx // cols + 1
    if rows_needed * T > sheet.height:
        grown = Image.new("RGBA", (sheet.width, rows_needed * T), (0, 0, 0, 0))
        grown.alpha_composite(sheet, (0, 0))
        sheet = grown
    x, y = (idx % cols) * T, (idx // cols) * T
    sheet.paste(Image.new("RGBA", (T, T), (0, 0, 0, 0)), (x, y))
    sheet.alpha_composite(tile, (x, y))
    print(f"{name} = {idx}")
    return sheet


def main() -> None:
    sheet_path, catalog_path = Path(sys.argv[1]), Path(sys.argv[2])
    catalog = json.loads(catalog_path.read_text())
    cols = catalog["columns"]
    sheet = Image.open(sheet_path).convert("RGBA")

    # Elevator: rebuild in place from the executive wall swatch.
    widx = catalog["tiles"]["wall_executive"]["index"]
    wall = sheet.crop(((widx % cols) * T, (widx // cols) * T, (widx % cols) * T + T, (widx // cols) * T + T))
    eidx = catalog["tiles"]["elevator"]["index"]
    ex, ey = (eidx % cols) * T, (eidx // cols) * T
    sheet.paste(Image.new("RGBA", (T, T), (0, 0, 0, 0)), (ex, ey))
    sheet.alpha_composite(elevator(wall), (ex, ey))
    print(f"elevator repaired @ {eidx}")

    # Cute mats: mint for tutorial (street), lilac for daily.
    sheet = append_or_replace(sheet, catalog, "mat_tutorial", mat((126, 196, 168, 255), (46, 110, 92, 255)), "walk")
    sheet = append_or_replace(sheet, catalog, "mat_daily", mat((196, 158, 220, 255), (110, 70, 150, 255)), "walk")

    sheet.save(sheet_path)
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n")


if __name__ == "__main__":
    main()
