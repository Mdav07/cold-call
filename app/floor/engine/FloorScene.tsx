"use client";

// Top-down floor view: a canvas tile renderer with grid movement, collision, a following camera,
// and interaction with the employee or prop the player faces. Owned by A; contract in ../types.ts.
import { useCallback, useEffect, useRef, useState } from "react";
import type { EmployeeId } from "@/shared/interfaces";
import type { Facing, FloorMap, FloorSceneProps } from "../types";

const TILE = 16;
const FRAME_W = 16;
const FRAME_H = 32;
const STEP_MS = 170; // time to walk one tile
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

export function FloorScene({ map, playerSprite, paused, onEvent, emotes, insetBottom = 0 }: FloorSceneProps) {
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

  // Reset when the map changes.
  useEffect(() => {
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
      if (npcAt(x, y) || propAt(x, y)) return false;
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
    if (prop) onEventRef.current({ type: "interact-prop", id: prop.id });
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
    let exitsArmed = false;
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
          if (exit && exitsArmed) onEventRef.current({ type: "exit", to: exit.to });
          else if (!exit) exitsArmed = true;
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
      // Zoom in far enough that the painted map always covers the screen: no empty void at the edges.
      const scale = Math.max(
        MIN_SCALE,
        Math.floor(Math.min(w / (VIEW_TILES.w * TILE), h / (VIEW_TILES.h * TILE))) || 1,
        // On phones the map scrolls instead: covering a tall screen would zoom far too close.
        w >= 700 ? Math.ceil(w / ((bx1 - bx0) * TILE)) : 0,
        w >= 700 ? Math.ceil(h / ((by1 - by0) * TILE)) : Math.floor((h * 0.75) / ((by1 - by0) * TILE)),
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
      if (!pausedRef.current && !p.moving) {
        const [dx, dy] = DELTA[p.facing];
        const fx = p.x + dx;
        const fy = p.y + dy;
        const n = npcAt(fx, fy);
        if (n && !emotesRef.current?.[n.id]) bubble(fx, fy, "!", "#f4c95d");
        else if (!n && propAt(fx, fy)) {
          c.fillStyle = "#f4c95d";
          const bob = Math.round(Math.sin(now / 250));
          c.fillRect(fx * TILE + 6, fy * TILE - 6 + bob, 4, 4);
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
