import type { Metadata } from "next";
import { Ending } from "./Ending";

export const metadata: Metadata = { title: "Cold Call · The trail continues" };

/** After Floor 3: Krystal's last note, then a tease for Case 2 (Fatwallet Federal). Replayable at /ending. */
export default function EndingPage() {
  return <Ending />;
}
