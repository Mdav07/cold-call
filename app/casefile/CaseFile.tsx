"use client";

// The case file as a manila folder: tabs along the top, a sheet of paper inside, short cards.
// Used by /casefile and by the in-game overlay on the floors (which passes the current floor).

import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import dossier from "@/content/plumpurse/dossier.json";
import directory from "@/content/plumpurse/directory.json";
import vendorsJson from "@/content/plumpurse/vendors.json";
import memosJson from "@/content/plumpurse/memos.json";
import jargon from "@/content/plumpurse/jargon.json";
import calendar from "@/content/plumpurse/calendar.json";
import evidence from "@/content/plumpurse/evidence.json";
import { MyNotes } from "./MyNotes";

const TABS = [
  { id: "people", label: "People" },
  { id: "vendors", label: "Vendors" },
  { id: "calendar", label: "Calendar" },
  { id: "memos", label: "Memos" },
  { id: "evidence", label: "Evidence" },
  { id: "mine", label: "My notes" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABEL: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

const employees = directory.employees;
const byId = Object.fromEntries(employees.map((e) => [e.id, e]));
const margin = Object.fromEntries(dossier.notes.map((n) => [n.employee_id, n.margin]));
const memos = [...memosJson.memos].sort((a, b) => b.date.localeCompare(a.date));
const floorName = (f: number) => (f === 0 ? "Pocket Branch" : `Floor ${f}`);

function dollars(range: number[]) {
  if (range.length === 0) return "?";
  if (range.length === 1) return `$${range[0].toFixed(2)}`;
  return `$${range[0].toFixed(2)}–$${range[range.length - 1].toFixed(2)}`;
}

/** Paper colours: dark ink on cream. Every text pair here is at least 4.5:1. */
const PAPER = {
  "--cc-ink": "#2b2420",
  "--cc-muted": "#5c5040",
  "--cc-panel-2": "#fffdf6",
  "--cc-edge": "#8a6a2f",
  "--cc-accent": "#a33a2a",
  "--cc-ok": "#2f6b3a",
} as CSSProperties;

function Card({ title, meta, children, more }: { title: string; meta?: ReactNode; children?: ReactNode; more?: ReactNode }) {
  return (
    <li className="flex flex-col gap-1.5 border border-[#d8ccb0] bg-white/70 p-3 shadow-[2px_2px_0_0_#d8ccb0]">
      <p className="font-pixel text-[10px] leading-relaxed text-[var(--cc-ink)]">{title}</p>
      {meta && <div className="text-xs text-[var(--cc-muted)]">{meta}</div>}
      {children}
      {more && (
        <details className="group text-sm text-[var(--cc-muted)]">
          <summary className="cursor-pointer list-none font-pixel text-[9px] text-[var(--cc-accent)] [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">▸ More</span>
            <span className="hidden group-open:inline">▾ Less</span>
          </summary>
          <div className="mt-1.5 flex flex-col gap-1">{more}</div>
        </details>
      )}
    </li>
  );
}

function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "green" }) {
  const c = tone === "green" ? "border-[#2f6b3a] text-[#2f6b3a]" : "border-[#8a6a2f] text-[#5c5040]";
  return <span className={`inline-block border px-1.5 py-0.5 font-pixel text-[8px] leading-none ${c}`}>{children}</span>;
}

/** Krystal's handwriting in the margin. */
function Margin({ lines }: { lines: string[] }) {
  return (
    <ul className="flex flex-col gap-0.5 border-l-2 border-[#2a4a8a] pl-2 text-sm italic text-[#2a4a8a]">
      {lines.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}

function FloorFilter({ value, onChange }: { value: number | "all"; onChange: (v: number | "all") => void }) {
  const opts: (number | "all")[] = ["all", 0, 1, 2, 3];
  return (
    <div role="group" aria-label="Filter by floor" className="flex flex-wrap gap-1">
      {opts.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className={`border border-[#8a6a2f] px-2 py-1 font-pixel text-[9px] ${value === o ? "bg-[#8a6a2f] text-[#fbf6e9]" : "text-[#5c5040] hover:bg-[#f0e6cc]"}`}
        >
          {o === "all" ? "All floors" : floorName(o)}
        </button>
      ))}
    </div>
  );
}

