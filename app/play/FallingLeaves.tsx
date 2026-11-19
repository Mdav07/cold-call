// Falling autumn leaves over a scene, for the Thanksgiving season (the lobby and the seasonal room).
// Pure CSS: a few pixel-art leaves fall, sway and spin on loops. They never catch the pointer, sit under
// the HUD and dialogue (z-[5]), and stay still for players who prefer reduced motion.

const COLOURS = ["#b2362a", "#d6702a", "#e2b246", "#c85a1e", "#9c4a24"];

// A tiny maple-ish leaf on a 5x5 grid ("#" = leaf, "s" = stem).
const LEAF = [".#.#.", "#####", ".###.", "..#..", "..s.."];

function Leaf({ colour }: { colour: string }) {
  return (
    <svg viewBox="0 0 5 5" width="100%" height="100%" shapeRendering="crispEdges" aria-hidden>
      {LEAF.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={c === "s" ? "#6a4a24" : colour} />,
        ),
      )}
    </svg>
  );
}

// Fixed layout (no Math.random), so the server and the browser draw the same leaves.
const LEAVES = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 37 + 11) % 100, // % across
  size: 12 + ((i * 7) % 3) * 4, // 12, 16 or 20 px
  fall: 9 + ((i * 5) % 7), // seconds to cross the screen
  delay: -((i * 13) % 17), // negative: some are already mid-fall on load
  sway: 14 + ((i * 3) % 4) * 6, // px each way
  colour: COLOURS[i % COLOURS.length],
}));

export function FallingLeaves() {
  return (
    <div aria-hidden className="cc-leaves pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      <style>{`
        @keyframes cc-leaf-fall { from { transform: translateY(-10vh); } to { transform: translateY(110vh); } }
        @keyframes cc-leaf-sway {
          0%, 100% { transform: translateX(calc(var(--sway) * -1)) rotate(-25deg); }
          50% { transform: translateX(var(--sway)) rotate(25deg); }
        }
        .cc-leaves .cc-leaf { position: absolute; top: 0; animation: cc-leaf-fall linear infinite; opacity: 0.9; }
        .cc-leaves .cc-leaf > span { display: block; width: 100%; height: 100%; animation: cc-leaf-sway ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .cc-leaves { display: none; } }
      `}</style>
      {LEAVES.map((l, i) => (
        <div
          key={i}
          className="cc-leaf"
          style={{ left: `${l.left}%`, width: l.size, height: l.size, animationDuration: `${l.fall}s`, animationDelay: `${l.delay}s` }}
        >
          <span style={{ ["--sway" as string]: `${l.sway}px`, animationDuration: `${3 + (i % 3)}s`, animationDelay: `${l.delay}s` }}>
            <Leaf colour={l.colour} />
          </span>
        </div>
      ))}
    </div>
  );
}
