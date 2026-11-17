import { MoodFace, PortraitSvg, R, type PortraitProps } from "./shared";

const BG = "#6b6878";
const SKIN = "#e8b896";
const HAIR = "#2a2018";
const SUIT = "#1a3058";
const SHIRT = "#f2efe6";
const WATCH = "#f4c95d";
const BAND = "#3a2a22";

/** Slicked hair and a gold watch. */
export function Max({ mood }: PortraitProps) {
  return (
    <PortraitSvg label={`Max Yield, ${mood}`}>
      <R x={0} y={0} w={32} h={32} fill={BG} />
      {/* slicked-back hair with shine */}
      <R x={8} y={4} w={16} h={5} fill={HAIR} />
      <R x={7} y={6} w={3} h={5} fill={HAIR} />
      <R x={22} y={6} w={3} h={5} fill={HAIR} />
      <R x={10} y={4} w={8} h={1} fill="#4a3830" />
      <R x={12} y={5} w={4} h={1} fill="#5a4840" />
      {/* face */}
      <R x={10} y={8} w={12} h={11} fill={SKIN} />
      <MoodFace mood={mood} lx={12} ly={12} rx={18} ry={12} mouthY={17} />
      {/* navy suit */}
      <R x={8} y={21} w={16} h={11} fill={SUIT} />
      <R x={11} y={20} w={10} h={2} fill={SKIN} />
      <R x={14} y={21} w={4} h={7} fill={SHIRT} />
      {/* raised arm + gold watch */}
      <R x={22} y={22} w={6} h={4} fill={SKIN} />
      <R x={24} y={24} w={5} h={3} fill={BAND} />
      <R x={25} y={24} w={3} h={3} fill={WATCH} />
      <R x={26} y={25} w={1} h={1} fill="#fff4b0" />
    </PortraitSvg>
  );
}
