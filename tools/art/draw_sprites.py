"""Draws the walkable floors' character sprites from scratch (replaces the stocky Kenney paper dolls).

Each character is a slim figure (about 10 px wide, 24 px tall) in the engine's sheet format:
4 rows (down, left, right, up) x 4 frames of 16x32, bottom-aligned; frame 0 idle, frames 1 and 3 walk
(legs alternate, arms swing), frame 2 idle. Characters are presets of a few options (skin, hair style
and colour, top, pants, accessory), which is also how the player's hunter is customised.

    python3 -I tools/art/draw_sprites.py public/sprites [preview.png]
"""

import sys
from pathlib import Path

from PIL import Image

W, H = 16, 32
CLEAR = (0, 0, 0, 0)
OUTLINE = (34, 30, 40, 255)
EYE = (30, 28, 36, 255)
SHOE = (44, 40, 50, 255)

SKIN = {
    "light": (240, 200, 168),
    "tan": (214, 164, 118),
    "brown": (160, 108, 72),
    "deep": (110, 70, 46),
}


def rgb(c):
    return c + (255,) if len(c) == 3 else c


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + (255,)


# Character presets. hair: short | long | bun | slick | curly | messy | bald.
# accessory: none | glasses | tie | headphones | clipboard | watch | pin | lanyard.
PRESETS = {
    "barry": dict(skin="tan", hair="messy", hair_c=(122, 80, 44), top=(206, 112, 52), pants=(70, 64, 80), acc="none"),
    "penny": dict(skin="light", hair="curly", hair_c=(196, 84, 40), top=(208, 168, 214), pants=(84, 74, 110), acc="pin"),
    "dee": dict(skin="tan", hair="short", hair_c=(36, 32, 40), top=(78, 80, 92), pants=(50, 54, 70), acc="headphones"),
    "annie": dict(skin="light", hair="bun", hair_c=(232, 200, 112), top=(96, 168, 104), pants=(70, 80, 96), acc="clipboard"),
    "bill": dict(skin="brown", hair="short", hair_c=(226, 226, 230), top=(188, 170, 132), pants=(110, 98, 74), acc="glasses"),
    "cassius": dict(skin="brown", hair="slick", hair_c=(30, 26, 32), top=(40, 42, 56), pants=(36, 38, 50), acc="tie"),
    "max": dict(skin="light", hair="slick", hair_c=(110, 70, 40), top=(54, 58, 84), pants=(44, 46, 64), acc="watch"),
}

# The player's choices (also listed in app/play/hunters.ts for the picker).
HUNTERS = {
    "hunter-1": dict(skin="light", hair="short", hair_c=(150, 90, 50), top=(48, 160, 160), pants=(60, 62, 80), acc="lanyard"),
    "hunter-2": dict(skin="tan", hair="long", hair_c=(40, 32, 36), top=(196, 70, 70), pants=(54, 54, 70), acc="lanyard"),
    "hunter-3": dict(skin="deep", hair="curly", hair_c=(32, 26, 30), top=(232, 186, 70), pants=(58, 54, 74), acc="lanyard"),
    "hunter-4": dict(skin="brown", hair="bun", hair_c=(70, 44, 30), top=(120, 96, 200), pants=(52, 52, 72), acc="lanyard"),
    "hunter-5": dict(skin="light", hair="messy", hair_c=(236, 210, 140), top=(80, 140, 70), pants=(66, 58, 50), acc="lanyard"),
    "hunter-6": dict(skin="tan", hair="slick", hair_c=(200, 60, 120), top=(36, 36, 44), pants=(30, 30, 38), acc="lanyard"),
}


class Canvas:
    def __init__(self):
        self.im = Image.new("RGBA", (W, H), CLEAR)
        self.px = self.im.load()

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < W and 0 <= y < H:
                    self.px[x, y] = rgb(c)

    def dot(self, x, y, c):
        if 0 <= x < W and 0 <= y < H:
            self.px[x, y] = rgb(c)


