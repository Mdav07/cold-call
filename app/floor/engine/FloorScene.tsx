"use client";

// Top-down floor view: a canvas tile renderer with grid movement, collision, a following camera,
// and interaction with the employee or prop the player faces. Owned by A; contract in ../types.ts.
import { useCallback, useEffect, useRef, useState } from "react";
import { useClientValue, useLatest, useMediaQuery } from "@/app/play/clientHooks";
import type { EmployeeId } from "@/shared/interfaces";
import type { Facing, FloorMap, FloorSceneProps } from "../types";
import { getHunter, spriteUrl } from "@/app/play/hunters";

const TILE = 16;
const FRAME_W = 16;
const FRAME_H = 32;
const STEP_MS = 215; // time to walk one tile
const VIEW_TILES = { w: 15, h: 10 }; // roughly how much of the floor fits on screen
const MIN_SCALE = 2; // never draw the art smaller than 2x, even on a phone
const ROW: Record<Facing, number> = { down: 0, left: 1, right: 2, up: 3 };
const DELTA: Record<Facing, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const KEY_DIR: Record<string, Facing> = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
};
/** Seats (chair_down/up/left/right, office chair front/back in tiles.json): hidden under an employee placed on one. */
const CHAIR_TILES = new Set([24, 25, 26, 27, 28, 29]);
const INTERACT_KEYS = new Set(["Space", "Enter", "KeyE"]);
const OPPOSITE: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };
/** board_* indexes in app/floor/maps/tiles.json — glints sit on the pinned notes, not tile-center. */
const BOARD_TILES = new Set([54, 55, 56, 57]);

interface Walker {
  x: number; // tile the walker is on (or leaving)
  y: number;
  tx: number; // target tile while moving
  ty: number;
  facing: Facing;
  t: number; // 0..1 progress of the current step
  moving: boolean;
  frame: number;
}

