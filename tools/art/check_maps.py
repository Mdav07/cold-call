"""Checks every compiled floor map is playable: each NPC, prop and exit can be reached from spawn.

    python3 -I tools/art/check_maps.py app/floor/maps
"""

import json
import sys
from pathlib import Path


def check(m: dict) -> list[str]:
    w, h = m["width"], m["height"]
    blocked = set(m.get("blocked", []))
    blocked |= {i for i, t in enumerate(m["layers"]["walls"]) if t >= 0}
    blocked |= {i for i, t in enumerate(m["layers"]["ground"]) if t < 0}
    npcs = {(n["x"], n["y"]) for n in m["npcs"]}

    def open_cell(x: int, y: int) -> bool:
        return 0 <= x < w and 0 <= y < h and (y * w + x) not in blocked and (x, y) not in npcs

    start = (m["spawn"]["x"], m["spawn"]["y"])
    seen, todo = {start}, [start]
    while todo:
        x, y = todo.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            c = (x + dx, y + dy)
            if c not in seen and open_cell(*c):
                seen.add(c)
                todo.append(c)

    def reachable(x: int, y: int) -> bool:
        return any((x + dx, y + dy) in seen for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))

    problems = [f"npc {n['id']}" for n in m["npcs"] if not reachable(n["x"], n["y"])]
    problems += [f"prop {p['id']}" for p in m.get("props", []) if not reachable(p["x"], p["y"])]
    problems += [f"exit to {e['to']}" for e in m.get("exits", []) if (e["x"], e["y"]) not in seen and not reachable(e["x"], e["y"])]
    return problems


def main() -> None:
    failed = False
    for path in sorted(Path(sys.argv[1]).glob("floor-[0-9].json")):
        problems = check(json.loads(path.read_text()))
        print(f"{path.name}: {'ok' if not problems else 'UNREACHABLE ' + ', '.join(problems)}")
        failed |= bool(problems)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