def draw(p: dict, facing: str, step: int) -> Image.Image:
    """step: 0 idle, 1 left foot forward, 3 right foot forward."""
    c = Canvas()
    skin = SKIN[p["skin"]]
    hair = p["hair_c"]
    top, pants = p["top"], p["pants"]
    lift_l = 1 if step == 1 else 0  # the lifted foot is one pixel shorter
    lift_r = 1 if step == 3 else 0
    swing = {1: 1, 3: -1}.get(step, 0)

    # Legs and shoes (bottom at y=31).
    c.rect(5, 25, 6, 29 - lift_l, pants)
    c.rect(9, 25, 10, 29 - lift_r, pants)
    c.rect(5, 30 - lift_l, 6, 31 - lift_l, SHOE)
    c.rect(9, 30 - lift_r, 10, 31 - lift_r, SHOE)
    if facing in ("left", "right"):
        # Side view: legs overlap, one in front.
        c.rect(5, 25, 10, 31, CLEAR)
        front = 7 + swing if facing == "right" else 8 - swing
        back = 8 - swing if facing == "right" else 7 + swing
        c.rect(back, 25, back + 1, 30, shade(pants, 0.8))
        c.rect(back, 31, back + 1, 31, SHOE)
        c.rect(front, 25, front + 1, 30, pants)
        c.rect(front, 31, front + 2 if facing == "right" else front + 1, 31, SHOE)

    # Torso and arms.
    if facing in ("left", "right"):
        c.rect(6, 16, 10, 24, top)
        arm_x = 8 + (swing if facing == "right" else -swing)
        c.rect(arm_x, 17, arm_x, 23, shade(top, 0.82))
        c.dot(arm_x, 24, skin)
    else:
        c.rect(4, 16, 11, 24, top)
        c.rect(3, 17 + (swing if facing == "down" else -swing) * 0, 3, 23, shade(top, 0.82))
        c.rect(12, 17, 12, 23, shade(top, 0.82))
        c.dot(3, 24 - max(0, swing), skin)
        c.dot(12, 24 - max(0, -swing), skin)
    c.rect(7, 15, 8, 15, shade(skin, 0.9))  # neck

    # Head.
    hx0, hx1 = (5, 11) if facing in ("left", "right") else (4, 11)
    c.rect(hx0, 7, hx1, 14, skin)

    # Hair.
    style = p["hair"]
    if style != "bald":
        c.rect(hx0, 5, hx1, 7, hair)  # crown
        if facing == "up":
            c.rect(hx0, 5, hx1, 13, hair)  # back of the head
        elif facing == "down":
            c.rect(hx0, 8, hx0, 9, hair)
            c.rect(hx1, 8, hx1, 9, hair)
        else:  # side: hair at the back of the head
            back_x = hx0 if facing == "right" else hx1
            c.rect(back_x, 8, back_x + (1 if facing == "right" else -1), 12, hair)
        if style == "long":
            if facing == "up":
                c.rect(hx0, 5, hx1, 17, hair)
            elif facing == "down":
                c.rect(hx0 - 1, 8, hx0, 17, hair)
                c.rect(hx1, 8, hx1 + 1, 17, hair)
            else:
                bx = hx0 - 1 if facing == "right" else hx1 + 1
                c.rect(min(bx, bx + (2 if facing == "right" else -2)), 8, max(bx, bx + (2 if facing == "right" else -2)), 17, hair)
        elif style == "curly":
            c.rect(hx0 - 1, 4, hx1 + 1, 7, hair)
            c.rect(hx0 - 1, 8, hx0, 12, hair)
            c.rect(hx1, 8, hx1 + 1, 12, hair)
            if facing == "up":
                c.rect(hx0 - 1, 4, hx1 + 1, 13, hair)
        elif style == "bun":
            c.rect(6, 2, 9, 4, hair)
        elif style == "slick":
            c.rect(hx0, 5, hx1, 6, shade(hair, 1.25))
        elif style == "messy":
            c.dot(hx0 + 1, 4, hair)
            c.dot(hx0 + 4, 4, hair)
            c.dot(hx1, 4, hair)

    # Face.
    if facing == "down":
        c.dot(6, 10, EYE)
        c.dot(9, 10, EYE)
        c.dot(7, 12, shade(skin, 0.75))
        c.dot(8, 12, shade(skin, 0.75))
    elif facing == "right":
        c.dot(10, 10, EYE)
        c.dot(11, 12, shade(skin, 0.8))
    elif facing == "left":
        c.dot(5, 10, EYE)
        c.dot(4, 12, shade(skin, 0.8)) if False else c.dot(5, 12, shade(skin, 0.8))

    # Accessories.
    acc = p["acc"]
    gold = (240, 200, 80)
    if acc == "glasses" and facing != "up":
        if facing == "down":
            c.rect(5, 10, 7, 10, OUTLINE)
            c.rect(8, 10, 10, 10, OUTLINE)
            c.dot(6, 10, (190, 220, 240))
            c.dot(9, 10, (190, 220, 240))
        else:
            ex = 10 if facing == "right" else 5
            c.rect(ex - 1, 10, ex + 1, 10, OUTLINE)
    elif acc == "tie" and facing == "down":
        c.rect(7, 16, 8, 21, gold)
    elif acc == "headphones":
        c.rect(hx0, 4, hx1, 4, OUTLINE)
        if facing in ("down", "up"):
            c.rect(hx0 - 1, 8, hx0 - 1, 11, OUTLINE)
            c.rect(hx1 + 1, 8, hx1 + 1, 11, OUTLINE)
        else:
            c.rect(8, 8, 8, 11, OUTLINE)
    elif acc == "clipboard" and facing in ("down", "right"):
        x = 11 if facing == "down" else 10
        c.rect(x, 18, x + 2, 22, (196, 150, 90))
        c.rect(x, 18, x + 2, 18, (230, 230, 236))
    elif acc == "watch" and facing == "down":
        c.dot(12, 22, gold)
    elif acc == "pin" and facing == "down":
        c.dot(6, 18, gold)
    elif acc == "lanyard" and facing == "down":
        c.dot(6, 16, (220, 60, 60))
        c.dot(9, 16, (220, 60, 60))
        c.rect(7, 18, 8, 20, (60, 64, 76))  # the hardware wallet on its lanyard
        c.dot(7, 19, (120, 220, 160))

    return c.im


