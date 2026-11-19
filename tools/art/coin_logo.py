# The Cold Call coin, the game logo: 16x16 pixel art with an embossed CC (or P: pass "P").
#   python3 -I tools/art/coin_logo.py <out-dir> [CC|P]   -> coin.svg, coin-256.png, apple-icon.png
# Copies live at app/icon.svg (browser tab), app/apple-icon.png (home screen) and public/logo.svg (in game).
import math, sys
from PIL import Image
out = sys.argv[1]
mark = sys.argv[2] if len(sys.argv) > 2 else "CC"
N = 16
C = {"o": "#4a2f0c", "g": "#f4c95d", "h": "#fff1b8", "s": "#d4962a", "p": "#7a4b10", "q": "#fde59a"}
grid = [["." for _ in range(N)] for _ in range(N)]
cx = cy = 7.5
for y in range(N):
    for x in range(N):
        d = math.hypot(x - cx, y - cy)
        if d > 7.7: continue
        if d > 6.95: grid[y][x] = "o"; continue
        # inner rim: lit top-left, shaded bottom-right
        if d > 5.8: grid[y][x] = "h" if (x - cx) + (y - cy) < -3.5 else ("s" if (x - cx) + (y - cy) > 3.5 else "g")
        else: grid[y][x] = "g"
# Letter bitmaps, sized so the mark is centred on the 16x16 coin (centre at 7.5, 7.5).
MARKS = {
    "P": ["XXXXX.", "X....X", "X....X", "XXXXX.", "X.....", "X.....", "X.....", "X....."],   # 6x8 at (5, 4)
    "CC": [".XXX...XXX", "X.....X...", "X.....X...", "X.....X...", "X.....X...", "X.....X...", "X.....X...", ".XXX...XXX"],  # 10x8 at (3, 4)
}
P = MARKS[mark]
ox, oy = (16 - len(P[0])) // 2, 4
for j, row in enumerate(P):          # embossed: dark letter, light edge up-left
    for i, c in enumerate(row):
        if c == "X":
            x, y = ox + i, oy + j
            inside = lambda a, b: 0 <= b - oy < len(P) and 0 <= a - ox < len(P[0]) and P[b - oy][a - ox] == "X"
            for ax, ay in ((x - 1, y), (x, y - 1)):
                if not inside(ax, ay) and grid[ay][ax] == "g" and (ax < ox or ay < oy): grid[ay][ax] = "q"
for j, row in enumerate(P):
    for i, c in enumerate(row):
        if c == "X": grid[oy + j][ox + i] = "p"
rects = []
for y in range(N):
    for x in range(N):
        k = grid[y][x]
        if k != ".": rects.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{C[k]}"/>')
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}" shape-rendering="crispEdges">' + "".join(rects) + "</svg>\n"
open(f"{out}/coin.svg", "w").write(svg)
im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
for y in range(N):
    for x in range(N):
        k = grid[y][x]
        if k != ".": im.putpixel((x, y), tuple(int(C[k][i:i+2], 16) for i in (1, 3, 5)) + (255,))
im.resize((256, 256), Image.NEAREST).save(f"{out}/coin-256.png")
bg = Image.new("RGBA", (180, 180), (21, 20, 26, 255)); bg.alpha_composite(im.resize((160, 160), Image.NEAREST), (10, 10)); bg.save(f"{out}/apple-icon.png")
print("\n".join("".join(r) for r in grid))
