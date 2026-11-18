"""Adds the Daily Case's themed workplaces to the tileset: per theme a floor, wall, window, wall top, a
clue board on the wall, a station (+ the station with a note on it), three pieces of decor and a seat.
Appended at the end in place: no existing index moves (lobbyMap and the floor maps hardcode them).
Re-running is safe: tiles already in the catalog are skipped.

    python3 -I tools/art/theme_tiles.py tools/art/kenney/roguelikeIndoor_transparent.png public/tiles/plumpurse.png app/floor/maps/tiles.json

Each theme's tile names go in content/daily/themes.json. Kenney pieces are CC0 (tools/art/kenney).
"""

import json
import random
import sys
from pathlib import Path

from PIL import Image

T = 16
KENNEY_COLS = 27
VOID = (40, 38, 46)  # wall tops match the floors' plain cap

Color = tuple[int, int, int]


class Tile:
    def __init__(self, fill: Color | None = None):
        self.im = Image.new("RGBA", (T, T), (fill + (255,)) if fill else (0, 0, 0, 0))
        self.px = self.im.load()

    def put(self, x: int, y: int, c: Color):
        if 0 <= x < T and 0 <= y < T:
            self.px[x, y] = c + (255,)

    def rect(self, x0: int, y0: int, x1: int, y1: int, c: Color):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(x, y, c)

    def box(self, x0: int, y0: int, x1: int, y1: int, fill: Color, edge: Color):
        self.rect(x0, y0, x1, y1, edge)
        self.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill)

    def shadow(self, x0: int, x1: int, y: int = 15):
        for x in range(x0, x1 + 1):
            self.px[x, y] = (20, 14, 30, 70)


def darker(c: Color, k: float = 0.75) -> Color:
    return tuple(max(0, int(v * k)) for v in c)  # type: ignore[return-value]


def lighter(c: Color, k: float = 0.25) -> Color:
    return tuple(min(255, int(v + (255 - v) * k)) for v in c)  # type: ignore[return-value]


