"""Builds the walkable floors' tileset: generated floors and walls in each floor's palette, plus
curated furniture from Kenney's Roguelike Indoors (CC0). Writes the PNG and a catalog of named tiles.

    python3 -I tools/art/build_tiles.py tools/art/kenney/roguelikeIndoor_transparent.png public/tiles app/floor/maps/tiles.json

Catalog entry kinds tell the map compiler which layer a tile goes on:
  ground  floor tiles (walkable)
  wall    blocks; drawn on the walls layer
  block   furniture that blocks; drawn on decor + added to `blocked`
  walk    decor you can walk over (rugs)
"""

import json
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw

T = 16
COLUMNS = 16
KENNEY_COLS = 27  # Roguelike Indoors: 27 x 18 tiles, 1 px spacing

# Floor palettes: the climb gets visibly fancier (design doc: drab bullpen -> gold executive suite).
THEMES = {
    "branch": {"floor": (150, 108, 72), "floor2": (132, 94, 62), "wall": (122, 66, 52), "trim": (88, 44, 36)},
    "bullpen": {"floor": (148, 146, 138), "floor2": (136, 134, 126), "wall": (110, 120, 104), "trim": (72, 80, 68)},
    "management": {"floor": (196, 200, 204), "floor2": (178, 184, 190), "wall": (78, 98, 128), "trim": (48, 62, 86)},
    "executive": {"floor": (120, 32, 40), "floor2": (104, 26, 34), "wall": (60, 40, 30), "trim": (212, 170, 70)},
}

# Kenney furniture picks: name -> (indoor sheet index, kind)
KENNEY = {
    "desk_l": (0, "block"), "desk_m": (1, "block"), "desk_r": (2, "block"),
    "table_oval_l": (3, "block"), "table_oval_r": (4, "block"), "table_small": (5, "block"), "table_round": (6, "block"),
    "chair_down": (54, "walk"), "chair_up": (55, "walk"), "chair_left": (56, "walk"), "chair_right": (57, "walk"),
    "office_chair": (216, "walk"), "office_chair_back": (217, "walk"),
    "plant": (16, "block"), "plant_small": (17, "block"),
    "counter": (324, "block"), "counter_papers": (328, "block"), "counter_books": (330, "block"), "counter_files": (331, "block"),
    "cabinet_dark": (266, "block"), "locker": (268, "block"), "copier": (239, "block"),
    "bookshelf": (320, "block"), "water_cooler": (416, "block"), "mirror": (427, "block"),
    "rug_orange_l": (243, "walk"), "rug_orange_m": (244, "walk"), "rug_orange_r": (245, "walk"),
    "rug_green_l": (250, "walk"), "rug_green_m": (251, "walk"), "rug_green_r": (252, "walk"),
    "painting_small": (343, "block"), "painting_gold": (370, "block"), "painting_landscape": (397, "block"),
    "candelabra": (19, "block"), "candelabra_gold": (20, "block"),
}


def noise_tile(base, alt, seed, grid=None):
    rnd = random.Random(seed)
    im = Image.new("RGBA", (T, T), base + (255,))
    px = im.load()
    for y in range(T):
        for x in range(T):
            if rnd.random() < 0.18:
                px[x, y] = alt + (255,)
    if grid:
        d = ImageDraw.Draw(im)
        d.line([(0, T - 1), (T - 1, T - 1)], fill=grid + (255,))
        d.line([(T - 1, 0), (T - 1, T - 1)], fill=grid + (255,))
    return im


def planks(base, alt):
    im = Image.new("RGBA", (T, T), base + (255,))
    d = ImageDraw.Draw(im)
    for y in (3, 7, 11, 15):
        d.line([(0, y), (T - 1, y)], fill=alt + (255,))
    d.line([(6, 0), (6, 3)], fill=alt + (255,))
    d.line([(12, 4), (12, 7)], fill=alt + (255,))
    d.line([(3, 8), (3, 11)], fill=alt + (255,))
    d.line([(10, 12), (10, 15)], fill=alt + (255,))
    return im


def wall_front(wall, trim, window=False):
    im = Image.new("RGBA", (T, T), wall + (255,))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 13, T - 1, T - 1], fill=trim + (255,))  # skirting
    if window:
        d.rectangle([3, 3, 12, 10], fill=(150, 200, 230, 255), outline=trim + (255,))
        d.line([(7, 3), (7, 10)], fill=trim + (255,))
    return im


def wall_top(trim):
    # Plain cap (no band), so a column of wall tops along a side wall doesn't stripe.
    return Image.new("RGBA", (T, T), (40, 38, 46, 255))


def elevator():
    im = Image.new("RGBA", (T, T), (90, 94, 104, 255))
    d = ImageDraw.Draw(im)
    d.rectangle([2, 1, 13, 15], fill=(170, 176, 186, 255), outline=(60, 62, 70, 255))
    d.line([(7, 1), (7, 15)], fill=(60, 62, 70, 255))
    d.rectangle([6, 0, 9, 0], fill=(240, 200, 80, 255))  # floor light
    return im


def main():
    src, out_dir, catalog_path = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    kenney = Image.open(src).convert("RGBA")
    tiles: list[tuple[str, Image.Image, str]] = []

    for name, t in THEMES.items():
        if name == "branch":
            tiles.append((f"floor_{name}", planks(t["floor"], t["floor2"]), "ground"))
        else:
            grid = t["floor2"] if name == "management" else None
            tiles.append((f"floor_{name}", noise_tile(t["floor"], t["floor2"], hash(name) & 0xFFFF, grid), "ground"))
        tiles.append((f"wall_{name}", wall_front(t["wall"], t["trim"]), "wall"))
        tiles.append((f"window_{name}", wall_front(t["wall"], t["trim"], window=True), "wall"))
        tiles.append((f"walltop_{name}", wall_top(t["trim"]), "wall"))
    tiles.append(("elevator", elevator(), "wall"))

    for name, (index, kind) in KENNEY.items():
        r, c = divmod(index, KENNEY_COLS)
        tiles.append((name, kenney.crop((c * 17, r * 17, c * 17 + T, r * 17 + T)), kind))

    rows = (len(tiles) + COLUMNS - 1) // COLUMNS
    sheet = Image.new("RGBA", (COLUMNS * T, rows * T), (0, 0, 0, 0))
    catalog = {"tileset": "/tiles/plumpurse.png", "columns": COLUMNS, "tiles": {}}
    for i, (name, im, kind) in enumerate(tiles):
        sheet.alpha_composite(im, ((i % COLUMNS) * T, (i // COLUMNS) * T))
        catalog["tiles"][name] = {"index": i, "kind": kind}

    out_dir.mkdir(parents=True, exist_ok=True)
    sheet.save(out_dir / "plumpurse.png")
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n")
    print(f"wrote {out_dir / 'plumpurse.png'} ({len(tiles)} tiles) and {catalog_path}")


if __name__ == "__main__":
    main()
