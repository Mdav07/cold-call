"use client";

// Top-down floor view: a canvas tile renderer with grid movement, collision, a following camera,
// and interaction with the employee or prop the player faces. Owned by A; contract in ../types.ts.
import { useCallback, useEffect, useRef, useState } from "react";
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
const INTERACT_KEYS = new Set(["Space", "Enter", "KeyE"]);
const OPPOSITE: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };

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
  const [h, setH] = useState<{ sprite: string; name: string | null }>({ sprite: fallback, name: null });
  useEffect(() => {
    try {
      if (localStorage.getItem("coldcall-hunter")) {
        const g = getHunter();
        setH({ sprite: spriteUrl(g.sprite), name: g.name });
        return;
      }
      const v = localStorage.getItem("cc-player-sprite");
      if (v && /^\/sprites\/[\w-]+\.png$/.test(v)) setH({ sprite: v, name: null });
    } catch {}
  }, []);
  return h;
}

export function FloorScene({ map, playerSprite: defaultSprite, paused, onEvent, emotes, insetBottom = 0, goal = null, tags, names }: FloorSceneProps) {
  const goalRef = useRef(goal);
  goalRef.current = goal;
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const readProps = useRef(new Set<string>()); // props the player has read: their marker goes away
  const hunter = usePickedHunter(defaultSprite);
  const playerSprite = hunter.sprite;
  const namesRef = useRef<Record<string, string | undefined>>({});
  namesRef.current = { ...names, ...(hunter.name ? { player: hunter.name } : {}) };
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const images = useImages([map.tileset, playerSprite, ...map.npcs.map((n) => n.sprite)]);

  // Mutable game state lives in refs so the animation loop does not re-render React.
  const player = useRef<Walker>({
    x: map.spawn.x, y: map.spawn.y, tx: map.spawn.x, ty: map.spawn.y,
    facing: map.spawn.facing, t: 0, moving: false, frame: 0,
  });
  const npcFacing = useRef<Partial<Record<EmployeeId, Facing>>>({});
  const held = useRef<Facing[]>([]); // most recent last
  const tapped = useRef<Facing | null>(null); // a key pressed and released before the next frame
  const insetRef = useRef(insetBottom);
  insetRef.current = insetBottom;
  const pausedRef = useRef(paused);
  const emotesRef = useRef(emotes);
  const onEventRef = useRef(onEvent);
  pausedRef.current = paused;
  emotesRef.current = emotes;
  onEventRef.current = onEvent;

  // Reset when the map changes to another place. Not when the same place comes back: Next keeps a page
  // you left mounted but hidden and re-runs its effects on return (lobby → case file → back), and a
  // guest's lobby is rebuilt once their progress loads. Both used to throw the player back to spawn.
  const placeRef = useRef<string | null>(null);
  useEffect(() => {
    const place = `${map.floor}:${map.name}:${map.width}x${map.height}`;
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
    [map, npcAt, propAt],
  );

  const facedCell = () => {
    const p = player.current;
    const [dx, dy] = DELTA[p.facing];
    return { x: p.x + dx, y: p.y + dy };
  };

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
    const prop = propAt(x, y);
    if (prop) {
      readProps.current.add(prop.id);
      onEventRef.current({ type: "interact-prop", id: prop.id });
    }
  }, [npcAt, propAt]);

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
  }, [interact]);

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

    const step = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const p = player.current;

      // Movement
      if (p.moving) {
        p.t += dt / STEP_MS;
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
          if (exit && exitsArmed) {
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
      const inset = Math.min(insetRef.current, h * 0.6) / scale; // map pixels hidden under the dialogue box
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
      const drawLayer = (layer: number[] | undefined) => {
        if (!layer || !tiles) return;
        const x0 = Math.max(0, Math.floor(camX / TILE));
        const y0 = Math.max(0, Math.floor(camY / TILE));
        const x1 = Math.min(map.width, Math.ceil((camX + viewW) / TILE) + 1);
        const y1 = Math.min(map.height, Math.ceil((camY + viewH) / TILE) + 1);
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const t = layer[y * map.width + x];
            if (t == null || t < 0) continue;
            const sx = (t % map.tilesetColumns) * TILE;
            const sy = Math.floor(t / map.tilesetColumns) * TILE;
            c.drawImage(tiles, sx, sy, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
          }
        }
      };
      drawLayer(map.layers.ground);
      drawLayer(map.layers.walls);
      drawLayer(map.layers.decor);

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
      actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());

      drawLayer(map.layers.overhead);

      // On-map text keeps the same size on screen whatever the zoom: sizes below are map pixels at 2x zoom.
      const u = 2 / scale;

      // Names above heads: small pixel text on a dark plate (box + text share one middle baseline).
      const nameTag = (x: number, y: number, text: string) => {
        c.font = `${5 * u}px ${pixelFont}, monospace`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        const pad = 4 * u;
        const wdt = Math.ceil(c.measureText(text).width + pad);
        const h = Math.round(6 * u);
        // Sprite art sits in the middle of the 16px frame; center the plate on that.
        const cx = Math.round(x + TILE / 2);
        const cy = Math.round(y - (FRAME_H - TILE) + 8);
        c.fillStyle = "rgba(21, 20, 26, 0.72)";
        c.fillRect(cx - Math.round(wdt / 2), cy - Math.round(h / 2), wdt, h);
        c.fillStyle = "#f2efe6";
        c.fillText(text, cx, cy + u); // +u optical: Press Start sits high in its em box
      };
      const nm = namesRef.current;
      // The person the player is facing gets one caption instead (below), so labels never stack.
      const [fdx, fdy] = DELTA[p.facing];
      const facingNpc = !p.moving ? npcAt(p.x + fdx, p.y + fdy) : undefined;
      if (!pausedRef.current) {
        for (const n of map.npcs)
          if (nm[n.id] && !emotesRef.current?.[n.id] && n !== facingNpc) nameTag(n.x * TILE, n.y * TILE, nm[n.id]!);
        if (nm.player && !facingNpc) nameTag(px, py, nm.player);
      }

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
        const near = Math.abs(pr.x - p.x) + Math.abs(pr.y - p.y) <= 2;
        const tw = reduceMotion ? 0.6 : (Math.sin(now / 520 + pr.x * 1.7 + pr.y) + 1) / 2;
        const a = near ? 0.55 + tw * 0.45 : 0.12 + tw * 0.3;
        // Sit the sparkle on the cork face (board frame is flush with the tile top).
        const gx = pr.x * TILE + 11, gy = pr.y * TILE + 4;
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

      // Door signs: a small backlit office sign, like an elevator floor indicator. Dark housing with a
      // lighter bevel, amber lettering with a faint glow, and the same hard drop shadow as the HUD panels.
      for (const t of tagsRef.current ?? []) {
        c.font = `${5 * u}px ${pixelFont}, monospace`;
        c.textAlign = "center";
        c.textBaseline = "alphabetic";
        const tw = Math.round(c.measureText(t.text).width + 6 * u);
        const th = Math.round(7 * u);
        const x0 = Math.round(t.endAt === "x" ? t.x * TILE - 3 - tw : t.x * TILE + TILE / 2 - tw / 2);
        const y0 = Math.round(t.y * TILE - 2 - th / 2);
        const glow = reduceMotion ? 0.5 : (Math.sin(now / 900) + 1) / 2; // a slow, gentle hum
        c.fillStyle = "rgba(10, 9, 14, 0.55)"; // drop shadow
        c.fillRect(x0 + 1, y0 + 1, tw + 1, th + 1);
        c.fillStyle = "#15141a"; // outline
        c.fillRect(x0 - 1, y0 - 1, tw + 2, th + 2);
        c.fillStyle = "#2a2833"; // housing
        c.fillRect(x0, y0, tw, th);
        c.fillStyle = "#3d3a4a"; // top bevel
        c.fillRect(x0, y0, tw, 1);
        c.fillStyle = `rgba(244, 201, 93, ${0.1 + glow * 0.06})`; // the backlight behind the lettering
        c.fillRect(x0 + 1, y0 + 2, tw - 2, th - 3);
        c.fillStyle = "#f4c95d";
        c.fillText(t.text, x0 + tw / 2, y0 + th / 2 + 2.5 * u);
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
      for (const n of map.npcs) {
        const e = emotesRef.current?.[n.id];
        if (e === "talking") bubble(n.x, n.y, "…", "#15141a");
        else if (e === "suspicious") bubble(n.x, n.y, "?", "#e8a33d");
        else if (e === "alarm") bubble(n.x, n.y, "!", "#e05d5d");
      }
      // A small dark caption above what you're facing, saying which key does what.
      const hint = (tx: number, ty: number, text: string) => {
        c.font = `${5 * u}px ${pixelFont}, monospace`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        const wdt = c.measureText(text).width + 6 * u;
        const cx = tx * TILE + TILE / 2, cy = ty * TILE - 5;
        c.fillStyle = "rgba(21, 20, 26, 0.82)";
        c.fillRect(Math.round(cx - wdt / 2), Math.round(cy - 4 * u), Math.round(wdt), Math.round(8 * u));
        c.fillStyle = "#f4c95d";
        c.textBaseline = "alphabetic";
        c.fillText(text, cx, cy + 2.5 * u);
      };
      if (!pausedRef.current && !p.moving) {
        const [dx, dy] = DELTA[p.facing];
        const fx = p.x + dx;
        const fy = p.y + dy;
        const n = npcAt(fx, fy);
        if (n && !emotesRef.current?.[n.id]) {
          /* the caption below says it */
        } else if (!n && propAt(fx, fy)) {
          // Facing something readable: a soft glow on its tile.
          const pulse = reduceMotion ? 0.5 : (Math.sin(now / 300) + 1) / 2;
          c.fillStyle = `rgba(255, 240, 200, ${0.08 + pulse * 0.08})`;
          c.fillRect(fx * TILE, fy * TILE, TILE, TILE);
          c.strokeStyle = `rgba(255, 240, 200, ${0.3 + pulse * 0.25})`;
          c.lineWidth = 1;
          c.strokeRect(fx * TILE + 0.5, fy * TILE + 0.5, TILE - 1, TILE - 1);
          hint(fx, p.facing === "down" ? fy + 1.6 : fy, "SPACE · READ");
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
    };

    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [map, images, playerSprite, walkable, npcAt, propAt]);

  return (
    <div ref={wrapRef} className="relative h-full w-full touch-none select-none overflow-hidden bg-[var(--cc-edge,#15141a)]">
      <canvas ref={canvasRef} className="block [image-rendering:pixelated]" aria-label={`${map.name}. Use the arrow keys to walk and Space to talk.`} role="img" />
      <TouchControls held={held} onA={interact} hidden={paused} />
    </div>
  );
}

