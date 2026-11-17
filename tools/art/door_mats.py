"""Cute rectangular doormats for lobby exits: T (tutorial), D (daily), 1–3 (elevators).
Also rebuilds the elevator so its frame matches the brown wall.

    python3 -I tools/art/door_mats.py public/tiles/plumpurse.png app/floor/maps/tiles.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

T = 16

# 3×5 pixel glyphs, drawn into the mat.
GLYPHS: dict[str, list[str]] = {
    "T": [
        "###",
        ".#.",
        ".#.",
        ".#.",
        ".#.",
    ],
    "D": [
        "##.",
        "#.#",
        "#.#",
        "#.#",
        "##.",
    ],
    "1": [
        ".#.",
        "##.",
        ".#.",
        ".#.",
        "###",
    ],
    "2": [
        "###",
        "..#",
        "###",
        "#..",
        "###",
    ],
    "3": [
        "###",
        "..#",
        "###",
        "..#",
        "###",
    ],
}


def mat(fill: tuple[int, int, int, int], ink: tuple[int, int, int, int], letter: str) -> Image.Image:
    """A wide rectangular welcome mat (inset from the tile) with one letter in the middle."""
    edge = (56, 40, 32, 255)
    stitch = (255, 250, 236, 255)
    im = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    px = im.load()
    # Horizontal rug: leave 2px clear top/bottom so it reads as a mat on the floor, not a full tile.
    y0, y1 = 3, 12
    for y in range(y0, y1 + 1):
        for x in range(1, 15):
            if x in (1, 14) or y in (y0, y1):
                px[x, y] = edge
            elif x in (2, 13) or y in (y0 + 1, y1 - 1):
                px[x, y] = stitch
            else:
                px[x, y] = fill
    # Letter centred on the mat.
    g = GLYPHS[letter]
    gw, gh = len(g[0]), len(g)
    ox = (T - gw) // 2
    oy = y0 + 2
    for gy, row in enumerate(g):
        for gx, ch in enumerate(row):
            if ch == "#":
                px[ox + gx, oy + gy] = ink
    return im


def elevator(wall: Image.Image) -> Image.Image:
    """Gray double doors set in a wall-colored frame so brown doesn't look like a bleed."""
    im = wall.copy().convert("RGBA")
    px = im.load()
    frame = wall.getpixel((8, 8))
    if frame[3] < 200:
        frame = (60, 40, 30, 255)
    frame_hi = (min(255, frame[0] + 24), min(255, frame[1] + 18), min(255, frame[2] + 12), 255)
    frame_lo = (max(0, frame[0] - 18), max(0, frame[1] - 14), max(0, frame[2] - 10), 255)
    door = (168, 174, 184, 255)
    door_hi = (190, 196, 206, 255)
    seam = (70, 72, 80, 255)
    gold = (240, 200, 80, 255)
    for y in range(T):
        for x in range(T):
            px[x, y] = frame
    for y in range(2, 15):
        for x in range(2, 14):
            px[x, y] = door
    for y in range(2, 15):
        px[7, y] = seam
        px[8, y] = seam
    for y in range(3, 14):
        px[3, y] = door_hi
        px[10, y] = door_hi
    for x in range(2, 14):
        px[x, 2] = frame_hi
        px[x, 14] = frame_lo
    for x in range(6, 10):
        px[x, 1] = gold
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

    widx = catalog["tiles"]["wall_executive"]["index"]
    wall = sheet.crop(((widx % cols) * T, (widx // cols) * T, (widx % cols) * T + T, (widx // cols) * T + T))
    eidx = catalog["tiles"]["elevator"]["index"]
    ex, ey = (eidx % cols) * T, (eidx // cols) * T
    sheet.paste(Image.new("RGBA", (T, T), (0, 0, 0, 0)), (ex, ey))
    sheet.alpha_composite(elevator(wall), (ex, ey))
    print(f"elevator repaired @ {eidx}")

    sheet = append_or_replace(sheet, catalog, "mat_tutorial", mat((126, 196, 168, 255), (36, 92, 74, 255), "T"), "walk")
    sheet = append_or_replace(sheet, catalog, "mat_daily", mat((196, 158, 220, 255), (92, 52, 130, 255), "D"), "walk")
    # Elevator mats: warm amber so they read with the gold call lights.
    sheet = append_or_replace(sheet, catalog, "mat_1", mat((232, 186, 96, 255), (120, 72, 24, 255), "1"), "walk")
    sheet = append_or_replace(sheet, catalog, "mat_2", mat((220, 168, 88, 255), (110, 64, 20, 255), "2"), "walk")
    sheet = append_or_replace(sheet, catalog, "mat_3", mat((208, 150, 78, 255), (100, 56, 18, 255), "3"), "walk")

    sheet.save(sheet_path)
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n")


if __name__ == "__main__":
    main()
