import type { Metadata } from "next";
import { Intro } from "./Intro";

export const metadata: Metadata = { title: "Cold Call · Krystal's trail" };

/** First-time opening: Krystal's cutscene, then pick your hunter, then the lobby. Replayable. */
export default function IntroPage() {
  return <Intro />;
}
