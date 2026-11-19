"""Builds the walking sprites from the dialogue-box portraits, so a character looks the same on the floor
as in the dialogue box: the portrait's head (hair, face, accessories), halved with a majority filter, on a
small walking body in the portrait's outfit colour. Hunters (no portraits) get heads in the same style.

    npx tsx --tsconfig tsconfig.json tools/art/export_portraits.tsx /tmp/portraits.json
    python3 -I tools/art/portrait_sprites.py /tmp/portraits.json public/sprites [preview.png]

Sheet format (engine): 4 rows (down, left, right, up) x 4 frames of 16x32, bottom-aligned; frame 0 idle,
frames 1 and 3 walk.
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path

from PIL import Image, ImageOps

FW, FH = 16, 32
CLEAR = (0, 0, 0, 0)
SHOE = (40, 36, 46, 255)
RECT = re.compile(r'<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="(#[0-9a-fA-F]{6})"')


def hex_rgba(h: str):
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + (255,)


def raster(svg: str) -> Image.Image:
    """The 32x32 portrait as pixels; the first full-size rect (the backdrop) becomes transparent."""
    im = Image.new("RGBA", (32, 32), CLEAR)
    px = im.load()
    rects = [(int(x), int(y), int(w), int(h), hex_rgba(f)) for x, y, w, h, f in RECT.findall(svg)]
    for i, (x, y, w, h, c) in enumerate(rects):
        if i == 0 and w == 32 and h == 32:
            continue  # backdrop
        for yy in range(y, min(32, y + h)):
            for xx in range(x, min(32, x + w)):
                px[xx, yy] = c
    return im


def halve(im: Image.Image) -> Image.Image:
    """32x32 -> 16x16, each 2x2 block keeps its most common opaque colour (dark details win ties)."""
    out = Image.new("RGBA", (16, 16), CLEAR)
    src, dst = im.load(), out.load()
    for y in range(16):
        for x in range(16):
            block = [src[2 * x + dx, 2 * y + dy] for dy in (0, 1) for dx in (0, 1)]
            solid = [b for b in block if b[3] > 0]
            if len(solid) < 2:
                continue
            counts = Counter(solid).most_common()
            top = counts[0][1]
            ties = [c for c, n in counts if n == top]
            dst[x, y] = min(ties, key=lambda c: sum(c[:3]))  # keep eyes and outlines
    return out


def dominant(im: Image.Image, box) -> tuple:
    x0, y0, x1, y1 = box
    px = im.load()
    cs = [px[x, y] for y in range(y0, y1) for x in range(x0, x1) if px[x, y][3] > 0]
    return Counter(cs).most_common(1)[0][0] if cs else (90, 90, 110, 255)


def fix_eyes(head: Image.Image, skin) -> Image.Image:
    """Collapse wide dark runs on the eye row to single pixels so halved portraits don't get a dash eye."""
    out = head.copy()
    px = out.load()
    w, h = out.size
    # Eye row is usually just under the hairline in the cropped head.
    for y in range(2, min(8, h)):
        dark = [x for x in range(w) if px[x, y][3] > 0 and sum(px[x, y][:3]) < 160]
        if len(dark) < 2:
            continue
        # Group into runs; keep the center pixel of each run, restore skin elsewhere.
        runs, start = [], dark[0]
        for i in range(1, len(dark)):
            if dark[i] != dark[i - 1] + 1:
                runs.append((start, dark[i - 1]))
                start = dark[i]
        runs.append((start, dark[-1]))
        if not any(b > a for a, b in runs):
            continue
        eye = min((px[x, y] for x in dark), key=lambda c: sum(c[:3]))
        for a, b in runs:
            for x in range(a, b + 1):
                px[x, y] = skin
            px[(a + b) // 2, y] = eye
        break
    return out


def head_from_portrait(im32: Image.Image):
    """Returns (head16, skin, hair, outfit): the head rows of the halved portrait, cropped to its width."""
    small = halve(im32)
    # The neck/shoulders start where the portrait's outfit begins; heads end around row 11 of 16.
    head = small.crop((0, 0, 16, 11))
    bbox = head.getbbox() or (4, 0, 12, 11)
    head = head.crop((bbox[0], 0, bbox[2], 11))
    skin = dominant(im32, (12, 11, 20, 17))
    hair = dominant(im32, (8, 2, 24, 6))
    outfit = dominant(im32, (8, 25, 24, 32))
    head = fix_eyes(head, skin)
    return head, skin, hair, outfit


# Hunters: no portrait, so a head drawn in the same halved style. hair: short | long | curly | bun | slick | messy
# Hunters: no portrait, so heads drawn in the same halved style. Eight player looks spanning skin tones
# (light to deep) and gender presentations, plus two streak rewards (hunter-1, hunter-5).
# hair: short | long | curly | bun | slick | messy | buzz | afro | braids | hijab; extras: beard, glasses, dress,
# hat (turkey | santa: the seasonal-case hunters).
HUNTERS = {
    "hunter-1": dict(skin=(240, 200, 168), hair="short", hair_c=(150, 90, 50), outfit=(48, 160, 160)),
    "hunter-2": dict(skin=(226, 176, 132), hair="long", hair_c=(40, 32, 36), outfit=(196, 70, 70), dress=True),
    "hunter-3": dict(skin=(92, 58, 40), hair="afro", hair_c=(26, 22, 24), outfit=(232, 186, 70), beard=True),
    "hunter-4": dict(skin=(160, 108, 72), hair="hijab", hair_c=(60, 70, 140), outfit=(120, 96, 200), dress=True),
    "hunter-5": dict(skin=(240, 200, 168), hair="messy", hair_c=(236, 210, 140), outfit=(80, 140, 70)),
    "hunter-6": dict(skin=(214, 164, 118), hair="slick", hair_c=(200, 60, 120), outfit=(36, 36, 44)),
    "hunter-7": dict(skin=(247, 214, 186), hair="short", hair_c=(120, 70, 40), outfit=(70, 120, 70), beard=True),
    "hunter-8": dict(skin=(110, 70, 46), hair="braids", hair_c=(30, 24, 28), outfit=(40, 140, 150), dress=True),
    "hunter-9": dict(skin=(238, 204, 160), hair="bun", hair_c=(28, 24, 30), outfit=(110, 110, 120)),
    "hunter-10": dict(skin=(176, 118, 80), hair="buzz", hair_c=(170, 170, 176), outfit=(200, 110, 60), glasses=True),
    # Seasonal-case rewards (app/play/unlocks.ts): Thanksgiving's turkey hat, the winter holidays' Santa hat.
    "hunter-11": dict(skin=(214, 164, 118), hair="short", hair_c=(90, 56, 34), outfit=(196, 110, 46), hat="turkey"),
    "hunter-12": dict(skin=(120, 78, 52), hair="short", hair_c=(30, 24, 28), outfit=(40, 120, 70), hat="santa", beard=True),
}


def drawn_head(p: dict) -> Image.Image:
    skin, hair = p["skin"] + (255,), p["hair_c"] + (255,)
    im = Image.new("RGBA", (10, 11), CLEAR)
    px = im.load()

    def rect(x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < 10 and 0 <= y < 11:
                    px[x, y] = c

    rect(2, 3, 7, 10, skin)  # face
    rect(1, 1, 8, 3, hair)  # crown
    rect(1, 3, 1, 6, hair)
    rect(8, 3, 8, 6, hair)
    style = p["hair"]
    if style == "long":
        rect(0, 3, 1, 10, hair)
        rect(8, 3, 9, 10, hair)
    elif style == "curly":
        rect(0, 0, 9, 3, hair)
        rect(0, 3, 1, 8, hair)
        rect(8, 3, 9, 8, hair)
    elif style == "bun":
        rect(3, 0, 6, 0, hair)
    elif style == "slick":
        rect(1, 1, 8, 1, shade(hair, 1.25))
    elif style == "messy":
        px[2, 0] = hair
        px[5, 0] = hair
        px[8, 0] = hair
    elif style == "buzz":
        rect(1, 1, 8, 1, CLEAR)  # close crop: only a thin band of hair
        rect(1, 3, 1, 6, skin)
        rect(8, 3, 8, 6, skin)
        rect(2, 2, 7, 2, hair)
        rect(2, 3, 7, 3, skin)
        rect(2, 3, 2, 3, hair)
        rect(7, 3, 7, 3, hair)
    elif style == "afro":
        rect(0, 0, 9, 4, hair)
        rect(0, 4, 1, 7, hair)
        rect(8, 4, 9, 7, hair)
        px[0, 0] = px[9, 0] = CLEAR
    elif style == "braids":
        rect(0, 3, 1, 10, hair)
        rect(8, 3, 9, 10, hair)
        bead = (220, 180, 60, 255)
        for y in (5, 8):
            px[0, y] = px[9, y] = bead
    elif style == "hijab":
        rect(0, 0, 9, 3, hair)  # the scarf frames the face and falls to the shoulders
        rect(0, 3, 1, 10, hair)
        rect(8, 3, 9, 10, hair)
        rect(1, 1, 8, 1, shade(hair, 1.2))
    hat = p.get("hat")
    if hat == "turkey":  # a roast-turkey hat: a golden-brown dome with drumstick bones poking out the sides
        roast, glaze = (176, 104, 44, 255), (214, 150, 70, 255)
        rect(1, 0, 8, 3, roast)
        rect(2, 0, 7, 0, glaze)
        rect(3, 1, 4, 1, glaze)
        px[0, 2] = px[9, 2] = (244, 236, 220, 255)  # the bones
        px[0, 1] = px[9, 1] = (244, 236, 220, 255)
        rect(1, 3, 8, 3, shade(roast, 0.8))
    elif hat == "santa":  # a red Santa hat with a white trim and pompom
        red, white = (200, 40, 44, 255), (244, 244, 240, 255)
        rect(1, 1, 8, 2, red)
        rect(3, 0, 7, 0, red)
        px[8, 0] = px[9, 0] = white
        rect(1, 3, 8, 3, white)
    eye = (30, 26, 34, 255)
    px[3, 6] = eye
    px[6, 6] = eye
    px[4, 8] = shade(skin, 0.75)
    px[5, 8] = shade(skin, 0.75)
    if p.get("beard"):
        rect(2, 8, 7, 10, hair)
        rect(2, 7, 2, 7, hair)
        rect(7, 7, 7, 7, hair)
        px[4, 8] = px[5, 8] = shade(skin, 0.75)  # the mouth shows through
    if p.get("glasses"):
        frame = (30, 30, 36, 255)
        for x in (2, 3, 4, 5, 6, 7):
            px[x, 5] = frame
        px[3, 6] = px[6, 6] = (140, 180, 210, 255)
    return im


def back_of(head: Image.Image, skin, hair) -> Image.Image:
    """The back of the head: face pixels become hair (anything darker than the skin stays hair too)."""
    out = head.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            c = px[x, y]
            # The top rows keep what's drawn there that isn't skin (hair, or a hat), so hats show from behind.
            if y <= 3 and c[3] > 0 and c[:3] != tuple(skin[:3]):
                continue
            if c[3] > 0 and y >= 1:
                px[x, y] = hair
    return out


def frame(head: Image.Image, outfit, facing: str, step: int, skin, dress: bool = False) -> Image.Image:
    f = Image.new("RGBA", (FW, FH), CLEAR)
    px = f.load()
    pants = shade(outfit, 0.55)
    arm = shade(outfit, 0.8)

    def rect(x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < FW and 0 <= y < FH:
                    px[x, y] = c

    lift_l = 1 if step == 1 else 0
    lift_r = 1 if step == 3 else 0
    if facing in ("down", "up"):
        rect(5, 20, 10, 26, outfit)  # body, 6 px wide
        rect(4, 21, 4, 25 + lift_r, arm)  # arms swing opposite the legs
        rect(11, 21, 11, 25 + lift_l, arm)
        px[4, 26 + lift_r] = skin
        px[11, 26 + lift_l] = skin
        rect(5, 27, 6, 30 - lift_l, pants)
        rect(9, 27, 10, 30 - lift_r, pants)
        rect(5, 31 - lift_l, 6, 31 - lift_l, SHOE)
        rect(9, 31 - lift_r, 10, 31 - lift_r, SHOE)
    else:
        rect(6, 20, 9, 26, outfit)  # side: narrower
        swing = {1: 1, 3: -1}.get(step, 0) * (1 if facing == "right" else -1)
        rect(7 + swing, 21, 8 + swing, 25, arm)
        px[7 + swing, 26] = skin
        front = 7 + swing
        back = 8 - swing
        rect(back, 27, back, 30, shade(pants, 0.8))
        rect(front, 27, front + 1, 30, pants)
        rect(min(front, back), 31, max(front, back) + 1, 31, SHOE)

    if dress:  # a skirt over the top of the legs
        if facing in ("down", "up"):
            rect(4, 26, 11, 28, outfit)
        else:
            rect(5, 26, 10, 28, outfit)

    # Head: bottom-aligned on the body (overlaps the neck by a pixel), centred.
    hx = (FW - head.width) // 2
    hy = 21 - head.height
    f.alpha_composite(head, (hx, hy))
    return f


def sheet(head: Image.Image, skin, hair, outfit, dress: bool = False) -> Image.Image:
    side = head  # the halved portraits face forward; a profile at this size reads the same
    heads = {"down": head, "left": ImageOps.mirror(side), "right": side, "up": back_of(head, skin, hair)}
    out = Image.new("RGBA", (FW * 4, FH * 4), CLEAR)
    for r, facing in enumerate(["down", "left", "right", "up"]):
        for c, step in enumerate([0, 1, 0, 3]):
            out.alpha_composite(frame(heads[facing], outfit, facing, step, skin, dress), (c * FW, r * FH))
    return out


def main() -> None:
    portraits = json.loads(Path(sys.argv[1]).read_text())
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    built = {}
    for cid, svg in portraits.items():
        if cid == "krystal":
            continue  # she never walks the floors
        head, skin, hair, outfit = head_from_portrait(raster(svg))
        built[cid] = sheet(head, skin, hair, outfit)
    for hid, p in HUNTERS.items():
        built[hid] = sheet(drawn_head(p), p["skin"] + (255,), p["hair_c"] + (255,), p["outfit"] + (255,), p.get("dress", False))
    for name, im in built.items():
        im.save(out_dir / f"{name}.png")
    built["hunter-2"].save(out_dir / "hunter.png")  # the default look (app/play/hunters.ts)
    print(f"wrote {len(built) + 1} sheets to {out_dir}")

    if len(sys.argv) > 3:
        S = 5
        names = list(built)
        prev = Image.new("RGBA", (len(names) * (FW * S + 8), 4 * FH * S), (60, 60, 70, 255))
        for i, n in enumerate(names):
            for r in range(4):
                fr = built[n].crop((FW, r * FH, 2 * FW, (r + 1) * FH)).resize((FW * S, FH * S), Image.NEAREST)
                prev.alpha_composite(fr, (i * (FW * S + 8), r * FH * S))
        prev.save(sys.argv[3])


if __name__ == "__main__":
    main()