function useImages(urls: string[]) {
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  const key = urls.join("|");
  useEffect(() => {
    let alive = true;
    for (const url of new Set(key.split("|"))) {
      if (!url) continue;
      const img = new Image();
      img.onload = () => alive && setImages((m) => ({ ...m, [url]: img }));
      img.src = url;
    }
    return () => {
      alive = false;
    };
  }, [key]);
  return images;
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

/** The hunter the player picked: Audrey's hunter store ("coldcall-hunter") first, then the intro's
 *  "cc-player-sprite". Read after mount (storage is client-only). */
function usePickedHunter(fallback: string) {
  const json = useClientValue(() => {
    try {
      if (localStorage.getItem("coldcall-hunter")) {
        const g = getHunter();
        return JSON.stringify({ sprite: spriteUrl(g.sprite), name: g.name });
      }
      const v = localStorage.getItem("cc-player-sprite");
      if (v && /^\/sprites\/[\w-]+\.png$/.test(v)) return JSON.stringify({ sprite: v, name: null });
    } catch {}
    return null;
  }, null);
  return json ? (JSON.parse(json) as { sprite: string; name: string | null }) : { sprite: fallback, name: null };
}

const GUARD_SPRITE = "/sprites/guard.png";
const GUARD_STEP_MS = 270; // the escort walks a little slower than the player, so it reads as a cutscene
const GRAB_MS = 1100; // the guard stands over the player before walking them out
const FADE_MS = 700;

/** Phones held upright: the handheld-console layout (screen on top, controls on a deck below). */
export const CONSOLE_QUERY = "(pointer: coarse) and (orientation: portrait)";

export function FloorScene({ map, playerSprite: defaultSprite, paused, onEvent, emotes, insetBottom = 0, goal = null, tags, names, escort = null, deck }: FloorSceneProps) {
  const consoleMode = useMediaQuery(CONSOLE_QUERY);
  // The deck under the screen: the dialogue box covers it first, so only the rest hides the map.
  const deckRef = useRef<HTMLDivElement>(null);
  const goalRef = useLatest(goal);
  const escortRef = useLatest(escort);
  const tagsRef = useLatest(tags);
  const readProps = useRef(new Set<string>()); // props the player has read: their marker goes away
  const hunter = usePickedHunter(defaultSprite);
  const playerSprite = hunter.sprite;
  const namesRef = useLatest<Record<string, string | undefined>>({ ...names, ...(hunter.name ? { player: hunter.name } : {}) });
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const images = useImages([map.tileset, playerSprite, GUARD_SPRITE, ...map.npcs.map((n) => n.sprite)]);

  // Mutable game state lives in refs so the animation loop does not re-render React.
  const player = useRef<Walker>({
    x: map.spawn.x, y: map.spawn.y, tx: map.spawn.x, ty: map.spawn.y,
    facing: map.spawn.facing, t: 0, moving: false, frame: 0,
  });
  const npcFacing = useRef<Partial<Record<EmployeeId, Facing>>>({});
  const held = useRef<Facing[]>([]); // most recent last
  const tapped = useRef<Facing | null>(null); // a key pressed and released before the next frame
  const insetRef = useLatest(insetBottom);
  const pausedRef = useLatest(paused);
  const emotesRef = useLatest(emotes);
  const onEventRef = useLatest(onEvent);

  // Reset when the map changes to another place. Not when the same place comes back: Next keeps a page
  // you left mounted but hidden and re-runs its effects on return (lobby → case file → back), and a
  // guest's lobby is rebuilt once their progress loads. Both used to throw the player back to spawn.
  const placeRef = useRef<string | null>(null);
  useEffect(() => {
    // The spawn is part of the place: coming back to the lobby at a different entrance (RESTART) moves you there.
    const place = `${map.floor}:${map.name}:${map.width}x${map.height}:${map.spawn.x},${map.spawn.y}`;
    if (placeRef.current === place) return;
    placeRef.current = place;
    player.current = {
      x: map.spawn.x, y: map.spawn.y, tx: map.spawn.x, ty: map.spawn.y,
      facing: map.spawn.facing, t: 0, moving: false, frame: 0,
    };
    npcFacing.current = Object.fromEntries(map.npcs.map((n) => [n.id, n.facing]));
  }, [map]);

  useEffect(() => {
    if (paused) {
      held.current = [];
      tapped.current = null;
    }
  }, [paused]);

  // ---------- rules ----------

  const blockedSet = useRef(new Set<number>());
  useEffect(() => {
    blockedSet.current = new Set(map.blocked ?? []);
  }, [map]);

  const npcAt = useCallback((x: number, y: number) => map.npcs.find((n) => n.x === x && n.y === y), [map]);
  const propAt = useCallback((x: number, y: number) => map.props?.find((p) => p.x === x && p.y === y), [map]);

  const walkable = useCallback(
    (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
      const i = y * map.width + x;
      if (map.layers.walls[i] >= 0 || blockedSet.current.has(i)) return false;
      if (npcAt(x, y)) return false; // props are notes on walls/desks: furniture blocks, the note itself doesn't
      return true;
    },
    [map, npcAt],
  );

  const facedCell = () => {
    const p = player.current;
    const [dx, dy] = DELTA[p.facing];
    return { x: p.x + dx, y: p.y + dy };
  };

  // The touch pad's held direction (the pad must not write the parent's ref itself).
  const hold = useCallback((d: Facing | null) => {
    held.current = d ? [d] : [];
  }, []);

  const interact = useCallback(() => {
    const p = player.current;
    if (pausedRef.current || p.moving) return;
    const { x, y } = facedCell();
    const npc = npcAt(x, y);
    if (npc) {
      npcFacing.current[npc.id] = OPPOSITE[p.facing];
      onEventRef.current({ type: "interact-npc", id: npc.id });
      return;
    }
    // Face a prop, or stand on one (doormat labels): Space still opens it.
    const prop = propAt(x, y) ?? propAt(p.x, p.y);
    if (prop) {
      readProps.current.add(prop.id);
      onEventRef.current({ type: "interact-prop", id: prop.id });
    }
  }, [npcAt, propAt, onEventRef, pausedRef]);

  // ---------- input ----------

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target) || pausedRef.current) return;
      const dir = KEY_DIR[e.code];
      if (dir) {
        e.preventDefault();
        held.current = [...held.current.filter((d) => d !== dir), dir];
        if (!e.repeat) tapped.current = dir;
      } else if (INTERACT_KEYS.has(e.code) && !e.repeat) {
        e.preventDefault();
        interact();
      }
    };
    const up = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.code];
      if (dir) held.current = held.current.filter((d) => d !== dir);
    };
    const clear = () => (held.current = []);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, [interact, pausedRef]);

  // ---------- loop ----------

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cssW = 0;
    let cssH = 0;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      cssW = Math.max(1, Math.floor(r.width));
      cssH = Math.max(1, Math.floor(r.height));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let last = performance.now();
    const loopStart = last;
    let nextIdleTurn = last + 2500;
    let raf = 0;
    // Armed unless the player starts on an exit (just arrived through it). A page coming back from
    // hidden keeps the player where they stood, often beside a door, and that door must still work.
    let exitsArmed = !map.exits?.some((e) => e.x === player.current.x && e.y === player.current.y);
    held.current = [];
    tapped.current = null;

    // The part of the map that has art: the camera never shows the void past it.
    let bx0 = map.width, by0 = map.height, bx1 = 0, by1 = 0;
    for (const layer of [map.layers.ground, map.layers.walls]) {
      if (!layer) continue;
      for (let i = 0; i < layer.length; i++) {
        if (layer[i] == null || layer[i] < 0) continue;
        const x = i % map.width, y = Math.floor(i / map.width);
        bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x + 1); by1 = Math.max(by1, y + 1);
      }
    }
    if (bx1 <= bx0) { bx0 = 0; by0 = 0; bx1 = map.width; by1 = map.height; }

    // Daylight from the windows (window tiles in /tiles/plumpurse.png): a warm pool on the floor below each.
    const WINDOW_TILES = new Set([2, 6, 10, 14]);
    const windows: { x: number; y: number }[] = [];
    map.layers.walls.forEach((t, i) => {
      if (WINDOW_TILES.has(t)) windows.push({ x: i % map.width, y: Math.floor(i / map.width) });
    });

    const pixelFont = getComputedStyle(document.body).getPropertyValue("--font-pixel").trim() || "monospace";

    // Shortest walk from the player to the goal (or to a tile next to it, for a person or a prop).
    let pathKey = "";
    let path: { x: number; y: number }[] = [];
    const findPath = (sx: number, sy: number, g: { x: number; y: number }) => {
      const key = `${sx},${sy},${g.x},${g.y}`;
      if (key === pathKey) return path;
      pathKey = key;
      const W = map.width;
      // A walkable goal or a door is stepped onto; a person or a prop is walked up to.
      const onto = walkable(g.x, g.y) || !!map.exits?.some((e) => e.x === g.x && e.y === g.y);
      const isEnd = (x: number, y: number) =>
        onto ? x === g.x && y === g.y : Math.abs(x - g.x) + Math.abs(y - g.y) === 1;
      const prev = new Map<number, number>([[sy * W + sx, -1]]);
      const queue = [sy * W + sx];
      let end = -1;
      while (queue.length) {
        const i = queue.shift()!;
        const x = i % W, y = Math.floor(i / W);
        if (isEnd(x, y)) { end = i; break; }
        for (const [dx, dy] of Object.values(DELTA)) {
          const nx = x + dx, ny = y + dy, j = ny * W + nx;
          if (prev.has(j)) continue;
          if (!walkable(nx, ny) && !(onto && nx === g.x && ny === g.y)) continue;
          prev.set(j, i);
          queue.push(j);
        }
      }
      path = [];
      for (let i = end; i >= 0 && prev.get(i) !== -1; i = prev.get(i)!) path.unshift({ x: i % W, y: Math.floor(i / W) });
      return path;
    };

    // ---------- the escort: security walks the player out (a cutscene at 100% suspicion) ----------
    type Pt = { x: number; y: number };
    type Escort = { key: string; phase: "in" | "grab" | "out" | "fade"; g: Walker; path: Pt[]; at: number; done: boolean };
    let esc: Escort | null = null;
    const door: Pt = map.exits?.[0] ?? map.spawn;
    /** Breadth-first walk from (sx, sy) to the first cell where isEnd holds; the path excludes the start. */
    const bfs = (sx: number, sy: number, isEnd: (x: number, y: number) => boolean, pass: (x: number, y: number) => boolean): Pt[] | null => {
      const W = map.width;
      const prev = new Map<number, number>([[sy * W + sx, -1]]);
      const queue = [sy * W + sx];
      while (queue.length) {
        const i = queue.shift()!;
        const x = i % W, y = Math.floor(i / W);
        if (isEnd(x, y)) {
          const out: Pt[] = [];
          for (let k = i; prev.get(k) !== -1; k = prev.get(k)!) out.unshift({ x: k % W, y: Math.floor(k / W) });
          return out;
        }
        for (const [dx, dy] of Object.values(DELTA)) {
          const nx = x + dx, ny = y + dy, j = ny * W + nx;
          if (prev.has(j) || !pass(nx, ny)) continue;
          prev.set(j, i);
          queue.push(j);
        }
      }
      return null;
    };
    const faceTo = (from: Pt, to: Pt): Facing =>
      to.x > from.x ? "right" : to.x < from.x ? "left" : to.y > from.y ? "down" : "up";
    const startEscort = (key: string, now: number): Escort | null => {
      const p = player.current;
      if (p.moving) return null; // let the current step finish first
      const g: Walker = { x: door.x, y: door.y, tx: door.x, ty: door.y, facing: "down", t: 0, moving: false, frame: 0 };
      const notPlayer = (x: number, y: number) => !(x === p.x && y === p.y);
      const nextTo = (x: number, y: number) => Math.abs(x - p.x) + Math.abs(y - p.y) === 1;
      const path = bfs(door.x, door.y, nextTo, (x, y) => walkable(x, y) && notPlayer(x, y));
      return { key, phase: path ? "in" : "fade", g, path: path ?? [], at: now, done: false };
    };
    /** Walk the guard one tile along esc.path; returns the tile it left, or null if it didn't start a step. */
    const guardStep = (e: Escort): Pt | null => {
      const next = e.path.shift();
      if (!next) return null;
      const from = { x: e.g.x, y: e.g.y };
      e.g.facing = faceTo(from, next);
      e.g.tx = next.x;
      e.g.ty = next.y;
      e.g.t = 0;
      e.g.moving = true;
      return from;
    };
    const runEscort = (now: number, dt: number) => {
      const e = esc!;
      const p = player.current;
      const g = e.g;
      if (g.moving) {
        g.t += dt / GUARD_STEP_MS;
        g.frame = g.t < 0.5 ? 1 : 3;
        if (g.t >= 1) {
          g.x = g.tx;
          g.y = g.ty;
          g.t = 0;
          g.moving = false;
          g.frame = 0;
        }
      }
      if (g.moving || p.moving) return;
      if (e.phase === "in") {
        if (!guardStep(e)) {
          // Beside the player: they face each other, and the guard says their line.
          g.facing = faceTo(g, p);
          p.facing = faceTo(p, g);
          e.phase = "grab";
          e.at = now;
        }
      } else if (e.phase === "grab") {
        if (now - e.at < GRAB_MS) return;
        // Back to the door, with the player one step behind the guard.
        const path = bfs(g.x, g.y, (x, y) => x === door.x && y === door.y, (x, y) => (walkable(x, y) || (x === door.x && y === door.y)) && !(x === p.x && y === p.y));
        e.path = path ?? [];
        e.phase = "out";
      } else if (e.phase === "out") {
        const left = guardStep(e);
        if (left) {
          p.facing = faceTo(p, left);
          p.tx = left.x;
          p.ty = left.y;
          p.t = 0;
          p.moving = true;
        } else {
          e.phase = "fade";
          e.at = now;
        }
      } else if (e.phase === "fade" && !e.done && now - e.at >= FADE_MS) {
        e.done = true;
        escortRef.current?.onDone();
      }
    };

    const step = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const p = player.current;

      const wanted = escortRef.current;
      if (!wanted) esc = null;
      else if (!esc || esc.key !== wanted.key) esc = startEscort(wanted.key, now) ?? esc;
      if (esc) runEscort(now, dt);

      // Movement
      if (p.moving) {
        p.t += dt / (esc ? GUARD_STEP_MS : STEP_MS);
        p.frame = p.t < 0.5 ? 1 : 3;
        if (p.t >= 1) {
          p.x = p.tx;
          p.y = p.ty;
          p.t = 0;
          p.moving = false;
          p.frame = 0;
          const exit = map.exits?.find((e) => e.x === p.x && e.y === p.y);
          // Exits arm only after the player has walked onto a tile that isn't an exit, so arriving
          // next to the door (or with a key still held from the previous page) can't bounce you out.
          // Disarm on fire so a held key / double step can't queue two rides.
          if (esc) {
            // Walked by the guard: doors don't fire.
          } else if (exit && exitsArmed) {
            exitsArmed = false;
            onEventRef.current({ type: "exit", to: exit.to });
          } else if (!exit) exitsArmed = true;
        }
      }
      const want = held.current[held.current.length - 1] ?? tapped.current;
      if (!p.moving && !pausedRef.current && want) {
        const dir = want;
        tapped.current = null;
        p.facing = dir;
        const [dx, dy] = DELTA[dir];
        if (walkable(p.x + dx, p.y + dy)) {
          p.tx = p.x + dx;
          p.ty = p.y + dy;
          p.moving = true;
          p.t = 0;
        } else if (now - loopStart > 500) {
          // Standing on a door you came back through (the lobby keeps your spot): pushing on through it
          // takes it, instead of making you step off and back on. Not in the first moments of the page,
          // so a key still held from the previous page can't bounce you straight back out.
          const exit = map.exits?.find((e) => e.x === p.x && e.y === p.y);
          if (exit) {
            exitsArmed = false;
            onEventRef.current({ type: "exit", to: exit.to });
          }
        }
      }

      // Idle NPCs look around now and then, unless they are talking.
      if (now > nextIdleTurn) {
        nextIdleTurn = now + 2500 + Math.random() * 3500;
        const n = map.npcs[Math.floor(Math.random() * map.npcs.length)];
        if (n && !emotesRef.current?.[n.id]) {
          const dirs: Facing[] = ["down", "left", "right", "down"];
          npcFacing.current[n.id] = dirs[Math.floor(Math.random() * dirs.length)];
        }
      }

      draw(ctx, cssW, cssH, now);
      raf = requestAnimationFrame(step);
    };

    const draw = (c: CanvasRenderingContext2D, w: number, h: number, now: number) => {
      const dpr = window.devicePixelRatio || 1;
      // Same tile scale on every floor: zoom from the viewport, not the map size. Small rooms
      // letterbox on the void; big rooms scroll. (Fitting each map made Floor 0 huge and Floor 3 tiny.)
      const scale = Math.max(
        MIN_SCALE,
        Math.floor(Math.min(w / (VIEW_TILES.w * TILE), h / (VIEW_TILES.h * TILE))) || 1,
      );
      const deckH = deckRef.current?.offsetHeight ?? 0;
      const inset = Math.min(Math.max(0, insetRef.current - deckH), h * 0.6) / scale; // map pixels hidden under the dialogue box
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.imageSmoothingEnabled = false;
      c.fillStyle = "#15141a";
      c.fillRect(0, 0, c.canvas.width, c.canvas.height);

      const p = player.current;
      const px = (p.x + (p.tx - p.x) * p.t) * TILE;
      const py = (p.y + (p.ty - p.y) * p.t) * TILE;
      const viewW = w / scale;
      const viewH = h / scale;
      const left = bx0 * TILE, top = by0 * TILE;
      const mapW = (bx1 - bx0) * TILE;
      const mapH = (by1 - by0) * TILE;
      const camX =
        left + (mapW <= viewW ? (mapW - viewW) / 2 : Math.min(Math.max(px - left + TILE / 2 - viewW / 2, 0), mapW - viewW));
      // The visible area is the part above the inset; the camera may scroll past the map's bottom
      // edge by the inset so the player is never hidden under the dialogue box.
      const visH = viewH - inset;
      const camY =
        top +
        (mapH <= visH ? (mapH - visH) / 2 : Math.min(Math.max(py - top + TILE / 2 - visH / 2, 0), mapH - visH));

      // Whole pixels at the chosen scale keep the art crisp.
      c.setTransform(dpr * scale, 0, 0, dpr * scale, -Math.round(camX * scale) * dpr, -Math.round(camY * scale) * dpr);

      const tiles = images[map.tileset];
      const drawLayer = (layer: number[] | undefined, keep?: (i: number, t: number) => boolean) => {
        if (!layer || !tiles) return;
        const x0 = Math.max(0, Math.floor(camX / TILE));
        const y0 = Math.max(0, Math.floor(camY / TILE));
        const x1 = Math.min(map.width, Math.ceil((camX + viewW) / TILE) + 1);
        const y1 = Math.min(map.height, Math.ceil((camY + viewH) / TILE) + 1);
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const t = layer[y * map.width + x];
            if (t == null || t < 0) continue;
            if (keep && !keep(y * map.width + x, t)) continue;
            const sx = (t % map.tilesetColumns) * TILE;
            const sy = Math.floor(t / map.tilesetColumns) * TILE;
            c.drawImage(tiles, sx, sy, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
          }
        }
      };
      drawLayer(map.layers.ground);
      drawLayer(map.layers.walls);
      // A chair an employee is placed on is hidden (they sit at it all day). The player's chair stays:
      // it's drawn before the characters, so the player simply stands in front of it, and chairs no
      // longer vanish as you walk over them.
      const seated = new Set<number>(map.npcs.map((n) => n.y * map.width + n.x));
      drawLayer(map.layers.decor, (i, t) => !(CHAIR_TILES.has(t) && seated.has(i)));

      // On-map text keeps the same size on screen whatever the zoom: sizes below are map pixels at 2x zoom.
      // Phones get smaller on-map text (names, LOCKED, door labels): it was crowding the small screen.
      const u = (2 / scale) * (w < 600 ? 0.8 : 1);

      // Names above heads: small pixel text on a dark plate. Press Start's measureText runs short,
      // so pad generously and size the box from real glyph bounds when the browser reports them.
      // A caption next to the screen's edge slides in so it isn't clipped (phones show a few tiles only).
      const keepInView = (cx: number, w: number) => {
        const lo = camX + w / 2 + 2, hi = camX + viewW - w / 2 - 2;
        return lo > hi ? cx : Math.min(hi, Math.max(lo, cx));
      };
      // White pixel text centred in a dark plate (box = false: text only, with a dark shadow). The glyphs
      // are placed from their measured ink bounds, so they sit in the middle of the box both ways.
      const plate = (x: number, y: number, text: string, padX: number, padY: number, opts: { box?: boolean; clamp?: boolean; size?: number } = {}) => {
        c.font = `${opts.size ?? 5 * u}px ${pixelFont}, monospace`;
        c.textAlign = "left";
        c.textBaseline = "alphabetic";
        const m = c.measureText(text);
        const left = m.actualBoundingBoxLeft ?? 0;
        const inkW = Math.max(m.width, left + (m.actualBoundingBoxRight ?? m.width));
        const asc = m.actualBoundingBoxAscent ?? 5 * u;
        const desc = m.actualBoundingBoxDescent ?? 0;
        const wdt = Math.ceil(inkW + padX * 2);
        const h = Math.ceil(asc + desc + padY * 2);
        const cx = opts.clamp === false ? x : keepInView(x, wdt);
        const bx = Math.round(cx - wdt / 2), by = Math.round(y - h / 2);
        const tx = bx + padX + left, ty = by + padY + asc;
        if (opts.box !== false) {
          c.fillStyle = "rgba(21, 20, 26, 0.82)";
          c.fillRect(bx, by, wdt, h);
        } else {
          c.fillStyle = "rgba(21, 20, 26, 0.75)";
          c.fillText(text, tx + u, ty + u);
        }
        c.fillStyle = "#f2efe6";
        c.fillText(text, tx, ty);
      };
      // A tag's text size and padding scale. `fit`: the plate stays within that many tiles, its text
      // shrinking when the room is drawn small (the lobby's names on a phone), down to 60% of the usual size.
      const tagFont = (t: { text: string; fit?: number }) => {
        let size = 5 * u, pad = 1;
        c.font = `${size}px ${pixelFont}, monospace`;
        if (t.fit) {
          const room = t.fit * TILE, need = c.measureText(t.text).width + 8 * u;
          if (need > room) {
            pad = Math.max(0.6, room / need);
            size *= pad;
          }
        }
        return { size, pad };
      };

      // Mat words are printed on the floor: drawn before the characters, so whoever stands on a mat
      // covers its word instead of the word floating over them. Same boxed plate as the other labels.
      for (const t of tagsRef.current ?? []) {
        if (!t.mat) continue;
        const { size, pad } = tagFont(t);
        plate(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, t.text, 4 * u * pad, 2.5 * u * pad, { clamp: false, size });
      }

      // Characters, back to front.
      type Actor = { y: number; draw: () => void };
      const actors: Actor[] = [];
      const drawWalker = (img: HTMLImageElement | undefined, x: number, y: number, facing: Facing, frame: number) => {
        if (!img) {
          c.fillStyle = "#f4c95d";
          c.fillRect(x + 3, y + 2, 10, 13);
          return;
        }
        // A soft oval shadow at the feet grounds each character on the floor.
        c.fillStyle = "rgba(20, 14, 30, 0.28)";
        c.beginPath();
        c.ellipse(x + TILE / 2, y + TILE - 1.5, 5.5, 2, 0, 0, Math.PI * 2);
        c.fill();
        c.drawImage(img, frame * FRAME_W, ROW[facing] * FRAME_H, FRAME_W, FRAME_H, x, y - (FRAME_H - TILE), FRAME_W, FRAME_H);
      };
      map.npcs.forEach((n, i) => {
        // Idle NPCs breathe: a 1 px bob, out of step with each other. Off for reduced motion.
        const bob = reduceMotion ? 0 : Math.floor((now / 600 + i * 0.37) % 2);
        actors.push({
          y: n.y * TILE,
          draw: () => drawWalker(images[n.sprite], n.x * TILE, n.y * TILE - bob, npcFacing.current[n.id] ?? n.facing, 0),
        });
      });
      actors.push({ y: py, draw: () => drawWalker(images[playerSprite], px, py, p.facing, p.frame) });
      const guard = esc && esc.phase !== "fade" ? esc.g : null;
      if (guard) {
        const gx = (guard.x + (guard.tx - guard.x) * guard.t) * TILE;
        const gy = (guard.y + (guard.ty - guard.y) * guard.t) * TILE;
        actors.push({ y: gy, draw: () => drawWalker(images[GUARD_SPRITE], gx, gy, guard.facing, guard.frame) });
      }
      actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());

      drawLayer(map.layers.overhead);

      const nameTag = (x: number, y: number, text: string) => plate(x + TILE / 2, y - (FRAME_H - TILE) + 8, text, 5 * u, 3 * u);
      const nm = namesRef.current;
      // The person the player is facing gets one caption instead (below), so labels never stack.
      const [fdx, fdy] = DELTA[p.facing];
      const facingNpc = !p.moving ? npcAt(p.x + fdx, p.y + fdy) : undefined;

      // Lighting: warm window light, then a soft shadow along the back wall (cozy, Stardew-like).
      c.save();
      c.globalCompositeOperation = "lighter";
      for (const wdw of windows) {
        const cx = wdw.x * TILE + TILE / 2;
        const cy = (wdw.y + 1) * TILE + TILE;
        const g = c.createRadialGradient(cx, cy, 2, cx, cy, TILE * 2.6);
        g.addColorStop(0, "rgba(255, 214, 150, 0.16)");
        g.addColorStop(1, "rgba(255, 214, 150, 0)");
        c.fillStyle = g;
        c.fillRect(cx - TILE * 3, cy - TILE * 3, TILE * 6, TILE * 6);
      }
      c.restore();

      // Guide: a faint trail of dots toward the next goal, a few tiles at a time, pulsing outward.
      const g = goalRef.current;
      if (g && !pausedRef.current) {
        const trail = findPath(p.tx, p.ty, g);
        // When the goal has a tag, the tag marks the last stretch: no dots under or around it.
        const tagged = tagsRef.current?.some((t) => !t.endAt && t.x === g.x && Math.abs(t.y - g.y) <= 1);
        const show = trail.filter((d) => !tagged || Math.abs(d.x - g.x) + Math.abs(d.y - g.y) > 1).slice(0, 7);
        show.forEach((d, i) => {
          const pulse = reduceMotion ? 0.5 : (Math.sin(now / 260 - i * 0.9) + 1) / 2;
          c.fillStyle = `rgba(255, 228, 140, ${(0.35 + pulse * 0.55) * (1 - i / 10)})`;
          c.fillRect(d.x * TILE + 6.5, d.y * TILE + 6.5, 3, 3);
        });
      }

      // Unread props get a faint twinkle: a tiny four-point glint that fades in and out, brighter when
      // the player is close. Read props go quiet.
      for (const pr of map.props ?? []) {
        if (readProps.current.has(pr.id)) continue;
        if (tagsRef.current?.some((t) => t.mat && t.x === pr.x && t.y === pr.y)) continue; // the mat's word marks it
        const near = Math.abs(pr.x - p.x) + Math.abs(pr.y - p.y) <= 2;
        const tw = reduceMotion ? 0.6 : (Math.sin(now / 520 + pr.x * 1.7 + pr.y) + 1) / 2;
        const a = near ? 0.55 + tw * 0.45 : 0.12 + tw * 0.3;
        // Cork boards: sit on the pinned notes. Everything else (elevators, counters): tile center.
        const wallTile = map.layers.walls[pr.y * map.width + pr.x];
        const onBoard = BOARD_TILES.has(wallTile);
        const gx = pr.x * TILE + (onBoard ? 11 : 8);
        const gy = pr.y * TILE + 6; // board papers sit under the 2px wall-color cap
        c.fillStyle = `rgba(255, 246, 214, ${a})`;
        c.fillRect(gx, gy - 1, 1, 3);
        c.fillRect(gx - 1, gy, 3, 1);
        if (near) {
          c.fillStyle = `rgba(255, 246, 214, ${a * 0.35})`;
          c.fillRect(gx, gy - 2, 1, 1);
          c.fillRect(gx, gy + 2, 1, 1);
          c.fillRect(gx - 2, gy, 1, 1);
          c.fillRect(gx + 2, gy, 1, 1);
        }
      }

      // Name plates go over the guide dots and twinkles, so nothing is drawn across a name.
      if (!pausedRef.current) {
        for (const n of map.npcs)
          if (nm[n.id] && !emotesRef.current?.[n.id] && n !== facingNpc) nameTag(n.x * TILE, n.y * TILE, nm[n.id]!);
        // The player's own plate gives way when someone stands close enough for the plates to touch.
        const crowded = map.npcs.some((n) => Math.abs(n.x * TILE - px) < TILE * 2.5 && Math.abs(n.y * TILE - py) < TILE);
        if (nm.player && !facingNpc && !crowded) nameTag(px, py, nm.player);
      }

      // Door labels: same quiet nameplate as NPC names, centred on the doormat.
      // TUTORIAL + DAILY CASE stay visible from spawn; FLOOR N lights up when close.
      if (!pausedRef.current) {
        for (const t of tagsRef.current ?? []) {
          if (t.mat) continue; // doormat words were drawn with the floor, before the characters
          const always = !!t.always || t.text === "TUTORIAL" || t.text === "DAILY CASE";
          const dist = Math.abs(p.x - t.x) + Math.abs(p.y - t.y);
          if (!always && dist > 3) continue;
          const a = always || reduceMotion ? 1 : Math.min(1, (4 - dist) / 2);
          c.globalAlpha = a;
          const { size, pad } = tagFont(t);
          c.font = `${size}px ${pixelFont}, monospace`;
          const wdt = c.measureText(t.text).width + 8 * u * pad;
          plate(t.endAt === "x" ? t.x * TILE - wdt / 2 - 2 : t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, t.text, 4 * u * pad, 2.5 * u * pad, { clamp: false, size });
          c.globalAlpha = 1;
        }
      }

      // Emotes and the "you can talk here" hint.
      const bubble = (tileX: number, tileY: number, text: string, color: string) => {
        const bob = Math.round(Math.sin(now / 250) * 1);
        const bx = tileX * TILE + 2;
        const by = tileY * TILE - (FRAME_H - TILE) - 11 + bob;
        c.fillStyle = "#15141a";
        c.fillRect(bx - 1, by - 1, 14, 11);
        c.fillStyle = "#f2efe6";
        c.fillRect(bx, by, 12, 9);
        c.fillStyle = "#15141a";
        c.fillRect(bx + 5, by + 9, 2, 2);
        c.fillStyle = color;
        c.font = "bold 8px monospace";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(text, bx + 6, by + 5);
      };
      if (esc && esc.phase !== "fade") {
        // The guard's name plate, and their line while they stand over the player.
        const gx = esc.g.x + (esc.g.tx - esc.g.x) * esc.g.t, gy = esc.g.y + (esc.g.ty - esc.g.y) * esc.g.t;
        nameTag(gx * TILE, gy * TILE, "Security");
        if (esc.phase === "grab") {
          plate(gx * TILE + TILE / 2, gy * TILE - (FRAME_H - TILE) - 6, "That's enough. Out you go.", 4 * u, 2.5 * u);
        }
      }
      for (const n of map.npcs) {
        const e = emotesRef.current?.[n.id];
        if (e === "talking") bubble(n.x, n.y, "…", "#15141a");
        else if (e === "suspicious") bubble(n.x, n.y, "?", "#e8a33d");
        else if (e === "alarm") bubble(n.x, n.y, "!", "#e05d5d");
      }
      // A small dark caption above what you're facing, saying which key does what.
      const hint = (tx: number, ty: number, text: string) => plate(tx * TILE + TILE / 2, ty * TILE - 5, text, 3 * u, 1.5 * u);
      if (!pausedRef.current && !p.moving) {
        const [dx, dy] = DELTA[p.facing];
        const fx = p.x + dx;
        const fy = p.y + dy;
        const n = npcAt(fx, fy);
        if (n && !emotesRef.current?.[n.id]) {
          /* the caption below says it */
        } else if (!n && (propAt(fx, fy) || propAt(p.x, p.y))) {
          // Facing a readable prop, or standing on one (doormats).
          const pr = propAt(fx, fy) ?? propAt(p.x, p.y)!;
          const px0 = pr.x, py0 = pr.y;
          const pulse = reduceMotion ? 0.5 : (Math.sin(now / 300) + 1) / 2;
          c.fillStyle = `rgba(255, 240, 200, ${0.08 + pulse * 0.08})`;
          c.fillRect(px0 * TILE, py0 * TILE, TILE, TILE);
          c.strokeStyle = `rgba(255, 240, 200, ${0.3 + pulse * 0.25})`;
          c.lineWidth = 1;
          c.strokeRect(px0 * TILE + 0.5, py0 * TILE + 0.5, TILE - 1, TILE - 1);
          hint(px0, p.facing === "down" && py0 === fy ? py0 + 1.6 : py0, "SPACE · READ");
        }
        if (n && !emotesRef.current?.[n.id]) {
          const who = namesRef.current[n.id];
          // Above their head, or under their feet when the player stands above them (so it never covers you).
          hint(fx, p.facing === "down" ? fy + 1.3 : fy - 0.5, who ? `SPACE · TALK TO ${who.toUpperCase()}` : "SPACE · TALK");
        }
      }

      // A soft vignette in screen space draws the eye to the middle of the room.
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, "rgba(12, 10, 24, 0)");
      vg.addColorStop(1, "rgba(12, 10, 24, 0.38)");
      c.fillStyle = vg;
      c.fillRect(0, 0, w, h);

      // The escort ends in a fade to black, which holds until the page moves on.
      if (esc?.phase === "fade") {
        c.fillStyle = `rgba(8, 7, 14, ${Math.min(1, (now - esc.at) / FADE_MS)})`;
        c.fillRect(0, 0, w, h);
      }
    };

    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // consoleMode: rotating the phone moves the canvas into (or out of) the console's screen.
  }, [map, images, playerSprite, walkable, npcAt, propAt, emotesRef, goalRef, insetRef, namesRef, onEventRef, pausedRef, tagsRef, escortRef, consoleMode]);

  const canvas = <canvas ref={canvasRef} className="block [image-rendering:pixelated]" aria-label={`${map.name}. Use the arrow keys to walk and Space to talk.`} role="img" />;

  if (!consoleMode)
    return (
      <div ref={wrapRef} className="relative h-full w-full touch-none select-none overflow-hidden bg-[var(--cc-edge,#15141a)]">
        {canvas}
        <TouchControls onHold={hold} onA={interact} hidden={paused} />
      </div>
    );

  // Handheld console: a grey body, the map in a dark bezel (rounded bottom-right corner, like the
  // classic), and the deck below with the HUD bar, the D-pad and the A button.
  return (
    <div className="flex h-full w-full touch-none select-none flex-col bg-[#c9c5ba]">
      <div className="mx-1.5 mt-1.5 flex min-h-0 flex-1 flex-col rounded-md rounded-br-[1.75rem] bg-[#4f5165] px-1.5 pb-1 pt-1.5 shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)]">
        <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden rounded-sm bg-[var(--cc-edge,#15141a)] ring-2 ring-black/40">
          {canvas}
        </div>
        {/* Where you are, printed on the bezel (the docked HUD leaves the name out to stay one row). */}
        <p className="mt-1 truncate text-center font-pixel text-[7px] tracking-[0.3em] text-[#c9c5ba]/80" aria-hidden>
          {map.name.split(" · ")[0].toUpperCase()}
        </p>
      </div>
      <div ref={deckRef} className="flex flex-col gap-1.5 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5">
        {deck}
        <ConsolePad onHold={hold} onA={interact} disabled={paused} />
      </div>
    </div>
  );
}

/** One D-pad arrow: the same triangle for all four, so every key is the same size. */
function Arrow({ dir }: { dir: Facing }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg viewBox="0 0 10 10" width="16" height="16" aria-hidden style={{ transform: `rotate(${rot}deg)` }} shapeRendering="crispEdges">
      <path d="M5 1 L9 7 L1 7 Z" fill="currentColor" />
    </svg>
  );
}

