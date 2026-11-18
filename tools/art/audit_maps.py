"""Audits floor maps: every collision box and interaction spot must sit on a drawn item.

The engine treats walls, `blocked` cells, NPCs and props as solid. So:
  - a prop on bare floor is an invisible wall with a marker floating over nothing;
  - a blocked cell with no wall/decor drawn is an invisible wall;
  - a "block"-kind furniture tile that isn't blocked can be walked through;
  - an NPC standing on blocking furniture or a wall overlaps the art.
Also renders an overlay per map (red = solid, yellow = prop, cyan = exit, green = spawn).

    python3 -I tools/art/audit_maps.py app/floor/maps/tiles.json <out_dir> map1.json [map2.json …]
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

T = 16


def audit(m: dict, kinds: dict[int, tuple[str, str]]) -> list[str]:
    w, h = m["width"], m["height"]
    ground, walls, decor = m["layers"]["ground"], m["layers"]["walls"], m["layers"]["decor"]
    blocked = set(m.get("blocked", []))
    out = []

    def where(i):
        return f"({i % w},{i // w})"

    def drawn(i):
        return walls[i] >= 0 or decor[i] >= 0

    for i in range(w * h):
        d = decor[i]
        if d >= 0:
            name, kind = kinds.get(d, (f"#{d}", "?"))
            if kind == "block" and i not in blocked and walls[i] < 0:
                out.append(f"walk-through furniture: {name} at {where(i)} is not blocked")
            if ground[i] < 0 and walls[i] < 0:
                out.append(f"floating art: {name} at {where(i)} has no floor under it")
        if i in blocked and not drawn(i):
            out.append(f"invisible wall: blocked cell {where(i)} has nothing drawn")
    for p in m.get("props", []):
        i = p["y"] * w + p["x"]
        if not drawn(i):
            out.append(f"prop '{p['id']}' at ({p['x']},{p['y']}) sits on bare floor (invisible wall, marker over nothing)")
    for n in m.get("npcs", []):
        i = n["y"] * w + n["x"]
        seat = kinds.get(decor[i], ("", ""))[0].startswith(("chair_", "office_chair", "seat_"))
        if walls[i] >= 0 or (decor[i] >= 0 and kinds.get(decor[i], ("", ""))[1] == "block" and not seat):
            out.append(f"npc '{n['id']}' at ({n['x']},{n['y']}) overlaps a wall or blocking furniture")
    for p in m.get("props", []):
        for n in m.get("npcs", []):
            if (p["x"], p["y"]) == (n["x"], n["y"]):
                out.append(f"prop '{p['id']}' and npc '{n['id']}' share a cell")

    # Reachability from the spawn, with the engine's rule (FloorScene walkable): walls, blocked cells and
    # NPCs are solid; props are not. Every NPC and prop needs a reachable neighbour (or, for a prop, its
    # own cell) to talk/read from, and every exit must be reachable.
    solid = set(blocked) | {n["y"] * w + n["x"] for n in m.get("npcs", [])}

    def passable(x, y):
        if not (0 <= x < w and 0 <= y < h):
            return False
        i = y * w + x
        return i not in solid and walls[i] < 0

    sp = m.get("spawn")
    if sp:
        seen = {(sp["x"], sp["y"])}
        todo = [(sp["x"], sp["y"])]
        while todo:
            x, y = todo.pop()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in seen and passable(*q):
                    seen.add(q)
                    todo.append(q)

        def near(x, y):
            return any((x + dx, y + dy) in seen for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))

        for n in m.get("npcs", []):
            if not near(n["x"], n["y"]):
                out.append(f"npc '{n['id']}' at ({n['x']},{n['y']}) can't be reached from the spawn")
        for p in m.get("props", []):
            if not near(p["x"], p["y"]) and (p["x"], p["y"]) not in seen:
                out.append(f"prop '{p['id']}' at ({p['x']},{p['y']}) can't be reached from the spawn")
        for e in m.get("exits", []):
            if (e["x"], e["y"]) not in seen:
                out.append(f"exit to {e.get('to')} at ({e['x']},{e['y']}) can't be reached from the spawn")
    return out


def overlay(m: dict, sheet: Image.Image, cols: int, path: Path) -> None:
    w, h = m["width"], m["height"]
    im = Image.new("RGBA", (w * T, h * T), (20, 20, 24, 255))

    def tile(i):
        return sheet.crop(((i % cols) * T, (i // cols) * T, (i % cols) * T + T, (i // cols) * T + T))

    for layer in ("ground", "walls", "decor"):
        for k, i in enumerate(m["layers"][layer]):
            if i >= 0:
                im.alpha_composite(tile(i), ((k % w) * T, (k // w) * T))
    S = 3
    im = im.resize((w * T * S, h * T * S), Image.NEAREST)
    d = ImageDraw.Draw(im, "RGBA")
    solid = set(m.get("blocked", [])) | {i for i, t in enumerate(m["layers"]["walls"]) if t >= 0}
    for i in solid:
        x, y = (i % w) * T * S, (i // w) * T * S
        d.rectangle([x + 2, y + 2, x + T * S - 3, y + T * S - 3], outline=(255, 70, 70, 200), width=2)
    for p in m.get("props", []):
        x, y = p["x"] * T * S, p["y"] * T * S
        d.rectangle([x + 5, y + 5, x + T * S - 6, y + T * S - 6], outline=(255, 220, 60, 255), width=3)
    for e in m.get("exits", []):
        x, y = e["x"] * T * S, e["y"] * T * S
        d.rectangle([x + 5, y + 5, x + T * S - 6, y + T * S - 6], outline=(80, 220, 255, 255), width=3)
    for n in m.get("npcs", []):
        x, y = n["x"] * T * S, n["y"] * T * S
        d.ellipse([x + 12, y + 12, x + T * S - 13, y + T * S - 13], fill=(200, 120, 255, 200))
    s = m["spawn"]
    d.ellipse([s["x"] * T * S + 14, s["y"] * T * S + 14, (s["x"] + 1) * T * S - 15, (s["y"] + 1) * T * S - 15], fill=(80, 230, 120, 220))
    im.save(path)


def main() -> None:
    catalog = json.loads(Path(sys.argv[1]).read_text())
    kinds = {v["index"]: (k, v["kind"]) for k, v in catalog["tiles"].items()}
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    sheet = Image.open("public" + catalog["tileset"]).convert("RGBA")
    total = 0
    for arg in sys.argv[3:]:
        m = json.loads(Path(arg).read_text())
        problems = audit(m, kinds)
        total += len(problems)
        name = Path(arg).stem
        overlay(m, sheet, catalog["columns"], out_dir / f"{name}.png")
        print(f"{name}: {'ok' if not problems else str(len(problems)) + ' problem(s)'}")
        for p in problems:
            print(f"  - {p}")
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main()
