import { MoodFace, PortraitSvg, R, type PortraitProps } from "./shared";

const BG = "#6b6878";
const SKIN = "#c48a5a";
const HAIR = "#1a1410";
const HOODIE = "#3d6b5a";
const HOOD = "#2f5244";
const CANS = "#2a2a32";
const BAND = "#f4c95d";

/** Hoodie and headphones. */
export function Dee({ mood }: PortraitProps) {
  return (
    <PortraitSvg label={`Dee Bugg, ${mood}`}>
      <R x={0} y={0} w={32} h={32} fill={BG} />
      {/* short hair under hoodie */}
      <R x={10} y={6} w={12} h={4} fill={HAIR} />
      {/* face */}
      <R x={10} y={9} w={12} h={10} fill={SKIN} />
      <MoodFace mood={mood} lx={12} ly={12} rx={18} ry={12} mouthY={17} />
      {/* hoodie hood */}
      <R x={7} y={4} w={18} h={3} fill={HOOD} />
      <R x={6} y={6} w={4} h={10} fill={HOOD} />
      <R x={22} y={6} w={4} h={10} fill={HOOD} />
      <R x={8} y={5} w={16} h={2} fill={HOOD} />
      {/* headphones over hood */}
      <R x={5} y={8} w={3} h={6} fill={CANS} />
      <R x={24} y={8} w={3} h={6} fill={CANS} />
      <R x={8} y={7} w={16} h={2} fill={CANS} />
      <R x={6} y={9} w={1} h={4} fill={BAND} />
      <R x={25} y={9} w={1} h={4} fill={BAND} />
      {/* hoodie body */}
      <R x={8} y={20} w={16} h={12} fill={HOODIE} />
      <R x={10} y={19} w={12} h={2} fill={SKIN} />
      <R x={14} y={22} w={4} h={8} fill={HOOD} />
      <R x={15} y={24} w={2} h={1} fill={BAND} />
    </PortraitSvg>
  );
}
