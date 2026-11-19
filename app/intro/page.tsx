import type { Metadata } from "next";
import { Intro } from "./Intro";

export const metadata: Metadata = { title: "Cold Call · Krystal's trail" };

/** First-time opening: Krystal's cutscene, then sign in (or guest), then pick a hunter if needed. Replayable. */
export default function IntroPage() {
  return <Intro />;
}
