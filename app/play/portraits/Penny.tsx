import { MoodFace, PortraitSvg, R, type PortraitProps } from "./shared";

const BG = "#6b6878";
const SKIN = "#e8b896";
const HAIR = "#c45c2a";
const BLOUSE = "#d4a0b8";
const PIN = "#f0c040";
const CAT = "#3a2a22";

/** Big hair and a cat-shaped pin. */
export function Penny({ mood }: PortraitProps) {
  return (
    <PortraitSvg label={`Penny Pincher, ${mood}`}>
      <R x={0} y={0} w={32} h={32} fill={BG} />
      {/* big voluminous hair */}
      <R x={6} y={2} w={20} h={4} fill={HAIR} />
      <R x={4} y={4} w={24} h={6} fill={HAIR} />
      <R x={3} y={8} w={6} h={10} fill={HAIR} />
      <R x={23} y={8} w={6} h={10} fill={HAIR} />
      <R x={5} y={16} w={4} h={4} fill={HAIR} />
      <R x={23} y={16} w={4} h={4} fill={HAIR} />
      {/* face */}
      <R x={9} y={8} w={14} h={12} fill={SKIN} />
      <R x={10} y={7} w={12} h={2} fill={SKIN} />
      <MoodFace mood={mood} lx={11} ly={12} rx={18} ry={12} mouthY={18} />
      {/* blouse */}
      <R x={8} y={22} w={16} h={10} fill={BLOUSE} />
      <R x={10} y={21} w={12} h={2} fill={SKIN} />
      {/* cat-shaped pin on collar */}
      <R x={14} y={24} w={4} h={3} fill={PIN} />
      <R x={14} y={23} w={1} h={1} fill={CAT} />
      <R x={17} y={23} w={1} h={1} fill={CAT} />
      <R x={15} y={25} w={2} h={1} fill={CAT} />
      <R x={13} y={26} w={1} h={1} fill={PIN} />
      <R x={18} y={26} w={1} h={1} fill={PIN} />
    </PortraitSvg>
  );
}
