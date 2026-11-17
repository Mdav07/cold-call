"use client";

import { useState } from "react";
import { MyNotes } from "./MyNotes";

type Dossier = {
  author: string;
  intro: string;
  notes: { employee_id: string; margin: string[] }[];
  gossip: string[];
};

type Employee = {
  id: string;
  name: string;
  aliases: string[];
  title: string;
  department: string;
  floor: number;
  manager: string | null;
  is_signer: boolean;
  notes: string[];
};

type Vendor = {
  name: string;
  aliases: string[];
  category: string;
  contact: string;
  payment_address_label: string;
  typical_invoice_usdc: number[];
  paid_from: string;
  notes: string[];
};

type Memo = {
  date: string;
  from: string;
  to: string;
  subject: string;
  body: string;
};

type Term = { term: string; meaning: string };

const TABS = [
  { id: "notes", label: "Krystal's notes" },
  { id: "staff", label: "Staff" },
  { id: "vendors", label: "Vendors" },
  { id: "memos", label: "Memos" },
  { id: "jargon", label: "Jargon" },
  { id: "mine", label: "My notes" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function dollars(range: number[]) {
  if (range.length === 0) return "?";
  if (range.length === 1) return `$${range[0].toFixed(2)}`;
  return `$${range[0].toFixed(2)} – $${range[range.length - 1].toFixed(2)}`;
}

function floorLabel(floor: number) {
  if (floor === 0) return "Pocket Branch";
  return `Floor ${floor}`;
}

export function CaseFile({
  dossier,
  employees,
  vendors,
  memos,
  terms,
}: {
  dossier: Dossier;
  employees: Employee[];
  vendors: Vendor[];
  memos: Memo[];
  terms: Term[];
}) {
  const [tab, setTab] = useState<TabId>("notes");
  const byId = Object.fromEntries(employees.map((e) => [e.id, e]));
  const sortedMemos = [...memos].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Case file sections" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="pixel-button"
            aria-pressed={tab === t.id}
            style={tab === t.id ? undefined : { opacity: 0.55 }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="pixel-frame bg-[var(--cc-panel)] p-4">
        {tab === "notes" && (
          <section aria-labelledby="krystal-notes" className="flex flex-col gap-4">
            <h2 id="krystal-notes" className="font-pixel text-xs text-[var(--cc-accent)]">
              {dossier.author}&apos;s notes
            </h2>
            <p className="text-sm italic leading-relaxed text-[var(--cc-muted)]">&ldquo;{dossier.intro}&rdquo;</p>

            <div className="flex flex-col gap-3">
              <h3 className="font-pixel text-[10px] text-[var(--cc-ink)]">Margin notes</h3>
              <ul className="flex flex-col gap-3">
                {dossier.notes.map((n) => {
                  const emp = byId[n.employee_id];
                  const label = emp ? `${emp.name} · ${emp.title}` : n.employee_id;
                  return (
                    <li key={n.employee_id} className="border-t-2 border-[var(--cc-edge)] pt-3 first:border-0 first:pt-0">
                      <p className="font-pixel text-[10px] text-[var(--cc-ink)]">{label}</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--cc-muted)]">
                        {n.margin.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex flex-col gap-2 border-t-2 border-[var(--cc-edge)] pt-3">
              <h3 className="font-pixel text-[10px] text-[var(--cc-ink)]">Gossip</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--cc-muted)]">
                {dossier.gossip.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {tab === "staff" && (
          <section aria-labelledby="staff-heading" className="flex flex-col gap-3">
            <h2 id="staff-heading" className="font-pixel text-xs text-[var(--cc-accent)]">
              Staff directory
            </h2>
            <ul className="flex flex-col gap-3">
              {employees.map((e) => (
                <li key={e.id} className="border-t-2 border-[var(--cc-edge)] pt-3 first:border-0 first:pt-0">
                  <p className="font-pixel text-[10px] text-[var(--cc-ink)]">
                    {e.name} · {e.title}
                  </p>
                  <p className="mt-1 text-sm text-[var(--cc-muted)]">
                    {e.department} · {floorLabel(e.floor)}
                    {e.manager ? ` · Reports to ${e.manager}` : ""}
                    {e.is_signer ? " · Can authorize payments" : ""}
                  </p>
                  {e.aliases.length > 0 && (
                    <p className="text-xs text-[var(--cc-muted)]">Also known as: {e.aliases.join(", ")}</p>
                  )}
                  {e.notes.length > 0 && (
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--cc-muted)]">
                      {e.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "vendors" && (
          <section aria-labelledby="vendors-heading" className="flex flex-col gap-3">
            <h2 id="vendors-heading" className="font-pixel text-xs text-[var(--cc-accent)]">
              Vendor registry
            </h2>
            <ul className="flex flex-col gap-3">
              {vendors.map((v) => (
                <li key={v.name} className="border-t-2 border-[var(--cc-edge)] pt-3 first:border-0 first:pt-0">
                  <p className="font-pixel text-[10px] text-[var(--cc-ink)]">{v.name}</p>
                  <p className="mt-1 text-sm text-[var(--cc-muted)]">
                    {v.category} · Contact: {v.contact}
                  </p>
                  <p className="text-sm text-[var(--cc-muted)]">
                    Typical invoice: <span className="text-[var(--cc-ok)]">{dollars(v.typical_invoice_usdc)}</span>
                    {" · "}Paid from {v.paid_from}
                  </p>
                  <p className="text-xs text-[var(--cc-muted)]">Pay to: {v.payment_address_label}</p>
                  {v.aliases.length > 0 && (
                    <p className="text-xs text-[var(--cc-muted)]">Also listed as: {v.aliases.join(", ")}</p>
                  )}
                  {v.notes.length > 0 && (
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--cc-muted)]">
                      {v.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "memos" && (
          <section aria-labelledby="memos-heading" className="flex flex-col gap-3">
            <h2 id="memos-heading" className="font-pixel text-xs text-[var(--cc-accent)]">
              Internal memos
            </h2>
            <ul className="flex flex-col gap-3">
              {sortedMemos.map((m) => (
                <li key={`${m.date}-${m.subject}`} className="border-t-2 border-[var(--cc-edge)] pt-3 first:border-0 first:pt-0">
                  <p className="font-pixel text-[10px] text-[var(--cc-ink)]">{m.subject}</p>
                  <p className="mt-1 text-xs text-[var(--cc-muted)]">
                    {m.date} · From {m.from} · To {m.to}
                  </p>
                  <p className="mt-2 text-sm text-[var(--cc-muted)]">{m.body}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "jargon" && (
          <section aria-labelledby="jargon-heading" className="flex flex-col gap-3">
            <h2 id="jargon-heading" className="font-pixel text-xs text-[var(--cc-accent)]">
              Office jargon
            </h2>
            <dl className="flex flex-col gap-3">
              {terms.map((t) => (
                <div key={t.term} className="border-t-2 border-[var(--cc-edge)] pt-3 first:border-0 first:pt-0">
                  <dt className="font-pixel text-[10px] text-[var(--cc-ink)]">{t.term}</dt>
                  <dd className="mt-1 text-sm text-[var(--cc-muted)]">{t.meaning}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {tab === "mine" && <MyNotes />}
      </div>
    </div>
  );
}
