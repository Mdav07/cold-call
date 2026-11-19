"""Holiday art for the seasonal cases, drawn the way tools/art/harvest_tiles.py drew Thanksgiving's.

Per holiday key (hanukkah, christmas, lunar, valentine, easter, pride, july4, halloween, diwali):
  room:  floor_<k>, wall_<k>, walltop_<k>, window_<k>, board_<k>, station_<k>, station_note_<k>,
         three decor pieces <thing>_<k> and seat_<k>
  lobby: door_<k> (the Daily's door re-dressed), mat_<k>, two dressing pieces <thing>_<k> (the first sits
         beside the reception desk, the second in the floor corners) and garland_<k> (hung over the back wall)

Appends the tiles (or redraws them in place when they exist), so no existing index moves. Idempotent.

    python3 -I tools/art/holiday_tiles.py public/tiles/plumpurse.png app/floor/maps/tiles.json

Writes tools/art/holiday_themes.json too: each key's "tiles" block (the content/daily/themes.json shape) plus
its door, mat, lobby dressing and garland names, for content/seasonal/seasons.json.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from door_mats import append_or_replace  # noqa: E402
from theme_tiles import T, Tile, armchair, board_on, darker, floor_checker, floor_noise, floor_planks, floor_squares, lighter, station, wall, walltop, window_on, with_note  # noqa: E402

Color = tuple[int, int, int]

WHITE = (244, 242, 236)
INK = (40, 34, 44)
GOLD = (226, 184, 72)
FLAME = (252, 206, 84)
FLAME_HI = (255, 244, 190)
LEAF = (70, 140, 70)
RAINBOW = [(220, 64, 60), (236, 140, 48), (240, 206, 70), (80, 166, 84), (64, 112, 200), (128, 76, 168)]


# ---------- small helpers ----------
def _tile(draw) -> Tile:
    t = Tile()
    draw(t)
    return t


def copy(src: Tile) -> Tile:
    t = Tile()
    t.im = src.im.copy()
    t.px = t.im.load()
    return t


def oval(t: Tile, cx: float, cy: float, rx: float, ry: float, c: Color):
    for y in range(T):
        for x in range(T):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                t.put(x, y, c)


def heart(t: Tile, x0: int, y0: int, c: Color, big: bool = False):
    rows = ([".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."] if big
            else [".#.#.", "#####", ".###.", "..#.."])
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch == "#":
                t.put(x0 + dx, y0 + dy, c)


def flame(t: Tile, x: int, y: int):
    t.put(x, y, FLAME), t.put(x, y - 1, FLAME_HI)


def stripe_swag(t: Tile, sag: list[int], string: Color):
    for x, y in enumerate(sag):
        t.put(x, y, string)


SAG = [3, 3, 4, 4, 5, 5, 5, 6, 6, 5, 5, 5, 4, 4, 3, 3]  # one droop per tile, so tiles join up (harvest's)


def pennants(t: Tile, colors: list[Color], string: Color, xs=(1, 5, 9, 13)):
    stripe_swag(t, SAG, string)
    for i, x in enumerate(xs):
        c = colors[i % len(colors)]
        y = max(SAG[x], SAG[x + 1]) + 1
        t.rect(x, y, x + 1, y, c), t.rect(x, y + 1, x + 1, y + 1, darker(c, 0.88)), t.put(x, y + 2, darker(c, 0.8))
        t.put(x + 2, y, c) if x + 2 < T else None


def shelf_frame(t: Tile, wood: Color, x0=1, x1=14, y0=1, y1=14):
    t.box(x0, y0, x1, y1, darker(wood, 0.8), darker(wood, 0.6))
    t.shadow(x0, x1)


def recolor_crop(sheet: Image.Image, catalog: dict, name: str) -> Image.Image:
    cols = catalog["columns"]
    i = catalog["tiles"][name]["index"]
    return sheet.crop(((i % cols) * T, (i // cols) * T, (i % cols) * T + T, (i // cols) * T + T)).copy()


def door_from(sheet: Image.Image, catalog: dict, paint: Color | None, motif) -> Image.Image:
    """The Daily's mahogany door (door_wood). With paint, the wood panels are repainted (shade kept); the brass
    plate is cleared to the door colour and motif(px) draws the holiday dressing on it."""
    im = recolor_crop(sheet, catalog, "door_wood")
    px = im.load()
    for y in range(T):
        for x in range(T):
            r, g, b, a = px[x, y]
            if a and r < 130 and r > g > b:  # the wood (the frame and brass are brighter)
                if paint:
                    k = r / 112
                    px[x, y] = tuple(min(255, int(v * k)) for v in paint) + (a,)
    body = px[7, 4]
    for y in range(T):  # the brass plate at the top goes, so the dressing has room
        for x in range(4, 12):
            if y <= 2 and px[x, y][:3] in ((222, 184, 98), (156, 118, 52)):
                px[x, y] = body
    motif(px)
    return im


def mat_from(sheet: Image.Image, catalog: dict, field: Color | None = None, rows: list[Color] | None = None) -> Image.Image:
    """The Daily mat (mat_daily) recoloured: the purple field becomes field (or a colour per row), shade kept;
    the gold frame and the carpet stay."""
    im = recolor_crop(sheet, catalog, "mat_daily")
    px = im.load()
    for y in range(T):
        for x in range(T):
            r, g, b, a = px[x, y]
            if a and b > r and b > g:  # the purple field and its dark edge
                k = (r + g + b) / (76 + 38 + 96)
                c = rows[(y - 2) % len(rows)] if rows else field
                px[x, y] = tuple(min(255, int(v * k)) for v in c) + (a,)  # type: ignore[union-attr]
    return im


def P(c: Color):
    return c + (255,)


# ======================================================================================================
# Hanukkah: a blue-and-silver deli.
# ======================================================================================================
def hanukkah():
    BLUE, NAVY, SILVER, SILVER_LO = (62, 104, 178), (34, 58, 108), (200, 208, 220), (150, 160, 178)
    w = wall(BLUE, NAVY, wainscot=(186, 196, 212))
    for x in range(0, 16, 4):  # a silver picture rail with studs
        w.put(x + 1, 3, SILVER)
    w.rect(0, 4, 15, 4, SILVER_LO)

    def menorah(t: Tile, x0: int, y0: int, metal: Color = SILVER):
        """Nine lights over 11 px: four candles, a gap, the raised shamash, a gap, four candles. Neighbouring
        candles and flames alternate shade so each light reads on its own."""
        for i, x in enumerate((0, 1, 2, 3, 7, 8, 9, 10)):
            c = WHITE if i % 2 == 0 else (196, 204, 222)
            t.put(x0 + x, y0 + 3, c), t.put(x0 + x, y0 + 4, c)
            t.put(x0 + x, y0 + 2, FLAME if i % 2 == 0 else (244, 150, 50))
        t.rect(x0 + 5, y0 + 1, x0 + 5, y0 + 4, WHITE), t.put(x0 + 5, y0, FLAME), t.put(x0 + 5, y0 - 1, FLAME_HI)
        t.rect(x0, y0 + 5, x0 + 10, y0 + 5, metal)
        t.rect(x0 + 5, y0 + 6, x0 + 5, y0 + 7, metal)
        t.rect(x0 + 3, y0 + 8, x0 + 7, y0 + 8, darker(metal, 0.8))

    def window(t_wall: Tile) -> Tile:
        t = copy(t_wall)
        t.box(1, 2, 14, 11, (34, 44, 88), NAVY)
        t.put(3, 3, (210, 220, 240)), t.put(12, 4, (210, 220, 240)), t.put(10, 3, (160, 176, 220))  # stars
        menorah(t, 3, 3)
        t.rect(2, 10, 13, 10, SILVER_LO)  # sill inside
        return t

    def menu(t: Tile):  # a deli menu board with a little dreidel
        t.rect(4, 4, 6, 6, SILVER), t.put(5, 3, SILVER), t.put(5, 7, SILVER), t.put(5, 5, BLUE)
        for y in (4, 6, 8, 10):
            t.rect(8, y, 11, y, (190, 200, 214))
        t.rect(4, 10, 6, 10, (190, 200, 214))

    def latkes(t: Tile):
        t.rect(2, 3, 6, 5, WHITE), t.rect(3, 3, 5, 4, (204, 150, 70)), t.put(4, 3, (226, 180, 96))  # latkes
        t.rect(11, 2, 13, 5, (232, 222, 196)), t.rect(11, 2, 13, 2, (200, 170, 120))  # applesauce cup

    def dreidel(t: Tile, x: int, y: int, c: Color):
        t.rect(x, y + 1, x + 2, y + 3, c), t.put(x + 1, y, SILVER), t.put(x + 1, y + 4, darker(c, 0.7))
        t.put(x + 1, y + 2, WHITE)

    def dreidel_shelf(t: Tile):
        shelf_frame(t, (150, 160, 178))
        t.rect(2, 7, 13, 7, darker(SILVER_LO, 0.8))
        for i, c in enumerate([BLUE, SILVER_LO, (90, 140, 210), BLUE]):
            dreidel(t, 2 + i * 3, 2, c)
        for i, c in enumerate([(90, 140, 210), BLUE, SILVER_LO, (90, 140, 210)]):
            dreidel(t, 2 + i * 3, 8, c)

    def doughnut_case(t: Tile):
        t.rect(1, 4, 14, 14, NAVY), t.rect(1, 11, 14, 11, darker(NAVY, 0.8))
        t.box(2, 4, 13, 10, (206, 226, 238), SILVER_LO)
        for x, y in ((3, 6), (7, 6), (5, 8), (9, 8), (10, 6)):
            t.rect(x, y, x + 2, y + 1, (206, 146, 70)), t.put(x + 1, y, (190, 40, 50)), t.put(x, y, (246, 240, 230))
        t.put(4, 5, WHITE), t.put(5, 5, WHITE)
        t.shadow(1, 14)

    def gelt(t: Tile):  # a silver bowl of gold-foil coins on a little stand
        oval(t, 7.5, 5.5, 5, 2.4, GOLD)
        for x, y in ((5, 4), (8, 4), (10, 5), (6, 6)):
            t.put(x, y, (250, 224, 130))
        t.rect(2, 7, 13, 8, SILVER), t.rect(3, 9, 12, 9, SILVER_LO)
        t.rect(7, 10, 8, 13, SILVER_LO), t.rect(4, 14, 11, 14, darker(SILVER_LO, 0.8))
        t.shadow(4, 11)

    def booth(t: Tile):
        c = (56, 98, 182)
        t.rect(2, 1, 13, 8, c), t.rect(2, 1, 13, 1, SILVER), t.rect(2, 1, 2, 8, SILVER), t.rect(13, 1, 13, 8, SILVER)
        for x in (5, 8, 11):
            t.rect(x, 2, x, 7, darker(c, 0.85))  # tufts
        t.rect(2, 9, 13, 11, lighter(c, 0.2)), t.rect(2, 9, 13, 9, darker(c, 0.8))
        t.rect(2, 12, 13, 13, NAVY), t.rect(3, 14, 3, 14, INK), t.rect(12, 14, 12, 14, INK)

    def menorah_stand(t: Tile):  # lobby: a lit menorah on a pedestal
        menorah(t, 2, 2)
        t.rect(5, 10, 10, 10, SILVER), t.rect(6, 11, 9, 13, (236, 238, 242)), t.rect(5, 14, 10, 14, SILVER_LO)
        t.shadow(5, 10)

    def big_dreidel(t: Tile):  # lobby: a giant dreidel display
        t.rect(4, 3, 11, 10, BLUE), t.rect(4, 3, 11, 3, lighter(BLUE, 0.3)), t.rect(11, 4, 11, 10, NAVY)
        t.rect(7, 0, 8, 2, SILVER)
        for x, y in ((5, 11), (6, 12), (7, 13), (8, 13), (9, 12), (10, 11)):
            t.rect(x, y, 15 - x, y, BLUE) if x <= 7 else None
        t.rect(5, 11, 10, 11, BLUE), t.rect(6, 12, 9, 12, NAVY), t.rect(7, 13, 8, 13, NAVY)
        t.rect(6, 5, 9, 5, SILVER), t.rect(8, 5, 8, 8, SILVER), t.rect(6, 8, 9, 8, SILVER)  # a silver letter-ish mark
        t.shadow(4, 11)

    def garland(t: Tile):
        pennants(t, [BLUE, WHITE, SILVER_LO, (110, 150, 220)], (170, 178, 196))

    def door_motif(px):
        x0, y0 = 2, 1  # a small silver menorah: four lights, a gap, the raised shamash, a gap, four lights
        for i, x in enumerate((0, 1, 2, 3, 8, 9, 10, 11)):
            px[x0 + x, y0 + 1] = P(FLAME if i % 2 == 0 else (244, 150, 50))
            px[x0 + x, y0 + 2] = P(WHITE if i % 2 == 0 else (196, 204, 222))
        for dx in (5, 6):
            px[x0 + dx, y0] = P(FLAME)
            px[x0 + dx, y0 + 1] = P(WHITE)
            px[x0 + dx, y0 + 2] = P(WHITE)
            px[x0 + dx, y0 + 4] = P(SILVER)
        for x in range(12):
            px[x0 + x, y0 + 3] = P(SILVER)

    st = station((222, 228, 236), BLUE, NAVY, latkes)
    room = [
        ("floor", floor_checker((214, 222, 236), (196, 206, 224)), "ground"),
        ("wall", w, "wall"),
        ("walltop", walltop(), "wall"),
        ("window", window(w), "wall"),
        ("board", board_on(w, SILVER_LO, (28, 40, 74), menu), "wall"),
        ("station", st, "block"),
        ("station_note", with_note(st), "block"),
        ("dreidel_shelf", _tile(dreidel_shelf), "block"),
        ("doughnut_case", _tile(doughnut_case), "block"),
        ("gelt", _tile(gelt), "block"),
        ("seat", _tile(booth), "walk"),
    ]
    lobby = [("menorah", _tile(menorah_stand)), ("big_dreidel", _tile(big_dreidel))]
    return room, lobby, _tile(garland), ((40, 76, 150), door_motif), {"field": (54, 96, 176)}


# ======================================================================================================
# Christmas: a cozy toy-drive warehouse.
# ======================================================================================================
def christmas():
    BRICK, GREEN, RED, PINE = (150, 50, 42), (40, 96, 58), (196, 44, 44), (52, 120, 64)
    w = wall(BRICK, (60, 44, 36), brick=True)
    w.rect(0, 13, 15, 13, (84, 60, 44))

    def wreath(t: Tile, cx: int, cy: int, r: float = 3.2):
        for y in range(T):
            for x in range(T):
                d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                if r - 1.6 <= d <= r + 0.6:
                    t.put(x, y, PINE if (x + y) % 3 else (34, 92, 48))
        for x, y in ((cx - 3, cy - 1), (cx + 2, cy - 2), (cx + 3, cy + 1), (cx - 2, cy + 2)):
            t.put(x, y, (230, 60, 60))  # berries
        t.rect(cx - 1, cy + 3, cx + 1, cy + 3, RED), t.put(cx - 2, cy + 4, RED), t.put(cx + 2, cy + 4, RED)  # bow

    def window(t_wall: Tile) -> Tile:
        t = window_on(t_wall, (90, 60, 40), sky=(184, 204, 230))
        t.rect(4, 9, 11, 9, WHITE)  # snow on the sill
        wreath(t, 8, 5)
        return t

    def tally(t: Tile):  # toy-drive tally on a cream board
        t.rect(4, 4, 6, 6, RED), t.rect(5, 4, 5, 6, GOLD), t.rect(4, 5, 6, 5, GOLD)  # a gift
        for y in (4, 6, 8, 10):
            t.rect(8, y, 11, y, (150, 130, 110))
        for y in (8, 10):
            t.put(4, y, GREEN), t.put(5, y + 1, GREEN), t.put(6, y, GREEN)  # ticks

    def packing(t: Tile):
        t.rect(2, 2, 6, 5, (60, 120, 200)), t.rect(4, 2, 4, 5, GOLD), t.rect(2, 3, 6, 3, GOLD)  # a gift
        t.rect(11, 3, 13, 5, RED), t.rect(11, 4, 13, 4, (240, 220, 220))  # ribbon roll

    def gift(t: Tile, x0, y0, x1, y1, c: Color, ribbon: Color):
        t.rect(x0, y0, x1, y1, c), t.rect(x0, y0, x1, y0, lighter(c, 0.2))
        mx = (x0 + x1) // 2
        t.rect(mx, y0, mx, y1, ribbon), t.rect(x0, (y0 + y1) // 2, x1, (y0 + y1) // 2, ribbon)
        t.put(mx - 1, y0 - 1, ribbon), t.put(mx + 1, y0 - 1, ribbon)

    def tree(t: Tile):
        for i, (y, half) in enumerate(((1, 0), (2, 1), (3, 1), (4, 2), (5, 3), (6, 2), (7, 3), (8, 4), (9, 5), (10, 6))):
            t.rect(7 - half, y, 8 + half, y, PINE)
            t.put(8 + half, y, (34, 92, 48))
        t.put(7, 0, GOLD), t.put(8, 0, GOLD), t.put(7, 1, (250, 220, 110))  # star
        for x, y, c in ((6, 4, RED), (9, 5, GOLD), (5, 7, (80, 140, 220)), (10, 8, RED), (7, 9, GOLD), (4, 9, GOLD), (8, 6, (240, 240, 240))):
            t.put(x, y, c)
        t.rect(7, 11, 8, 11, (110, 70, 40))
        gift(t, 2, 12, 5, 14, RED, GOLD), gift(t, 10, 12, 13, 14, (60, 120, 200), WHITE), gift(t, 6, 13, 9, 14, GOLD, RED)
        t.shadow(2, 13)

    def gifts(t: Tile):
        gift(t, 1, 9, 7, 14, RED, GOLD)
        gift(t, 8, 8, 14, 14, GREEN, (240, 220, 220))
        gift(t, 3, 3, 10, 8, (70, 130, 206), RED)
        gift(t, 10, 4, 13, 7, GOLD, GREEN)
        t.shadow(1, 14)

    def sleigh(t: Tile):
        body = (186, 40, 40)
        t.rect(2, 7, 12, 11, body), t.rect(2, 7, 12, 7, lighter(body, 0.2))
        t.rect(12, 4, 13, 10, body), t.put(13, 3, body), t.put(14, 3, GOLD)  # the curled front
        t.rect(3, 9, 11, 9, GOLD)
        t.rect(2, 13, 14, 13, GOLD), t.put(1, 12, GOLD), t.put(15, 12, GOLD)  # runners
        t.put(4, 12, (150, 120, 60)), t.put(10, 12, (150, 120, 60))
        oval(t, 6, 5, 4, 2.6, (186, 150, 100))  # a sack of toys
        t.put(4, 3, (90, 160, 230)), t.put(7, 2, GOLD), t.put(8, 3, (90, 200, 120)), t.put(6, 3, RED)
        t.shadow(1, 15)

    def poinsettia(t: Tile):  # lobby, by the desk
        t.rect(5, 10, 10, 14, GOLD), t.rect(5, 10, 10, 10, lighter(GOLD, 0.3)), t.rect(6, 15, 9, 15, darker(GOLD))
        for x, y in ((4, 6), (7, 4), (10, 6), (5, 8), (9, 8), (7, 7), (3, 8), (11, 8)):
            t.rect(x, y, x + 1, y + 1, RED if (x + y) % 2 else (220, 60, 60))
        for x, y in ((3, 9), (12, 9), (6, 9), (9, 9)):
            t.put(x, y, PINE)
        t.put(7, 6, GOLD), t.put(8, 6, GOLD)

    def toybin(t: Tile):  # lobby corner: a toy-drive donation bin
        t.rect(2, 7, 13, 14, (176, 134, 84)), t.rect(2, 7, 13, 7, (200, 160, 110))
        t.rect(2, 10, 13, 11, RED), t.rect(6, 10, 9, 11, WHITE)
        t.rect(3, 3, 5, 6, (90, 160, 230)), t.put(4, 2, (90, 160, 230))  # a toy robot-ish block
        t.rect(9, 4, 12, 6, GREEN), t.put(9, 7, INK), t.put(12, 7, INK)  # toy truck
        oval(t, 7, 5, 1.5, 1.5, (210, 160, 100)), t.put(6, 3, (210, 160, 100)), t.put(8, 3, (210, 160, 100))  # bear
        t.shadow(2, 13)

    def garland(t: Tile):
        for x, y in enumerate(SAG):
            t.put(x, y, PINE), t.put(x, y + 1, (34, 92, 48))
            t.put(x, y - 1, PINE) if x % 2 else None
        for x, c in ((2, RED), (6, GOLD), (10, RED), (14, (80, 140, 220))):
            t.rect(x, SAG[x] + 2, x, SAG[x] + 3, c)
        for x in (0, 4, 8, 12):
            t.put(x, SAG[x] - 1, FLAME_HI)

    def door_motif(px):
        cx, cy = 7.5, 4.5
        for y in range(9):
            for x in range(16):
                d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                if 2.0 <= d <= 3.5:
                    px[x, y] = P(PINE if (x + y) % 3 else (74, 160, 82))
        for x, y in ((5, 3), (10, 4), (6, 7)):
            px[x, y] = P((230, 60, 60))
        for x, y in ((7, 7), (8, 7), (6, 8), (9, 8)):
            px[x, y] = P(RED)

    st = station((196, 160, 110), (128, 86, 52), (88, 58, 36), packing)
    room = [
        ("floor", floor_squares((178, 168, 154), (164, 154, 140), 1225), "ground"),  # warehouse slabs
        ("wall", w, "wall"),
        ("walltop", walltop(), "wall"),
        ("window", window(w), "wall"),
        ("board", board_on(w, GREEN, (236, 226, 204), tally), "wall"),
        ("station", st, "block"),
        ("station_note", with_note(st), "block"),
        ("tree", _tile(tree), "block"),
        ("gifts", _tile(gifts), "block"),
        ("sleigh", _tile(sleigh), "block"),
        ("seat", armchair(GREEN, (110, 66, 40)), "walk"),
    ]
    lobby = [("poinsettia", _tile(poinsettia)), ("toybin", _tile(toybin))]
    return room, lobby, _tile(garland), ((36, 82, 54), door_motif), {"field": (40, 110, 64)}


# ======================================================================================================
# Lunar New Year: a red-and-gold banquet hall.
# ======================================================================================================
def lunar():
    RED, DEEP, GOLD_L, LACQ = (186, 40, 36), (110, 22, 24), (230, 180, 60), (96, 32, 30)
    w = wall(RED, (70, 20, 20), wainscot=(120, 30, 28))
    w.rect(0, 9, 15, 9, GOLD_L)
    for x in (2, 7, 12):  # gold fretwork studs on the dado
        w.put(x, 11, GOLD_L), w.put(x + 1, 12, GOLD_L)

    def lantern(t: Tile, x: int, y: int, big: bool = False):
        h = 5 if big else 4
        t.rect(x + 1, y, x + 2 + (1 if big else 0), y, GOLD_L)
        t.rect(x, y + 1, x + 3 + (1 if big else 0), y + h - 1, (220, 40, 36))
        t.rect(x + 1, y + 1, x + 1, y + h - 1, (250, 90, 70))
        t.rect(x + 1, y + h, x + 2 + (1 if big else 0), y + h, GOLD_L)
        t.put(x + 1 + (1 if big else 0), y + h + 1, GOLD_L)

    def window(t_wall: Tile) -> Tile:
        t = copy(t_wall)
        t.box(2, 2, 13, 11, (40, 30, 70), GOLD_L)
        for x in (5, 10):  # lattice
            t.rect(x, 3, x, 10, darker(GOLD_L, 0.8))
        t.rect(3, 6, 12, 6, darker(GOLD_L, 0.8))
        oval(t, 11, 4, 1.4, 1.4, (250, 236, 190))  # moon
        lantern(t, 6, 3, big=True)
        return t

    def scroll(t: Tile):  # gold scroll with abstract brush strokes (not lettering)
        t.rect(5, 3, 10, 12, (236, 200, 96)), t.rect(4, 2, 11, 2, (90, 50, 30)), t.rect(4, 13, 11, 13, (90, 50, 30))
        for x, y0, y1 in ((7, 4, 6), (6, 5, 5), (8, 5, 5), (7, 8, 11), (6, 9, 9), (8, 10, 10)):
            t.rect(x, y0, x, y1, (80, 30, 24))

    def board_bg(t: Tile):
        scroll(t)

    def dumplings(t: Tile):
        t.box(2, 2, 6, 5, (196, 160, 100), (150, 110, 60))  # bamboo steamer
        t.put(3, 3, WHITE), t.put(5, 3, WHITE), t.put(4, 4, WHITE)
        t.rect(10, 3, 13, 5, (60, 110, 100)), t.put(14, 4, (60, 110, 100)), t.rect(11, 2, 12, 2, (60, 110, 100))  # teapot

    def lanterns(t: Tile):
        t.rect(7, 2, 8, 14, (90, 30, 26)), t.rect(2, 2, 13, 2, (90, 30, 26))
        lantern(t, 1, 3, big=True), lantern(t, 10, 3, big=True)
        t.rect(4, 14, 11, 14, (70, 20, 20))
        t.shadow(4, 11)

    def table(t: Tile):  # a round banquet table, seen from the side: red cloth, plates and a lazy susan
        oval(t, 7.5, 6, 7, 3, (200, 44, 40))
        oval(t, 7.5, 5.5, 6, 2, (220, 60, 50))
        oval(t, 7.5, 5.5, 2, 1, GOLD_L)
        for x in (3, 12):
            t.put(x, 5, WHITE), t.put(x, 6, (220, 220, 214))
        t.rect(1, 7, 14, 10, (176, 36, 34)), t.rect(1, 10, 14, 10, GOLD_L)
        t.rect(3, 11, 3, 13, (90, 30, 26)), t.rect(12, 11, 12, 13, (90, 30, 26))
        t.shadow(1, 14)

    def mandarin(t: Tile):
        t.rect(4, 11, 11, 14, (224, 200, 120)), t.rect(4, 11, 11, 11, GOLD_L), t.rect(6, 12, 9, 13, (60, 110, 160))  # glazed pot
        oval(t, 7.5, 5.5, 5.5, 4.5, (60, 130, 66))
        for x, y in ((4, 4), (7, 3), (10, 5), (5, 7), (9, 8), (11, 3), (7, 6)):
            t.put(x, y, (250, 150, 30)), t.put(x + 1, y, (230, 120, 20))
        t.put(4, 2, darker(LEAF)), t.put(11, 7, darker(LEAF))
        t.shadow(4, 11)

    def drum_stool(t: Tile):
        oval(t, 7.5, 5, 5.5, 2, (210, 60, 50))
        t.rect(2, 5, 13, 12, (176, 36, 34)), t.rect(2, 5, 13, 5, (210, 60, 50))
        for x in (3, 6, 9, 12):
            t.put(x, 6, GOLD_L), t.put(x, 11, GOLD_L)
        t.rect(5, 7, 10, 10, (150, 28, 28))
        t.rect(2, 12, 13, 12, GOLD_L)
        t.rect(3, 13, 4, 14, (90, 30, 26)), t.rect(11, 13, 12, 14, (90, 30, 26))

    def mandarin_bowl(t: Tile):  # lobby: a pyramid of mandarins on a gold stand
        for x, y in ((4, 7), (6, 7), (8, 7), (10, 7), (5, 5), (7, 5), (9, 5), (6, 3), (8, 3), (7, 1)):
            t.rect(x, y, x + 1, y + 1, (250, 150, 30)), t.put(x, y, (255, 190, 80))
        t.put(8, 0, LEAF)
        t.rect(3, 9, 12, 10, GOLD_L), t.rect(6, 11, 9, 13, (176, 36, 34)), t.rect(4, 14, 11, 14, GOLD_L)
        t.shadow(4, 11)

    def drum(t: Tile):  # lobby corner: a big festival drum on a stand
        oval(t, 7.5, 4, 6, 2, (236, 220, 180))
        t.rect(2, 4, 13, 10, (200, 40, 36)), t.rect(2, 4, 13, 4, (236, 220, 180))
        for x in range(2, 14, 2):
            t.put(x, 5, GOLD_L), t.put(x, 10, GOLD_L)
        oval(t, 7.5, 7.5, 2.4, 1.6, GOLD_L)
        t.rect(3, 11, 3, 14, (90, 30, 26)), t.rect(12, 11, 12, 14, (90, 30, 26)), t.rect(3, 13, 12, 13, (90, 30, 26))
        t.shadow(2, 13)

    def garland(t: Tile):
        stripe_swag(t, SAG, GOLD_L)
        for x in (2, 10):
            lantern(t, x - 1, SAG[x] + 1)

    def door_motif(px):
        # a gold paper-cut: a diamond with a flower cut out of it
        for y in range(1, 9):
            for x in range(3, 13):
                d = abs(x - 7.5) + abs(y - 4.5)
                if d <= 4.2:
                    px[x, y] = P(GOLD_L)
        for x, y in ((7, 3), (8, 3), (6, 4), (9, 4), (6, 5), (9, 5), (7, 6), (8, 6)):
            px[x, y] = P((150, 26, 26))
        px[7, 4], px[8, 4], px[7, 5], px[8, 5] = (P(GOLD_L),) * 4

    st = station((200, 44, 40), LACQ, (60, 18, 18), dumplings)
    st.rect(0, 4, 15, 4, GOLD_L)  # a gold runner down the cloth
    floor = floor_planks((104, 36, 32), (90, 30, 28), seed=128)
    for x, y in ((3, 1), (11, 5), (6, 9), (13, 13), (1, 12)):
        floor.put(x, y, (132, 58, 50))  # lacquer gleam
    room = [
        ("floor", floor, "ground"),
        ("wall", w, "wall"),
        ("walltop", walltop(), "wall"),
        ("window", window(w), "wall"),
        ("board", board_on(w, (70, 20, 20), DEEP, board_bg), "wall"),
        ("station", st, "block"),
        ("station_note", with_note(st), "block"),
        ("lanterns", _tile(lanterns), "block"),
        ("banquet_table", _tile(table), "block"),
        ("mandarin_tree", _tile(mandarin), "block"),
        ("seat", _tile(drum_stool), "walk"),
    ]
    lobby = [("mandarins", _tile(mandarin_bowl)), ("drum", _tile(drum))]
    return room, lobby, _tile(garland), ((176, 32, 30), door_motif), {"field": (236, 64, 36)}


# ======================================================================================================
# Valentine's Day: a pink-and-red florist.
# ======================================================================================================
def valentine():
    PINK, ROSE, RED, CREAM = (228, 160, 176), (196, 60, 90), (204, 36, 56), (246, 236, 234)
    w = wall(PINK, (150, 50, 70), wainscot=(240, 226, 226))
    for x, y in ((3, 3), (11, 5), (7, 1)):
        w.put(x, y, lighter(PINK, 0.35))  # tiny polka dots

    def window(t_wall: Tile) -> Tile:
        t = copy(t_wall)
        rows = ["..###..###..", ".#####.####.", "############", "############", ".##########.",
                "..########..", "...######...", "....####....", ".....##....."]
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch == "#":
                    t.put(2 + dx, 2 + dy, WHITE)
        for dy, row in enumerate(rows[1:-1], start=1):  # glass inside the white frame
            for dx, ch in enumerate(row):
                if ch == "#" and 0 < dx < 11 and row[dx - 1] == "#" and row[dx + 1] == "#" and rows[dy - 1][dx] == "#" and rows[dy + 1][dx] == "#":
                    t.put(2 + dx, 2 + dy, (170, 214, 238))
        t.put(4, 4, (230, 246, 255)), t.put(5, 4, (230, 246, 255))
        return t

    def chalk(t: Tile):
        heart(t, 4, 4, (240, 120, 150))
        for y in (4, 6, 8, 10):
            t.rect(10, y, 11, y, (220, 214, 210))
        t.rect(4, 9, 8, 9, (200, 196, 190)), t.rect(4, 11, 7, 11, (200, 196, 190))

    def bouquet(t: Tile):
        t.rect(2, 4, 5, 5, (236, 220, 196)), t.put(3, 3, RED), t.put(4, 2, RED), t.put(5, 3, (240, 120, 150)), t.put(2, 3, LEAF)
        t.rect(10, 3, 13, 5, (240, 120, 150)), t.rect(10, 4, 13, 4, CREAM)  # ribbon spool

    def rose(t: Tile, x: int, y: int, c: Color):
        t.rect(x, y, x + 1, y + 1, c), t.put(x, y, lighter(c, 0.3))

    def buckets(t: Tile):
        t.rect(1, 7, 14, 7, (170, 120, 80)), t.rect(1, 13, 14, 13, (170, 120, 80))
        t.rect(1, 7, 1, 14, (130, 90, 60)), t.rect(14, 7, 14, 14, (130, 90, 60))
        for i, c in enumerate((RED, (246, 180, 196), WHITE)):  # top tier
            x = 2 + i * 4
            t.rect(x, 4, x + 2, 6, (170, 176, 186))
            rose(t, x, 2, c), t.put(x + 2, 3, darker(c, 0.85)), t.put(x + 1, 1, LEAF)
        for i, c in enumerate(((246, 180, 196), RED, ROSE)):  # bottom tier
            x = 2 + i * 4
            t.rect(x, 10, x + 2, 12, (170, 176, 186))
            rose(t, x, 8, c), t.put(x + 2, 9, darker(c, 0.85))
        t.shadow(1, 14)

    def heartbox(t: Tile, x0: int, y0: int, c: Color, big=True):
        heart(t, x0, y0, c, big)
        t.put(x0 + 1, y0 + 1, lighter(c, 0.35))

    def chocolates(t: Tile):
        heartbox(t, 1, 9, RED), heartbox(t, 8, 9, (150, 40, 60))
        heartbox(t, 4, 4, (236, 120, 150))
        t.rect(6, 4, 8, 4, GOLD)  # bow
        t.shadow(1, 14)

    def balloons(t: Tile):
        t.rect(7, 9, 7, 13, (200, 200, 200)), t.put(6, 8, (200, 200, 200)), t.put(9, 8, (200, 200, 200))
        heartbox(t, 2, 1, RED), heartbox(t, 8, 3, (236, 120, 150))
        t.rect(5, 13, 10, 14, (150, 50, 70)), t.rect(5, 13, 10, 13, ROSE)  # a weight
        t.shadow(5, 10)

    def velvet_stool(t: Tile):
        oval(t, 7.5, 6, 6, 3.2, (172, 30, 54))
        oval(t, 7.5, 5.2, 5, 2, (204, 52, 78))
        for x in (5, 8, 11):
            t.put(x, 6, (130, 20, 40))  # tufts
        t.rect(2, 9, 13, 9, GOLD)
        t.rect(3, 10, 3, 14, GOLD), t.rect(12, 10, 12, 14, GOLD), t.rect(6, 10, 6, 13, darker(GOLD)), t.rect(9, 10, 9, 13, darker(GOLD))

    def rose_vase(t: Tile):  # lobby, by the desk
        t.rect(6, 9, 9, 14, (220, 236, 244)), t.rect(5, 8, 10, 8, (200, 216, 228)), t.rect(7, 10, 8, 13, (170, 210, 180))
        for x, y in ((4, 4), (7, 2), (10, 4), (6, 5), (9, 6), (5, 7)):
            rose(t, x, y, RED if (x + y) % 2 else (236, 120, 150))
        t.put(8, 5, LEAF), t.put(4, 6, LEAF), t.put(11, 6, LEAF)
        t.shadow(5, 10)

    def teddy(t: Tile):  # lobby corner: a teddy bear holding a heart
        fur, fur_lo = (176, 120, 76), (140, 92, 56)
        oval(t, 7.5, 3.5, 3, 2.6, fur), t.put(4, 1, fur_lo), t.put(11, 1, fur_lo)  # head, ears
        t.put(6, 3, INK), t.put(9, 3, INK), t.rect(7, 4, 8, 4, (110, 70, 44))
        oval(t, 7.5, 10, 4.5, 4, fur)
        t.rect(3, 13, 5, 14, fur_lo), t.rect(10, 13, 12, 14, fur_lo)
        heart(t, 5, 8, RED, big=False)
        t.shadow(3, 12)

    def garland(t: Tile):
        stripe_swag(t, SAG, (240, 210, 216))
        for x, c in ((1, RED), (6, (236, 120, 150)), (11, RED)):
            heart(t, x, SAG[x + 2] + 1, c)

    def door_motif(px):
        rows = [".##.##.", "#..#..#", "#.....#", ".#...#.", "..#.#..", "...#..."]
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch == "#":
                    px[4 + dx, 1 + dy] = P(RED)
        px[5, 2], px[9, 2] = P((246, 160, 180)), P((246, 160, 180))

    st = station(CREAM, (220, 140, 160), (150, 50, 70), bouquet)
    floor = Tile((238, 212, 216))
    for x, y in ((3, 3), (11, 11)):  # a scatter of little roses, low contrast
        floor.rect(x, y, x + 1, y + 1, (224, 176, 186)), floor.put(x + 2, y + 1, (200, 210, 186))
    for x, y in ((11, 4), (4, 12)):
        floor.put(x, y, (228, 192, 200))
    room = [
        ("floor", floor, "ground"),
        ("wall", w, "wall"),
        ("walltop", walltop(), "wall"),
        ("window", window(w), "wall"),
        ("board", board_on(w, (240, 236, 232), (52, 60, 56), chalk), "wall"),
        ("station", st, "block"),
        ("station_note", with_note(st), "block"),
        ("flower_buckets", _tile(buckets), "block"),
        ("chocolates", _tile(chocolates), "block"),
        ("heart_balloons", _tile(balloons), "block"),
        ("seat", _tile(velvet_stool), "walk"),
    ]
    lobby = [("roses", _tile(rose_vase)), ("teddy", _tile(teddy))]
    return room, lobby, _tile(garland), ((206, 116, 138), door_motif), {"field": (214, 96, 140)}


# ======================================================================================================
# Easter: a spring park pavilion.
# ======================================================================================================
def easter():
    BUTTER, LAV, MINT, PINK_P, SKY_P, YEL = (238, 228, 186), (150, 128, 196), (150, 214, 176), (244, 176, 196), (160, 200, 240), (246, 222, 110)
    w = wall(BUTTER, (120, 100, 160), wainscot=(244, 244, 238))
    for x in range(0, 16, 4):  # white picket posts on the dado
        w.rect(x + 1, 10, x + 2, 12, (226, 226, 220)), w.put(x + 1, 9, WHITE)

    def egg(t: Tile, x: int, y: int, c: Color, band: Color | None = None):
        t.rect(x, y + 1, x + 2, y + 2, c), t.put(x + 1, y, c), t.put(x + 1, y + 3, darker(c, 0.85))
        if band:
            t.rect(x, y + 2, x + 2, y + 2, band)

    def window(t_wall: Tile) -> Tile:
        t = window_on(t_wall, (120, 100, 160), sky=(176, 220, 244))
        for i, x in enumerate((4, 6, 9, 11)):
            c = (PINK_P, YEL, MINT, LAV)[i]
            t.rect(x, 3, x + 1, 3, c), t.put(x, 4, c)
        t.rect(4, 9, 11, 9, (130, 190, 100))  # treetops outside
        return t

    def flyer(t: Tile):  # an egg-hunt map pinned on cork
        t.rect(4, 4, 11, 11, (250, 248, 236))
        for x, y in ((5, 9), (6, 8), (7, 8), (8, 7), (9, 6), (10, 5)):
            t.put(x, y, (190, 170, 150))
        egg(t, 4, 5, PINK_P), egg(t, 9, 7, SKY_P)
        t.put(10, 5, (220, 70, 70))

    def lemonade(t: Tile):
        t.rect(2, 2, 4, 5, (250, 236, 140)), t.rect(2, 2, 4, 2, (220, 230, 240)), t.put(5, 3, (220, 230, 240))  # pitcher
        t.rect(11, 3, 12, 5, (250, 236, 140)), t.rect(11, 3, 12, 3, (230, 240, 248))  # cup

    def eggs(t: Tile):
        egg(t, 2, 5, PINK_P, YEL), egg(t, 5, 4, SKY_P, WHITE), egg(t, 8, 5, YEL, LAV), egg(t, 11, 4, MINT, PINK_P)
        t.rect(1, 8, 14, 13, (196, 150, 90)), t.rect(1, 8, 14, 8, (220, 176, 110))
        for x in range(2, 14, 2):
            t.rect(x, 9, x, 12, (170, 124, 70))
        for x in range(2, 14, 3):
            t.put(x, 8, (150, 200, 110))  # paper grass
        t.rect(2, 2, 2, 7, (170, 124, 70)), t.rect(13, 2, 13, 7, (170, 124, 70)), t.rect(3, 1, 12, 1, (170, 124, 70))  # handle
        t.shadow(1, 14)

    def tulips(t: Tile):
        t.rect(1, 10, 14, 14, (176, 132, 90)), t.rect(1, 10, 14, 10, (200, 156, 110)), t.rect(1, 12, 14, 12, (150, 110, 74))
        for i, x in enumerate((2, 5, 8, 11)):
            c = ((236, 90, 120), YEL, (240, 140, 80), LAV)[i]
            t.rect(x + 1, 6, x + 1, 9, (80, 150, 70)), t.put(x, 8, (100, 170, 80))
            t.rect(x, 3 + i % 2, x + 2, 5 + i % 2, c), t.put(x + 1, 3 + i % 2, lighter(c, 0.3))
        t.shadow(1, 14)

    def bunny(t: Tile):  # a cheerful bunny statue on a little plinth
        fur = (246, 244, 240)
        t.rect(5, 0, 6, 4, fur), t.rect(9, 0, 10, 4, fur), t.put(5, 1, PINK_P), t.put(10, 1, PINK_P)  # ears
        oval(t, 7.5, 6, 3, 2.4, fur)
        t.put(6, 6, INK), t.put(9, 6, INK), t.put(7, 7, PINK_P), t.put(8, 7, PINK_P)
        oval(t, 7.5, 10.5, 3.8, 2.6, fur), t.put(11, 11, WHITE)
        t.rect(3, 13, 12, 14, (180, 186, 176)), t.rect(3, 13, 12, 13, (206, 210, 200))
        t.shadow(3, 12)

    def picnic_bench(t: Tile):
        wood, lo = (190, 140, 90), (150, 104, 62)
        t.rect(1, 6, 14, 8, wood), t.rect(1, 6, 14, 6, lighter(wood, 0.25)), t.rect(1, 8, 14, 8, lo)
        for x in (3, 12):
            t.rect(x, 9, x, 13, lo)
        t.rect(2, 11, 13, 11, lo)

    def egg_tree(t: Tile):  # lobby, by the desk: a pot of branches hung with eggs
        t.rect(5, 11, 10, 14, (176, 132, 90)), t.rect(5, 11, 10, 11, (200, 156, 110))
        for x, y in ((7, 10), (7, 9), (6, 8), (5, 7), (4, 6), (8, 8), (9, 7), (10, 6), (11, 5), (7, 7), (7, 6), (7, 5), (6, 4), (8, 3)):
            t.put(x, y, (120, 86, 60))
        for x, y, c in ((3, 7, PINK_P), (10, 7, SKY_P), (5, 4, YEL), (9, 3, MINT), (12, 6, LAV)):
            t.rect(x, y, x + 1, y + 1, c), t.put(x, y, lighter(c, 0.4))
        t.shadow(5, 10)

    def giant_egg(t: Tile):  # lobby corner: a big painted egg in a nest
        oval(t, 7.5, 6.5, 4.5, 5.8, SKY_P)
        t.rect(3, 5, 12, 6, PINK_P), t.rect(3, 9, 12, 9, YEL)
        for x in (4, 7, 10):
            t.put(x, 7, WHITE)
        t.put(6, 2, lighter(SKY_P, 0.5)), t.put(5, 3, lighter(SKY_P, 0.5))
        oval(t, 7.5, 12.5, 6.5, 2.2, (176, 132, 80))
        for x in range(2, 14, 2):
            t.put(x, 12, (206, 166, 100))
        t.shadow(1, 14)

    def garland(t: Tile):
        pennants(t, [PINK_P, YEL, MINT, LAV], (226, 226, 220))

    def door_motif(px):
        cx, cy = 7.5, 4.5
        cols = [PINK_P, YEL, SKY_P, WHITE, LAV]
        k = 0
        for y in range(9):
            for x in range(16):
                d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                if 2.4 <= d <= 3.6:
                    px[x, y] = P((110, 170, 90) if (x + y) % 2 else cols[k % len(cols)])
                    k += 1

    st = station((250, 240, 244), (200, 160, 112), (150, 112, 70), lemonade)
    for x in range(0, 16, 2):  # gingham cloth
        st.rect(x, 2, x, 5, (244, 196, 210))
    st.rect(0, 3, 15, 3, (244, 196, 210))
    floor = floor_noise((150, 186, 110), (140, 178, 102), seed=404, p=0.2)
    for x0, y0, x1, y1 in ((0, 0, 6, 5), (8, 0, 15, 6), (1, 8, 7, 14), (9, 9, 15, 15)):  # flagstones
        floor.rect(x0, y0, x1, y1, (192, 190, 172))
        floor.put(x0 + 1, y0 + 1, (204, 202, 186))
        floor.rect(x0, y1, x1, y1, (176, 174, 156))
    room = [
        ("floor", floor, "ground"),
        ("wall", w, "wall"),
        ("walltop", walltop(), "wall"),
        ("window", window(w), "wall"),
        ("board", board_on(w, (150, 104, 62), (196, 150, 100), flyer), "wall"),
        ("station", st, "block"),
        ("station_note", with_note(st), "block"),
        ("egg_basket", _tile(eggs), "block"),
        ("tulips", _tile(tulips), "block"),
        ("bunny", _tile(bunny), "block"),
        ("seat", _tile(picnic_bench), "walk"),
    ]
    lobby = [("egg_tree", _tile(egg_tree)), ("giant_egg", _tile(giant_egg))]
    return room, lobby, _tile(garland), ((150, 130, 196), door_motif), {"field": (110, 176, 140)}


# ======================================================================================================
# Pride: a community-centre workshop.
# ======================================================================================================
def pride():
    BLOCK, TRIM = (222, 218, 208), (74, 72, 84)
    w = wall(BLOCK, TRIM)
    for y in (2, 5):
        w.rect(0, y, 15, y, (204, 200, 190))
    for x, y in ((3, 0), (11, 0), (7, 3), (15, 3), (3, 6), (11, 6)):
        w.rect(x, y, x, y + 1, (204, 200, 190))
    for i, c in enumerate(RAINBOW):  # the painted rainbow band
        w.rect(0, 7 + i, 15, 7 + i, c)

    def window(t_wall: Tile) -> Tile:
        t = copy(t_wall)
        t.box(3, 1, 12, 9, (170, 214, 240), TRIM)  # sits above the band
        t.rect(7, 1, 8, 9, TRIM)
        for i, x in enumerate((4, 6, 9, 11)):
            t.put(x, 2, RAINBOW[i]), t.put(x + (1 if x in (4, 9) else 0), 3, RAINBOW[i + 2])
        t.put(4, 5, lighter((170, 214, 240), 0.6))
        return t

    def corkboard(t: Tile):
        t.rect(4, 4, 7, 9, WHITE)
        for y in (5, 7):
            t.rect(5, y, 6, y, (150, 150, 160))
        for i, c in enumerate(RAINBOW):  # a little pride flag pinned up
            t.rect(9, 4 + i, 11, 4 + i, c)
        t.put(5, 3, (220, 60, 60)), t.put(10, 3, (60, 110, 200))
        t.rect(5, 11, 10, 11, (240, 220, 120))

    def paint_pots(t: Tile):
        for i, x in enumerate((2, 5, 9, 12)):
            c = RAINBOW[(i * 2) % 6]
            t.rect(x, 3, x + 1, 5, (220, 220, 226)), t.rect(x, 3, x + 1, 3, c)
        t.rect(7, 2, 7, 5, (170, 120, 70)), t.put(7, 1, RAINBOW[4])  # brush

    def float_table(t: Tile):
        for i, c in enumerate(RAINBOW):  # a cardboard rainbow arch on the float
            r = 6.5 - i
            for x in range(16):
                for y in range(0, 9):
                    d = ((x - 7.5) ** 2 + ((y - 8) * 1.1) ** 2) ** 0.5
                    if r - 1 < d <= r and r > 1.5:
                        t.put(x, y, c)
        t.rect(0, 8, 15, 11, (200, 176, 126)), t.rect(0, 8, 15, 8, (224, 200, 150))
        for x in range(0, 16, 3):
            t.put(x, 10, RAINBOW[(x // 3) % 6])  # fringe
        oval(t, 3, 13, 1.6, 1.6, INK), oval(t, 12, 13, 1.6, 1.6, INK)
        t.put(3, 13, (150, 150, 160)), t.put(12, 13, (150, 150, 160))
        t.shadow(1, 14)

    def glitter_shelf(t: Tile):
        shelf_frame(t, (160, 160, 170))
        t.rect(2, 7, 13, 7, (110, 110, 120))
        for row, y in enumerate((2, 8)):
            for i in range(4):
                c = RAINBOW[(i + row * 3) % 6]
                x = 2 + i * 3
                t.rect(x, y + 1, x + 1, y + 4, c), t.rect(x, y, x + 1, y, (230, 230, 236))
                t.put(x + (i % 2), y + 2, lighter(c, 0.7))  # sparkle
        t.put(13, 1, WHITE), t.put(1, 8, WHITE)

    def paint_cans(t: Tile):
        metal, rim = (176, 180, 190), (120, 124, 134)
        for x0, y0, c in ((1, 9, RAINBOW[0]), (8, 9, RAINBOW[4]), (4, 3, RAINBOW[2])):
            t.rect(x0, y0 + 1, x0 + 5, y0 + 5, metal)
            t.rect(x0, y0, x0 + 5, y0, rim), t.rect(x0 + 1, y0, x0 + 4, y0, c)  # paint showing in the open top
            t.rect(x0, y0 + 2, x0 + 5, y0 + 4, c), t.rect(x0, y0 + 2, x0 + 5, y0 + 2, lighter(c, 0.3))  # label
            t.put(x0 + 4, y0 + 1, c)  # a drip over the rim
            t.rect(x0, y0 + 5, x0 + 5, y0 + 5, rim)
        t.shadow(1, 14)

    def folding_chair(t: Tile):
        metal, seat = (150, 154, 164), (128, 76, 168)
        t.rect(4, 2, 11, 6, seat), t.rect(4, 2, 11, 2, lighter(seat, 0.25))
        t.rect(3, 2, 3, 14, metal), t.rect(12, 2, 12, 14, metal)
        t.rect(4, 8, 11, 9, lighter(seat, 0.15)), t.rect(4, 9, 11, 9, darker(seat, 0.8))
        t.rect(5, 11, 10, 11, darker(metal, 0.8))

    def flag_stand(t: Tile):  # lobby, by the desk: a pride flag on a stand
        t.rect(3, 1, 3, 14, (170, 150, 120)), t.put(3, 0, GOLD)
        for i, c in enumerate(RAINBOW):
            t.rect(4, 2 + i, 12, 2 + i, c)
        t.put(12, 3, darker(RAINBOW[1], 0.85)), t.put(12, 5, darker(RAINBOW[3], 0.85))
        t.rect(1, 14, 6, 14, TRIM)
        t.shadow(1, 6)

    def balloons(t: Tile):  # lobby corner: a rainbow balloon cluster
        for i, (x, y) in enumerate(((5, 1), (9, 1), (3, 4), (7, 4), (11, 4), (5, 7))):
            c = RAINBOW[i]
            oval(t, x + 0.5, y + 1, 1.8, 1.9, c), t.put(x, y, lighter(c, 0.5))
        t.rect(7, 10, 7, 13, (200, 200, 206)), t.rect(5, 13, 10, 14, TRIM)
        t.shadow(5, 10)

    def garland(t: Tile):
        stripe_swag(t, SAG, (230, 230, 236))
        for i, x in enumerate((0, 3, 5, 8, 10, 13)):
            if x + 1 >= T:
                continue
            c = RAINBOW[i]
            y = SAG[x] + 1
            t.rect(x, y, x + 1, y, c), t.put(x, y + 1, c), t.put(x + 1, y + 1, darker(c, 0.85))

    def door_motif(px):
        for i, c in enumerate(RAINBOW):  # a rainbow plate where the brass one was
            for x in range(5, 11):
                px[x, 1 + i] = P(c)

    st = station((214, 190, 140), (150, 154, 164), (100, 104, 114), paint_pots)
    floor = Tile((206, 204, 200))
    for x, y in ((2, 3), (12, 2), (7, 13), (13, 11)):
        floor.put(x, y, (196, 194, 190))
    for i, c in enumerate(RAINBOW):  # the runner: soft stripes, so people stay readable on it
        floor.rect(0, 5 + i, 15, 5 + i, lighter(c, 0.55))
    room = [
        ("floor", floor, "ground"),
        ("wall", w, "wall"),
        ("walltop", walltop(), "wall"),
        ("window", window(w), "wall"),
        ("board", board_on(w, (130, 90, 60), (196, 150, 100), corkboard), "wall"),
        ("station", st, "block"),
        ("station_note", with_note(st), "block"),
        ("float", _tile(float_table), "block"),
        ("glitter_shelf", _tile(glitter_shelf), "block"),
        ("paint_cans", _tile(paint_cans), "block"),
        ("seat", _tile(folding_chair), "walk"),
    ]
    lobby = [("flag", _tile(flag_stand)), ("balloons", _tile(balloons))]
    return room, lobby, _tile(garland), (None, door_motif), {"rows": RAINBOW}


# ======================================================================================================
# Fourth of July: a lakeside boardwalk.
# ======================================================================================================
def july4():
    NAVY, RED, CLAP = (36, 52, 104), (200, 44, 52), (232, 232, 224)
    w = wall(CLAP, NAVY)
    for y in (2, 5, 8, 11):  # clapboard siding
        w.rect(0, y, 15, y, (206, 206, 198))
    w.rect(0, 12, 15, 12, (196, 196, 188))

    def fan(t: Tile, cx: float, y0: int, r: float):
        """A half-round bunting fan hanging from y0: red, white and blue rings, blue in the middle."""
        for y in range(y0, y0 + int(r) + 1):
            for x in range(T):
                d = ((x - cx) ** 2 + ((y - y0) * 1.6) ** 2) ** 0.5
                if d <= r:
                    band = d / r
                    t.put(x, y, NAVY if band < 0.35 else WHITE if band < 0.68 else RED)

    def window(t_wall: Tile) -> Tile:
        t = window_on(t_wall, NAVY, sky=(150, 204, 240))
        t.rect(4, 8, 11, 9, (80, 140, 200))  # the lake
        fan(t, 7.5, 2, 5.5)
        t.put(7, 2, WHITE), t.put(8, 2, WHITE)  # a star in the middle
        return t

    def schedule(t: Tile):
        t.put(5, 3, RED), t.rect(4, 4, 6, 4, RED), t.put(5, 5, RED), t.put(4, 6, RED), t.put(6, 6, RED)  # a star
        for y in (4, 6, 8, 10):
            t.rect(8, y, 11, y, (120, 130, 170))
        t.rect(4, 9, 6, 9, (120, 130, 170)), t.rect(4, 11, 6, 11, (120, 130, 170))

    def snack(t: Tile):
        t.rect(2, 4, 6, 5, (230, 190, 120)), t.rect(3, 3, 5, 3, (190, 80, 60)), t.rect(3, 4, 5, 4, (240, 200, 60))  # hot dog
        t.rect(11, 2, 12, 5, (250, 236, 140)), t.rect(11, 2, 12, 2, WHITE), t.put(13, 1, RED)  # lemonade + straw

    def picnic(t: Tile):
        for x in range(1, 15):  # red check cloth
            for y in range(4, 9):
                t.put(x, y, RED if (x // 2 + y // 2) % 2 else WHITE)
        t.rect(1, 8, 14, 8, darker(RED, 0.8))
        t.rect(3, 3, 4, 3, (140, 200, 90)), t.rect(10, 3, 12, 3, (230, 120, 90))  # watermelon slice, plate
        for x, x2 in ((3, 1), (12, 14)):
            t.rect(x, 9, x, 14, (150, 120, 90)), t.put(x2 if x2 < x else x2, 14, (150, 120, 90))
        t.rect(1, 12, 14, 12, (170, 140, 104))  # bench rail
        t.shadow(1, 14)

    def cooler(t: Tile):
        t.rect(2, 4, 13, 13, (50, 110, 190)), t.rect(2, 4, 13, 6, WHITE), t.rect(2, 7, 13, 7, (200, 206, 214))
        t.rect(6, 3, 9, 3, (200, 206, 214)), t.put(6, 4, (160, 166, 176)), t.put(9, 4, (160, 166, 176))  # handle
        t.rect(3, 8, 3, 12, lighter((50, 110, 190), 0.25))
        t.rect(2, 14, 13, 14, darker((50, 110, 190), 0.7))
        t.shadow(2, 13)

    def flagpole(t: Tile):
        t.rect(3, 0, 3, 11, (200, 200, 206)), t.put(3, 0, GOLD)
        for y in range(1, 7):  # stripes
            t.rect(4, y, 13, y, RED if y % 2 else WHITE)
        t.rect(4, 1, 7, 3, NAVY), t.put(5, 2, WHITE), t.put(7, 1, WHITE)  # canton with stars
        t.rect(1, 11, 7, 14, (170, 120, 80)), t.rect(1, 11, 7, 11, (196, 146, 100))
        t.put(2, 10, (80, 150, 70)), t.put(6, 10, (80, 150, 70)), t.put(5, 9, (226, 60, 60))
        t.shadow(1, 7)

    def beach_chair(t: Tile):
        for x in range(4, 12):
            t.rect(x, 2, x, 9, RED if (x // 2) % 2 else WHITE)
        t.rect(3, 2, 3, 13, (176, 140, 100)), t.rect(12, 2, 12, 13, (176, 140, 100))
        t.rect(3, 10, 12, 10, (176, 140, 100)), t.rect(4, 12, 11, 12, (150, 116, 80))

    def pinwheels(t: Tile):  # lobby, by the desk: a planter of pinwheels
        t.rect(4, 11, 11, 14, WHITE), t.rect(4, 11, 11, 11, (210, 210, 204)), t.rect(4, 13, 11, 13, RED)
        for cx, cy, a, b in ((5, 4, RED, WHITE), (10, 3, NAVY, WHITE), (8, 7, RED, NAVY)):
            t.rect(cx, cy + 2, cx, 10, (200, 200, 206))
            t.put(cx - 1, cy - 1, a), t.put(cx, cy - 1, a), t.put(cx + 1, cy, b), t.put(cx + 1, cy + 1, b)
            t.put(cx, cy + 1, a), t.put(cx - 1, cy + 1, a), t.put(cx - 1, cy, b), t.put(cx, cy, GOLD)
        t.shadow(4, 11)

    def melons(t: Tile):  # lobby corner: a crate of watermelons with a slice on top
        for cx in (4.5, 10.5):
            oval(t, cx, 7, 3.4, 2.6, (70, 150, 64))
            for x in range(int(cx) - 2, int(cx) + 3, 2):
                t.rect(x, 5, x, 8, (36, 96, 40))  # stripes
            t.put(int(cx) - 1, 5, (130, 200, 110))
        for x, y0 in ((6, 3), (7, 2), (8, 2), (9, 3)):  # the slice: red flesh, seeds, green rind
            t.rect(x, y0, x, 4, (230, 70, 80))
        t.rect(6, 5, 9, 5, (90, 170, 80)), t.put(7, 3, INK), t.put(8, 4, INK)
        t.rect(1, 9, 14, 14, (176, 132, 90)), t.rect(1, 9, 14, 9, (200, 156, 110)), t.rect(1, 12, 14, 12, (150, 110, 74))
        t.rect(5, 10, 10, 11, NAVY), t.put(7, 10, WHITE), t.put(8, 11, WHITE)
        t.shadow(1, 14)

    def garland(t: Tile):  # one bunting swag per tile: navy top with white stars, then red, white, red
        import math
        for x in range(T):
            depth = 2 + round(4 * math.sin(math.pi * (x + 0.5) / T))
            for y in range(depth + 1):
                band = depth - y
                c = RED if band in (0, 2) else WHITE if band == 1 else NAVY
                t.put(x, y, c)
            if depth >= 5 and x % 3 == 1:
                t.put(x, 1, WHITE)
        t.rect(0, 0, 1, 1, GOLD), t.rect(14, 0, 15, 1, GOLD)  # rosettes where swags meet

    def door_motif(px):
        for y in range(1, 7):  # a little flag plate
            for x in range(5, 11):
                px[x, y] = P(RED if y % 2 else WHITE)
        for y in range(1, 4):
            for x in range(5, 8):
                px[x, y] = P((56, 76, 140))
        px[6, 2] = P(WHITE)

    st = station(WHITE, RED, NAVY, snack)
    for x in range(1, 15, 3):  # red-and-white striped front
        st.rect(x, 8, x, 14, WHITE)
    room = [
        ("floor", floor_planks((178, 164, 142), (160, 146, 124), seed=704), "ground"),
        ("wall", w, "wall"),
        ("walltop", walltop(), "wall"),
        ("window", window(w), "wall"),
        ("board", board_on(w, NAVY, (246, 244, 236), schedule), "wall"),
        ("station", st, "block"),
        ("station_note", with_note(st), "block"),
        ("picnic_table", _tile(picnic), "block"),
        ("cooler", _tile(cooler), "block"),
        ("flagpole", _tile(flagpole), "block"),
        ("seat", _tile(beach_chair), "walk"),
    ]
    lobby = [("pinwheels", _tile(pinwheels)), ("melons", _tile(melons))]
    return room, lobby, _tile(garland), ((40, 60, 120), door_motif), {"field": (34, 50, 112)}


# ======================================================================================================
# Halloween: a haunted manor (spooky-cute).
# ======================================================================================================
def halloween():
    STONE, STONE_LO, PURP, ORANGE, GHOST, SLIME = (86, 76, 102), (66, 58, 80), (110, 70, 140), (240, 132, 30), (236, 236, 244), (120, 210, 90)
    w = Tile(STONE)
    for y in (3, 7, 11):
        w.rect(0, y, 15, y, STONE_LO)
    for row, y0 in enumerate((0, 4, 8)):
        for x in ((5, 13) if row % 2 == 0 else (1, 9)):
            w.rect(x, y0, x, y0 + 2, STONE_LO)
    w.put(3, 1, lighter(STONE, 0.1)), w.put(10, 5, lighter(STONE, 0.1))
    w.rect(0, 12, 15, 12, PURP)
    w.rect(0, 13, 15, 15, (44, 34, 56))

    def window(t_wall: Tile) -> Tile:
        t = copy(t_wall)
        frame, sky = (40, 30, 50), (34, 40, 84)
        t.rect(3, 4, 12, 11, frame), t.rect(4, 3, 11, 3, frame), t.rect(6, 2, 9, 2, frame)  # a pointed arch
        t.rect(4, 5, 11, 10, sky), t.rect(5, 4, 10, 4, sky), t.rect(7, 3, 8, 3, sky)
        oval(t, 9, 6, 1.8, 1.8, (250, 240, 196)), t.put(10, 5, (230, 220, 170))  # moon
        t.put(5, 6, INK), t.put(6, 5, INK), t.put(4, 5, INK), t.put(6, 7, INK) if False else None  # a bat
        t.put(5, 7, INK), t.put(6, 6, INK)
        t.rect(3, 11, 12, 11, (60, 48, 70))
        return t

    def notice(t: Tile):  # a parchment notice with a little ghost
        t.rect(4, 4, 6, 7, GHOST), t.put(5, 3, GHOST), t.put(4, 8, GHOST), t.put(6, 8, GHOST)
        t.put(4, 5, INK), t.put(6, 5, INK)
        for y in (4, 6, 8, 10):
            t.rect(8, y, 11, y, (150, 120, 90))
        t.rect(4, 10, 6, 10, (150, 120, 90))

    def candelabra(t: Tile):
        brass = (196, 160, 80)
        for x in (2, 4, 6):
            t.rect(x, 2, x, 3, (240, 236, 220)), t.put(x, 1, SLIME)
        t.rect(2, 4, 6, 4, brass), t.rect(4, 5, 4, 5, brass)
        oval(t, 12, 4, 2.2, 1.6, (40, 36, 46)), t.rect(10, 3, 14, 3, (60, 56, 66))  # a little candy cauldron
        t.put(11, 2, ORANGE), t.put(13, 2, PURP), t.put(12, 2, SLIME)

    def jack(t: Tile, x0: int, y0: int, wdt: int, hgt: int, c=ORANGE):
        for y in range(hgt):
            for x in range(wdt):
                if ((x - (wdt - 1) / 2) / (wdt / 2)) ** 2 + ((y - (hgt - 1) / 2) / (hgt / 2)) ** 2 <= 1:
                    t.put(x0 + x, y0 + y, c)
        t.rect(x0 + wdt // 2, y0 - 1, x0 + wdt // 2, y0, (70, 90, 40))
        mid = x0 + wdt // 2
        glow = (255, 226, 110)
        t.put(mid - 2, y0 + 2, glow), t.put(mid + 1, y0 + 2, glow)  # eyes
        t.rect(mid - 2, y0 + hgt - 3, mid + 1, y0 + hgt - 3, glow), t.put(mid - 1, y0 + hgt - 2, glow)  # grin

    def jacks(t: Tile):
        jack(t, 1, 8, 8, 6), jack(t, 8, 9, 7, 5, (226, 110, 24)), jack(t, 5, 3, 7, 6, (250, 150, 40))
        t.shadow(1, 14)

    def cobweb_shelf(t: Tile):
        wood = (92, 62, 50)
        shelf_frame(t, wood)
        t.rect(2, 7, 13, 7, darker(wood, 0.6))
        for i, c in enumerate([(120, 50, 60), (60, 90, 70), PURP, (120, 50, 60), (70, 60, 100)]):
            t.rect(3 + i * 2, 3, 3 + i * 2, 6, c)
        t.rect(4, 10, 5, 13, SLIME), t.put(4, 9, (200, 200, 200)), t.rect(8, 11, 10, 13, PURP), t.put(9, 10, (200, 200, 200))  # potions
        web = (214, 214, 224)
        for k in range(4):
            t.put(13 - k, 2, web) if k % 2 == 0 else None
            t.put(13, 2 + k, web) if k % 2 == 0 else None
            t.put(13 - k, 2 + k, web)
        t.put(11, 3, web), t.put(12, 4, web)

    def cauldron(t: Tile):
        oval(t, 7.5, 9, 6, 4.5, (44, 40, 50))
        t.rect(2, 5, 13, 6, (64, 60, 72))
        oval(t, 7.5, 5, 5, 1.2, SLIME)
        t.put(5, 3, SLIME), t.put(9, 2, lighter(SLIME, 0.4)), t.put(10, 4, SLIME)  # bubbles
        t.put(4, 9, (80, 76, 90))
        t.rect(3, 13, 4, 14, (44, 40, 50)), t.rect(11, 13, 12, 14, (44, 40, 50))
        t.shadow(2, 13)

    def coffin_bench(t: Tile):
        wood = (100, 66, 54)
        rows = [(4, 11), (3, 12), (2, 13), (2, 13), (3, 12), (3, 12), (4, 11), (4, 11)]
        for i, (a, b) in enumerate(rows):
            t.rect(a, 2 + i, b, 2 + i, wood)
        t.rect(4, 4, 11, 7, PURP), t.rect(4, 4, 11, 4, lighter(PURP, 0.25))  # cushion
        t.rect(7, 2, 8, 3, (200, 180, 120))
        t.rect(2, 10, 13, 11, darker(wood, 0.8))
        t.rect(3, 12, 3, 14, (60, 40, 32)), t.rect(12, 12, 12, 14, (60, 40, 32))

    def ghost(t: Tile):  # lobby, by the desk: a friendly sheet ghost on a stool
        oval(t, 7.5, 5, 3.8, 4, GHOST)
        t.rect(4, 5, 11, 10, GHOST)
        for x in (4, 7, 10):
            t.put(x, 11, GHOST)
        t.put(6, 4, INK), t.put(9, 4, INK), t.rect(7, 7, 8, 7, (100, 90, 110))
        t.put(5, 6, (246, 190, 200)), t.put(10, 6, (246, 190, 200))
        t.rect(4, 12, 11, 12, (92, 62, 50)), t.rect(5, 13, 5, 14, (60, 40, 32)), t.rect(10, 13, 10, 14, (60, 40, 32))
        t.shadow(4, 11)

    def tombstone(t: Tile):  # lobby corner: a cute gravestone with a pumpkin
        st_c = (150, 150, 160)
        t.rect(3, 4, 11, 13, st_c), t.rect(4, 3, 10, 3, st_c), t.rect(5, 2, 9, 2, st_c)
        t.rect(11, 4, 11, 13, darker(st_c, 0.8))
        t.rect(5, 6, 9, 6, (100, 100, 112)), t.rect(5, 8, 9, 8, (100, 100, 112)), t.rect(6, 10, 8, 10, (100, 100, 112))
        t.rect(2, 13, 13, 14, (70, 110, 60))
        jack(t, 10, 10, 5, 4)
        t.shadow(2, 14)

    def garland(t: Tile):
        stripe_swag(t, SAG, (60, 50, 70))
        for x, c in ((1, ORANGE), (9, PURP)):
            y = SAG[x] + 1
            t.rect(x, y, x + 2, y, c), t.rect(x, y + 1, x + 1, y + 1, darker(c, 0.85)), t.put(x, y + 2, darker(c, 0.75))
        for x in (5, 13):  # bats
            y = SAG[x] + 2
            t.put(x - 2, y - 1, INK), t.put(x - 1, y, INK), t.put(x, y, INK), t.put(x + 1, y, INK), t.put(x + 2, y - 1, INK)
            t.put(x, y + 1, INK)

    def door_motif(px):
        # a jack-o'-lantern face plate and a cobweb in the top-left corner
        for y in range(1, 6):
            for x in range(5, 11):
                if ((x - 7.5) / 3) ** 2 + ((y - 3.2) / 2.4) ** 2 <= 1:
                    px[x, y] = P(ORANGE)
        px[7, 0] = P((70, 90, 40))
        px[6, 2], px[9, 2] = P((60, 30, 10)), P((60, 30, 10))
        for x in range(6, 10):
            px[x, 4] = P((60, 30, 10))
        web = P((200, 200, 214))
        for k in range(4):
            px[2 + k, 2 + k] = web
        px[2, 4], px[4, 2], px[3, 5], px[5, 3] = web, web, web, web

    st = station((70, 48, 42), (92, 62, 50), (44, 30, 26), candelabra)
    floor = Tile((92, 88, 104))
    for y in (7, 15):
        floor.rect(0, y, 15, y, (80, 76, 92))
    for x, y0 in ((5, 0), (12, 8)):
        floor.rect(x, y0, x, y0 + 6, (80, 76, 92))
    for x, y in ((1, 2), (2, 3), (3, 3), (4, 4), (9, 11), (10, 10), (11, 11)):
        floor.put(x, y, (76, 72, 88))  # cracks
    for x, y in ((8, 2), (2, 11), (14, 4)):
        floor.put(x, y, (100, 96, 112))
    room = [
        ("floor", floor, "ground"),
        ("wall", w, "wall"),
        ("walltop", walltop(), "wall"),
        ("window", window(w), "wall"),
        ("board", board_on(w, (60, 44, 40), (220, 204, 168), notice), "wall"),
        ("station", st, "block"),
        ("station_note", with_note(st), "block"),
        ("jack_o_lanterns", _tile(jacks), "block"),
        ("cobweb_shelf", _tile(cobweb_shelf), "block"),
        ("cauldron", _tile(cauldron), "block"),
        ("seat", _tile(coffin_bench), "walk"),
    ]
    lobby = [("ghost", _tile(ghost)), ("tombstone", _tile(tombstone))]
    return room, lobby, _tile(garland), ((70, 52, 86), door_motif), {"field": (40, 34, 50)}


# ======================================================================================================
# Diwali: a festival sweet shop.
# ======================================================================================================
def diwali():
    TEAL, SAFFRON, MAGENTA, MARI, MARI_Y, CLAY = (34, 120, 124), (230, 146, 40), (170, 30, 100), (240, 130, 20), (250, 196, 40), (180, 96, 56)
    w = wall(TEAL, (110, 20, 70), wainscot=SAFFRON)
    for x in range(1, 16, 4):  # a small gold border pattern
        w.put(x, 9, (250, 214, 120)), w.put(x + 1, 10, MAGENTA)

    def diya(t: Tile, x: int, y: int):
        t.rect(x, y, x + 2, y, CLAY), t.put(x + 1, y + 1, darker(CLAY, 0.8)), t.put(x, y, lighter(CLAY, 0.2))
        flame(t, x + 1, y - 1)

    def marigolds(t: Tile, pts):
        for i, (x, y) in enumerate(pts):
            t.put(x, y, MARI if i % 2 else MARI_Y)

    def window(t_wall: Tile) -> Tile:
        t = window_on(t_wall, (110, 20, 70), sky=(44, 40, 96))
        t.put(5, 6, (240, 220, 160)), t.put(10, 4, (240, 220, 160)), t.put(11, 7, (200, 190, 240))
        marigolds(t, [(3, 2), (4, 3), (5, 4), (6, 4), (7, 3), (8, 3), (9, 4), (10, 4), (11, 3), (12, 2)])
        for x in (3, 12):
            marigolds(t, [(x, 4), (x, 5), (x, 6), (x, 7)])
        t.put(7, 4, LEAF), t.put(8, 4, LEAF)
        return t

    def menu(t: Tile):  # sweets price board
        for x, c in ((4, MARI), (6, (240, 220, 200))):
            oval(t, x + 0.5, 4.5, 1, 1, c)
        t.put(8, 4, (180, 200, 210)), t.put(9, 3, (180, 200, 210)), t.put(9, 5, (180, 200, 210)), t.put(10, 4, (180, 200, 210))
        for y in (7, 9, 11):
            t.rect(4, y, 7, y, (236, 200, 120)), t.rect(9, y, 11, y, (250, 230, 200))

    def sweets(t: Tile):
        t.rect(1, 4, 6, 5, (210, 214, 220))  # a silver tray of laddoos
        for x in (2, 4):
            t.rect(x, 3, x + 1, 4, MARI), t.put(x, 3, MARI_Y)
        diya(t, 11, 4)

    def diyas(t: Tile):  # rows of clay lamps on a stepped stand
        t.rect(1, 6, 14, 6, (110, 20, 70)), t.rect(1, 10, 14, 10, (110, 20, 70)), t.rect(1, 14, 14, 14, (110, 20, 70))
        t.rect(1, 7, 14, 9, darker(MAGENTA, 0.6)), t.rect(1, 11, 14, 13, darker(MAGENTA, 0.6))
        for x in (2, 6, 10):
            diya(t, x, 5)
        for x in (1, 5, 9, 12):
            diya(t, x, 9) if x < 13 else None
        for x in (2, 6, 10):
            diya(t, x, 13)
        t.shadow(1, 14)

    def rangoli(t: Tile):  # drawn on the floor, top-down; transparent so the floor shows round it
        for y in range(T):
            for x in range(T):
                d = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5
                if d <= 2:
                    t.put(x, y, MARI_Y)
                elif d <= 3.6:
                    t.put(x, y, MAGENTA)
                elif d <= 5.2:
                    t.put(x, y, (40, 150, 150) if (x + y) % 2 == 0 or abs(x - 7.5) < 1 or abs(y - 7.5) < 1 else MARI)
                elif d <= 6.6 and (abs(x - 7.5) < 1.5 or abs(y - 7.5) < 1.5 or abs(abs(x - 7.5) - abs(y - 7.5)) < 1):
                    t.put(x, y, MARI)
        for x, y in ((7, 7), (8, 8), (7, 8), (8, 7)):
            t.put(x, y, WHITE)
        for x, y in ((7, 0), (8, 0), (0, 7), (0, 8), (15, 7), (15, 8), (7, 15), (8, 15), (2, 2), (13, 2), (2, 13), (13, 13)):
            t.put(x, y, WHITE)

    def sweets_case(t: Tile):
        t.rect(1, 4, 14, 14, (180, 140, 60)), t.rect(1, 11, 14, 11, darker((180, 140, 60), 0.8))
        t.box(2, 4, 13, 10, (226, 236, 232), (200, 170, 90))
        for x in (3, 5, 7):
            t.rect(x, 8, x + 1, 9, MARI), t.put(x, 8, MARI_Y)
        for x in (9, 11):  # silver-topped barfi diamonds
            t.put(x + 1, 6, (210, 220, 228)), t.rect(x, 7, x + 2, 7, (150, 200, 140)), t.put(x + 1, 8, (150, 200, 140))
        t.rect(3, 6, 4, 6, (240, 220, 200)), t.rect(6, 6, 7, 6, (250, 240, 230))
        t.shadow(1, 14)

    def bench(t: Tile):
        wood = (130, 70, 40)
        t.rect(1, 8, 14, 10, wood), t.rect(1, 8, 14, 8, lighter(wood, 0.2))
        t.rect(2, 11, 2, 14, darker(wood)), t.rect(13, 11, 13, 14, darker(wood))
        for x0, c in ((2, MAGENTA), (6, SAFFRON), (10, TEAL)):  # cushions
            t.rect(x0, 4, x0 + 3, 7, c), t.rect(x0, 4, x0 + 3, 4, lighter(c, 0.3)), t.put(x0 + 1, 6, (250, 214, 120))

    def lantern(t: Tile):  # lobby, by the desk: a paper star lantern on a stand
        t.rect(7, 0, 8, 1, (200, 170, 90))
        for y in range(2, 9):
            for x in range(3, 13):
                d = abs(x - 7.5) + abs(y - 5)
                if d <= 4.5 or (abs(x - 7.5) < 1 and abs(y - 5) <= 4) or (abs(y - 5) < 1):
                    t.put(x, y, MAGENTA if d > 2.2 else MARI_Y)
        t.put(7, 9, MARI), t.put(8, 9, MARI), t.put(7, 10, SAFFRON)  # tassel
        t.rect(5, 11, 10, 11, (200, 170, 90)), t.rect(7, 11, 8, 13, (200, 170, 90)), t.rect(5, 14, 10, 14, (150, 120, 60))
        t.shadow(5, 10)

    def urn(t: Tile):  # lobby corner: a brass urn heaped with marigolds
        brass = (206, 160, 70)
        oval(t, 7.5, 10.5, 4.5, 3.8, brass), t.rect(5, 6, 10, 7, darker(brass, 0.85)), t.put(5, 9, lighter(brass, 0.4))
        for x, y in ((4, 4), (6, 3), (8, 2), (10, 3), (11, 5), (5, 5), (7, 4), (9, 4), (3, 6), (12, 6)):
            t.rect(x, y, x + 1, y + 1, MARI if (x + y) % 2 else MARI_Y)
        t.put(6, 6, LEAF), t.put(10, 6, LEAF)
        t.shadow(3, 12)

    def garland(t: Tile):  # a marigold toran with mango-leaf drops
        for x in range(T):
            t.put(x, 1, MARI if x % 2 else MARI_Y), t.put(x, 2, MARI_Y if x % 2 else MARI)
        for x in (1, 5, 9, 13):
            for y in range(3, 7):
                t.put(x, y, MARI if y % 2 else MARI_Y)
            t.put(x, 7, LEAF), t.put(x + 1, 7, darker(LEAF, 0.8)) if x + 1 < T else None
        for x in (3, 7, 11, 15):
            t.put(x, 3, LEAF), t.put(x, 4, darker(LEAF, 0.8))

    def door_motif(px):
        for x in range(2, 14):  # a marigold toran across the top
            px[x, 1] = P(MARI if x % 2 else MARI_Y)
        for x in (3, 6, 9, 12):
            px[x, 2] = P(MARI_Y)
            px[x, 3] = P(LEAF)
        for x0 in (4, 9):  # two diyas
            px[x0, 6], px[x0 + 1, 6], px[x0 + 2, 6] = P(CLAY), P(CLAY), P(CLAY)
            px[x0 + 1, 5], px[x0 + 1, 4] = P(FLAME), P(FLAME_HI)

    st = station((226, 232, 236), TEAL, (110, 20, 70), sweets)
    st.rect(0, 7, 15, 7, (250, 214, 120))
    floor = Tile((228, 204, 162))
    for cx, cy in ((3.5, 3.5), (11.5, 11.5)):  # a quiet four-petal tile motif
        for dx, dy in ((0, -1.5), (0, 1.5), (-1.5, 0), (1.5, 0)):
            floor.put(int(cx + dx), int(cy + dy), (212, 176, 128))
        floor.put(int(cx), int(cy), (206, 150, 110))
    floor.rect(0, 15, 15, 15, (216, 190, 148)), floor.rect(15, 0, 15, 15, (216, 190, 148))
    floor.rect(0, 7, 15, 7, (220, 196, 154)), floor.rect(7, 0, 7, 15, (220, 196, 154))
    room = [
        ("floor", floor, "ground"),
        ("wall", w, "wall"),
        ("walltop", walltop(), "wall"),
        ("window", window(w), "wall"),
        ("board", board_on(w, (214, 172, 70), (100, 20, 64), menu), "wall"),
        ("station", st, "block"),
        ("station_note", with_note(st), "block"),
        ("diyas", _tile(diyas), "block"),
        ("rangoli", _tile(rangoli), "block"),
        ("sweets_case", _tile(sweets_case), "block"),
        ("seat", _tile(bench), "walk"),
    ]
    lobby = [("lantern", _tile(lantern)), ("marigolds", _tile(urn))]
    return room, lobby, _tile(garland), ((96, 52, 34), door_motif), {"field": (226, 136, 24)}


HOLIDAYS = {
    "hanukkah": hanukkah,
    "christmas": christmas,
    "lunar": lunar,
    "valentine": valentine,
    "easter": easter,
    "pride": pride,
    "july4": july4,
    "halloween": halloween,
    "diwali": diwali,
}
ROLES = ("floor", "wall", "walltop", "window", "board", "station", "station_note", "seat")


def build(sheet: Image.Image, catalog: dict) -> tuple[Image.Image, dict, list[tuple[str, list[str]]]]:
    """Draws every holiday into the sheet and catalog. Returns the sheet, the themes block and, per holiday,
    the tile names in drawing order (for the contact sheet)."""
    themes: dict = {}
    order: list[tuple[str, list[str]]] = []
    for key, make in HOLIDAYS.items():
        room, lobby, garland, (paint, motif), mat = make()
        names: list[str] = []
        tiles: dict = {"decor": []}
        for role, tile, kind in room:
            name = f"{role}_{key}"
            sheet = append_or_replace(sheet, catalog, name, tile.im, kind)
            names.append(name)
            if role in ROLES:
                tiles[role] = name
            else:
                tiles["decor"].append(name)
        door = f"door_{key}"
        sheet = append_or_replace(sheet, catalog, door, door_from(sheet, catalog, paint, motif), "walk")
        mat_name = f"mat_{key}"
        sheet = append_or_replace(sheet, catalog, mat_name, mat_from(sheet, catalog, **mat), "walk")
        lobby_names = []
        for thing, tile in lobby:
            name = f"{thing}_{key}"
            sheet = append_or_replace(sheet, catalog, name, tile.im, "block")
            lobby_names.append(name)
        garland_name = f"garland_{key}"
        sheet = append_or_replace(sheet, catalog, garland_name, garland.im, "decor")
        names += [door, mat_name, *lobby_names, garland_name]
        ordered = {r: tiles[r] for r in ("floor", "wall", "walltop", "window", "board", "station", "station_note")}
        ordered["decor"] = tiles["decor"]
        ordered["seat"] = tiles["seat"]
        themes[key] = {"tiles": ordered, "door": door, "mat": mat_name, "lobby": lobby_names, "garland": garland_name}
        order.append((key, names))
    return sheet, themes, order


def main() -> None:
    sheet_path, catalog_path = Path(sys.argv[1]), Path(sys.argv[2])
    catalog = json.loads(catalog_path.read_text())
    sheet = Image.open(sheet_path).convert("RGBA")
    sheet, themes, _ = build(sheet, catalog)
    sheet.save(sheet_path)
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n")
    out = Path(__file__).resolve().parent / "holiday_themes.json"
    out.write_text(json.dumps({"_about": "Holiday tile names per season key (tools/art/holiday_tiles.py). "
                               "tiles is the content/daily/themes.json shape; door, mat, lobby (by the desk, then "
                               "the floor corners) and garland dress the lobby.", **themes}, indent=2) + "\n")


if __name__ == "__main__":
    main()
