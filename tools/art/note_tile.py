"""Adds the 'table_note' tile (the small side table with a paper note on it) to the end of the tileset, so
readable notes look like notes rather than a bare tan square. Appended in place: no existing index moves.

    python3 -I tools/art/note_tile.py public/tiles/plumpurse.png app/floor/maps/tiles.json
"""

import json
import sys
from pathlib import Path

from PIL import Image

T = 16


def note_on(table: Image.Image) -> Image.Image:
    im = table.copy()
    px = im.load()
    paper, line, fold, pin, shadow = (244, 240, 226, 255), (150, 160, 182, 255), (214, 204, 180, 255), (192, 57, 43, 255), (60, 40, 25, 110)
    x0, y0, x1, y1 = 4, 4, 11, 12  # sheet, slightly off-centre like it was dropped there
    for y in range(y0 + 1, y1 + 2):  # soft shadow down and right
        for x in range(x0 + 1, x1 + 2):
            if px[x, y][3] > 0:
                r, g, b, a = px[x, y]
                px[x, y] = (int(r * 0.75), int(g * 0.75), int(b * 0.75), a)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px[x, y] = paper
    for y in range(y0 + 3, y1, 2):  # written lines, the last one short
        for x in range(x0 + 1, x1 - (2 if y >= y1 - 2 else 0)):
            px[x, y] = line
    px[x1, y0] = (0, 0, 0, 0) if table.getpixel((x1, y0))[3] == 0 else table.getpixel((x1, y0))  # folded corner
    px[x1 - 1, y0] = fold
    px[x1, y0 + 1] = fold
    px[x0 + 3, y0] = pin
    px[x0 + 4, y0] = pin
    px[x0 + 3, y0 + 1] = (140, 30, 22, 255)
    _ = shadow
    return im


def main() -> None:
    sheet_path, catalog_path = Path(sys.argv[1]), Path(sys.argv[2])
    catalog = json.loads(catalog_path.read_text())
    if "table_note" in catalog["tiles"]:
        print("table_note already present")
        return
    cols = catalog["columns"]
    sheet = Image.open(sheet_path).convert("RGBA")
    base = catalog["tiles"]["table_small"]["index"]
    table = sheet.crop(((base % cols) * T, (base // cols) * T, (base % cols) * T + T, (base // cols) * T + T))
    index = max(v["index"] for v in catalog["tiles"].values()) + 1
    rows = index // cols + 1
    if rows * T > sheet.height:
        grown = Image.new("RGBA", (sheet.width, rows * T), (0, 0, 0, 0))
        grown.alpha_composite(sheet, (0, 0))
        sheet = grown
    sheet.alpha_composite(note_on(table), ((index % cols) * T, (index // cols) * T))
    sheet.save(sheet_path)
    catalog["tiles"]["table_note"] = {"index": index, "kind": "block"}
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n")
    print(f"table_note = {index}")


if __name__ == "__main__":
    main()
