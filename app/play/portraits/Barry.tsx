import { PortraitSvg, R, type PortraitProps } from "./shared";

const BG = "#6b6878";
const SKIN = "#e8c4a0";
const HAIR = "#6a5848";
const SHIRT = "#c8d4b8";
const EYE = "#1a1410";
const BROW = "#4a4038";
const MOUTH = "#7a3b3b";

/** Droopy, sleepy eyes. */
export function Barry({ mood }: PortraitProps) {
  const eyeOpen = mood === "suspicious" ? 2 : mood === "convinced" ? 2 : 1;
  return (
    <PortraitSvg label={`Barry Biscuit, ${mood}`}>
      <R x={0} y={0} w={32} h={32} fill={BG} />
      {/* messy sleepy hair */}
      <R x={9} y={5} w={14} h={4} fill={HAIR} />
      <R x={8} y={7} w={3} h={5} fill={HAIR} />
      <R x={21} y={7} w={3} h={5} fill={HAIR} />
      <R x={11} y={4} w={2} h={2} fill={HAIR} />
      <R x={18} y={4} w={2} h={2} fill={HAIR} />
      {/* round face */}
      <R x={9} y={8} w={14} h={12} fill={SKIN} />
      {/* droopy brows */}
      <R x={11} y={11} w={4} h={1} fill={BROW} />
      <R x={18} y={11} w={4} h={1} fill={BROW} />
      <R x={11} y={12} w={1} h={1} fill={BROW} />
      <R x={21} y={12} w={1} h={1} fill={BROW} />
      {/* sleepy/droopy eyes — 2px wide so the walker sheet halves to one pixel each (not a dash) */}
      <R x={12} y={13} w={2} h={eyeOpen} fill={EYE} />
      <R x={18} y={13} w={2} h={eyeOpen} fill={EYE} />
      <R x={12} y={13} w={2} h={1} fill={SKIN} />
      <R x={18} y={13} w={2} h={1} fill={SKIN} />
      {mood === "suspicious" && (
        <>
          <R x={12} y={12} w={2} h={1} fill={BROW} />
          <R x={18} y={12} w={2} h={1} fill={BROW} />
        </>
      )}
      {/* mouth */}
      {mood === "convinced" ? (
        <>
          <R x={14} y={18} w={5} h={1} fill={MOUTH} />
          <R x={13} y={17} w={1} h={1} fill={MOUTH} />
          <R x={19} y={17} w={1} h={1} fill={MOUTH} />
        </>
      ) : mood === "suspicious" ? (
        <R x={14} y={18} w={4} h={1} fill={MOUTH} />
      ) : (
        <>
          {/* yawn-ish open mouth when neutral/sleepy */}
          <R x={14} y={17} w={4} h={2} fill="#5a3030" />
          <R x={15} y={17} w={2} h={1} fill="#f5f0e8" />
        </>
      )}
      {/* soft teller shirt */}
      <R x={8} y={22} w={16} h={10} fill={SHIRT} />
      <R x={11} y={21} w={10} h={2} fill={SKIN} />
      <R x={15} y={23} w={2} h={5} fill="#a8b898" />
    </PortraitSvg>
  );
}
