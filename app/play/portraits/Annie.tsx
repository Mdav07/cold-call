import { MoodFace, PortraitSvg, R, type PortraitProps } from "./shared";

const BG = "#6b6878";
const SKIN = "#f0c4a0";
const HAIR = "#8b5a2b";
const BLOUSE = "#e8e0d4";
const CLIP = "#f4f1ea";
const CLIP_EDGE = "#3a3944";
const ACCENT = "#c45c5c";

/** Clipboard. */
export function Annie({ mood }: PortraitProps) {
  return (
    <PortraitSvg label={`Annie Uity, ${mood}`}>
      <R x={0} y={0} w={32} h={32} fill={BG} />
      {/* neat bob */}
      <R x={9} y={4} w={14} h={4} fill={HAIR} />
      <R x={8} y={7} w={4} h={8} fill={HAIR} />
      <R x={20} y={7} w={4} h={8} fill={HAIR} />
      <R x={10} y={5} w={12} h={2} fill={HAIR} />
      {/* face */}
      <R x={10} y={8} w={12} h={11} fill={SKIN} />
      <MoodFace mood={mood} lx={12} ly={12} rx={18} ry={12} mouthY={17} />
      {/* blouse */}
      <R x={9} y={21} w={14} h={11} fill={BLOUSE} />
      <R x={11} y={20} w={10} h={2} fill={SKIN} />
      <R x={15} y={22} w={2} h={6} fill={ACCENT} />
      {/* clipboard held in front */}
      <R x={18} y={18} w={10} h={12} fill={CLIP} />
      <R x={18} y={18} w={10} h={1} fill={CLIP_EDGE} />
      <R x={18} y={29} w={10} h={1} fill={CLIP_EDGE} />
      <R x={18} y={18} w={1} h={12} fill={CLIP_EDGE} />
      <R x={27} y={18} w={1} h={12} fill={CLIP_EDGE} />
      <R x={21} y={17} w={4} h={2} fill={CLIP_EDGE} />
      <R x={20} y={21} w={6} h={1} fill={ACCENT} />
      <R x={20} y={23} w={6} h={1} fill={CLIP_EDGE} />
      <R x={20} y={25} w={5} h={1} fill={CLIP_EDGE} />
      <R x={20} y={27} w={4} h={1} fill={CLIP_EDGE} />
    </PortraitSvg>
  );
}