def sheet(p: dict) -> Image.Image:
    out = Image.new("RGBA", (W * 4, H * 4), CLEAR)
    for r, facing in enumerate(["down", "left", "right", "up"]):
        for f, step in enumerate([0, 1, 0, 3]):
            out.alpha_composite(draw(p, facing, step), (f * W, r * H))
    return out


def main() -> None:
    out_dir = Path(sys.argv[1])
    out_dir.mkdir(parents=True, exist_ok=True)
    every = {**PRESETS, **HUNTERS}
    for name, p in every.items():
        sheet(p).save(out_dir / f"{name}.png")
    # The default player sprite keeps its old name, so existing references still work.
    sheet(HUNTERS["hunter-1"]).save(out_dir / "hunter.png")
    print(f"wrote {len(every) + 1} sheets to {out_dir}")
    if len(sys.argv) > 2:
        S = 4
        names = list(every)
        prev = Image.new("RGBA", (len(names) * (W * 4 + 4) * S // 4 * 1, H * 4 * S // 4 * 1), (60, 60, 70, 255))
        prev = Image.new("RGBA", (len(names) * W * S + len(names) * 6, 4 * H * S), (60, 60, 70, 255))
        for i, n in enumerate(names):
            sh = Image.open(out_dir / f"{n}.png")
            for r in range(4):
                fr = sh.crop((W, r * H, 2 * W, (r + 1) * H)).resize((W * S, H * S), Image.NEAREST)
                prev.alpha_composite(fr, (i * (W * S + 6), r * H * S))
        prev.save(sys.argv[2])


if __name__ == "__main__":
    main()
