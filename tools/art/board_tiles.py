"""Adds a cork notice board on each theme's wall (board_branch, board_bullpen, board_management,
board_executive) to the end of the tileset. Notes that used to sit on lone tables are pinned here instead.
Appended in place: no existing index moves.

    python3 -I tools/art/board_tiles.py public/tiles/plumpurse.png app/floor/maps/tiles.json
"""

import json
import random
import sys
from pathlib import Path

from PIL import Image

T = 16
THEMES = ["branch", "bullpen", "management", "executive"]


def board_on(wall: Image.Image, seed: int) -> Image.Image:
    im = wall.copy()
    px = im.load()
    rnd = random.Random(seed)
    frame, cork, cork2 = (92, 60, 32, 255), (196, 150, 92, 255), (178, 132, 78, 255)
    x0, y0, x1, y1 = 2, 3, 13, 12
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            edge = x in (x0, x1) or y in (y0, y1)
            px[x, y] = frame if edge else (cork2 if rnd.random() < 0.25 else cork)
    for y in range(y0 + 1, y1 + 2):  # shadow under and right of the frame
        if y < T and x1 + 1 < T:
            r, g, b, a = px[x1 + 1, y]
            px[x1 + 1, y] = (int(r * 0.7), int(g * 0.7), int(b * 0.7), a)
    if y1 + 1 < T:
        for x in range(x0 + 1, x1 + 2):
            r, g, b, a = px[x, y1 + 1]
            px[x, y1 + 1] = (int(r * 0.7), int(g * 0.7), int(b * 0.7), a)
    # two pinned papers: a white sheet with lines and a yellow sticky
    sheet, line, sticky, pin = (244, 240, 226, 255), (150, 160, 182, 255), (247, 222, 120, 255), (192, 57, 43, 255)
    for y in range(5, 11):
        for x in range(4, 9):
            px[x, y] = sheet
    for y in (7, 9):
        for x in range(5, 8):
            px[x, y] = line
    px[6, 5] = pin
    for y in range(6, 10):
        for x in range(10, 13):
            px[x, y] = sticky
    px[11, 6] = (40, 90, 160, 255)
    return im


def main() -> None:
    sheet_path, catalog_path = Path(sys.argv[1]), Path(sys.argv[2])
    catalog = json.loads(catalog_path.read_text())
    cols = catalog["columns"]
    sheet = Image.open(sheet_path).convert("RGBA")
    for n, theme in enumerate(THEMES):
        name = f"board_{theme}"
        if name in catalog["tiles"]:
            continue
        w = catalog["tiles"][f"wall_{theme}"]["index"]
        wall = sheet.crop(((w % cols) * T, (w // cols) * T, (w % cols) * T + T, (w // cols) * T + T))
        index = max(v["index"] for v in catalog["tiles"].values()) + 1
        rows = index // cols + 1
        if rows * T > sheet.height:
            grown = Image.new("RGBA", (sheet.width, rows * T), (0, 0, 0, 0))
            grown.alpha_composite(sheet, (0, 0))
            sheet = grown
        sheet.alpha_composite(board_on(wall, n), ((index % cols) * T, (index // cols) * T))
        catalog["tiles"][name] = {"index": index, "kind": "wall"}
        print(f"{name} = {index}")
    sheet.save(sheet_path)
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n")


if __name__ == "__main__":
    main()
