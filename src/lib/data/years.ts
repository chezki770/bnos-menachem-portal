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
