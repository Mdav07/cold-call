"""Thanksgiving art for the seasonal case: a harvest theme for the room (floor, wall, window, menu board,
a harvest table with a pie, pumpkins, a hay bale, a cornucopia and a plaid chair) and, for the lobby, a
wooden door with an autumn wreath plus an orange mat to stand in front of it.

Appends the tiles (or redraws them in place when they exist), so no existing index moves.

    python3 -I tools/art/harvest_tiles.py public/tiles/plumpurse.png app/floor/maps/tiles.json

The theme's tile names go in content/daily/themes.json ("harvest"); the door and mat in app/tower/lobbyMap.ts.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from door_mats import append_or_replace  # noqa: E402
from theme_tiles import T, Tile, armchair, board_on, darker, floor_planks, lighter, station, wall, walltop, window_on, with_note  # noqa: E402

ORANGE = (214, 112, 40)
PUMPKIN = (232, 128, 36)
STEM = (96, 70, 36)
LEAF = (98, 132, 52)
GOLD = (226, 178, 70)
RED = (178, 54, 40)
BROWN = (120, 72, 38)
CREAM = (240, 226, 196)


def _tile(draw) -> Tile:
    t = Tile()
    draw(t)
    return t


def pumpkin(t: Tile, x0: int, y0: int, w: int, h: int, c=PUMPKIN):
    for y in range(h):
        for x in range(w):
            if ((x - (w - 1) / 2) / (w / 2)) ** 2 + ((y - (h - 1) / 2) / (h / 2)) ** 2 <= 1:
                t.put(x0 + x, y0 + y, c)
    for x in range(1, w - 1, 2):  # ribs
        t.rect(x0 + x, y0 + 1, x0 + x, y0 + h - 2, darker(c, 0.82))
    t.rect(x0 + w // 2, y0 - 2, x0 + w // 2, y0, STEM)
    t.put(x0 + w // 2 + 1, y0 - 2, LEAF)


def themes() -> list[tuple[str, Tile, str]]:
    face, trim = (196, 108, 50), (92, 56, 30)
    w = wall(face, trim, wainscot=(128, 80, 42))

    def turkey_menu(t: Tile):  # a chalkboard menu with a little turkey
        for i, c in enumerate((RED, ORANGE, GOLD, LEAF)):  # tail feathers
            t.rect(4 + i * 2, 4, 5 + i * 2, 6, c)
        t.rect(6, 6, 9, 9, BROWN), t.rect(9, 5, 10, 6, BROWN), t.put(10, 5, (240, 200, 80)), t.put(11, 6, RED)
        for y in (11,):
            t.rect(4, y, 11, y, (200, 200, 188))

    def pie(t: Tile):
        t.rect(3, 3, 9, 5, (196, 140, 70)), t.rect(4, 3, 8, 4, (200, 110, 40)), t.rect(3, 5, 9, 5, (150, 100, 52))  # pumpkin pie
        t.rect(11, 2, 13, 5, CREAM), t.rect(11, 2, 13, 2, darker(CREAM, 0.85))  # a stack of plates

    def pumpkins(t: Tile):
        pumpkin(t, 1, 8, 8, 6)
        pumpkin(t, 8, 9, 7, 5, (240, 168, 60))
        pumpkin(t, 5, 4, 6, 5, (226, 110, 30))
        t.shadow(1, 14)

    def haybale(t: Tile):
        hay, hay_lo = (214, 182, 96), (176, 144, 70)
        t.rect(1, 6, 14, 14, hay)
        for y in range(7, 14, 2):
            t.rect(2, y, 13, y, hay_lo)
        t.rect(1, 6, 14, 6, lighter(hay, 0.2))
        t.rect(4, 6, 4, 14, (150, 96, 48)), t.rect(11, 6, 11, 14, (150, 96, 48))  # twine
        pumpkin(t, 6, 2, 5, 4)

    def cornucopia(t: Tile):
        basket, basket_lo = (176, 120, 60), (130, 86, 42)
        for x in range(2, 13):  # the horn, wide at the right
            h = 2 + (x - 2) // 2
            t.rect(x, 12 - h, x, 12, basket if x % 2 else basket_lo)
        t.rect(1, 11, 2, 12, basket_lo)
        for x, y, c in ((12, 6, RED), (13, 8, GOLD), (11, 9, (140, 60, 140)), (13, 10, ORANGE), (10, 7, LEAF)):
            t.rect(x, y, x + 1, y + 1, c)
        t.shadow(2, 14)

    st = station((176, 116, 62), (128, 80, 42), (92, 56, 30), pie)
    return [
        ("floor_harvest", floor_planks((186, 132, 78), (164, 112, 64), seed=1126), "ground"),
        ("wall_harvest", w, "wall"),
        ("window_harvest", window_on(w, trim, sky=(236, 176, 110)), "wall"),
        ("walltop_harvest", walltop(), "wall"),
        ("board_harvest", board_on(w, BROWN, (46, 56, 48), turkey_menu), "wall"),
        ("station_harvest", st, "block"),
        ("station_note_harvest", with_note(st), "block"),
        ("pumpkins_harvest", _tile(pumpkins), "block"),
        ("haybale_harvest", _tile(haybale), "block"),
        ("cornucopia_harvest", _tile(cornucopia), "block"),
        ("seat_harvest", armchair((168, 52, 44), (92, 56, 30)), "block"),
    ]


def garland() -> Tile:
    """An autumn-leaf garland to hang over the lobby's back wall in the Thanksgiving season (transparent,
    drawn on top of the wall): a twine swag with red, orange and gold leaves."""
    t = Tile()
    twine = (120, 84, 46)
    sag = [3, 3, 4, 4, 5, 5, 5, 6, 6, 5, 5, 5, 4, 4, 3, 3]  # one droop per tile, so tiles join up
    for x, y in enumerate(sag):
        t.put(x, y, twine)
    leaves = [(1, RED), (4, ORANGE), (7, GOLD), (10, (200, 90, 30)), (13, RED)]
    for x, c in leaves:
        y = sag[x] + 1
        t.rect(x, y, x + 1, y + 1, c)
        t.put(x + 1, y + 2, darker(c, 0.8))
    return t


def harvest_door(sheet: Image.Image, catalog: dict) -> Image.Image:
    """The Daily's mahogany door, warmed up, with an autumn wreath where the brass plate was."""
    cols = catalog["columns"]
    i = catalog["tiles"]["door_wood"]["index"]
    im = sheet.crop(((i % cols) * T, (i // cols) * T, (i % cols) * T + T, (i // cols) * T + T)).copy()
    px = im.load()
    for y in range(T):  # warm the wood a touch toward amber
        for x in range(T):
            r, g, b, a = px[x, y]
            if a and r > g > b:
                px[x, y] = (min(255, r + 18), min(255, g + 8), b, a)
    ring = [(5, 2), (6, 1), (7, 1), (8, 1), (9, 1), (10, 2), (10, 3), (10, 4), (9, 5), (8, 5), (7, 5), (6, 5), (5, 4), (5, 3)]
    colours = [RED, ORANGE, GOLD, LEAF, (200, 90, 30), GOLD, RED]
    for k, (x, y) in enumerate(ring):
        px[x, y] = colours[k % len(colours)] + (255,)
    px[7, 6] = RED + (255,)
    px[8, 6] = RED + (255,)  # the bow
    return im


def harvest_mat(sheet: Image.Image, catalog: dict) -> Image.Image:
    """The Daily mat recoloured: burnt orange field, the same gold frame."""
    cols = catalog["columns"]
    i = catalog["tiles"]["mat_daily"]["index"]
    im = sheet.crop(((i % cols) * T, (i // cols) * T, (i % cols) * T + T, (i // cols) * T + T)).copy()
    px = im.load()
    for y in range(T):
        for x in range(T):
            r, g, b, a = px[x, y]
            if a and b > r and b > g:  # the purple field
                k = (r + g + b) / (3 * 60)
                px[x, y] = (min(255, int(150 * k)), min(255, int(62 * k)), min(255, int(28 * k)), a)
    return im


def main() -> None:
    sheet_path, catalog_path = Path(sys.argv[1]), Path(sys.argv[2])
    catalog = json.loads(catalog_path.read_text())
    sheet = Image.open(sheet_path).convert("RGBA")
    for name, tile, kind in themes():
        sheet = append_or_replace(sheet, catalog, name, tile.im, kind)
    sheet = append_or_replace(sheet, catalog, "door_harvest", harvest_door(sheet, catalog), "walk")
    sheet = append_or_replace(sheet, catalog, "garland_harvest", garland().im, "decor")
    sheet = append_or_replace(sheet, catalog, "mat_harvest", harvest_mat(sheet, catalog), "walk")
    sheet.save(sheet_path)
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n")


if __name__ == "__main__":
    main()
