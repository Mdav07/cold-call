import { redirect } from "next/navigation";

// The game opens in the tower lobby; the street door to the tutorial is the one open door.
export default function Home() {
  redirect("/tower");
}
