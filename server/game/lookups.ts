// Lookups the employees call as tools. A's thin routes in app/api/tools/* call these.
// Matching is deliberately strict: a con only passes if the player uses names that exist in
// the case file (registry spelling or a listed alias), never a near miss.

import calendar from "@/content/plumpurse/calendar.json";
import directory from "@/content/plumpurse/directory.json";
import vendorFile from "@/content/plumpurse/vendors.json";
import type {
  CheckCalendarInput,
  CheckCalendarResult,
  CheckVendorListInput,
  CheckVendorListResult,
  VerifyEmployeeInput,
  VerifyEmployeeResult,
} from "@/shared/interfaces";

type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

interface CalendarPerson {
  id: string;
  weekly: Partial<Record<Weekday, string[]>>;
  pto: { start: string; end: string; label?: string }[];
}

/** Lowercase, drop punctuation, "the", and company suffixes, collapse spaces. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(the|inc|llc|ltd|co|company|corp)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matches(query: string, names: string[]): boolean {
  const q = normalizeName(query);
  if (!q) return false;
  return names.some((n) => {
    const name = normalizeName(n);
    // Exact, or the query quotes a full listed name inside a longer phrase
    // ("invoice from Quillfeather Supplies").
    return q === name || (name.length >= 5 && ` ${q} `.includes(` ${name} `));
  });
}

function findEmployee(name: string) {
  return directory.employees.find((e) => matches(name, [e.name, ...e.aliases]));
}

export function checkVendorList(input: CheckVendorListInput): CheckVendorListResult {
  const v = vendorFile.vendors.find((x) => matches(input.vendor_name, [x.name, ...x.aliases]));
  if (!v) return { match: false };
  return {
    match: true,
    vendor_name: v.name,
    payment_address_label: v.payment_address_label,
    notes: [
      `${v.category}. Typical invoice ${v.typical_invoice_usdc[0]} to ${v.typical_invoice_usdc[1]} USDC, paid from ${v.paid_from}.`,
      ...v.notes,
    ],
  };
}

export function checkCalendar(input: CheckCalendarInput): CheckCalendarResult {
  const emp = findEmployee(input.person);
  if (!emp) return { exists: false, busy: false, pto: false, meetings: [] };

  const person = (calendar.people as CalendarPerson[]).find((p) => p.id === emp.id);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null;
  if (!person || !date) return { exists: true, busy: false, pto: false, meetings: [] };

  const pto = person.pto.find((r) => r.start <= date && date <= r.end);
  if (pto) {
    return { exists: true, busy: true, pto: true, meetings: [`PTO: ${pto.label ?? "out of office"}`] };
  }
  const weekday = WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const meetings = person.weekly[weekday] ?? [];
  return { exists: true, busy: meetings.length > 0, pto: false, meetings };
}

export function verifyEmployee(input: VerifyEmployeeInput): VerifyEmployeeResult {
  const emp = findEmployee(input.name);
  if (!emp) return { exists: false };
  return {
    exists: true,
    title: emp.title,
    manager: emp.manager ?? undefined,
    department: emp.department,
    notes: emp.notes,
  };
}
