/** Display helpers shared by pages. */

export const SCHOOL_TZ = process.env.SCHOOL_TZ ?? 'America/New_York';

/** Today's date (YYYY-MM-DD) in the school's time zone. */
export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TZ }).format(now);
}

/** Local date (YYYY-MM-DD) of a timestamp, in the school's time zone. */
export function localDate(iso: string): string {
  return todayIso(new Date(iso));
}

/** ISO timestamp n days ago. */
export function daysAgoIso(n: number): string {
  return new Date(Date.now() - n * 864e5).toISOString();
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso: string | null | undefined, opts: { year?: boolean } = { year: true }): string {
  if (!iso) return '—';
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(opts.year === false ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
}

export function fmtRange(start: string, end: string): string {
  if (start === end) return fmtDate(start);
  return `${fmtDate(start, { year: false })} – ${fmtDate(end)}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: SCHOOL_TZ,
  });
}

export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function weekdayName(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

export function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** "$1,234.50" or "1234.5" → cents. */
export function parseMoney(input: string): number | null {
  const n = Number(input.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function shortName(name: string): string {
  const parts = name.split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 172800) return 'Yesterday';
  return fmtDate(iso);
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

export const ABSENCE_LABEL: Record<string, string> = {
  SICK: 'Sick',
  PERSONAL: 'Personal',
  SIMCHA: 'Simcha',
  MATERNITY: 'Maternity',
  SNOW_DAY: 'Snow day',
  UNPAID: 'Unpaid',
};

export const OCCASION_LABEL: Record<string, string> = {
  OWN_WEDDING: 'Own wedding',
  CHILD_WEDDING: "Child's wedding",
  GRANDCHILD_WEDDING: "Grandchild's wedding",
  SIBLING_WEDDING: "Sibling's wedding",
  CHILD_BAR_BAS_MITZVAH: "Child's Bar/Bas Mitzvah",
  OWN_LECHAIM_MORNING: 'Own Lechaim (morning teacher)',
  OWN_LECHAIM_AFTERNOON: 'Own Lechaim (afternoon teacher)',
  CHILD_LECHAIM: "Child's Lechaim",
  BRIS_NEPHEW: 'Bris — nephew',
  BRIS_GRANDCHILD: 'Bris — grandchild',
  SHIVA: 'Shiva',
};

export const DOC_LABEL: Record<string, string> = {
  W4: 'W‑4',
  ID: 'ID card',
  I9: 'I‑9',
  IT2104: 'IT‑2104',
  DIRECT_DEPOSIT: 'Direct deposit',
  OTHER: 'Other',
};

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  DEPT_HEAD: 'Department head',
  STAFF: 'Staff',
};