# ---------- floors ----------
def floor_checker(a: Color, b: Color, n: int = 4) -> Tile:
    t = Tile(a)
    for y in range(T):
        for x in range(T):
            if (x // n + y // n) % 2:
                t.put(x, y, b)
    return t


def floor_planks(base: Color, alt: Color, seed: int) -> Tile:
    t = Tile(base)
    rnd = random.Random(seed)
    for y in (3, 7, 11, 15):
        t.rect(0, y, 15, y, alt)
    for row in range(4):
        x = rnd.randrange(2, 14)
        t.rect(x, row * 4, x, row * 4 + 2, alt)
    for _ in range(6):
        t.put(rnd.randrange(16), rnd.randrange(16), lighter(base, 0.08))
    return t


def floor_noise(base: Color, alt: Color, seed: int, p: float = 0.18) -> Tile:
    t = Tile(base)
    rnd = random.Random(seed)
    for y in range(T):
        for x in range(T):
            if rnd.random() < p:
                t.put(x, y, alt)
    return t


def floor_squares(base: Color, grout: Color, seed: int) -> Tile:
    t = floor_noise(base, lighter(base, 0.12), seed, 0.08)
    t.rect(0, 7, 15, 7, grout)
    t.rect(7, 0, 7, 15, grout)
    return t


def floor_carpet(base: Color, motif: Color) -> Tile:
    t = Tile(base)
    for y in range(T):
        for x in range(T):
            if abs(x - 7.5) + abs(y - 7.5) in (6, 6.0) or abs(x - 7.5) + abs(y - 7.5) == 7:
                t.put(x, y, motif)
    t.put(7, 7, motif), t.put(8, 8, motif), t.put(7, 8, motif), t.put(8, 7, motif)
    return t


# ---------- walls ----------
def wall(face: Color, trim: Color, wainscot: Color | None = None, brick: bool = False) -> Tile:
    t = Tile(face)
    if brick:
        mortar = lighter(face, 0.3)
        for y in (3, 7, 11):
            t.rect(0, y, 15, y, mortar)
        for row, y0 in enumerate((0, 4, 8)):
            for x in ((4, 12) if row % 2 == 0 else (0, 8)):
                t.rect(x, y0, x, y0 + 2, mortar)
    if wainscot:
        t.rect(0, 9, 15, 15, wainscot)
        t.rect(0, 9, 15, 9, lighter(wainscot, 0.25))
        for x in (3, 8, 13):
            t.rect(x, 11, x, 14, darker(wainscot, 0.85))
    t.rect(0, 13, 15, 15, trim)
    return t


def window_on(w: Tile, frame: Color, sky: Color = (150, 200, 230)) -> Tile:
    t = Tile()
    t.im = w.im.copy()
    t.px = t.im.load()
    t.box(3, 2, 12, 10, sky, frame)
    t.rect(7, 2, 8, 10, frame)
    t.put(4, 3, lighter(sky, 0.6)), t.put(5, 3, lighter(sky, 0.6)), t.put(4, 4, lighter(sky, 0.6))
    return t


def walltop() -> Tile:
    return Tile(VOID)


def board_on(w: Tile, frame: Color, inner: Color, draw) -> Tile:
    """A board hung on the wall face. Two rows of wall stay above it, so it never touches the cap."""
    t = Tile()
    t.im = w.im.copy()
    t.px = t.im.load()
    t.box(2, 2, 13, 13, inner, frame)
    draw(t)
    return t


# ---------- furniture (front view, like the Kenney counters: top surface, then the front) ----------
def station(top: Color, body: Color, edge: Color, item=None) -> Tile:
    t = Tile()
    t.rect(0, 2, 15, 6, top)
    t.rect(0, 6, 15, 6, darker(top, 0.8))
    t.rect(0, 7, 15, 14, body)
    t.rect(0, 7, 15, 7, edge)
    t.rect(1, 9, 6, 13, darker(body, 0.9)), t.rect(9, 9, 14, 13, darker(body, 0.9))
    t.put(5, 11, edge), t.put(10, 11, edge)
    t.shadow(0, 15)
    if item:
        item(t)
    return t


def with_note(s: Tile) -> Tile:
    t = Tile()
    t.im = s.im.copy()
    t.px = t.im.load()
    t.rect(6, 1, 11, 5, (244, 240, 226))
    t.rect(7, 2, 10, 2, (150, 160, 182)), t.rect(7, 4, 9, 4, (150, 160, 182))
    t.put(8, 1, (192, 57, 43))
    return t


def kenney(sheet: Image.Image, index: int, recolor: Color | None = None) -> Tile:
    r, c = divmod(index, KENNEY_COLS)
    t = Tile()
    t.im = sheet.crop((c * 17, r * 17, c * 17 + T, r * 17 + T)).convert("RGBA")
    t.px = t.im.load()
    if recolor:  # tint the mid-tones (the cloth), keep wood and outlines
        for y in range(T):
            for x in range(T):
                r0, g0, b0, a = t.px[x, y]
                if a and r0 > 150 and g0 < 120:  # Kenney's orange cloth
                    k = (r0 + g0 + b0) / (3 * 150)
                    t.px[x, y] = tuple(min(255, int(v * k)) for v in recolor) + (a,)
    return t


def armchair(cloth: Color, frame: Color) -> Tile:
    t = Tile()
    t.rect(3, 2, 12, 7, cloth), t.rect(3, 2, 12, 2, lighter(cloth, 0.2))  # back
    t.rect(2, 6, 3, 12, frame), t.rect(12, 6, 13, 12, frame)  # arms
    t.rect(4, 8, 11, 11, lighter(cloth, 0.15)), t.rect(4, 8, 11, 8, darker(cloth, 0.85))  # seat
    t.rect(3, 13, 3, 14, darker(frame)), t.rect(12, 13, 12, 14, darker(frame))
    return t


def pot(t: Tile, pot_c: Color = (176, 98, 62), x0: int = 5, x1: int = 10):
    t.rect(x0, 11, x1, 14, pot_c)
    t.rect(x0, 11, x1, 11, lighter(pot_c, 0.25))
    t.rect(x0 + 1, 15, x1 - 1, 15, darker(pot_c))


def leaves(t: Tile, cells: list[tuple[int, int]], c: Color = (74, 150, 74)):
    for x, y in cells:
        t.put(x, y, c)
        t.put(x + 1, y, darker(c, 0.8))


# ---------- the themes ----------
def themes(k: Image.Image) -> dict[str, list[tuple[str, Tile, str]]]:
    out: dict[str, list[tuple[str, Tile, str]]] = {}
    ink = (40, 34, 44)

    # Restaurant: black-and-white checks, oxblood walls over wood, a chalk menu, a steel kitchen pass.
    face, trim = (128, 40, 44), (70, 34, 28)
    w = wall(face, trim, wainscot=(120, 78, 46))

    def chalk_menu(t: Tile):
        chalk = (226, 226, 214)
        t.rect(4, 4, 11, 4, chalk)
        for y in (6, 8, 10):
            t.rect(4, y, 8, y, (170, 176, 164)), t.rect(10, y, 11, y, chalk)

    def pass_item(t: Tile):
        t.rect(2, 3, 4, 5, (236, 236, 236)), t.put(3, 4, (210, 90, 60))  # a plate
        t.rect(11, 2, 13, 5, (200, 60, 50)), t.rect(12, 2, 12, 2, (240, 230, 220))  # sauce bottle

    def herbs(t: Tile):
        pot(t)
        leaves(t, [(5, 9), (7, 8), (9, 9), (6, 10), (8, 10), (4, 10), (10, 10), (7, 6), (6, 7), (9, 7)], (86, 168, 70))

    st = station((206, 210, 214), (150, 156, 164), (110, 114, 122), pass_item)
    out["restaurant"] = [
        ("floor_restaurant", floor_checker((232, 230, 222), (52, 50, 58)), "ground"),
        ("wall_restaurant", w, "wall"),
        ("window_restaurant", window_on(w, trim), "wall"),
        ("walltop_restaurant", walltop(), "wall"),
        ("board_restaurant", board_on(w, (110, 72, 40), (44, 58, 50), chalk_menu), "wall"),
        ("station_restaurant", st, "block"),
        ("station_note_restaurant", with_note(st), "block"),
        ("stove_restaurant", kenney(k, 392), "block"),
        ("wine_rack_restaurant", kenney(k, 479), "block"),
        ("herbs_restaurant", Tile() if False else _tile(herbs), "block"),
        ("seat_restaurant", kenney(k, 54), "walk"),
    ]

    # Coffee shop: warm planks, sage walls, a chalk board with a cup, a wooden bar.
    face, trim = (128, 150, 120), (84, 60, 44)
    w = wall(face, trim, wainscot=(150, 104, 66))

    def cup_menu(t: Tile):
        chalk = (232, 228, 214)
        t.rect(4, 4, 6, 6, chalk), t.put(7, 5, chalk), t.rect(4, 7, 6, 7, chalk)  # cup
        for y in (4, 6, 8, 10):
            t.rect(9, y, 11, y, (180, 180, 168))
        t.rect(4, 10, 7, 10, (180, 180, 168))

    def bar_item(t: Tile):
        t.rect(3, 3, 5, 5, (240, 236, 228)), t.rect(4, 3, 4, 3, (110, 70, 40))  # cup
        t.rect(10, 2, 13, 5, (90, 92, 100)), t.rect(11, 3, 12, 3, (120, 200, 120))  # till

    def espresso(t: Tile):
        t.rect(2, 3, 13, 14, (176, 180, 188)), t.rect(2, 3, 13, 4, (210, 214, 220))
        t.rect(4, 6, 11, 9, (60, 60, 68)), t.put(10, 7, (230, 70, 60))
        t.rect(5, 10, 6, 12, (40, 40, 46)), t.rect(9, 10, 10, 12, (40, 40, 46))
        t.rect(5, 13, 6, 13, (240, 236, 228)), t.rect(9, 13, 10, 13, (240, 236, 228))
        t.shadow(2, 13)

    def pastry_case(t: Tile):
        t.rect(1, 4, 14, 14, (120, 82, 52))
        t.box(2, 4, 13, 10, (200, 226, 232), (150, 170, 178))
        for x, c in ((3, (214, 160, 80)), (6, (230, 120, 140)), (9, (200, 140, 60)), (11, (240, 220, 160))):
            t.rect(x, 8, x + 1, 9, c)
        t.shadow(1, 14)

    def sacks(t: Tile):
        for x0, c in ((2, (176, 150, 110)), (8, (160, 134, 96))):
            t.rect(x0, 7, x0 + 5, 14, c)
            t.rect(x0 + 1, 6, x0 + 4, 6, darker(c, 0.85))
            t.rect(x0 + 1, 10, x0 + 4, 11, (110, 70, 40))
        t.shadow(2, 13)

    def stool(t: Tile):
        for y in range(4, 10):
            for x in range(3, 13):
                if ((x - 7.5) / 5) ** 2 + ((y - 6.5) / 3) ** 2 <= 1:
                    t.put(x, y, (150, 100, 60) if y < 8 else (110, 70, 40))
        t.rect(5, 10, 5, 14, (60, 60, 66)), t.rect(10, 10, 10, 14, (60, 60, 66)), t.rect(5, 12, 10, 12, (60, 60, 66))

    st = station((84, 56, 40), (156, 108, 68), (110, 74, 44), bar_item)
    out["coffee"] = [
        ("floor_coffee", floor_planks((186, 140, 96), (160, 116, 78), 11), "ground"),
        ("wall_coffee", w, "wall"),
        ("window_coffee", window_on(w, trim), "wall"),
        ("walltop_coffee", walltop(), "wall"),
        ("board_coffee", board_on(w, (110, 72, 40), (38, 38, 42), cup_menu), "wall"),
        ("station_coffee", st, "block"),
        ("station_note_coffee", with_note(st), "block"),
        ("espresso_coffee", _tile(espresso), "block"),
        ("pastry_case_coffee", _tile(pastry_case), "block"),
        ("sacks_coffee", _tile(sacks), "block"),
        ("seat_coffee", _tile(stool), "walk"),
    ]

    # Consulting firm: blue-grey carpet tiles, white walls with a navy rail, a whiteboard 2x2.
    face, trim = (226, 228, 232), (54, 70, 104)
    w = wall(face, trim)
    w.rect(0, 8, 15, 8, (90, 110, 150))

    def matrix(t: Tile):
        t.rect(7, 3, 7, 12, (90, 110, 150)), t.rect(3, 7, 12, 7, (90, 110, 150))
        t.put(10, 4, (210, 60, 60)), t.put(5, 10, (60, 140, 90)), t.put(9, 9, (230, 160, 40)), t.put(4, 5, (60, 110, 200))

    def reception_item(t: Tile):
        t.rect(9, 1, 13, 4, (50, 54, 62)), t.rect(10, 2, 12, 3, (120, 170, 230)), t.rect(11, 5, 11, 5, (50, 54, 62))

    def flipchart(t: Tile):
        t.rect(4, 1, 11, 10, (246, 246, 240)), t.rect(4, 1, 11, 1, (120, 124, 132))
        t.rect(5, 8, 5, 9, (60, 110, 200)), t.rect(7, 6, 7, 9, (60, 110, 200)), t.rect(9, 4, 9, 9, (210, 60, 60))
        t.rect(5, 11, 5, 15, (110, 114, 122)), t.rect(10, 11, 10, 15, (110, 114, 122)), t.rect(7, 11, 8, 14, (110, 114, 122))

    def binders(t: Tile):
        t.box(1, 1, 14, 14, (226, 228, 232), (150, 154, 162))
        t.rect(2, 7, 13, 7, (150, 154, 162))
        for i, c in enumerate([(54, 70, 104), (200, 70, 60), (54, 70, 104), (230, 180, 60), (80, 140, 110), (54, 70, 104)]):
            t.rect(2 + i * 2, 2, 3 + i * 2, 6, c)
        for i, c in enumerate([(80, 140, 110), (54, 70, 104), (54, 70, 104), (200, 70, 60)]):
            t.rect(2 + i * 2, 9, 3 + i * 2, 13, c)
        t.shadow(1, 14, 15)

    def tall_plant(t: Tile):
        pot(t, (230, 230, 226))
        leaves(t, [(7, 1), (6, 2), (8, 3), (5, 4), (9, 5), (6, 6), (8, 7), (4, 8), (10, 8), (6, 9), (8, 9)], (60, 140, 80))

    st = station((240, 240, 238), (196, 200, 208), (54, 70, 104), reception_item)
    out["consulting"] = [
        ("floor_consulting", floor_squares((150, 160, 178), (132, 142, 160), 21), "ground"),
        ("wall_consulting", w, "wall"),
        ("window_consulting", window_on(w, (120, 124, 132)), "wall"),
        ("walltop_consulting", walltop(), "wall"),
        ("board_consulting", board_on(w, (150, 154, 162), (250, 250, 248), matrix), "wall"),
        ("station_consulting", st, "block"),
        ("station_note_consulting", with_note(st), "block"),
        ("flipchart_consulting", _tile(flipchart), "block"),
        ("binders_consulting", _tile(binders), "block"),
        ("tall_plant_consulting", _tile(tall_plant), "block"),
        ("seat_consulting", kenney(k, 216), "walk"),
    ]

    # Trading desk: charcoal carpet, navy walls, a ticker screen, desks with green-lit monitors.
    face, trim = (40, 52, 80), (24, 30, 46)
    w = wall(face, trim)

    def ticker(t: Tile):
        pts = [(3, 10), (4, 9), (5, 9), (6, 7), (7, 8), (8, 6), (9, 6), (10, 4), (11, 5), (12, 3)]
        for x, y in pts:
            t.put(x, y, (90, 220, 120))
        t.put(7, 8, (230, 80, 70))
        t.rect(3, 12, 6, 12, (90, 220, 120)), t.rect(8, 12, 12, 12, (230, 80, 70))

    def monitors(t: Tile):
        for x0 in (1, 9):
            t.rect(x0, 0, x0 + 5, 4, (30, 32, 40)), t.rect(x0 + 1, 1, x0 + 4, 3, (40, 70, 60))
            t.put(x0 + 1, 3, (90, 220, 120)), t.put(x0 + 2, 2, (90, 220, 120)), t.put(x0 + 3, 2, (230, 80, 70)), t.put(x0 + 4, 1, (90, 220, 120))
            t.rect(x0 + 2, 5, x0 + 3, 5, (30, 32, 40))

    def big_screen(t: Tile):
        t.rect(1, 2, 14, 10, (24, 26, 34)), t.rect(2, 3, 13, 9, (30, 44, 60))
        for i, x in enumerate(range(3, 13, 2)):
            h = (3, 5, 2, 6, 4)[i]
            t.rect(x, 9 - h, x, 8, (90, 220, 120) if i % 2 == 0 else (230, 80, 70))
        t.rect(7, 11, 8, 14, (60, 62, 70)), t.rect(4, 14, 11, 14, (60, 62, 70))

    def globe(t: Tile):
        for y in range(3, 11):
            for x in range(4, 12):
                if (x - 7.5) ** 2 + (y - 6.5) ** 2 <= 14:
                    t.put(x, y, (70, 130, 200))
        t.rect(6, 4, 7, 6, (90, 170, 90)), t.rect(9, 7, 10, 9, (90, 170, 90))
        t.rect(7, 11, 8, 13, (180, 140, 60)), t.rect(5, 14, 10, 14, (180, 140, 60))

    def server(t: Tile):
        t.box(3, 0, 12, 14, (44, 46, 54), (24, 26, 32))
        for y in (2, 5, 8, 11):
            t.rect(4, y, 11, y + 1, (60, 62, 72)), t.put(10, y, (90, 220, 120)), t.put(9, y, (230, 180, 60))
        t.shadow(3, 12)

    st = station((60, 62, 72), (84, 88, 100), (40, 42, 50), monitors)
    out["trading"] = [
        ("floor_trading", floor_noise((70, 72, 84), (60, 62, 74), 31), "ground"),
        ("wall_trading", w, "wall"),
        ("window_trading", window_on(w, (24, 30, 46), (120, 150, 200)), "wall"),
        ("walltop_trading", walltop(), "wall"),
        ("board_trading", board_on(w, (24, 26, 32), (16, 20, 26), ticker), "wall"),
        ("station_trading", st, "block"),
        ("station_note_trading", with_note(st), "block"),
        ("big_screen_trading", _tile(big_screen), "block"),
        ("globe_trading", _tile(globe), "block"),
        ("server_trading", _tile(server), "block"),
        ("seat_trading", kenney(k, 217), "walk"),
    ]

    # Tech startup: polished concrete, brick walls, a wall of stickies, plywood standing desks.
    face, trim = (156, 82, 62), (90, 86, 84)
    w = wall(face, trim, brick=True)

    def stickies(t: Tile):
        cs = [(247, 222, 120), (240, 150, 170), (130, 200, 230), (150, 220, 140)]
        for i, (x, y) in enumerate([(4, 4), (7, 4), (10, 4), (4, 7), (7, 7), (4, 10), (10, 10), (10, 7)]):
            t.rect(x, y, x + 1, y + 1, cs[i % 4])
        t.rect(6, 3, 6, 12, (200, 200, 200)), t.rect(9, 3, 9, 12, (200, 200, 200))

    def laptop(t: Tile):
        t.rect(4, 1, 11, 4, (190, 194, 204)), t.rect(5, 2, 10, 3, (90, 140, 230)), t.rect(3, 5, 12, 5, (160, 164, 174))

    def arcade(t: Tile):
        t.rect(3, 0, 12, 14, (60, 40, 110)), t.rect(4, 1, 11, 2, (240, 90, 160))
        t.rect(4, 4, 11, 8, (20, 22, 30)), t.put(6, 6, (90, 220, 120)), t.put(9, 5, (240, 220, 80))
        t.rect(4, 10, 11, 11, (90, 70, 150)), t.put(6, 10, (230, 60, 60)), t.put(9, 10, (60, 120, 230))
        t.shadow(3, 12)

    def drinks_fridge(t: Tile):
        t.box(3, 0, 12, 14, (200, 230, 236), (170, 174, 184))
        for y, cs in ((2, [(230, 90, 60), (240, 200, 60), (90, 200, 110)]), (6, [(90, 160, 230), (230, 90, 60), (240, 200, 60)]), (10, [(90, 200, 110), (90, 160, 230), (240, 140, 180)])):
            for i, c in enumerate(cs):
                t.rect(5 + i * 2, y, 5 + i * 2, y + 2, c)
            t.rect(4, y + 3, 11, y + 3, (170, 174, 184))
        t.shadow(3, 12)

    def white_plant(t: Tile):
        pot(t, (236, 236, 232), 4, 11)
        leaves(t, [(4, 7), (6, 5), (8, 6), (10, 7), (5, 9), (9, 9), (7, 8), (3, 9), (11, 9)], (70, 160, 90))

    def beanbag(t: Tile):
        for y in range(6, 15):
            for x in range(2, 14):
                if ((x - 7.5) / 6) ** 2 + ((y - 10.5) / 4.5) ** 2 <= 1:
                    t.put(x, y, (240, 140, 60) if y > 8 else (250, 170, 90))
        t.put(6, 9, (200, 110, 40)), t.put(9, 10, (200, 110, 40))

    st = station((214, 180, 130), (196, 160, 110), (150, 120, 80), laptop)
    out["startup"] = [
        ("floor_startup", floor_noise((176, 178, 180), (164, 166, 170), 41, 0.12), "ground"),
        ("wall_startup", w, "wall"),
        ("window_startup", window_on(w, (60, 62, 66)), "wall"),
        ("walltop_startup", walltop(), "wall"),
        ("board_startup", board_on(w, (60, 62, 66), (244, 244, 240), stickies), "wall"),
        ("station_startup", st, "block"),
        ("station_note_startup", with_note(st), "block"),
        ("arcade_startup", _tile(arcade), "block"),
        ("drinks_fridge_startup", _tile(drinks_fridge), "block"),
        ("white_plant_startup", _tile(white_plant), "block"),
        ("seat_startup", _tile(beanbag), "walk"),
    ]

    # Health clinic: mint vinyl squares, white walls with a mint band, an eye chart, a white front desk.
    face, trim = (238, 242, 240), (120, 170, 160)
    w = wall(face, trim)
    w.rect(0, 9, 15, 10, (170, 214, 204))

    def eye_chart(t: Tile):
        t.rect(6, 3, 9, 3, ink), t.rect(6, 4, 6, 6, ink), t.rect(6, 5, 8, 5, ink), t.rect(6, 6, 9, 6, ink)  # an E
        t.rect(5, 8, 5, 8, ink), t.rect(7, 8, 7, 8, ink), t.rect(9, 8, 10, 8, ink)
        for x in (4, 6, 8, 10, 11):
            t.put(x, 10, (90, 90, 96))
        for x in (5, 7, 9):
            t.put(x, 12, (140, 140, 146))

    def desk_cross(t: Tile):
        t.rect(11, 2, 11, 5, (210, 60, 60)), t.rect(10, 3, 12, 4, (210, 60, 60))
        t.rect(2, 3, 5, 5, (120, 170, 160))

    def med_cabinet(t: Tile):
        t.box(3, 1, 12, 14, (240, 242, 244), (170, 176, 184))
        t.rect(7, 4, 8, 9, (210, 60, 60)), t.rect(5, 6, 10, 7, (210, 60, 60))
        t.rect(10, 11, 10, 12, (170, 176, 184))
        t.shadow(3, 12)

    def iv_stand(t: Tile):
        t.rect(7, 2, 8, 14, (170, 176, 184)), t.rect(4, 2, 11, 2, (170, 176, 184))
        t.rect(9, 3, 11, 7, (210, 230, 240)), t.rect(10, 8, 10, 11, (210, 230, 240))
        t.rect(5, 14, 10, 14, (120, 124, 132))

    def clinic_plant(t: Tile):
        pot(t, (120, 170, 160))
        leaves(t, [(5, 6), (7, 4), (9, 6), (4, 8), (10, 8), (6, 9), (8, 9), (7, 7)], (80, 160, 90))

    def plastic_chair(t: Tile):
        c = (90, 150, 200)
        t.rect(4, 3, 11, 6, c), t.rect(4, 7, 11, 10, lighter(c, 0.2))
        t.rect(4, 11, 4, 14, (120, 124, 132)), t.rect(11, 11, 11, 14, (120, 124, 132))

    st = station((248, 248, 246), (210, 230, 226), (120, 170, 160), desk_cross)
    out["clinic"] = [
        ("floor_clinic", floor_squares((206, 230, 222), (180, 206, 198), 51), "ground"),
        ("wall_clinic", w, "wall"),
        ("window_clinic", window_on(w, (170, 176, 184)), "wall"),
        ("walltop_clinic", walltop(), "wall"),
        ("board_clinic", board_on(w, (170, 176, 184), (252, 252, 250), eye_chart), "wall"),
        ("station_clinic", st, "block"),
        ("station_note_clinic", with_note(st), "block"),
        ("med_cabinet_clinic", _tile(med_cabinet), "block"),
        ("iv_stand_clinic", _tile(iv_stand), "block"),
        ("plant_clinic", _tile(clinic_plant), "block"),
        ("seat_clinic", _tile(plastic_chair), "walk"),
    ]

    # Law office: dark herringbone-ish planks, bottle-green walls over walnut, a framed diploma.
    face, trim = (48, 86, 66), (60, 38, 26)
    w = wall(face, trim, wainscot=(92, 58, 36))

    def diploma(t: Tile):
        t.rect(4, 4, 11, 4, (120, 100, 70)), t.rect(4, 6, 11, 6, (160, 140, 110)), t.rect(5, 8, 10, 8, (160, 140, 110))
        t.rect(9, 10, 10, 11, (190, 50, 50))

    def leather_top(t: Tile):
        t.rect(2, 3, 13, 5, (54, 96, 70))
        t.rect(10, 1, 12, 3, (230, 200, 120)), t.put(11, 0, (230, 200, 120))  # a lamp

    def law_books(t: Tile):
        t.box(1, 0, 14, 14, (92, 58, 36), (60, 38, 26))
        for row, y in enumerate((1, 5, 9)):
            for i in range(6):
                c = [(120, 40, 40), (40, 70, 50), (130, 100, 50), (120, 40, 40), (60, 50, 90), (40, 70, 50)][(i + row) % 6]
                t.rect(2 + i * 2, y, 2 + i * 2, y + 3, c)
                t.put(2 + i * 2, y + 1, (220, 190, 110))
        t.shadow(1, 14, 15)

    def scales(t: Tile):
        gold = (214, 172, 70)
        t.rect(7, 2, 8, 12, gold), t.rect(3, 3, 12, 3, gold)
        t.rect(2, 6, 5, 6, gold), t.rect(10, 6, 13, 6, gold), t.put(3, 4, gold), t.put(4, 5, gold), t.put(12, 4, gold), t.put(11, 5, gold)
        t.rect(4, 13, 11, 14, (60, 38, 26))

    def clock(t: Tile):
        t.box(4, 0, 11, 14, (110, 70, 40), (60, 38, 26))
        for y in range(2, 6):
            for x in range(5, 11):
                if (x - 7.5) ** 2 + (y - 3.5) ** 2 <= 5:
                    t.put(x, y, (240, 230, 200))
        t.put(7, 3, ink), t.put(8, 3, ink), t.put(7, 2, ink)
        t.rect(7, 7, 8, 11, (214, 172, 70))
        t.shadow(4, 11)

    st = station((54, 96, 70), (100, 52, 36), (60, 30, 20), leather_top)
    out["law"] = [
        ("floor_law", floor_planks((108, 70, 44), (88, 56, 34), 61), "ground"),
        ("wall_law", w, "wall"),
        ("window_law", window_on(w, (60, 38, 26)), "wall"),
        ("walltop_law", walltop(), "wall"),
        ("board_law", board_on(w, (214, 172, 70), (240, 230, 200), diploma), "wall"),
        ("station_law", st, "block"),
        ("station_note_law", with_note(st), "block"),
        ("law_books_law", _tile(law_books), "block"),
        ("scales_law", _tile(scales), "block"),
        ("clock_law", _tile(clock), "block"),
        ("seat_law", armchair((112, 50, 36), (70, 40, 26)), "walk"),
    ]

    # Hotel lobby: burgundy patterned carpet, cream walls with a gold rail, a key rack, a marble desk.
    face, trim = (232, 220, 196), (150, 110, 50)
    w = wall(face, trim)
    w.rect(0, 9, 15, 9, (200, 160, 80))

    def key_rack(t: Tile):
        for i, x in enumerate((4, 7, 10)):
            for j, y in enumerate((4, 9)):
                t.put(x + 1, y, (60, 40, 30))
                if (i + j) % 3:
                    t.rect(x + 1, y + 1, x + 1, y + 2, (214, 172, 70)), t.rect(x, y + 3, x + 2, y + 3, (190, 50, 50))

    def bell(t: Tile):
        t.rect(3, 4, 5, 5, (214, 172, 70)), t.put(4, 3, (214, 172, 70)), t.rect(2, 6, 6, 6, (150, 110, 50))
        t.rect(10, 2, 13, 5, (244, 240, 226))

    def marble(t: Tile):
        t.put(2, 3, (200, 196, 190)), t.put(3, 4, (200, 196, 190)), t.put(8, 2, (200, 196, 190)), t.put(9, 3, (200, 196, 190))

    def front_desk_item(t: Tile):
        marble(t), bell(t)

    def palm(t: Tile):
        pot(t, (150, 110, 50))
        for x, y in [(2, 4), (3, 3), (4, 3), (5, 4), (13, 4), (12, 3), (11, 3), (10, 4), (6, 2), (7, 1), (8, 1), (9, 2), (4, 6), (11, 6)]:
            t.put(x, y, (60, 140, 70))
        t.rect(7, 4, 8, 10, (120, 90, 50))
        leaves(t, [(5, 5), (9, 5), (6, 3), (3, 5), (11, 5)], (70, 156, 80))

    def luggage(t: Tile):
        gold = (214, 172, 70)
        t.rect(3, 1, 3, 13, gold), t.rect(12, 1, 12, 13, gold), t.rect(3, 1, 12, 1, gold), t.rect(2, 13, 13, 13, gold)
        t.rect(4, 7, 8, 12, (60, 90, 140)), t.rect(9, 9, 11, 12, (150, 60, 50)), t.rect(5, 4, 10, 6, (90, 60, 40))
        t.put(4, 14, (40, 40, 46)), t.put(11, 14, (40, 40, 46))

    st = station((236, 232, 226), (96, 58, 36), (150, 110, 50), front_desk_item)
    out["hotel"] = [
        ("floor_hotel", floor_carpet((128, 36, 48), (196, 150, 70)), "ground"),
        ("wall_hotel", w, "wall"),
        ("window_hotel", window_on(w, (150, 110, 50)), "wall"),
        ("walltop_hotel", walltop(), "wall"),
        ("board_hotel", board_on(w, (96, 58, 36), (132, 90, 56), key_rack), "wall"),
        ("station_hotel", st, "block"),
        ("station_note_hotel", with_note(st), "block"),
        ("palm_hotel", _tile(palm), "block"),
        ("luggage_cart_hotel", _tile(luggage), "block"),
        ("piano_hotel", kenney(k, 240), "block"),
        ("seat_hotel", armchair((60, 110, 90), (150, 110, 50)), "walk"),
    ]
    return out


def _tile(draw) -> Tile:
    t = Tile()
    draw(t)
    return t


def main() -> None:
    kenney_path, sheet_path, catalog_path = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    k = Image.open(kenney_path).convert("RGBA")
    catalog = json.loads(catalog_path.read_text())
    cols = catalog["columns"]
    sheet = Image.open(sheet_path).convert("RGBA")
    added = 0
    for theme, tiles in themes(k).items():
        for name, tile, kind in tiles:
            if name in catalog["tiles"]:
                continue
            index = max(v["index"] for v in catalog["tiles"].values()) + 1
            rows = index // cols + 1
            if rows * T > sheet.height:
                grown = Image.new("RGBA", (sheet.width, rows * T), (0, 0, 0, 0))
                grown.alpha_composite(sheet, (0, 0))
                sheet = grown
            sheet.alpha_composite(tile.im, ((index % cols) * T, (index // cols) * T))
            catalog["tiles"][name] = {"index": index, "kind": kind}
            added += 1
    sheet.save(sheet_path)
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n")
    print(f"added {added} tiles; last index {max(v['index'] for v in catalog['tiles'].values())}")


if __name__ == "__main__":
    main()
