"""Builds content/seasonal/seasons.json from the approved holiday layouts (tools/seasonal/layouts.json) and the
holiday room tiles (tools/art/holiday_themes.json, written by tools/art/holiday_tiles.py).

    python3 -I tools/seasonal/build_seasons.py

Each holiday has dated windows (one per year) and three layouts that rotate day by day while a window is open
(shared/seasonalCase.ts). Every layout in every window gets its own reserved year-2000 caseDate, so runs, the
leaderboard and the chain tools can tell which layout a run played and which year it belongs to. The live
Thanksgiving 2026 case keeps 2000-11-26. Invoice codes and sprites are seeded, so rebuilding changes nothing.
"""

from __future__ import annotations

import json
import random
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LAYOUTS = ROOT / "tools/seasonal/layouts.json"
ART = ROOT / "tools/art/holiday_themes.json"
OUT = ROOT / "content/seasonal/seasons.json"
LIVE = json.loads((ROOT / "tools/seasonal/thanksgiving-live.json").read_text())

CAP = "50 cents"
GREETING = {
    "thanksgiving": "Happy Thanksgiving, kid.",
    "hanukkah": "Happy Hanukkah, kid.",
    "christmas": "Merry Christmas, kid.",
    "lunar-new-year": "Happy Lunar New Year, kid.",
    "valentines": "Happy Valentine's Day, kid.",
    "easter": "Happy Easter, kid.",
    "pride": "Happy Pride, kid.",
    "fourth-of-july": "Happy Fourth of July, kid.",
    "halloween": "Happy Halloween, kid.",
    "diwali": "Happy Diwali, kid.",
}
# Which kind of voice each holiday character has (Jordan uses they/them). Voice ids per kind are in
# shared/seasonalCase.ts; each layout's payer and co-signer get different voices.
VOICE_KIND = {
    "neutral": {"Jordan Ellis"},
    "male": {
        "Hank Delgado", "Desmond Achebe", "Henri Dubois", "Oliver Grant", "Frank Kowalski", "Ziggy Lorne", "Vikram Iyer",
        "Sanjay Bhatt", "Dev Okafor", "Omar Haddad", "Tomás Reyes", "Eli Rosen", "Sam Okonkwo", "Ari Bloom", "Felix Mbeki",
        "Kenny Tran", "Danny Ho", "Arthur Chow", "Kai Nakamura", "Marcus Bell", "Jamal Reed", "Leo Santos", "Ben Adeyemi",
        "Theo Lambert", "Raj Patel", "Carlos Ruiz", "Gus Pemberton", "Wes Brennan", "Rohan Kapoor",
    },
}
VOICES = {
    "female": ["XrExE9yKIg1WjnnlVkGX", "Xb7hH8MSUJpSbSDYk0k2", "pFZP5JQG7iQjIQuC4Bku"],  # Matilda, Alice, Lily
    "male": ["TX3LPaxmHKxFdv7VOQHJ", "iP95p4xoKVk53GoZ742B", "cjVigY5qzO86Huf0OWal", "JBFqnCBsd6RMkjVDRZzb", "IKne3meq5aSn9XLyUdCD", "CwhRBWXzGAHq8TQ4Fs17"],  # Liam, Chris, Eric, George, Charlie, Roger
    "neutral": ["SAz9YHcvj6GT2YYXdXww"],  # River
}


def kind(name: str) -> str:
    return next((k for k, names in VOICE_KIND.items() if name in names), "female")


def voices_for(key: str, i: int, a: str, b: str) -> tuple[str, str]:
    r = random.Random(f"coldcall-voice:{key}:{i}")
    va = r.choice(VOICES[kind(a)])
    vb = r.choice([v for v in VOICES[kind(b)] if v != va])
    return va, vb


