import Link from 'next/link';
import { SubmitButton } from '@/components/client';
import { TimeCardBadge } from '@/components/status';
import { Notice, PageHead } from '@/components/ui';
import { requireUser } from '@/lib/auth/current-user';
import { isHourly } from '@/lib/data/employees';
import { parseWeek, shiftsBetween, weekDays } from '@/lib/data/shifts';
import { entryHours, openEntry, timeCardSummary } from '@/lib/data/time';
import { addDays, fmtDate, fmtDateTime, fmtRange, fmtTime, todayIso, weekdayName } from '@/lib/format';
import { employees, payPeriods } from '@/lib/store';
import { clockIn, clockOut, submitTimeCard } from '../actions';

export default async function MySchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const emp = (await employees.get(user.id))!;
  const monday = parseWeek(sp.week);
  const days = weekDays(monday);
  const mine = await shiftsBetween(days[0], days[4], (s) => s.employeeId === user.id);
  const hourly = isHourly(emp);
  const today = todayIso();
  const period = hourly ? await payPeriods.find((p) => p.startsOn <= today && today <= p.endsOn) : undefined;
  const tc = period ? await timeCardSummary(user.id, period) : null;
  const open = hourly ? await openEntry(user.id) : undefined;

  return (
    <>
      <PageHead
        title="My schedule"
        sub={`Week of ${fmtDate(monday)}`}
        actions={
          <>
            <Link className="btn btn-secondary btn-sm" href={`/me/schedule?week=${addDays(monday, -7)}`}>
              ← Previous
            </Link>
            <Link className="btn btn-secondary btn-sm" href="/me/schedule">
              This week
            </Link>
            <Link className="btn btn-secondary btn-sm" href={`/me/schedule?week=${addDays(monday, 7)}`}>
              Next →
            </Link>
          </>
        }
      />
      <Notice searchParams={sp} />
      {hourly && (
        <div className="panel mb">
          <div className="panel-body clock-card">
            <div>
              <div className="faint">Time clock</div>
              <div className="big">
                {open ? `Clocked in since ${fmtDateTime(open.clockIn)}` : 'Not clocked in'}
              </div>
            </div>
            <form action={open ? clockOut : clockIn}>
              <SubmitButton pendingText="…">{open ? 'Clock out' : 'Clock in'}</SubmitButton>
            </form>
          </div>
        </div>
      )}
      <div className="panel mb">
        <div className="panel-body">
          {days.map((d) => {
            const list = mine.filter((s) => s.date === d);
            return (
              <div className="task-row" key={d}>
                <div>
                  <div className="task-label">
                    {weekdayName(d)}
                    {d === today && <span className="faint"> · today</span>}
                  </div>
                  <div className="task-sub">
                    {list.length
                      ? list
                          .map((s) => `${fmtTime(s.startTime)} – ${fmtTime(s.endTime)} · ${s.department}`)
                          .join(', ')
                      : 'No shift scheduled'}
                  </div>
                </div>
                <span className="faint">{fmtDate(d, { year: false })}</span>
              </div>
            );
          })}
        </div>
      </div>
      {hourly && period && tc && (
        <div className="panel">
          <div className="panel-head">
            <h3>Time card · {fmtRange(period.startsOn, period.endsOn)}</h3>
            <TimeCardBadge status={tc.card?.status ?? 'MISSING'} />
          </div>
          <div className="panel-body">
            <div className="pay-card-summary">
              <div>
                <strong>{tc.regular}</strong>Regular hours
              </div>
              <div>
                <strong>{tc.overtime}</strong>Overtime
              </div>
              <div>
                <strong>{tc.total}</strong>Total
              </div>
            </div>
            {tc.card?.status === 'NEEDS_CHANGES' && tc.card.note && (
              <p className="alert alert-warn">The office asked for changes: {tc.card.note}</p>
            )}
            {tc.entries.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Clock in</th>
                    <th>Clock out</th>
                    <th className="num">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {tc.entries.map((e) => (
                    <tr key={e.id}>
                      <td>{fmtDateTime(e.clockIn)}</td>
                      <td>{e.clockOut ? fmtDateTime(e.clockOut) : 'Open'}</td>
                      <td className="num">{entryHours(e).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="faint">
              Overtime is hours over 40 per Monday–Sunday week, paid at 1.5×. If a punch is wrong, tell the
              office before submitting.
            </p>
            {tc.card?.status !== 'APPROVED' && period.status === 'DRAFT' && (
              <form action={submitTimeCard}>
                <input type="hidden" name="payPeriodId" value={period.id} />
                <SubmitButton pendingText="Submitting…">
                  {tc.card ? 'Re-submit time card' : 'Submit time card'}
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
