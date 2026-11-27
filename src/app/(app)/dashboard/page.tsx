import Link from 'next/link';
import { Empty, PageHead, Stat } from '@/components/ui';
import { requireManager } from '@/lib/auth/current-user';
import { documentsByEmployee, missingRequired } from '@/lib/data/documents';
import { employeeMap, isHourly, visibleEmployees } from '@/lib/data/employees';
import { periodsForYear } from '@/lib/data/payroll';
import { shiftsBetween, weekDays, mondayOf } from '@/lib/data/shifts';
import { currentSchoolYear } from '@/lib/data/years';
import { daysAgoIso, fmtRange, plural, shortName, timeAgo, todayIso } from '@/lib/format';
import { auditLog, contracts, timeCards, timeOffRequests, type Employee } from '@/lib/store';

const ACTIVITY: Record<string, string> = {
  DOCUMENT_UPLOADED: 'uploaded a document',
  CONTRACT_SIGNED: 'signed their contract',
  CONTRACT_SENT: 'sent a contract',
  ABSENCE_POSTED: 'posted an absence',
  REQUEST_SUBMITTED: 'requested time off',
  REQUEST_APPROVED: 'approved a time-off request',
  REQUEST_DECLINED: 'declined a time-off request',
  SHIFT_CREATED: 'added a shift',
  SHIFT_FILLED: 'filled an open shift',
  EMPLOYEE_CREATED: 'added an employee',
  PAYROLL_SUBMITTED: 'submitted payroll',
  TIME_CARD_SUBMITTED: 'submitted a time card',
  SELF_INFO_UPDATED: 'updated their details',
  DATA_IMPORTED: 'imported a CSV',
};

