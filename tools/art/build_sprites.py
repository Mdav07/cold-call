"""Builds character sprite sheets for the walkable floors from Kenney's Roguelike Characters (CC0).

Kenney's characters are single front-facing 16x16 paper dolls (body + pants + shirt + hair). The
engine expects 4 rows (down, left, right, up) x 4 frames of 16x32, bottom-aligned; frame 0 is idle,
frames 1 and 3 are the walk frames. We compose each character, pad it to 16x32 at the bottom, and
make the walk frames a 1-pixel bob. Left is the right frame mirrored; up reuses the front view.

    python3 -I tools/art/build_sprites.py tools/art/kenney/roguelikeChar_transparent.png public/sprites
"""

import sys
from pathlib import Path

from PIL import Image, ImageOps

COLS = 54  # tiles per row in the Kenney sheet (16 px + 1 px spacing)

# Layer tile indexes (row * 54 + col), bottom to top: body, legs/pants, torso, hair.
CHARACTERS = {
    "hunter": [0, 170, 10, 23],  # the player: teal jacket
    "penny": [0, 174, 14, 77],  # lavender blouse, red hair
    "dee": [54, 338, 339, 293],  # dark hoodie
    "annie": [0, 172, 330, 289],  # bright and tidy, blonde
    "bill": [108, 338, 282, 505],  # beige suit, white hair
    "cassius": [108, 338, 341, 293],  # dark suit, black hair
    "max": [0, 338, 341, 23],  # dark suit, slick brown hair
    "barry": [54, 170, 60, 73],  # teller's waistcoat
}


def tile(sheet: Image.Image, index: int) -> Image.Image:
    row, col = divmod(index, COLS)
    return sheet.crop((col * 17, row * 17, col * 17 + 16, row * 17 + 16))


def compose(sheet: Image.Image, layers: list[int]) -> Image.Image:
    out = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for index in layers:
        out.alpha_composite(tile(sheet, index))
    return out


def frame(doll: Image.Image, bob: int) -> Image.Image:
    """16x32 frame with the doll bottom-aligned, raised by `bob` pixels."""
    f = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    f.alpha_composite(doll, (0, 16 - bob))
    return f


def sheet_for(doll: Image.Image) -> Image.Image:
    side = doll  # Kenney has no side view; the front reads fine at this size
    rows = [doll, ImageOps.mirror(side), side, doll]  # down, left, right, up
    out = Image.new("RGBA", (16 * 4, 32 * 4), (0, 0, 0, 0))
    for r, base in enumerate(rows):
        for c, bob in enumerate([0, 1, 0, 1]):  # idle, walk, idle, walk
            out.alpha_composite(frame(base, bob), (c * 16, r * 32))
    return out


def main() -> None:
    src, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(src).convert("RGBA")
    for name, layers in CHARACTERS.items():
        path = out_dir / f"{name}.png"
        sheet_for(compose(sheet, layers)).save(path)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
