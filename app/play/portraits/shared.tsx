import type { ReactNode } from "react";

export type PortraitMood = "neutral" | "suspicious" | "convinced";

export type PortraitProps = { mood: PortraitMood };

export function PortraitSvg({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <svg
      role="img"
      aria-label={label}
      width={176}
      height={176}
      viewBox="0 0 32 32"
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

export function R({
  x,
  y,
  w = 1,
  h = 1,
  fill,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  fill: string;
}) {
  return <rect x={x} y={y} width={w} height={h} fill={fill} />;
}

/** Shared face parts that change with mood. Eyes centered around (lx,ly) and (rx,ry). */
export function MoodFace({
  mood,
  lx,
  ly,
  rx,
  ry,
  mouthY,
  brow = "#3a2a22",
  eye = "#1a1410",
  mouth = "#7a3b3b",
}: {
  mood: PortraitMood;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  mouthY: number;
  brow?: string;
  eye?: string;
  mouth?: string;
}) {
  if (mood === "suspicious") {
    return (
      <>
        {/* furrowed brows */}
        <R x={lx - 1} y={ly - 2} w={4} h={1} fill={brow} />
        <R x={rx - 1} y={ry - 2} w={4} h={1} fill={brow} />
        <R x={lx + 2} y={ly - 1} w={1} h={1} fill={brow} />
        <R x={rx - 1} y={ry - 1} w={1} h={1} fill={brow} />
        {/* narrowed eyes */}
        <R x={lx} y={ly} w={3} h={1} fill={eye} />
        <R x={rx} y={ry} w={3} h={1} fill={eye} />
        {/* frown */}
        <R x={lx + 1} y={mouthY} w={rx - lx + 1} h={1} fill={mouth} />
        <R x={lx} y={mouthY - 1} w={1} h={1} fill={mouth} />
        <R x={rx + 2} y={mouthY - 1} w={1} h={1} fill={mouth} />
      </>
    );
  }
  if (mood === "convinced") {
    return (
      <>
        {/* soft brows */}
        <R x={lx} y={ly - 2} w={3} h={1} fill={brow} />
        <R x={rx} y={ry - 2} w={3} h={1} fill={brow} />
        {/* open eyes with shine */}
        <R x={lx} y={ly} w={3} h={2} fill={eye} />
        <R x={rx} y={ry} w={3} h={2} fill={eye} />
        <R x={lx + 1} y={ly} w={1} h={1} fill="#f5f0e8" />
        <R x={rx + 1} y={ry} w={1} h={1} fill="#f5f0e8" />
        {/* smile */}
        <R x={lx + 1} y={mouthY} w={rx - lx + 1} h={1} fill={mouth} />
        <R x={lx} y={mouthY - 1} w={1} h={1} fill={mouth} />
        <R x={rx + 2} y={mouthY - 1} w={1} h={1} fill={mouth} />
      </>
    );
  }
  // neutral
  return (
    <>
      <R x={lx} y={ly - 2} w={3} h={1} fill={brow} />
      <R x={rx} y={ry - 2} w={3} h={1} fill={brow} />
      <R x={lx} y={ly} w={3} h={2} fill={eye} />
      <R x={rx} y={ry} w={3} h={2} fill={eye} />
      <R x={lx + 2} y={mouthY} w={rx - lx} h={1} fill={mouth} />
    </>
  );
}
