// The tower case file's contents for a set of unlocked floors, built on the server, so people, memos,
// schedules, vendors and evidence of locked floors never reach the browser.

import dossier from "@/content/plumpurse/dossier.json";
import directory from "@/content/plumpurse/directory.json";
import vendorsJson from "@/content/plumpurse/vendors.json";
import memosJson from "@/content/plumpurse/memos.json";
import calendar from "@/content/plumpurse/calendar.json";
import evidence from "@/content/plumpurse/evidence.json";

export type CaseEmployee = (typeof directory.employees)[number];
export type CaseVendor = (typeof vendorsJson.vendors)[number];
export type CaseMemo = (typeof memosJson.memos)[number];
export type CaseCalendarPerson = (typeof calendar.people)[number];
export type CaseEvidence = (typeof evidence.items)[number];

export interface CaseData {
  author: string;
  intro: string;
  employees: CaseEmployee[];
  facts: Record<string, string[]>;
  vendors: CaseVendor[];
  memos: CaseMemo[];
  calendar: CaseCalendarPerson[];
  evidence: CaseEvidence[];
}

/** Which floor's vault a vendor is paid from (its earliest floor). */
const vendorFloor = (paidFrom: string) =>
  paidFrom.includes("Pocket Branch") ? 0 : paidFrom.includes("Petty Cash") ? 1 : paidFrom.includes("Operations") ? 2 : 3;

export function caseDataFor(unlocked: number[]): CaseData {
  const open = new Set([0, ...unlocked]); // the tutorial is always open
  const employees = directory.employees.filter((e) => open.has(e.floor));
  const ids = new Set(employees.map((e) => e.id));
  return {
    author: dossier.author,
    intro: dossier.intro,
    employees,
    facts: Object.fromEntries(dossier.notes.filter((n) => ids.has(n.employee_id)).map((n) => [n.employee_id, n.facts])),
    vendors: vendorsJson.vendors.filter((v) => open.has(vendorFloor(v.paid_from))),
    memos: memosJson.memos.filter((m) => open.has(m.floor)).sort((a, b) => b.date.localeCompare(a.date)),
    calendar: calendar.people.filter((p) => ids.has(p.id)),
    evidence: evidence.items.filter((i) => open.has(i.floor)),
  };
}

export const EMPTY_CASE_DATA: CaseData = { author: dossier.author, intro: dossier.intro, employees: [], facts: {}, vendors: [], memos: [], calendar: [], evidence: [] };
