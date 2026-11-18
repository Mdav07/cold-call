"""The security guard who walks a player out at 100% suspicion: staff-05 with a peaked cap and a badge.

    python3 -I tools/art/guard_sprite.py public/sprites/staff-05.png public/sprites/guard.png
"""

from __future__ import annotations

import sys

from PIL import Image

CAP = (31, 42, 72, 255)
CAP_HI = (52, 68, 110, 255)
VISOR = (14, 14, 20, 255)
BADGE = (244, 201, 93, 255)
SHIRT = (38, 52, 92, 255)


def main() -> None:
    src, out = sys.argv[1], sys.argv[2]
    im = Image.open(src).convert("RGBA")
    px = im.load()
    for row in range(4):  # down, left, right, up
        for col in range(4):
            ox, oy = col * 16, row * 32
            ys = [y for y in range(32) if any(px[ox + x, oy + y][3] for x in range(16))]
            if not ys:
                continue
            top = ys[0]
            head = [x for x in range(16) if px[ox + x, oy + top][3]]
            x0, x1 = min(head), max(head)
            # Crown above the hair, then the hair band becomes the cap.
            for y in range(top - 2, top + 2):
                for x in range(x0 + (1 if y < top else 0), x1 + 1 - (1 if y < top else 0)):
                    px[ox + x, oy + y] = CAP_HI if y == top - 2 else CAP
            # Visor: forward over the face (down), to the side (left/right); none from behind.
            vy = oy + top + 2
            if row == 0:
                for x in range(x0 - 1, x1 + 2):
                    px[ox + x, vy] = VISOR
            elif row == 1:
                for x in range(x0 - 2, x0 + 3):
                    px[ox + x, vy] = VISOR
            elif row == 2:
                for x in range(x1 - 2, x1 + 3):
                    px[ox + x, vy] = VISOR
            # Uniform shirt and a gold badge on the chest (seen from the front).
            for y in range(top + 10, top + 16):
                for x in range(16):
                    if px[ox + x, oy + y][3]:
                        px[ox + x, oy + y] = SHIRT
            if row == 0:
                px[ox + x0 + 2, oy + top + 11] = BADGE
    im.save(out)


if __name__ == "__main__":
    main()
