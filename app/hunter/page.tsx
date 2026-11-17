import { HunterPicker } from "./HunterPicker";

export const metadata = { title: "Your hunter · Cold Call" };

export default function HunterPage() {
  return (
    <main className="cc-floor-1 flex min-h-full flex-1 items-center justify-center p-4">
      <HunterPicker />
    </main>
  );
}
