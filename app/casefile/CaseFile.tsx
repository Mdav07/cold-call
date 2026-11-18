"use client";

// The case file as a manila folder: tabs along the top, a sheet of paper inside, short cards.
// Used by /casefile and by the in-game overlay on the floors (which passes the current floor).

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { CaseData } from "./data";
import pocket from "@/content/pocket-branch/casefile.json";
import { MyNotes } from "./MyNotes";
import { useCollectedEvidence, useReadProps } from "@/app/play/evidence";
import type { DailyCase } from "@/shared/dailyCase";
import { dailyPropId } from "@/app/daily/room";

const TABS = [
  { id: "people", label: "People" },
  { id: "vendors", label: "Vendors" },
  { id: "calendar", label: "Calendar" },
  { id: "memos", label: "Memos" },
  { id: "evidence", label: "Evidence" },
  { id: "mine", label: "My notes" },
] as const;
type TabId = (typeof TABS)[number]["id"] | "notices";

/** The Daily Case is its own little file too: today's one person, today's vendors, the clues found. */
const DAILY_TABS: { id: TabId; label: string }[] = [
  { id: "people", label: "People" },
  { id: "vendors", label: "Vendors" },
  { id: "notices", label: "Clues" },
  { id: "mine", label: "My notes" },
];

/** The Pocket Branch is its own little file: nothing from the tower in it. */
const POCKET_TABS: { id: TabId; label: string }[] = [
  { id: "people", label: "People" },
  { id: "vendors", label: "Vendors" },
  { id: "calendar", label: "Calendar" },
  { id: "notices", label: "Notices" },
  { id: "evidence", label: "Evidence" },
  { id: "mine", label: "My notes" },
];

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABEL: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

// The file's contents come from the server (app/casefile/data.ts), already limited to unlocked floors.
const CaseDataContext = createContext<CaseData | null>(null);
function useCaseData() {
  const d = useContext(CaseDataContext);
  if (!d) throw new Error("CaseFile needs data");
  return { ...d, byId: Object.fromEntries(d.employees.map((e) => [e.id, e])) };
}
const floorName = (f: number) => (f === 0 ? "Tutorial" : `Floor ${f}`);

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

function Card({ title, meta, children }: { title: string; meta?: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex flex-col gap-1.5 border border-[#d8ccb0] bg-white/70 p-3 shadow-[2px_2px_0_0_#d8ccb0]">
      <p className="font-pixel text-[10px] leading-relaxed text-[var(--cc-ink)]">{title}</p>
      {meta && <div className="text-xs text-[var(--cc-muted)]">{meta}</div>}
      {children}
    </li>
  );
}

/** A document the player hasn't found yet: a blank slot pointing them back to the floor. */
function Locked({ where }: { where: string }) {
  return (
    <li className="flex flex-col gap-1 border border-dashed border-[#c9b98f] p-3 text-[var(--cc-muted)]">
      <p className="font-pixel text-[10px]">???</p>
      <p className="text-sm">Not found yet. Look around {where}.</p>
    </li>
  );
}

function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "green" }) {
  const c = tone === "green" ? "border-[#2f6b3a] text-[#2f6b3a]" : "border-[#8a6a2f] text-[#5c5040]";
  return <span className={`inline-block border px-1.5 py-0.5 font-pixel text-[8px] leading-none ${c}`}>{children}</span>;
}

