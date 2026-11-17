import { MoodFace, PortraitSvg, R, type PortraitProps } from "./shared";

const BG = "#6b6878";
const SKIN = "#d4a574";
const HAIR = "#2c1810";
const JACKET = "#3a3944";
const GOGGLE = "#4a5568";
const LENS = "#7ec8e8";
const LANYARD = "#c45c5c";
const WALLET = "#2a2a32";
const LED = "#6fbf73";

/** Aviator goggles on her head and a hardware wallet on a lanyard. */
export function Krystal({ mood }: PortraitProps) {
  return (
    <PortraitSvg label={`Krystal Klear, ${mood}`}>
      <R x={0} y={0} w={32} h={32} fill={BG} />
      {/* dark hair */}
      <R x={8} y={6} w={16} h={5} fill={HAIR} />
      <R x={7} y={8} w={4} h={8} fill={HAIR} />
      <R x={21} y={8} w={4} h={8} fill={HAIR} />
      {/* face */}
      <R x={10} y={9} w={12} h={11} fill={SKIN} />
      <MoodFace mood={mood} lx={12} ly={13} rx={18} ry={13} mouthY={18} />
      {/* aviator goggles perched on head */}
      <R x={9} y={3} w={14} h={4} fill={GOGGLE} />
      <R x={10} y={3} w={5} h={4} fill={LENS} />
      <R x={17} y={3} w={5} h={4} fill={LENS} />
      <R x={15} y={4} w={2} h={2} fill={GOGGLE} />
      <R x={9} y={4} w={1} h={2} fill="#2a2a32" />
      <R x={22} y={4} w={1} h={2} fill="#2a2a32" />
      <R x={11} y={4} w={2} h={1} fill="#b8e8f8" />
      <R x={18} y={4} w={2} h={1} fill="#b8e8f8" />
      {/* jacket */}
      <R x={8} y={22} w={16} h={10} fill={JACKET} />
      <R x={11} y={21} w={10} h={2} fill={SKIN} />
      {/* lanyard + hardware wallet */}
      <R x={14} y={22} w={1} h={6} fill={LANYARD} />
      <R x={17} y={22} w={1} h={6} fill={LANYARD} />
      <R x={14} y={22} w={4} h={1} fill={LANYARD} />
      <R x={13} y={27} w={6} h={4} fill={WALLET} />
      <R x={14} y={28} w={4} h={2} fill="#4a4856" />
      <R x={15} y={29} w={1} h={1} fill={LED} />
      <R x={17} y={29} w={1} h={1} fill="#e05d5d" />
    </PortraitSvg>
  );
}