export default async function DashboardPage() {
  const user = await requireManager();
  const admin = user.role === 'ADMIN';
  const year = await currentSchoolYear();
  const people = await visibleEmployees(user);
  const ids = new Set(people.map((p) => p.id));
  const byId = await employeeMap();
  const today = todayIso();
  const days = weekDays(mondayOf(today));

  const yearContracts = year
    ? await contracts.where((c) => c.schoolYearId === year.id && ids.has(c.employeeId))
    : [];
  const unsigned = people.filter(
    (p) => yearContracts.find((c) => c.employeeId === p.id)?.status !== 'SIGNED',
  );
  const awaiting = yearContracts.filter((c) => c.status === 'SENT');
  const weekAgo = daysAgoIso(7);
  const staleSent = awaiting.filter((c) => c.sentAt && c.sentAt < weekAgo).length;

  const docs = await documentsByEmployee();
  const missingDocs = people
    .map((p) => ({ p, missing: missingRequired(docs.get(p.id)) }))
    .filter((x) => x.missing.length);

  const weekShifts = await shiftsBetween(days[0], days[4], (s) => admin || s.department === user.department);
  const open = weekShifts.filter((s) => !s.employeeId);
  const openDepts = new Set(open.map((s) => s.department)).size;

  const pending = await timeOffRequests.where(
    (r) => r.status === 'PENDING' && ids.has(r.employeeId) && r.employeeId !== user.id,
  );
  const periods = year ? await periodsForYear(year.id) : [];
  const nextRun = periods.find((p) => p.status === 'DRAFT' && p.payDate >= today);
  const daysToPay = nextRun ? Math.round((Date.parse(nextRun.payDate) - Date.parse(today)) / 864e5) : null;
  const submittedCards = nextRun
    ? await timeCards.where((c) => c.payPeriodId === nextRun.id && c.status === 'SUBMITTED')
    : [];
  const hourlyCount = people.filter((p) => isHourly(p)).length;

  const activity = (await auditLog.where((a) => !!ACTIVITY[a.action] && (admin || ids.has(a.actorId ?? ''))))
    .slice(-8)
    .reverse();
  const depts = new Set(people.map((p) => p.department)).size;
  const who = (e?: Employee) => (e ? shortName(e.name) : 'Someone');

  return (
    <>
      <PageHead
        title="Dashboard"
        sub={`${admin ? 'All departments' : user.department} · ${year?.label.replace('-', ' – ') ?? 'No school year set'}`}
      />
      <div className="stat-row">
        <Stat label="Employees" value={people.length} note={`across ${plural(depts, 'department')}`} />
        <Stat
          label="Contracts awaiting signature"
          value={awaiting.length}
          note={staleSent ? `${staleSent} sent over a week ago` : 'None overdue'}
          flag={awaiting.length > 0}
        />
        <Stat
          label="Open shifts this week"
          value={open.length}
          note={open.length ? `across ${plural(openDepts, 'department')}` : 'All filled'}
          flag={open.length > 0}
        />
        {admin ? (
          <Stat
            label="Payroll run due"
            value={daysToPay === null ? '—' : daysToPay === 0 ? 'Today' : plural(daysToPay, 'day')}
            note={nextRun ? `${fmtRange(nextRun.startsOn, nextRun.endsOn)} pay period` : 'No upcoming period'}
            flag={daysToPay !== null && daysToPay <= 3}
          />
        ) : (
          <Stat
            label="Time-off requests"
            value={pending.length}
            note="Waiting for you"
            flag={pending.length > 0}
          />
        )}
      </div>
      <div className="two-col">
        <div className="panel">
          <div className="panel-head">
            <h3>Needs attention</h3>
          </div>
          <div className="panel-body">
            {pending.length > 0 && (
              <Task
                label={`${plural(pending.length, 'time-off request')} waiting`}
                sub="Approve or decline"
                href="/absences"
                action="Review"
              />
            )}
            {admin && unsigned.length > 0 && (
              <Task
                label={`${plural(unsigned.length, 'contract')} unsigned`}
                sub="Blocking payroll for those employees"
                href="/contracts"
                action="Review"
              />
            )}
            {admin && missingDocs.length > 0 && (
              <Task
                label={`${plural(missingDocs.length, 'employee')} missing documents`}
                sub={
                  missingDocs
                    .slice(0, 3)
                    .map((x) => shortName(x.p.name))
                    .join(', ') + (missingDocs.length > 3 ? '…' : '')
                }
                href="/reports/documents"
                action="Review"
              />
            )}
            {open.length > 0 && (
              <Task
                label={`${plural(open.length, 'open shift')}, this week`}
                sub="Unfilled"
                href="/scheduling?tab=open"
                action="Fill shifts"
              />
            )}
            {admin && submittedCards.length > 0 && (
              <Task
                label={`${plural(submittedCards.length, 'time card')} to approve`}
                sub={`${hourlyCount} hourly employees`}
                href={`/payroll?period=${nextRun!.id}&tab=cards`}
                action="Review"
              />
            )}
            {!pending.length &&
              !(admin && (unsigned.length || missingDocs.length || submittedCards.length)) &&
              !open.length && <Empty title="All caught up">Nothing needs your attention right now.</Empty>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h3>Recent activity</h3>
          </div>
          <div className="panel-body">
            {activity.length === 0 ? (
              <p className="muted">No activity yet.</p>
            ) : (
              activity.map((a) => (
                <div className="activity-row" key={a.id}>
                  <div className="activity-dot" />
                  <div style={{ flex: 1 }}>
                    {who(byId.get(a.actorId ?? ''))} {ACTIVITY[a.action]}
                    {a.detail && a.action !== 'DOCUMENT_UPLOADED' ? (
                      <span className="faint"> · {a.detail}</span>
                    ) : null}
                  </div>
                  <div className="activity-time">{timeAgo(a.at)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Task({ label, sub, href, action }: { label: string; sub: string; href: string; action: string }) {
  return (
    <div className="task-row">
      <div>
        <div className="task-label">{label}</div>
        <div className="task-sub">{sub}</div>
      </div>
      <Link className="btn btn-secondary btn-sm" href={href}>
        {action}
      </Link>
    </div>
  );
}
