import { schoolYears, type SchoolYear } from '@/lib/store';
import { todayIso } from '@/lib/format';

/** The year marked current, else the one containing today, else the latest. */
export async function currentSchoolYear(): Promise<SchoolYear | undefined> {
  const years = await schoolYears.all();
  const today = todayIso();
  return (
    years.find((y) => y.current) ??
    years.find((y) => y.startsOn <= today && today <= y.endsOn) ??
    years.sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0]
  );
}

export async function requireSchoolYear(): Promise<SchoolYear> {
  const y = await currentSchoolYear();
  if (!y) throw new Error('No school year set up yet. Add one on the Settings page.');
  return y;
}

/**
 * The school year an absence belongs to, from its dates. PTO and maternity allowances are per school
 * year, so an absence must sit inside one year: one that runs past the year's end is refused, and
 * the rest is posted separately in the next year.
 */
export async function schoolYearForDates(
  startsOn: string,
  endsOn: string,
): Promise<{ ok: true; year: SchoolYear } | { ok: false; error: string }> {
  const years = await schoolYears.all();
  const year = years.find((y) => y.startsOn <= startsOn && startsOn <= y.endsOn);
  if (!year) return { ok: false, error: `No school year covers ${startsOn}. Add it on the Settings page.` };
  if (endsOn > year.endsOn)
    return {
      ok: false,
      error: `The ${year.label} school year ends ${year.endsOn}. Post the days after that separately in the next year.`,
    };
  return { ok: true, year };
}
