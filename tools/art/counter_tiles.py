"""Adds countertop items, so readable notes on counters show something on top (the stock counter tiles only
have papers in the front drawer): counter_card (a yellow pickup card), counter_note (a paper note) and
counter_sign (a small standing sign). Appended in place: no existing index moves.

    python3 -I tools/art/counter_tiles.py public/tiles/plumpurse.png app/floor/maps/tiles.json
"""

import json
import sys
from pathlib import Path

from PIL import Image

T = 16
SHADOW = 0.72


def darken(px, x, y):
    r, g, b, a = px[x, y]
    px[x, y] = (int(r * SHADOW), int(g * SHADOW), int(b * SHADOW), a)


def rect(px, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px[x, y] = c


def card(base):
    im = base.copy(); px = im.load()
    for x in range(5, 13): darken(px, x, 6)
    for y in range(2, 6): darken(px, 12, y)
    rect(px, 4, 1, 11, 5, (247, 206, 70, 255))       # yellow card
    rect(px, 4, 1, 11, 1, (196, 140, 30, 255))       # stripe
    rect(px, 5, 3, 9, 3, (90, 70, 40, 255))          # printed line
    return im


def note(base):
    im = base.copy(); px = im.load()
    for x in range(6, 13): darken(px, x, 6)
    for y in range(1, 6): darken(px, 12, y)
    rect(px, 5, 0, 11, 5, (244, 240, 226, 255))      # paper
    rect(px, 6, 2, 10, 2, (150, 160, 182, 255))
    rect(px, 6, 4, 9, 4, (150, 160, 182, 255))
    px[8, 0] = (192, 57, 43, 255)                    # pin
    return im


def sign(base):
    im = base.copy(); px = im.load()
    for x in range(4, 13): darken(px, x, 6)
    rect(px, 4, 0, 11, 5, (250, 250, 246, 255))      # tent sign face
    rect(px, 4, 0, 11, 0, (120, 120, 130, 255))      # top fold
    rect(px, 5, 2, 10, 3, (190, 50, 40, 255))        # red band ("CLOSED")
    px[4, 5] = px[11, 5] = (120, 120, 130, 255)      # feet
    return im


def main() -> None:
    sheet_path, catalog_path = Path(sys.argv[1]), Path(sys.argv[2])
    catalog = json.loads(catalog_path.read_text())
    cols = catalog["columns"]
    sheet = Image.open(sheet_path).convert("RGBA")
    b = catalog["tiles"]["counter"]["index"]
    base = sheet.crop(((b % cols) * T, (b // cols) * T, (b % cols) * T + T, (b // cols) * T + T))
    for name, make in (("counter_card", card), ("counter_note", note), ("counter_sign", sign)):
        if name in catalog["tiles"]:
            continue
        index = max(v["index"] for v in catalog["tiles"].values()) + 1
        rows = index // cols + 1
        if rows * T > sheet.height:
            grown = Image.new("RGBA", (sheet.width, rows * T), (0, 0, 0, 0))
            grown.alpha_composite(sheet, (0, 0))
            sheet = grown
        sheet.alpha_composite(make(base), ((index % cols) * T, (index // cols) * T))
        catalog["tiles"][name] = {"index": index, "kind": "block"}
        print(f"{name} = {index}")
    sheet.save(sheet_path)
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n")


if __name__ == "__main__":
    main()