const GRID = "grid items-start gap-3 sm:grid-cols-2";

function People({ floor }: { floor: number | "all" }) {
  const list = employees.filter((e) => floor === "all" || e.floor === floor);
  return (
    <ul className={GRID}>
      {list.map((e) => (
        <Card
          key={e.id}
          title={e.name}
          meta={
            <span className="flex flex-wrap items-center gap-1">
              {e.title} <Chip>{floorName(e.floor)}</Chip>
              {e.is_signer && <Chip tone="green">Can pay</Chip>}
            </span>
          }
          more={
            <>
              <p>
                {e.department}
                {e.manager ? ` · reports to ${e.manager}` : ""}
              </p>
              {e.aliases.length > 0 && <p>Goes by: {e.aliases.join(", ")}</p>}
              {e.notes.map((n) => (
                <p key={n}>• {n}</p>
              ))}
            </>
          }
        >
          {margin[e.id] && <Margin lines={margin[e.id]} />}
        </Card>
      ))}
    </ul>
  );
}

function Vendors() {
  return (
    <ul className={GRID}>
      {vendorsJson.vendors.map((v) => (
        <Card
          key={v.name}
          title={v.name}
          meta={v.category}
          more={
            <>
              <p>Contact: {v.contact}</p>
              <p>Pay to: {v.payment_address_label}</p>
              {v.aliases.length > 0 && <p>Also listed as: {v.aliases.join(", ")}</p>}
              {v.notes.map((n) => (
                <p key={n}>• {n}</p>
              ))}
            </>
          }
        >
          <p className="text-sm text-[var(--cc-ink)]">
            Usually <span className="font-semibold text-[var(--cc-ok)]">{dollars(v.typical_invoice_usdc)}</span> · paid from {v.paid_from}
          </p>
        </Card>
      ))}
    </ul>
  );
}

function Calendar({ floor }: { floor: number | "all" }) {
  const people = calendar.people.filter((p) => floor === "all" || byId[p.id]?.floor === floor);
  return (
    <ul className={GRID}>
      {people.map((p) => {
        const weekly = p.weekly as Record<string, string[] | undefined>;
        const days = DAYS.filter((d) => weekly[d]?.length);
        const pto = p.pto as { start: string; end: string; label?: string }[];
        const who = byId[p.id];
        return (
          <Card key={p.id} title={who?.name ?? p.id} meta={who ? floorName(who.floor) : undefined}>
            {days.length === 0 && pto.length === 0 && <p className="text-sm text-[var(--cc-muted)]">Nothing booked.</p>}
            {days.length > 0 && (
              <dl className="grid grid-cols-[2.5rem_1fr] gap-x-2 gap-y-1 text-sm">
                {days.map((d) => (
                  <div key={d} className="contents">
                    <dt className="font-pixel text-[9px] leading-5 text-[var(--cc-accent)]">{DAY_LABEL[d]}</dt>
                    <dd className="text-[var(--cc-ink)]">{weekly[d]!.join(" · ")}</dd>
                  </div>
                ))}
              </dl>
            )}
            {pto.map((t) => (
              <p key={`${t.start}-${t.end}`} className="text-sm font-semibold text-[var(--cc-accent)]">
                Away {t.start === t.end ? t.start : `${t.start} to ${t.end}`}
                {t.label ? ` · ${t.label}` : ""}
              </p>
            ))}
          </Card>
        );
      })}
    </ul>
  );
}

