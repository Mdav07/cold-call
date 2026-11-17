"""Daily Case staff: 24 walking sprites in the hunters' style (tools/art/portrait_sprites.py), with their own
mixes of skin, hair and outfit so the day's employee never looks like a player hunter.

    python3 -I tools/art/staff_sprites.py public/sprites [preview.png]
"""

import importlib.util
import random
import sys
from pathlib import Path

from PIL import Image

spec = importlib.util.spec_from_file_location("portrait_sprites", Path(__file__).with_name("portrait_sprites.py"))
ps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ps)

SKINS = [(247, 214, 186), (240, 200, 168), (226, 180, 140), (214, 164, 118), (190, 138, 96), (160, 108, 72), (130, 86, 56), (110, 70, 46), (86, 56, 38)]
HAIR = [(30, 26, 30), (60, 40, 28), (96, 62, 36), (150, 90, 50), (190, 120, 60), (236, 210, 140), (200, 200, 205), (120, 120, 128), (170, 50, 40), (60, 90, 170), (60, 140, 110)]
STYLES = ["short", "long", "curly", "bun", "slick", "messy"]
OUTFITS = [(70, 110, 160), (160, 100, 60), (90, 120, 80), (150, 60, 90), (210, 210, 220), (60, 60, 70), (200, 140, 60), (110, 80, 150), (40, 130, 140), (180, 70, 50), (120, 120, 100), (230, 180, 190)]
# The player hunters' exact mixes, never reused for staff.
TAKEN = {(tuple(p["skin"]), p["hair"], tuple(p["hair_c"]), tuple(p["outfit"])) for p in ps.HUNTERS.values()}


def main() -> None:
    out = Path(sys.argv[1])
    rnd = random.Random(20261118)
    made, seen = [], set()
    while len(made) < 24:
        p = dict(skin=rnd.choice(SKINS), hair=rnd.choice(STYLES), hair_c=rnd.choice(HAIR), outfit=rnd.choice(OUTFITS))
        key = (p["skin"], p["hair"], p["hair_c"], p["outfit"])
        if key in seen or key in TAKEN or (p["hair"], p["outfit"]) in {(k[1], k[3]) for k in seen}:
            continue
        seen.add(key)
        made.append(ps.sheet(ps.drawn_head(p), p["skin"] + (255,), p["hair_c"] + (255,), p["outfit"] + (255,)))
    for i, im in enumerate(made, 1):
        im.save(out / f"staff-{i:02d}.png")
    print(f"wrote {len(made)} staff sprites")
    if len(sys.argv) > 2:
        S = 4
        prev = Image.new("RGBA", (12 * 16 * S, 2 * 32 * S), (60, 60, 70, 255))
        for i, im in enumerate(made):
            fr = im.crop((0, 0, 16, 32)).resize((16 * S, 32 * S), Image.NEAREST)
            prev.alpha_composite(fr, ((i % 12) * 16 * S, (i // 12) * 32 * S))
        prev.save(sys.argv[2])


if __name__ == "__main__":
    main()