/** Krystal's handwriting: one fact per line. */
function Facts({ lines }: { lines: string[] }) {
  return (
    <ul className="flex flex-col gap-1 border-l-2 border-[#2a4a8a] pl-2 text-sm text-[#2a4a8a]">
      {lines.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}

function FloorFilter({
  value,
  onChange,
  floors,
}: {
  value: number | "all";
  onChange: (v: number | "all") => void;
  /** Floors the player may filter to (unlocked, and Pocket Branch only in the tutorial file). */
  floors: number[];
}) {
  const opts: (number | "all")[] = floors.length > 1 ? ["all", ...floors] : [...floors];
  if (opts.length === 0) return null;
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

/** Local weekday + clock so the Calendar tab lines up with "now". */
function NowChip() {
  const [label, setLabel] = useState(() => formatNow());
  useEffect(() => {
    const tick = () => setLabel(formatNow());
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="font-pixel text-[9px] text-[var(--cc-accent)]" title="Your local time — match it to the schedules below">
      Now · {label}
    </p>
  );
}

function formatNow() {
  const d = new Date();
  const day = DAY_LABEL[["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()]];
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} ${time}`;
}

/** Floors shown in the filter: tutorial file is Pocket Branch only; main file never includes 0. */
function visibleFloors(unlocked: number[], atFloor: number | undefined): number[] {
  const tutorial = atFloor === 0;
  const base = unlocked.length > 0 ? unlocked : tutorial ? [0] : [1];
  return base.filter((f) => (tutorial ? f === 0 : f > 0)).sort((a, b) => a - b);
}

const GRID = "grid items-start gap-3 sm:grid-cols-2";

function onFloor(floor: number, filter: number | "all", allowed: number[]) {
  return filter === "all" ? allowed.includes(floor) : floor === filter;
}

function People({ floor, allowed }: { floor: number | "all"; allowed: number[] }) {
  const { employees, facts } = useCaseData();
  // Only the people you can con; everyone else shows up in their facts.
  const list = employees.filter((e) => facts[e.id] && onFloor(e.floor, floor, allowed));
  return (
    <ul className={GRID}>
      {list.map((e) => (
        <Card
          key={e.id}
          title={e.name}
          meta={
            <span className="flex flex-wrap items-center gap-1">
              {e.title} <Chip>{floorName(e.floor)}</Chip>
            </span>
          }
        >
          <Facts lines={facts[e.id]} />
        </Card>
      ))}
    </ul>
  );
}

function Vendors() {
  const { vendors } = useCaseData();
  return (
    <ul className={GRID}>
      {vendors.filter((v) => !v.paid_from.includes("Pocket Branch")).map((v) => (
        <Card key={v.name} title={v.name}>
          <p className="text-sm text-[var(--cc-ink)]">
            <span className="font-semibold text-[var(--cc-ok)]">{dollars(v.typical_invoice_usdc)}</span> · {v.paid_from}
          </p>
          <p className="text-sm text-[var(--cc-muted)]">{v.card}</p>
        </Card>
      ))}
    </ul>
  );
}

function Calendar({ floor, allowed }: { floor: number | "all"; allowed: number[] }) {
  const { calendar, byId } = useCaseData();
  const people = calendar.filter((p) => {
    const f = byId[p.id]?.floor;
    return f != null && onFloor(f, floor, allowed);
  });
  return (
    <div className="flex flex-col gap-3">
      <NowChip />
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
    </div>
  );
}

function Memos({ allowed }: { allowed: number[] }) {
  const read = useReadProps();
  const { memos } = useCaseData();
  const list = memos.filter((m) => allowed.includes(m.floor));
  return (
    <ul className="flex flex-col gap-3">
      {list.map((m) =>
        !m.props.some((id) => read.has(id)) ? (
          <Locked key={`${m.date}-${m.subject}`} where={floorName(m.floor)} />
        ) : (
        <Card key={`${m.date}-${m.subject}`} title={m.subject} meta={`${m.date.slice(5)} · ${m.from}`}>
          <p className="text-sm text-[var(--cc-ink)]">{m.body}</p>
        </Card>
        ),
      )}
    </ul>
  );
}

function Evidence({ floor, allowed }: { floor: number | "all"; allowed: number[] }) {
  const found = useCollectedEvidence();
  const { evidence } = useCaseData();
  const items = evidence.filter((e) => onFloor(e.floor, floor, allowed));
  if (items.length === 0) return <p className="text-sm text-[var(--cc-muted)]">Nothing filed for this floor.</p>;
  return (
    <ul className={GRID}>
      {items.map((e) =>
        found.has(e.id) ? (
          <Card key={e.id} title={e.label} meta={floorName(e.floor)}>
            <p className="text-sm text-[var(--cc-ink)]">{e.text}</p>
          </Card>
        ) : (
          <Locked key={e.id} where={floorName(e.floor)} />
        ),
      )}
    </ul>
  );
}

function PocketPeople() {
  return (
    <ul className={GRID}>
      {pocket.people.map((e) => (
        <Card
          key={e.id}
          title={e.name}
          meta={
            <span className="flex flex-wrap items-center gap-1">
              {e.title} {e.can_pay && <Chip tone="green">Can pay</Chip>}
            </span>
          }
        >
          <Facts lines={e.facts} />
        </Card>
      ))}
    </ul>
  );
}

function PocketVendors() {
  return (
    <ul className={GRID}>
      {pocket.vendors.map((v) => (
        <Card key={v.name} title={v.name}>
          <p className="text-sm text-[var(--cc-ink)]">
            <span className="font-semibold text-[var(--cc-ok)]">{v.typical}</span> · {v.paid_from}
          </p>
          <p className="text-sm text-[var(--cc-muted)]">{v.card}</p>
        </Card>
      ))}
    </ul>
  );
}

function PocketCalendar() {
  return (
    <div className="flex flex-col gap-3">
      <NowChip />
      <ul className={GRID}>
        {pocket.schedule.map((s) => (
          <Card key={s.who} title={s.who} meta={s.days}>
            {s.items.map((i) => (
              <p key={i} className="text-sm text-[var(--cc-ink)]">{i}</p>
            ))}
          </Card>
        ))}
      </ul>
    </div>
  );
}

function PocketNotices() {
  const read = useReadProps();
  return (
    <ul className="flex flex-col gap-3">
      {pocket.notices.map((n) =>
        n.props.some((id) => read.has(id)) ? (
          <Card key={n.title} title={n.title}>
            <p className="text-sm text-[var(--cc-ink)]">{n.body}</p>
          </Card>
        ) : (
          <Locked key={n.title} where="the branch" />
        ),
      )}
    </ul>
  );
}

function DailyPeople({ c }: { c: DailyCase }) {
  return (
    <ul className={GRID}>
      <Card
        title={c.employee.name}
        meta={
          <span className="flex flex-wrap items-center gap-1">
            {c.employee.title} <Chip tone="green">Can pay</Chip>
          </span>
        }
      >
        <Facts lines={[c.employee.personality, "Pays one listed vendor a day, up to $" + c.capUsdc.toFixed(2) + "."]} />
      </Card>
    </ul>
  );
}

function DailyVendors({ c }: { c: DailyCase }) {
  return (
    <ul className={GRID}>
      {c.vendors.map((v) => (
        <Card key={v.name} title={v.name} meta={"Invoices " + v.code.split("-")[0] + "-…"}>
          <p className="text-sm text-[var(--cc-ink)]">{v.what[0].toUpperCase() + v.what.slice(1)}</p>
        </Card>
      ))}
    </ul>
  );
}

function DailyClues({ c }: { c: DailyCase }) {
  const read = useReadProps();
  return (
    <ul className={GRID}>
      {c.clues.map((clue) =>
        read.has(dailyPropId(c.date, clue.id)) ? (
          <Card key={clue.id} title={clue.label}>
            <p className="text-sm text-[var(--cc-ink)]">{clue.text}</p>
          </Card>
        ) : (
          <Locked key={clue.id} where="the room" />
        ),
      )}
    </ul>
  );
}

function PocketEvidence() {
  const found = useCollectedEvidence();
  const { evidence } = useCaseData();
  const items = evidence.filter((e) => e.floor === 0);
  return (
    <ul className={GRID}>
      {items.map((e) =>
        found.has(e.id) ? (
          <Card key={e.id} title={e.label}>
            <p className="text-sm text-[var(--cc-ink)]">{e.text}</p>
          </Card>
        ) : (
          <Locked key={e.id} where="the branch" />
        ),
      )}
    </ul>
  );
}

/**
 * `floor` preselects that floor in the People, Calendar and Evidence filters.
 * `unlockedFloors` limits the filter chips (and "All") to floors the player has open.
 * Floor 0 opens the separate Pocket Branch file (content/pocket-branch); the main file never lists it.
 * `fill` makes the folder fill its parent and scroll inside the paper (for the overlay).
 */
export function CaseFile({
  data,
  floor,
  unlockedFloors = [],
  fill = false,
  onClose,
  daily,
}: {
  /** The tower file's contents for the player's unlocked floors (app/casefile/data.ts, built on the server). */
  data: CaseData;
  /** Today's Daily Case: shows its own small file instead of the tower's. */
  daily?: DailyCase;
  floor?: number;
  unlockedFloors?: number[];
  fill?: boolean;
  onClose?: () => void;
}) {
  const allowed = useMemo(() => visibleFloors(unlockedFloors, floor), [unlockedFloors, floor]);
  const initial: number | "all" = floor != null && allowed.includes(floor) ? floor : allowed.length === 1 ? allowed[0] : "all";
  const [tab, setTab] = useState<TabId>("people");
  const [filter, setFilter] = useState<number | "all">(initial);
  const id = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isDaily = !!daily;
  const isPocket = floor === 0 && !isDaily;
  const tabs: readonly { id: TabId; label: string }[] = isDaily ? DAILY_TABS : isPocket ? POCKET_TABS : TABS;

  // If unlocks change (or we opened on a locked chip), show a visible floor instead.
  const active: number | "all" = filter !== "all" && !allowed.includes(filter) ? (allowed.length === 1 ? allowed[0]! : "all") : filter;

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onTabKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + tabs.length) % tabs.length;
    setTab(tabs[n].id);
    tabRefs.current[n]?.focus();
  };

  const filtered = !isPocket && !isDaily && (tab === "people" || tab === "calendar" || tab === "evidence");

  return (
    <CaseDataContext.Provider value={data}>
    <div className={`flex flex-col ${fill ? "min-h-0 flex-1" : ""}`}>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-end">
      <div role="tablist" aria-label="Case file" className="grid flex-1 grid-cols-3 items-end gap-1 px-1 sm:flex sm:pl-3">
        {tabs.map((t, i) => {
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
              className={`shrink-0 rounded-t-md border-2 border-b-0 border-[#8a6a2f] px-2 font-pixel text-[9px] text-[#2b2420] outline-none focus-visible:underline focus-visible:underline-offset-2 sm:px-3 ${
                on ? "relative top-[2px] z-10 bg-[#e2c27f] pb-2.5 pt-2" : "mt-1 bg-[#c9a560] pb-1.5 pt-1.5 hover:bg-[#d6b46e]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {onClose && (
        // The overlay's Close sits on the folder, at the end of the tab row.
        <button type="button" onClick={onClose} className="pixel-button self-end !px-3 !py-1.5 sm:mb-1">
          ✕ Close<span className="hidden sm:inline"> (Esc)</span>
        </button>
      )}
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
            <p className="font-pixel text-[9px] text-[var(--cc-muted)]">
              {daily
                ? `Daily Case · ${daily.title} · ${daily.date}`
                : isPocket
                  ? `${pocket.title} · practice file kept by ${pocket.author}`
                  : `Plumpurse S&T · file kept by ${data.author}`}
            </p>
            <p aria-hidden className="-rotate-6 border-2 border-[#a33a2a] px-2 py-0.5 font-pixel text-[9px] text-[#a33a2a]">
              CONFIDENTIAL
            </p>
          </div>
          {tab === "people" && (
            <p className="border border-[#e8d99a] bg-[#fff4b0] p-2 text-sm text-[var(--cc-ink)] shadow-[2px_2px_0_0_#d8ccb0]">
              <span className="font-pixel text-[9px] text-[var(--cc-accent)]">Krystal: </span>
              {daily
                ? `${daily.place}. One person, one small payment. Read the notes in the room: they tell you who to be and what not to say.`
                : isPocket
                  ? pocket.intro
                  : data.intro}
            </p>
          )}
          {filtered && <FloorFilter value={active} onChange={setFilter} floors={allowed} />}
          {daily ? (
            <>
              {tab === "people" && <DailyPeople c={daily} />}
              {tab === "vendors" && <DailyVendors c={daily} />}
              {tab === "notices" && <DailyClues c={daily} />}
            </>
          ) : isPocket ? (
            <>
              {tab === "people" && <PocketPeople />}
              {tab === "vendors" && <PocketVendors />}
              {tab === "calendar" && <PocketCalendar />}
              {tab === "notices" && <PocketNotices />}
              {tab === "evidence" && <PocketEvidence />}
            </>
          ) : (
            <>
              {tab === "people" && <People floor={active} allowed={allowed} />}
              {tab === "vendors" && <Vendors />}
              {tab === "calendar" && <Calendar floor={active} allowed={allowed} />}
              {tab === "memos" && <Memos allowed={allowed} />}
              {tab === "evidence" && <Evidence floor={active} allowed={allowed} />}
            </>
          )}
          {tab === "mine" && <MyNotes />}
        </div>
      </div>
    </div>
    </CaseDataContext.Provider>
  );
}
