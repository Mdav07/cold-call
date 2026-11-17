import Link from "next/link";
import dossier from "@/content/plumpurse/dossier.json";
import directory from "@/content/plumpurse/directory.json";
import vendors from "@/content/plumpurse/vendors.json";
import memos from "@/content/plumpurse/memos.json";
import jargon from "@/content/plumpurse/jargon.json";
import { CaseFile } from "./CaseFile";

export default function CaseFilePage() {
  return (
    <main className="cc-floor-1 mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <header className="pixel-frame flex flex-wrap items-center justify-between gap-2 bg-[var(--cc-panel)] px-4 py-3">
        <h1 className="font-pixel text-xs text-[var(--cc-accent)]">Case file</h1>
        <Link className="underline text-sm" href="/tower">
          Back to the tower
        </Link>
      </header>
      <CaseFile
        dossier={dossier}
        employees={directory.employees}
        vendors={vendors.vendors}
        memos={memos.memos}
        terms={jargon.terms}
      />
    </main>
  );
}
