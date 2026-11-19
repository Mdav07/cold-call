// Holiday weather over a scene (the lobby and the holiday room): one effect per holiday, named by the season's
// "fx" (content/seasonal/seasons.json). Pure CSS: little pixel sprites fall, rise, drift or twinkle on loops.
// They never catch the pointer, sit under the HUD and dialogue (z-[5]), and stay still for reduced motion.

type Motion = "fall" | "rise" | "drift" | "twinkle";

interface Fx {
  motion: Motion;
  count: number;
  sizes: [number, number]; // px, smallest and largest
  speed: [number, number]; // seconds per loop, fastest and slowest
  sway: number; // px each way (fall/rise)
  spin: boolean;
  /** Sprites on a pixel grid; "." is empty, any other character is a colour from `colours` (per sprite set). */
  sprites: { grid: string[]; colours: Record<string, string> }[];
}

const g = (grid: string[], colours: Record<string, string>) => ({ grid, colours });

const FX: Record<string, Fx> = {
  leaves: {
    motion: "fall", count: 16, sizes: [12, 20], speed: [9, 15], sway: 26, spin: true,
    sprites: ["#b2362a", "#d6702a", "#e2b246", "#c85a1e", "#9c4a24"].map((c) =>
      g([".#.#.", "#####", ".###.", "..#..", "..s.."], { "#": c, s: "#6a4a24" }),
    ),
  },
  snow: {
    motion: "fall", count: 28, sizes: [6, 12], speed: [10, 18], sway: 18, spin: false,
    sprites: [g([".#.", "###", ".#."], { "#": "#f4f7ff" }), g(["#.#", ".#.", "#.#"], { "#": "#dfe9ff" }), g(["#"], { "#": "#ffffff" })],
  },
  petals: {
    motion: "fall", count: 18, sizes: [10, 16], speed: [9, 14], sway: 24, spin: true,
    sprites: [
      g([".#.#.", "#####", "#####", ".###.", "..#.."], { "#": "#e2457a" }),
      g([".#.#.", "#####", ".###.", "..#.."], { "#": "#f39ab8" }),
      g([".##", "###", "##."], { "#": "#c8264f" }),
    ],
  },
  blossom: {
    motion: "fall", count: 18, sizes: [10, 14], speed: [10, 16], sway: 22, spin: true,
    sprites: [
      g([".#.", "#o#", ".#."], { "#": "#f6c3d8", o: "#f2d16b" }),
      g([".#.", "#o#", ".#."], { "#": "#d9c6f2", o: "#f2d16b" }),
      g([".#.", "#o#", ".#."], { "#": "#fdf1a6", o: "#f2a65a" }),
    ],
  },
  confetti: {
    motion: "fall", count: 30, sizes: [6, 10], speed: [7, 12], sway: 16, spin: true,
    sprites: ["#e04848", "#ef9a2a", "#e8c930", "#3fa65a", "#3b6fd8", "#8a4fc9"].map((c) => g(["##", "##"], { "#": c })),
  },
  lanterns: {
    motion: "rise", count: 10, sizes: [14, 22], speed: [16, 24], sway: 12, spin: false,
    sprites: [g([".y.", "rrr", "ryr", "rrr", ".y."], { r: "#d8322a", y: "#f2c14e" })],
  },
  candles: {
    motion: "rise", count: 16, sizes: [8, 12], speed: [12, 20], sway: 10, spin: false,
    sprites: [
      g([".#.", "###", ".#."], { "#": "#9cc8ff" }),
      g([".#.", "#w#", ".#."], { "#": "#f2c14e", w: "#fff6d8" }),
      g(["#"], { "#": "#dfe9ff" }),
    ],
  },
  diyas: {
    motion: "twinkle", count: 22, sizes: [8, 12], speed: [2, 4], sway: 0, spin: false,
    sprites: [
      g([".f.", ".y.", "ooo"], { f: "#fff1a8", y: "#f2a531", o: "#c0602a" }),
      g([".#.", "#w#", ".#."], { "#": "#f5b731", w: "#fff6d8" }),
    ],
  },
  fireworks: {
    motion: "twinkle", count: 9, sizes: [22, 34], speed: [2.4, 4], sway: 0, spin: false,
    sprites: ["#e0464a", "#f4f4f8", "#4a6fe0"].map((c) =>
      g(["#...#...#", ".#..#..#.", "..#.#.#..", "...###...", "#########", "...###...", "..#.#.#..", ".#..#..#.", "#...#...#"], { "#": c }),
    ),
  },
  fog: {
    motion: "drift", count: 6, sizes: [18, 26], speed: [14, 22], sway: 0, spin: false,
    sprites: [g(["#.....#", "##...##", "#######", ".#y#y#.", "..###.."], { "#": "#5a4675", y: "#f2c14e" })],
  },
};

