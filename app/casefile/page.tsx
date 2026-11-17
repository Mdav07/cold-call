import { BackButton } from "@/app/ui/BackButton";
import { CaseFile } from "./CaseFile";

export default function CaseFilePage() {
  return (
    <main className="cc-floor-1 mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <header className="pixel-frame flex items-center gap-3 bg-[var(--cc-panel)] px-3 py-2">
        <BackButton />
        <h1 className="font-pixel text-xs text-[var(--cc-accent)]">Case file</h1>
      </header>
      <CaseFile />
    </main>
  );
}