function Memos() {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {memos.map((m) => {
          const first = m.body.split(/(?<=[.!?])\s/)[0];
          const rest = m.body.slice(first.length).trim();
          return (
            <Card key={`${m.date}-${m.subject}`} title={m.subject} meta={`${m.date} · ${m.from} → ${m.to}`} more={rest ? <p>{rest}</p> : undefined}>
              <p className="text-sm text-[var(--cc-ink)]">{first}</p>
            </Card>
          );
        })}
      </ul>
      <section aria-label="Office jargon" className="border border-dashed border-[#8a6a2f] p-3">
        <p className="mb-2 font-pixel text-[10px] text-[var(--cc-accent)]">Office jargon</p>
        <dl className="grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
          {jargon.terms.map((t) => (
            <div key={t.term} className="contents">
              <dt className="font-semibold text-[var(--cc-ink)]">{t.term}</dt>
              <dd className="text-[var(--cc-muted)]">{t.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function Evidence({ floor }: { floor: number | "all" }) {
  const items = evidence.items.filter((e) => floor === "all" || e.floor === floor);
  if (items.length === 0) return <p className="text-sm text-[var(--cc-muted)]">Nothing filed for this floor.</p>;
  return (
    <ul className={GRID}>
      {items.map((e) => (
        <Card key={e.id} title={e.label} meta={floorName(e.floor)}>
          <p className="text-sm text-[var(--cc-ink)]">{e.text}</p>
        </Card>
      ))}
    </ul>
  );
}

/**
 * `floor` preselects that floor in the People, Calendar and Evidence filters.
 * `fill` makes the folder fill its parent and scroll inside the paper (for the overlay).
 */
export function CaseFile({ floor, fill = false }: { floor?: number; fill?: boolean }) {
  const [tab, setTab] = useState<TabId>("people");
  const [filter, setFilter] = useState<number | "all">(floor ?? "all");
  const id = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onTabKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + TABS.length) % TABS.length;
    setTab(TABS[n].id);
    tabRefs.current[n]?.focus();
  };

  const filtered = tab === "people" || tab === "calendar" || tab === "evidence";

  return (
    <div className={`flex flex-col ${fill ? "min-h-0 flex-1" : ""}`}>
      <div role="tablist" aria-label="Case file" className="grid grid-cols-3 items-end gap-1 px-1 sm:flex sm:pl-3">
        {TABS.map((t, i) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${t.id}`}
              aria-selected={on}
              aria-controls={`${id}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={`shrink-0 rounded-t-md border-2 border-b-0 border-[#8a6a2f] px-2 font-pixel text-[9px] text-[#2b2420] sm:px-3 ${
                on ? "relative top-[2px] z-10 bg-[#e2c27f] pb-2.5 pt-2" : "mt-1 bg-[#c9a560] pb-1.5 pt-1.5 hover:bg-[#d6b46e]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className={`border-2 border-[#8a6a2f] bg-[#e2c27f] p-2 shadow-[4px_4px_0_0_#15141a] sm:p-3 ${fill ? "flex min-h-0 flex-1 flex-col" : ""}`}>
        <div
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={`${id}-tab-${tab}`}
          style={PAPER}
          className={`flex flex-col gap-3 border border-[#d8ccb0] bg-[#fbf6e9] p-3 text-[var(--cc-ink)] sm:p-4 ${fill ? "min-h-0 flex-1 overflow-y-auto" : ""}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-pixel text-[9px] text-[var(--cc-muted)]">Plumpurse S&amp;T · file kept by {dossier.author}</p>
            <p aria-hidden className="-rotate-6 border-2 border-[#a33a2a] px-2 py-0.5 font-pixel text-[9px] text-[#a33a2a]">
              CONFIDENTIAL
            </p>
          </div>
          {tab === "people" && (
            <p className="border border-[#e8d99a] bg-[#fff4b0] p-2 text-sm text-[var(--cc-ink)] shadow-[2px_2px_0_0_#d8ccb0]">
              <span className="font-pixel text-[9px] text-[var(--cc-accent)]">Krystal: </span>
              {dossier.intro}
            </p>
          )}
          {filtered && <FloorFilter value={filter} onChange={setFilter} />}
          {tab === "people" && <People floor={filter} />}
          {tab === "vendors" && <Vendors />}
          {tab === "calendar" && <Calendar floor={filter} />}
          {tab === "memos" && <Memos />}
          {tab === "evidence" && <Evidence floor={filter} />}
          {tab === "mine" && <MyNotes />}
          {tab === "people" && dossier.gossip.length > 0 && (
            <section aria-label="Overheard" className="border border-dashed border-[#8a6a2f] p-3">
              <p className="mb-1 font-pixel text-[10px] text-[var(--cc-accent)]">Overheard</p>
              <ul className="flex flex-col gap-1 text-sm text-[var(--cc-muted)]">
                {dossier.gossip.map((g) => (
                  <li key={g}>“{g}”</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