function Sprite({ grid, colours }: { grid: string[]; colours: Record<string, string> }) {
  const w = Math.max(...grid.map((r) => r.length));
  return (
    <svg viewBox={`0 0 ${w} ${grid.length}`} width="100%" height="100%" shapeRendering="crispEdges" aria-hidden>
      {grid.flatMap((row, y) =>
        [...row].map((c, x) => (c === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={colours[c] ?? "#fff"} />)),
      )}
    </svg>
  );
}

const lerp = ([a, b]: [number, number], t: number) => a + (b - a) * t;

/** The weather for a holiday's fx, or nothing for an unknown one. */
export function SeasonWeather({ fx }: { fx: string | null | undefined }) {
  const f = fx ? FX[fx] : undefined;
  if (!f) return null;
  // Fixed layout (no Math.random), so the server and the browser draw the same scene.
  const items = Array.from({ length: f.count }, (_, i) => {
    const t = ((i * 7) % 5) / 4;
    return {
      left: (i * 37 + 11) % 100,
      top: f.motion === "twinkle" ? (i * 29 + 7) % (fx === "fireworks" ? 40 : 90) : f.motion === "drift" ? 8 + ((i * 23) % 60) : 0,
      size: Math.round(lerp(f.sizes, t)),
      dur: lerp(f.speed, ((i * 5) % 7) / 6),
      delay: -((i * 13) % 17) * (f.motion === "twinkle" ? 0.31 : 1),
      sway: f.sway ? f.sway * (0.6 + ((i * 3) % 4) * 0.15) : 0,
      sprite: f.sprites[i % f.sprites.length],
    };
  });
  return (
    <div aria-hidden className="cc-wx pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      <style>{`
        @keyframes cc-wx-fall { from { transform: translateY(-10vh); } to { transform: translateY(110vh); } }
        @keyframes cc-wx-rise { from { transform: translateY(110vh); } to { transform: translateY(-15vh); } }
        @keyframes cc-wx-drift { from { transform: translateX(-15vw); } to { transform: translateX(115vw); } }
        @keyframes cc-wx-twinkle { 0%, 100% { opacity: 0; transform: scale(.4); } 40%, 60% { opacity: .95; transform: scale(1); } }
        @keyframes cc-wx-sway { 0%, 100% { transform: translateX(calc(var(--sway) * -1)); } 50% { transform: translateX(var(--sway)); } }
        @keyframes cc-wx-swayspin {
          0%, 100% { transform: translateX(calc(var(--sway) * -1)) rotate(-25deg); }
          50% { transform: translateX(var(--sway)) rotate(25deg); }
        }
        @keyframes cc-wx-bob { 0%, 100% { transform: translateY(-6px); } 50% { transform: translateY(6px); } }
        .cc-wx .cc-wx-i { position: absolute; opacity: .9; animation-timing-function: linear; animation-iteration-count: infinite; }
        .cc-wx .cc-wx-i > span { display: block; width: 100%; height: 100%; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        @media (prefers-reduced-motion: reduce) { .cc-wx { display: none; } }
      `}</style>
      {items.map((it, i) => {
        const outer = f.motion === "fall" ? "cc-wx-fall" : f.motion === "rise" ? "cc-wx-rise" : f.motion === "drift" ? "cc-wx-drift" : "cc-wx-twinkle";
        const inner = f.motion === "drift" ? "cc-wx-bob" : f.motion === "twinkle" ? "none" : f.spin ? "cc-wx-swayspin" : "cc-wx-sway";
        const pos = f.motion === "drift" ? { left: 0, top: `${it.top}%` } : f.motion === "twinkle" ? { left: `${it.left}%`, top: `${it.top}%` } : { left: `${it.left}%`, top: 0 };
        return (
          <div
            key={i}
            className="cc-wx-i"
            style={{ ...pos, width: it.size, height: it.size, animationName: outer, animationDuration: `${it.dur}s`, animationDelay: `${it.delay}s` }}
          >
            <span style={{ ["--sway" as string]: `${it.sway}px`, animationName: inner, animationDuration: `${3 + (i % 3)}s`, animationDelay: `${it.delay}s` }}>
              <Sprite {...it.sprite} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