# Krystal's line when you clear the holiday case.
SIGNOFF = {
    "thanksgiving": "Happy Thanksgiving, kid. Save me a slice of pie.",
    "hanukkah": "Happy Hanukkah, kid. Save me a latke.",
    "christmas": "Merry Christmas, kid. That was a gift.",
    "lunar-new-year": "Happy Lunar New Year, kid. That's a lucky start.",
    "valentines": "Happy Valentine's Day, kid. They never saw it coming.",
    "easter": "Happy Easter, kid. Nice find.",
    "pride": "Happy Pride, kid. Clean work.",
    "fourth-of-july": "Happy Fourth, kid. Big finish.",
    "halloween": "Happy Halloween, kid. Scary good.",
    "diwali": "Happy Diwali, kid. Bright work.",
}
# Season key -> tile key in tools/art/holiday_themes.json (Thanksgiving keeps its harvest tiles).
ART_KEY = {
    "hanukkah": "hanukkah", "christmas": "christmas", "lunar-new-year": "lunar", "valentines": "valentine",
    "easter": "easter", "pride": "pride", "fourth-of-july": "july4", "halloween": "halloween", "diwali": "diwali",
}
FX = {
    "thanksgiving": "leaves", "hanukkah": "candles", "christmas": "snow", "lunar-new-year": "lanterns",
    "valentines": "petals", "easter": "blossom", "pride": "confetti", "fourth-of-july": "fireworks",
    "halloween": "fog", "diwali": "diyas",
}
# Staff sprites the Thanksgiving case already uses stay with it.
SPRITES = [f"/sprites/staff-{i:02d}.png" for i in range(1, 25)]


def harvest_theme() -> dict:
    return LIVE["theme"]


def theme_for(key: str, name: str, art: dict) -> tuple[dict, dict | None]:
    """The room theme and lobby dressing. Until the holiday's art lands, its room borrows the harvest tiles."""
    if key == "thanksgiving":
        return harvest_theme(), {"door": "door_harvest", "mat": "mat_harvest", "lobby": ["pumpkins_harvest", "haybale_harvest"], "garland": "garland_harvest"}
    a = art.get(ART_KEY[key])
    tiles = a["tiles"] if a else harvest_theme()["tiles"]
    lobby = {k: a[k] for k in ("door", "mat", "lobby", "garland")} if a else None
    return {"id": key, "name": name, "business": "", "float": "", "tiles": tiles}, lobby


def free_dates(anchor: date, n: int, taken: set[str]) -> list[str]:
    """The first n unused year-2000 dates from the window's opening day on."""
    out, d = [], date(2000, anchor.month, anchor.day)
    while len(out) < n:
        iso = d.isoformat()
        if iso not in taken:
            out.append(iso)
            taken.add(iso)
        d += timedelta(days=1)
        if d.year != 2000:
            d = date(2000, 1, 1)
    return out


def build_case(season: dict, i: int, l: dict, r: random.Random, sprites: list[str]) -> tuple[dict, dict]:
    e, h = l["employee"], l["helper"]
    ef, hf = e["name"].split()[0], h["name"].split()[0]
    codes = set()

    def code(prefix: str) -> str:
        while True:
            c = f"{prefix}-{r.randint(1000, 9999)}"
            if c not in codes:
                codes.add(c)
                return c

    vendors = [{"name": v["name"], "code": code(v["prefix"]), "what": v["what"]} for v in l["vendors"]]
    booked = vendors[l["allowed"]]
    case = {
        "business": l["business"],
        "float": l["float"],
        "title": l["title"],
        "place": l["place"],
        "brief": [
            f"{GREETING[season['id']]} {l['hook']} {e['name']}, the {e['title'].lower()}, holds {l['float']}, but nothing leaves without a second signature from {h['name']}, the {h['title'].lower()}.",
            f"Convince {ef} to propose a small payment to today's booked vendor, then talk {hf} into co-signing. The notes around the room will tell you who's really booked.",
        ],
        "employee": {
            "name": e["name"],
            "firstName": ef,
            "title": e["title"],
            "sprite": sprites[0],
            "personality": e["personality"],
            "tic": e["tic"],
            "softSpot": e["softSpot"],
            "redLine": f"never proposes without the invoice number and {l['check']}, never pays anyone who isn't on today's vendor sheet, and never more than {CAP} from {l['float']}. {hf} must co-sign",
        },
        "vendors": vendors,
        "allowedVendor": booked["name"],
        "allowedJob": l["job"],
        "allowedInvoice": booked["code"],
        "clues": [
            {"id": "work-order", "label": "Work order", "text": f"{booked['name']} is booked to {l['job']}. Invoice {booked['code']}, {CAP} max from {l['float']}. {ef} proposes; {hf} co-signs."},
            {"id": "soft-spot", "label": f"{ef}'s things", "text": e["softClue"]},
            {"id": "cosign", "label": "Two-signature card", "text": l["cosignClue"]},
            {"id": "red-line", "label": "Note by the phone", "text": f"No invoice number and {l['check']}, no payment. Nobody off today's vendor sheet gets a cent."},
        ],
    }
    helper = {
        "id": "helper",
        "name": h["name"],
        "firstName": hf,
        "title": h["title"],
        "sprite": sprites[1],
        "personality": h["personality"],
        "softSpot": h["softSpot"],
        "check": l["check"],
        "firstMessage": h["firstMessage"],
    }
    return case, helper


