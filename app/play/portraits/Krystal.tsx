import { MoodFace, PortraitSvg, R, type PortraitProps } from "./shared";

const BG = "#6b6878";
const SKIN = "#e8c4a8";
const HAIR = "#1a1410";
const SHIRT = "#f4f4f6";
const BLAZER = "#1e1e24";
const RIM = "#b8bcc0";
const GLASS = "#a8c8d8";

/** Long black hair with bangs, thin silver glasses, white shirt under a black blazer. */
export function Krystal({ mood }: PortraitProps) {
  return (
    <PortraitSvg label={`Krystal Klear, ${mood}`}>
      <R x={0} y={0} w={32} h={32} fill={BG} />
      {/* long black hair */}
      <R x={8} y={5} w={16} h={5} fill={HAIR} />
      <R x={7} y={7} w={4} h={14} fill={HAIR} />
      <R x={21} y={7} w={4} h={14} fill={HAIR} />
      {/* face */}
      <R x={10} y={9} w={12} h={11} fill={SKIN} />
      <MoodFace mood={mood} lx={12} ly={13} rx={18} ry={13} mouthY={18} />
      {/* wispy bangs across the forehead */}
      <R x={10} y={9} w={12} h={2} fill={HAIR} />
      <R x={11} y={11} w={2} h={1} fill={HAIR} />
      <R x={14} y={11} w={1} h={1} fill={HAIR} />
      <R x={17} y={11} w={1} h={1} fill={HAIR} />
      <R x={19} y={11} w={2} h={1} fill={HAIR} />
      {/* thin silver glasses */}
      <R x={11} y={12} w={5} h={4} fill={GLASS} />
      <R x={17} y={12} w={5} h={4} fill={GLASS} />
      <R x={11} y={12} w={5} h={1} fill={RIM} />
      <R x={11} y={15} w={5} h={1} fill={RIM} />
      <R x={11} y={12} w={1} h={4} fill={RIM} />
      <R x={15} y={12} w={1} h={4} fill={RIM} />
      <R x={17} y={12} w={5} h={1} fill={RIM} />
      <R x={17} y={15} w={5} h={1} fill={RIM} />
      <R x={17} y={12} w={1} h={4} fill={RIM} />
      <R x={21} y={12} w={1} h={4} fill={RIM} />
      <R x={16} y={13} w={1} h={1} fill={RIM} />
      {/* white shirt under black blazer */}
      <R x={8} y={22} w={16} h={10} fill={BLAZER} />
      <R x={11} y={20} w={10} h={2} fill={SKIN} />
      <R x={12} y={21} w={3} h={2} fill={SHIRT} />
      <R x={17} y={21} w={3} h={2} fill={SHIRT} />
      <R x={13} y={22} w={6} h={10} fill={SHIRT} />
      <R x={15} y={23} w={2} h={1} fill={BLAZER} />
      {/* hair over the shoulders */}
      <R x={7} y={18} w={3} h={7} fill={HAIR} />
      <R x={22} y={18} w={3} h={7} fill={HAIR} />
    </PortraitSvg>
  );
}
