import { Suspense } from "react";
import { BackButton } from "@/app/ui/BackButton";
import { unlockedFloorsForRequest } from "@/server/game/unlocks";
import { caseDataFor, EMPTY_CASE_DATA } from "./data";
import { CaseFile } from "./CaseFile";

export default function CaseFilePage() {
  return (
    <main className="cc-floor-1 mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <header className="pixel-frame flex items-center gap-3 bg-[var(--cc-panel)] px-3 py-2">
        <BackButton />
        <h1 className="font-pixel text-xs text-[var(--cc-accent)]">Case file</h1>
      </header>
      <Suspense fallback={<CaseFile data={EMPTY_CASE_DATA} floor={0} unlockedFloors={[0]} />}>
        <CaseFileWithUnlocks />
      </Suspense>
    </main>
  );
}

async function CaseFileWithUnlocks() {
  // The main file, limited to unlocked floors (gated on the server). Before Floor 1 opens, the tutorial's file.
  const open = await unlockedFloorsForRequest();
  const towerFloors = open.filter((f) => f > 0);
  if (!towerFloors.length) return <CaseFile data={caseDataFor(open)} floor={0} unlockedFloors={[0]} />;
  return <CaseFile data={caseDataFor(open)} unlockedFloors={towerFloors} />;
}