/**
 * The D-pad as one touch area: the direction follows the thumb, so rolling from one arrow to another
 * turns without lifting. The pad holds the pointer from touch-down to release; the middle (a small
 * dead zone) keeps the current direction.
 */
function usePad(onHold: (d: Facing | null) => void) {
  const [held, setHeld] = useState<Facing | null>(null);
  const cur = useRef<Facing | null>(null);
  const set = (d: Facing | null) => {
    if (cur.current === d) return;
    cur.current = d;
    setHeld(d);
    onHold(d);
  };
  const dirAt = (e: React.PointerEvent<HTMLElement>): Facing | null => {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) return cur.current;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  };
  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      set(dirAt(e));
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) set(dirAt(e));
    },
    onPointerUp: () => set(null),
    onPointerCancel: () => set(null),
    onLostPointerCapture: () => set(null),
  };
  return { held, handlers };
}

/** The console deck's controls: a D-pad cross on the left, the A button on the right. */
function ConsolePad({ onHold, onA, disabled }: { onHold: (d: Facing | null) => void; onA: () => void; disabled: boolean }) {
  const pad = usePad(onHold);
  const arm = "flex size-12 items-center justify-center bg-[#26252e] text-[#8d8b9a]";
  const lit = "!bg-[#3a3946] !text-[#e8e6ef]";
  const keys: [Facing, string][] = [
    ["up", "col-start-2 row-start-1 rounded-t-md"],
    ["left", "col-start-1 row-start-2 rounded-l-md"],
    ["right", "col-start-3 row-start-2 rounded-r-md"],
    ["down", "col-start-2 row-start-3 rounded-b-md"],
  ];
  return (
    <div className={`flex items-center justify-between pl-4 pr-10 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
      <div className="grid touch-none select-none grid-cols-[repeat(3,3rem)] grid-rows-[repeat(3,3rem)] drop-shadow-[0_3px_0_rgba(0,0,0,0.3)]" {...pad.handlers}>
        {keys.map(([d, pos]) => (
          <button
            key={d}
            type="button"
            tabIndex={-1}
            aria-label={`Walk ${d}`}
            className={`${arm} ${pos} ${pad.held === d ? lit : ""}`}
          >
            <Arrow dir={d} />
          </button>
        ))}
        <div className="col-start-2 row-start-2 bg-[#26252e]" aria-hidden>
          <div className="m-auto mt-[1rem] size-4 rounded-full bg-[#1b1a21]" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          aria-label="Talk"
          className="size-14 rounded-full bg-[#a3245a] font-pixel text-sm text-[#f3d6e2] shadow-[0_4px_0_#5e1434] active:translate-y-[3px] active:shadow-[0_1px_0_#5e1434]"
          // On the completed tap, not on touch-down: the dialogue box opens where this button is, and a
          // touch-down trigger let the same tap's click land on the box's first choice.
          onClick={onA}
        >
          A
        </button>
        <span className="font-pixel text-[9px] tracking-widest text-[#3c3f78]" aria-hidden>
          TALK
        </span>
      </div>
    </div>
  );
}

/** On-screen D-pad and A button, shown on touch screens only. */
function TouchControls({
  onHold,
  onA,
  hidden,
}: {
  /** The direction being held on the pad, or null when released. */
  onHold: (d: Facing | null) => void;
  onA: () => void;
  hidden: boolean;
}) {
  const coarse = useMediaQuery("(pointer: coarse)");
  const padCtl = usePad(onHold);
  if (!coarse || hidden) return null;

  const btn =
    "pixel-button flex h-12 w-12 items-center justify-center !p-0 text-base opacity-80 active:opacity-100";
  const pad: [Facing, string][] = [
    ["up", "col-start-2 row-start-1"],
    ["left", "col-start-1 row-start-2"],
    ["right", "col-start-3 row-start-2"],
    ["down", "col-start-2 row-start-3"],
  ];
  return (
    <>
      <div className="absolute bottom-4 left-4 grid touch-none select-none grid-cols-3 grid-rows-3 gap-1" {...padCtl.handlers}>
        {pad.map(([d, pos]) => (
          <button
            key={d}
            type="button"
            tabIndex={-1}
            aria-label={`Walk ${d}`}
            className={`${btn} ${pos} ${padCtl.held === d ? "!opacity-100" : ""}`}
          >
            <Arrow dir={d} />
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="Talk"
        className={`${btn} absolute bottom-10 right-6 !h-16 !w-16 rounded-full`}
        onClick={onA}
      >
        A
      </button>
    </>
  );
}

export type { FloorMap };
