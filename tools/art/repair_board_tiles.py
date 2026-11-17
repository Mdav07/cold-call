"""Rewrite board_* tiles in place: framed cork only, no wall-brown band above the frame.
That band read as a weird stalk under the unread sparkle. Indexes unchanged.

    python3 -I tools/art/repair_board_tiles.py public/tiles/plumpurse.png app/floor/maps/tiles.json
"""

import json
import random
import sys
from pathlib import Path

from PIL import Image

T = 16
THEMES = ["branch", "bullpen", "management", "executive"]


def board(seed: int, wall: Image.Image) -> Image.Image:
    # Start from the wall tile so transparent gaps don't show floor through the wall row.
    # Cork frame is flush with the top of the tile — no brown band above it for the glint to sit on.
    im = wall.copy().convert("RGBA")
    px = im.load()
    rnd = random.Random(seed)
    frame, cork, cork2 = (92, 60, 32, 255), (196, 150, 92, 255), (178, 132, 78, 255)
    x0, y0, x1, y1 = 2, 0, 13, 12
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            edge = x in (x0, x1) or y in (y0, y1)
            px[x, y] = frame if edge else (cork2 if rnd.random() < 0.25 else cork)
    sheet, line, sticky, pin = (244, 240, 226, 255), (150, 160, 182, 255), (247, 222, 120, 255), (192, 57, 43, 255)
    for y in range(2, 8):
        for x in range(4, 9):
            px[x, y] = sheet
    for y in (4, 6):
        for x in range(5, 8):
            px[x, y] = line
    px[6, 2] = pin
    for y in range(3, 7):
        for x in range(10, 13):
            px[x, y] = sticky
    px[11, 3] = (40, 90, 160, 255)
    return im


def main() -> None:
    sheet_path, catalog_path = Path(sys.argv[1]), Path(sys.argv[2])
    catalog = json.loads(catalog_path.read_text())
    cols = catalog["columns"]
    sheet = Image.open(sheet_path).convert("RGBA")
    for n, theme in enumerate(THEMES):
        name = f"board_{theme}"
        idx = catalog["tiles"][name]["index"]
        x, y = (idx % cols) * T, (idx // cols) * T
        widx = catalog["tiles"][f"wall_{theme}"]["index"]
        wall = sheet.crop(((widx % cols) * T, (widx // cols) * T, (widx % cols) * T + T, (widx // cols) * T + T))
        blank = Image.new("RGBA", (T, T), (0, 0, 0, 0))
        sheet.paste(blank, (x, y))
        sheet.alpha_composite(board(n, wall), (x, y))
        print(f"repaired {name} @ {idx}")
    sheet.save(sheet_path)


if __name__ == "__main__":
    main()
