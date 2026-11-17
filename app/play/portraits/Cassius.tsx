import { PortraitSvg, R, type PortraitProps } from "./shared";

const BG = "#6b6878";
const SKIN = "#c49a6c";
const HAIR = "#1a1410";
const SUIT = "#1c1c24";
const SHIRT = "#d8d4cc";
const EYE = "#1a1410";
const BROW = "#1a1410";
const MOUTH = "#7a3b3b";

/** Dark suit, eyes to the side. */
export function Cassius({ mood }: PortraitProps) {
  const glance = mood === "convinced" ? 0 : 1; // pupils shift right when wary
  return (
    <PortraitSvg label={`Cassius Flow, ${mood}`}>
      <R x={0} y={0} w={32} h={32} fill={BG} />
      {/* slick dark hair */}
      <R x={9} y={4} w={14} h={4} fill={HAIR} />
      <R x={8} y={6} w={3} h={6} fill={HAIR} />
      <R x={21} y={6} w={3} h={6} fill={HAIR} />
      {/* face */}
      <R x={10} y={8} w={12} h={11} fill={SKIN} />
      {/* brows — lower when suspicious */}
      <R x={12} y={mood === "suspicious" ? 11 : 10} w={3} h={1} fill={BROW} />
      <R x={18} y={mood === "suspicious" ? 11 : 10} w={3} h={1} fill={BROW} />
      {/* eyes looking aside */}
      <R x={12} y={12} w={3} h={2} fill="#f5f0e8" />
      <R x={18} y={12} w={3} h={2} fill="#f5f0e8" />
      <R x={12 + glance} y={12} w={2} h={2} fill={EYE} />
      <R x={18 + glance} y={12} w={2} h={2} fill={EYE} />
      {/* mouth */}
      {mood === "convinced" ? (
        <>
          <R x={14} y={17} w={5} h={1} fill={MOUTH} />
          <R x={13} y={16} w={1} h={1} fill={MOUTH} />
          <R x={19} y={16} w={1} h={1} fill={MOUTH} />
        </>
      ) : mood === "suspicious" ? (
        <>
          <R x={14} y={17} w={5} h={1} fill={MOUTH} />
          <R x={13} y={16} w={1} h={1} fill={MOUTH} />
          <R x={19} y={16} w={1} h={1} fill={MOUTH} />
        </>
      ) : (
        <R x={14} y={17} w={4} h={1} fill={MOUTH} />
      )}
      {/* dark suit */}
      <R x={8} y={21} w={16} h={11} fill={SUIT} />
      <R x={11} y={20} w={10} h={2} fill={SKIN} />
      <R x={14} y={21} w={4} h={8} fill={SHIRT} />
      <R x={15} y={22} w={2} h={6} fill={SUIT} />
    </PortraitSvg>
  );
}
