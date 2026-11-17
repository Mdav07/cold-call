import { MoodFace, PortraitSvg, R, type PortraitProps } from "./shared";

const BG = "#6b6878";
const SKIN = "#e0b090";
const HAIR = "#4a4038";
const SHIRT = "#e8e8ec";
const TIE = "#2a4a7a";
const GLASS = "#8ab4d4";
const RIM = "#2a2a32";

/** Glasses and a tie. */
export function Bill({ mood }: PortraitProps) {
  return (
    <PortraitSvg label={`Bill Ledger, ${mood}`}>
      <R x={0} y={0} w={32} h={32} fill={BG} />
      {/* thinning hair */}
      <R x={10} y={5} w={12} h={3} fill={HAIR} />
      <R x={9} y={7} w={3} h={5} fill={HAIR} />
      <R x={20} y={7} w={3} h={5} fill={HAIR} />
      {/* face */}
      <R x={10} y={8} w={12} h={11} fill={SKIN} />
      <MoodFace mood={mood} lx={12} ly={12} rx={18} ry={12} mouthY={18} />
      {/* glasses */}
      <R x={11} y={11} w={5} h={4} fill={GLASS} />
      <R x={17} y={11} w={5} h={4} fill={GLASS} />
      <R x={11} y={11} w={5} h={1} fill={RIM} />
      <R x={11} y={14} w={5} h={1} fill={RIM} />
      <R x={11} y={11} w={1} h={4} fill={RIM} />
      <R x={15} y={11} w={1} h={4} fill={RIM} />
      <R x={17} y={11} w={5} h={1} fill={RIM} />
      <R x={17} y={14} w={5} h={1} fill={RIM} />
      <R x={17} y={11} w={1} h={4} fill={RIM} />
      <R x={21} y={11} w={1} h={4} fill={RIM} />
      <R x={16} y={12} w={1} h={1} fill={RIM} />
      {/* shirt + tie */}
      <R x={9} y={21} w={14} h={11} fill={SHIRT} />
      <R x={11} y={20} w={10} h={2} fill={SKIN} />
      <R x={15} y={21} w={2} h={9} fill={TIE} />
      <R x={14} y={21} w={4} h={2} fill={TIE} />
      <R x={15} y={30} w={2} h={1} fill="#1a3058" />
    </PortraitSvg>
  );
}