def main() -> None:
    src = json.loads(LAYOUTS.read_text())
    art = json.loads(ART.read_text()) if ART.exists() else {}
    live = LIVE
    taken: set[str] = {"2000-11-26"}
    seasons = []
    for s in src:
        theme, lobby = theme_for(s["id"], s["name"], art)
        r = random.Random(f"coldcall-season:{s['id']}")
        pool = [x for x in SPRITES if s["id"] != "thanksgiving" or x not in ("/sprites/staff-07.png", "/sprites/staff-12.png")]
        picks = r.sample(pool, len(s["layouts"]) * 2)
        layouts = []
        for i, l in enumerate(s["layouts"]):
            case, helper = build_case(s, i, l, random.Random(f"coldcall-season:{s['id']}:{i}"), picks[i * 2 : i * 2 + 2])
            if s["id"] == "thanksgiving" and i == 0:  # the live case, word for word
                case = live["case"]
                helper = {**live["helper"], "firstMessage": l["helper"]["firstMessage"]}
            va, vb = voices_for(s["id"], i, case["employee"]["name"], helper["name"])
            if s["id"] == "thanksgiving" and i == 0:
                va, vb = "XrExE9yKIg1WjnnlVkGX", "TX3LPaxmHKxFdv7VOQHJ"  # Marisol and Dev keep the voices they have
            layouts.append({"case": case, "helper": helper, "voices": {"daily": va, "helper": vb}})
        windows = []
        for opens, closes in s["windows"]:
            if s["id"] == "thanksgiving" and opens == "2026-11-16":
                dates = ["2000-11-26"] + free_dates(date(2000, 11, 27), len(layouts) - 1, taken)
            else:
                dates = free_dates(date.fromisoformat(opens), len(layouts), taken)
            windows.append({"opens": opens, "closes": closes, "caseDates": dates})
        seasons.append({
            "id": s["id"],
            "name": s["name"],
            "fx": FX[s["id"]],
            "signoff": SIGNOFF[s["id"]],
            "art": bool(s["id"] == "thanksgiving" or art.get(ART_KEY.get(s["id"], ""))),
            "theme": theme,
            "lobby": lobby,
            "caseDate": windows[0]["caseDates"][0],  # first layout of the first window (scripts/e2e-seasonal.ts default)
            "windows": windows,
            "layouts": layouts,
        })
    about = (
        "Holiday cases (shared/seasonalCase.ts). Built by tools/seasonal/build_seasons.py from tools/seasonal/layouts.json; "
        "edit those, not this file. Each holiday opens on its windows (UTC dates, inclusive) and rotates its layouts day by day. "
        "caseDates[i] is layout i's reserved year-2000 run date in that window. art=false means the room still borrows the harvest tiles."
    )
    OUT.write_text(json.dumps({"_about": about, "seasons": seasons}, indent=2, ensure_ascii=False) + "\n")
    n = sum(len(s["layouts"]) for s in seasons)
    print(f"{len(seasons)} holidays, {n} layouts, {len(taken)} reserved dates -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
