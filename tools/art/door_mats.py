"""Cute rectangular doormats for lobby exits: T (tutorial), D (daily), 1–3 (elevators).
Tile is carpet-filled (no gray holes), mat centred, colorful outline. Also rebuilds the elevator.

    python3 -I tools/art/door_mats.py public/tiles/plumpurse.png app/floor/maps/tiles.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

T = 16
# Lobby carpet (floor_executive in plumpurse.png).
CARPET = (120, 32, 40, 255)

# 3×5 pixel glyphs.
GLYPHS: dict[str, list[str]] = {
    "T": ["###", ".#.", ".#.", ".#.", ".#."],
    "D": ["##.", "#.#", "#.#", "#.#", "##."],
    "1": [".#.", "##.", ".#.", ".#.", "###"],
    "2": ["###", "..#", "###", "#..", "###"],
    "3": ["###", "..#", "###", "..#", "###"],
}


def mat(
    fill: tuple[int, int, int, int],
    ink: tuple[int, int, int, int],
    outline: tuple[int, int, int, int],
    letter: str,
) -> Image.Image:
    """Full carpet tile + a centred rug with a colorful outline and letter."""
    hi = (
        min(255, outline[0] + 40),
        min(255, outline[1] + 40),
        min(255, outline[2] + 40),
        255,
    )
    im = Image.new("RGBA", (T, T), CARPET)
    px = im.load()
    # Rug inset so margins show carpet; odd size so the letter can sit dead-centre.
    x0, y0, x1, y1 = 2, 3, 13, 12
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            edge = x in (x0, x1) or y in (y0, y1)
            inner = x in (x0 + 1, x1 - 1) or y in (y0 + 1, y1 - 1)
            if edge:
                px[x, y] = outline
            elif inner:
                px[x, y] = hi
            else:
                px[x, y] = fill
    g = GLYPHS[letter]
    gw, gh = len(g[0]), len(g)
    ox = (T - gw) // 2
    oy = (T - gh) // 2
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

    # Colors sampled from the tileset: plant-pot teal, hunter purple sweater, plant leaf green.
    pot = (55, 170, 165, 255)
    pot_ink = (24, 88, 86, 255)
    pot_edge = (90, 220, 214, 255)
    sweater = (148, 120, 220, 255)
    sweater_ink = (56, 36, 110, 255)
    sweater_edge = (196, 170, 255, 255)
    leaf = (123, 173, 44, 255)
    leaf_ink = (40, 72, 20, 255)
    leaf_edge = (168, 220, 72, 255)
    mats = [
        ("mat_tutorial", pot, pot_ink, pot_edge, "T"),
        ("mat_daily", sweater, sweater_ink, sweater_edge, "D"),
        ("mat_1", leaf, leaf_ink, leaf_edge, "1"),
        ("mat_2", leaf, leaf_ink, leaf_edge, "2"),
        ("mat_3", leaf, leaf_ink, leaf_edge, "3"),
    ]
    for name, fill, ink, outline, letter in mats:
        sheet = append_or_replace(sheet, catalog, name, mat(fill, ink, outline, letter), "walk")

    sheet.save(sheet_path)
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n")


if __name__ == "__main__":
    main()