/** On-screen D-pad and A button, shown on touch screens only. */
function TouchControls({
  held,
  onA,
  hidden,
}: {
  held: React.RefObject<Facing[]>;
  onA: () => void;
  hidden: boolean;
}) {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setCoarse(mq.matches);
    const on = () => setCoarse(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  if (!coarse || hidden) return null;

  const press = (d: Facing) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    held.current = [d];
  };
  const release = () => (held.current = []);
  const btn =
    "pixel-button flex h-12 w-12 items-center justify-center !p-0 text-base opacity-80 active:opacity-100";
  const pad: [Facing, string, string][] = [
    ["up", "▲", "col-start-2 row-start-1"],
    ["left", "◀", "col-start-1 row-start-2"],
    ["right", "▶", "col-start-3 row-start-2"],
    ["down", "▼", "col-start-2 row-start-3"],
  ];
  return (
    <>
      <div className="absolute bottom-4 left-4 grid grid-cols-3 grid-rows-3 gap-1">
        {pad.map(([d, label, pos]) => (
          <button
            key={d}
            type="button"
            aria-label={`Walk ${d}`}
            className={`${btn} ${pos}`}
            onPointerDown={press(d)}
            onPointerUp={release}
            onPointerCancel={release}
            onPointerLeave={release}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="Talk"
        className={`${btn} absolute bottom-10 right-6 !h-16 !w-16 rounded-full`}
        onPointerDown={(e) => {
          e.preventDefault();
          onA();
        }}
      >
        A
      </button>
    </>
  );
}

export type { FloorMap };
