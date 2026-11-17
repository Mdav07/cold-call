"""Compiles text-art floor maps into the engine's FloorMap JSON (app/floor/types.ts).

    python3 -I tools/art/build_maps.py app/floor/maps/tiles.json app/floor/maps/src app/floor/maps

A source map (app/floor/maps/src/floor-<n>.json) looks like:

  {
    "floor": 1, "name": "Floor 1 · The Bullpen", "theme": "bullpen",
    "legend": { "D": "desk_m", "p": "plant", "c": "office_chair" },
    "rows": [
      "##########",
      "#...D...p#",
      "#E.......#"
    ],
    "spawn": { "x": 1, "y": 2, "facing": "up" },
    "npcs": [ { "id": "penny", "x": 4, "y": 2, "facing": "down" } ],
    "props": [ { "id": "registry", "x": 8, "y": 1, "label": "Vendor registry", "text": "..." } ],
    "exits": [ { "x": 1, "y": 2, "to": "/tower" } ]
  }

Built-in characters (any legend entry can override them):
  #  wall: the compiler picks the wall face if the cell below is open, else the wall top
  W  window in the wall
  .  floor (the theme's floor tile)
  E  elevator door (a wall; put an exit on the open cell in front of it)
  space  nothing (outside the building)
Every non-wall cell gets the theme's floor underneath, so furniture sits on carpet.
NPC sprites default to /sprites/<id>.png.
"""

import json
import sys
from pathlib import Path


def compile_map(src: dict, catalog: dict) -> dict:
    tiles = catalog["tiles"]
    theme = src["theme"]
    rows = src["rows"]
    h = len(rows)
    w = max(len(r) for r in rows)
    grid = [r.ljust(w) for r in rows]
    legend = {"E": "elevator", **src.get("legend", {})}

    def idx(name: str) -> int:
        if name not in tiles:
            raise SystemExit(f"floor {src['floor']}: unknown tile '{name}' (see tiles.json)")
        return tiles[name]["index"]

    ground = [-1] * (w * h)
    walls = [-1] * (w * h)
    decor = [-1] * (w * h)
    blocked: list[int] = []

    def is_wall(x: int, y: int) -> bool:
        return 0 <= y < h and 0 <= x < w and grid[y][x] in "#W"

    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            i = y * w + x
            if ch == " ":
                continue
            if ch in "#W":
                below_open = y + 1 < h and not is_wall(x, y + 1) and grid[y + 1][x] != " "
                if ch == "W":
                    walls[i] = idx(f"window_{theme}")
                else:
                    walls[i] = idx(f"wall_{theme}" if below_open else f"walltop_{theme}")
                continue
            ground[i] = idx(f"floor_{theme}")
            if ch == ".":
                continue
            if ch not in legend:
                raise SystemExit(f"floor {src['floor']}: character '{ch}' at ({x},{y}) has no legend entry")
            name = legend[ch]
            kind = tiles[name]["kind"] if name in tiles else None
            if kind == "wall":
                walls[i] = idx(name)
            elif kind == "ground":
                ground[i] = idx(name)
            else:
                decor[i] = idx(name)
                if kind == "block":
                    blocked.append(i)

    npcs = [{"sprite": f"/sprites/{n['id']}.png", **n} for n in src.get("npcs", [])]
    for n in npcs:
        if grid[n["y"]][n["x"]] not in ".":
            if (n["y"] * w + n["x"]) in blocked or is_wall(n["x"], n["y"]):
                raise SystemExit(f"floor {src['floor']}: {n['id']} stands on a blocked cell")

    return {
        "floor": src["floor"],
        "name": src["name"],
        "width": w,
        "height": h,
        "tileset": catalog["tileset"],
        "tilesetColumns": catalog["columns"],
        "layers": {"ground": ground, "walls": walls, "decor": decor},
        "blocked": blocked,
        "spawn": src["spawn"],
        "npcs": npcs,
        "props": src.get("props", []),
        "exits": src.get("exits", []),
    }


def main() -> None:
    catalog = json.loads(Path(sys.argv[1]).read_text())
    src_dir, out_dir = Path(sys.argv[2]), Path(sys.argv[3])
    for path in sorted(src_dir.glob("floor-*.json")):
        out = compile_map(json.loads(path.read_text()), catalog)
        target = out_dir / path.name
        target.write_text(json.dumps(out, separators=(",", ":")) + "\n")
        print(f"wrote {target} ({out['width']}x{out['height']}, {len(out['npcs'])} npcs)")


if __name__ == "__main__":
    main()
