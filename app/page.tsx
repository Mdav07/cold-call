import { redirect } from "next/navigation";

// The game opens straight into the tutorial: the Pocket Branch, with Krystal's briefing.
export default function Home() {
  redirect("/floor/0");
}
