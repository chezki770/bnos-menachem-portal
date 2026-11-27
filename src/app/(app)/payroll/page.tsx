import Link from 'next/link';
import { SubmitButton } from '@/components/client';
import { TimeCardBadge } from '@/components/status';
import { Badge, Empty, NameCell, Notice, Stat, Download } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/current-user';
import { employeeMap } from '@/lib/data/employees';
import { buildRun, periodsForYear, type RunLine } from '@/lib/data/payroll';
import { entryHours, timeCardSummary } from '@/lib/data/time';
import { currentSchoolYear } from '@/lib/data/years';
import {
  fmtDate,
  fmtDateTime,
  fmtRange,
  localDate,
  money,
  shortName,
  SCHOOL_TZ,
  todayIso,
} from '@/lib/format';
import { PAYROLL_STATUS_LABEL } from '@/lib/rules/payroll';
import { auditLog } from '@/lib/store';
import {
  addAdjustment,
  approveAllSubmitted,
  decideTimeCard,
  deleteAdjustment,
  deleteTimeEntry,
  saveTimeEntry,
  setPeriodStatus,
  submitRun,
} from './actions';

type SP = Record<string, string | undefined>;
const TABS = [
  ['run', 'This run'],
  ['cards', 'Time cards'],
  ['adjustments', 'Adjustments'],
  ['history', 'History'],
] as const;
const STATUS_TONE = { DRAFT: 'brass', SUBMITTED: 'moss', PAID: 'neutral' } as const;

export default async function PayrollPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const year = await currentSchoolYear();
  const periods = year ? await periodsForYear(year.id) : [];
  if (!periods.length)
    return (
      <>
        <div className="page-head">
          <h1>Payroll</h1>
        </div>
        <div className="panel">
          <Empty title="No pay periods yet">
            Generate pay periods for the school year on the{' '}
            <Link className="link" href="/settings">
              Settings
            </Link>{' '}
            page.
          </Empty>
        </div>
      </>
    );
  const today = todayIso();
  const period =
    periods.find((p) => p.id === sp.period) ??
    periods.find((p) => p.status === 'DRAFT' && p.startsOn <= today) ??
    periods.find((p) => p.endsOn >= today) ??
    periods[periods.length - 1];
  const tab = TABS.some(([t]) => t === sp.tab) ? sp.tab! : 'run';
  const lines = await buildRun(period);
  const draft = period.status === 'DRAFT';
  const ready = lines.filter((l) => l.status === 'READY');
  const blocked = lines.filter((l) => l.status !== 'READY');
  const total = ready.reduce((s, l) => s + l.totalCents, 0);
  const base = `/payroll?period=${period.id}`;

  return (
    <>
      <div className="pay-page-head">
        <div className="pay-head-row">
          <div className="pay-head-title">
            <h1>Payroll</h1>
            <Badge tone={STATUS_TONE[period.status]}>
              {period.status[0] + period.status.slice(1).toLowerCase()}
            </Badge>
          </div>
          <div className="pay-head-actions">
            <form className="hstack">
              <input type="hidden" name="tab" value={tab} />
              <select className="pay-select" name="period" defaultValue={period.id} aria-label="Pay period">
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {fmtRange(p.startsOn, p.endsOn)} · {p.status.toLowerCase()}
                  </option>
                ))}
              </select>
              <button className="btn btn-secondary">Go</button>
            </form>
            <Download className="btn btn-secondary" href={`/api/payroll/export?period=${period.id}`}>
              Export CSV for provider
            </Download>
          </div>
        </div>
        <p className="pay-subtitle-line">
          {fmtRange(period.startsOn, period.endsOn)} · Pay date {fmtDate(period.payDate)} · Taxes and net pay
          calculated by the payroll provider.
        </p>
      </div>
      <Notice searchParams={sp} />
      {draft && blocked.length > 0 && (
        <div className="pay-warning">
          <span className="pay-warning-text">
            {blocked.length} employee(s) will be skipped until their issue is fixed:{' '}
            {[...new Set(blocked.map((b) => PAYROLL_STATUS_LABEL[b.status].toLowerCase()))].join(', ')}.
          </span>
        </div>
      )}
      <div className="stat-row">
        <Stat label="Ready to pay" value={ready.length} note={`of ${lines.length} employees`} />
        <Stat
          label="Skipped"
          value={blocked.length}
          flag={blocked.length > 0}
          note="Blocked or missing info"
        />
        <Stat label="Total before tax" value={money(total)} note={draft ? 'Estimate' : 'Submitted'} />
        <Stat
          label="Pay date"
          value={fmtDate(period.payDate, { year: false })}
          note={period.status === 'PAID' ? 'Paid' : draft ? 'Draft' : 'Submitted'}
        />
      </div>
      <nav className="subtabs">
        {TABS.map(([t, l]) => (
          <Link key={t} href={`${base}&tab=${t}`} className={`subtab${tab === t ? ' active' : ''}`}>
            {l}
          </Link>
        ))}
      </nav>
      {tab === 'run' && <RunTab lines={lines} periodId={period.id} status={period.status} />}
      {tab === 'cards' && <CardsTab period={period} lines={lines} emp={sp.emp} />}
      {tab === 'adjustments' && <AdjustmentsTab lines={lines} periodId={period.id} draft={draft} />}
      {tab === 'history' && <HistoryTab periodId={period.id} />}
    </>
  );
}

function RunTab({ lines, periodId, status }: { lines: RunLine[]; periodId: string; status: string }) {
  const draft = status === 'DRAFT';
  return (
    <>
      <div className="panel">
        <div className="pay-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th className="num">Hours</th>
                <th className="num">Gross</th>
                <th className="num">Docked</th>
                <th className="num">Adjustments</th>
                <th className="num">Total before tax</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.employee.id}>
                  <td>
                    <Link href={`/employees/${l.employee.id}`} style={{ textDecoration: 'none' }}>
                      <NameCell
                        name={l.employee.name}
                        sub={`${l.employee.department} · ${l.basis === 'HOURLY' ? 'Hourly' : 'Salaried'}`}
                      />
                    </Link>
                  </td>
                  <td className="num">
                    {l.basis === 'HOURLY' ? (
                      <>
                        {l.regularHours + l.overtimeHours}
                        {l.overtimeHours > 0 && <span className="pay-pending">{l.overtimeHours} OT</span>}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="num">{money(l.grossCents)}</td>
                  <td className="num">
                    {l.dockedCents ? (
                      <>
                        −{money(l.dockedCents)}
                        <span className="pay-pending">{l.dockedDays} day(s)</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="num">{l.adjustmentsCents ? money(l.adjustmentsCents) : '—'}</td>
                  <td className="num">
                    <strong>{money(l.totalCents)}</strong>
                  </td>
                  <td>
                    <Badge tone={l.status === 'READY' ? 'moss' : 'brick'}>
                      {PAYROLL_STATUS_LABEL[l.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel pay-review">
        <div className="panel-body">
          <p className="faint" style={{ marginTop: 0 }}>
            Handbook rules apply: under 15 periods a week is paid only for periods actually taught, absences
            beyond PTO are docked at one day&apos;s share of the annual salary, and days next to a vacation
            are double-docked. Employees with unsigned contracts, missing direct deposit or unapproved time
            cards are skipped. Hourly gross is based only on approved hours.
          </p>
          {draft ? (
            <form action={submitRun} className="spread">
              <input type="hidden" name="payPeriodId" value={periodId} />
              <label className="check">
                <input type="checkbox" name="reviewed" required /> I&apos;ve reviewed this run
              </label>
              <SubmitButton pendingText="Submitting…" confirm="Submit this run? Amounts will be frozen.">
                Submit run
              </SubmitButton>
            </form>
          ) : (
            <div className="spread">
              <span className="muted">This run is {status.toLowerCase()}. Amounts are frozen.</span>
              <div className="hstack">
                {status === 'SUBMITTED' && (
                  <>
                    <form action={setPeriodStatus}>
                      <input type="hidden" name="payPeriodId" value={periodId} />
                      <input type="hidden" name="status" value="DRAFT" />
                      <SubmitButton
                        className="btn btn-secondary"
                        confirm="Reopen this run? The frozen amounts will be recalculated."
                      >
                        Reopen
                      </SubmitButton>
                    </form>
                    <form action={setPeriodStatus}>
                      <input type="hidden" name="payPeriodId" value={periodId} />
                      <input type="hidden" name="status" value="PAID" />
                      <SubmitButton>Mark as paid</SubmitButton>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

async function CardsTab({
  period,
  lines,
  emp,
}: {
  period: Awaited<ReturnType<typeof periodsForYear>>[number];
  lines: RunLine[];
  emp?: string;
}) {
  const hourly = lines.filter((l) => l.basis === 'HOURLY');
  const draft = period.status === 'DRAFT';
  const selected = hourly.find((l) => l.employee.id === emp);
  const detail = selected ? await timeCardSummary(selected.employee.id, period) : null;
  const base = `/payroll?period=${period.id}&tab=cards`;
  return (
    <div className="stack">
      <p className="faint" style={{ margin: 0 }}>
        Hourly employees only. Overtime is hours over 40 per Monday–Sunday week, paid at 1.5×. Missing cards
        have no submitted hours. Times are in {SCHOOL_TZ}.
      </p>
      <div className="panel">
        <div className="panel-head">
          <h3>Time cards</h3>
          {draft && hourly.some((l) => l.timeCardStatus === 'SUBMITTED') && (
            <form action={approveAllSubmitted}>
              <input type="hidden" name="payPeriodId" value={period.id} />
              <SubmitButton className="btn btn-secondary btn-sm">Approve all submitted</SubmitButton>
            </form>
          )}
        </div>
        {hourly.length === 0 ? (
          <Empty title="No hourly employees" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Department</th>
                <th className="num">Hours (total)</th>
                <th className="num">Overtime</th>
                <th>Status</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hourly.map((l) => (
                <tr
                  key={l.employee.id}
                  style={
                    selected?.employee.id === l.employee.id ? { background: 'var(--brass-soft)' } : undefined
                  }
                >
                  <td>{l.employee.name}</td>
                  <td>{l.employee.department}</td>
                  <td className="num">{l.regularHours + l.overtimeHours}</td>
                  <td className="num">{l.overtimeHours}</td>
                  <td>
                    <TimeCardBadge status={l.timeCardStatus} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link className="btn btn-secondary btn-sm" href={`${base}&emp=${l.employee.id}`}>
                        Review
                      </Link>
                      {draft && l.timeCardStatus !== 'APPROVED' && (
                        <form action={decideTimeCard}>
                          <input type="hidden" name="payPeriodId" value={period.id} />
                          <input type="hidden" name="employeeId" value={l.employee.id} />
                          <SubmitButton className="btn btn-primary btn-sm" name="decision" value="APPROVED">
                            Approve
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {selected && detail && (
        <div className="panel">
          <div className="panel-head">
            <h3>
              {selected.employee.name} · {fmtRange(period.startsOn, period.endsOn)}
            </h3>
            <TimeCardBadge status={selected.timeCardStatus} />
          </div>
          <div className="panel-body stack">
            <div className="pay-card-summary">
              <div>
                <strong>{detail.regular}</strong>Regular
              </div>
              <div>
                <strong>{detail.overtime}</strong>Overtime
              </div>
              <div>
                <strong>{detail.total}</strong>Total hours
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Clock in</th>
                  <th>Clock out</th>
                  <th className="num">Hours</th>
                  <th>Note</th>
                  {draft && <th />}
                </tr>
              </thead>
              <tbody>
                {detail.entries.map((e) => (
                  <tr key={e.id}>
                    <td>{fmtDate(localDate(e.clockIn))}</td>
                    <td>{fmtDateTime(e.clockIn)}</td>
                    <td>{e.clockOut ? fmtDateTime(e.clockOut) : <Badge tone="brick">Missed punch</Badge>}</td>
                    <td className="num">{entryHours(e).toFixed(2)}</td>
                    <td className="muted">
                      {e.source === 'MANUAL' ? `Edited: ${e.note ?? ''}` : (e.note ?? '')}
                    </td>
                    {draft && (
                      <td>
                        <form action={deleteTimeEntry}>
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="payPeriodId" value={period.id} />
                          <input type="hidden" name="employeeId" value={selected.employee.id} />
                          <SubmitButton className="btn btn-text btn-sm" confirm="Delete this punch?">
                            Delete
                          </SubmitButton>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
                {detail.entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      No punches in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {draft && (
              <>
                <form action={saveTimeEntry} className="tc-form">
                  <input type="hidden" name="payPeriodId" value={period.id} />
                  <input type="hidden" name="employeeId" value={selected.employee.id} />
                  <div className="section-label" style={{ marginTop: 0 }}>
                    Add a missed punch
                  </div>
                  <div className="form-grid-3">
                    <div className="field">
                      <label htmlFor="date">Date</label>
                      <input
                        id="date"
                        type="date"
                        name="date"
                        min={period.startsOn}
                        max={period.endsOn}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="in">Clock in</label>
                      <input id="in" type="time" name="in" required />
                    </div>
                    <div className="field">
                      <label htmlFor="out">Clock out</label>
                      <input id="out" type="time" name="out" required />
                    </div>
                  </div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label htmlFor="note">Reason (recorded in the audit log)</label>
                    <input id="note" name="note" required />
                  </div>
                  <div className="form-actions">
                    <SubmitButton className="btn btn-secondary">Add punch</SubmitButton>
                  </div>
                </form>
                <form action={decideTimeCard} className="hstack">
                  <input type="hidden" name="payPeriodId" value={period.id} />
                  <input type="hidden" name="employeeId" value={selected.employee.id} />
                  <input
                    className="search-input"
                    name="note"
                    placeholder="What needs to change? (for 'Needs changes')"
                    style={{ flex: 1, minWidth: 220 }}
                    aria-label="Note"
                  />
                  <SubmitButton className="btn btn-secondary" name="decision" value="NEEDS_CHANGES">
                    Needs changes
                  </SubmitButton>
                  <SubmitButton name="decision" value="APPROVED">
                    Approve
                  </SubmitButton>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

async function AdjustmentsTab({
  lines,
  periodId,
  draft,
}: {
  lines: RunLine[];
  periodId: string;
  draft: boolean;
}) {
  const byId = await employeeMap();
  const all = lines.flatMap((l) => l.adjustments);
  return (
    <div className="two-col">
      <div className="panel">
        <div className="panel-head">
          <h3>Adjustments this period</h3>
        </div>
        {all.length === 0 ? (
          <Empty title="No adjustments">
            Bonuses, deductions and reimbursements for this period show here.
          </Empty>
        ) : (
          <div className="panel-body">
            {all.map((a) => (
              <div className="pay-adj-item" key={a.id}>
                <span>
                  {byId.get(a.employeeId)?.name} — {a.note}{' '}
                  <span className="faint">
                    · {a.kind.toLowerCase()} · by {shortName(byId.get(a.createdById)?.name ?? '?')}
                  </span>
                </span>
                <span className="hstack">
                  <span className="amt">
                    {a.kind === 'DEDUCTION' ? '−' : '+'}
                    {money(a.cents)}
                  </span>
                  {draft && (
                    <form action={deleteAdjustment}>
                      <input type="hidden" name="id" value={a.id} />
                      <SubmitButton className="btn btn-text btn-sm" confirm="Remove this adjustment?">
                        Remove
                      </SubmitButton>
                    </form>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {draft && (
        <div className="panel" style={{ alignSelf: 'start' }}>
          <div className="panel-head">
            <h3>Add adjustment</h3>
          </div>
          <form action={addAdjustment} className="panel-body stack">
            <input type="hidden" name="payPeriodId" value={periodId} />
            <div className="field">
              <label htmlFor="employeeId">Employee</label>
              <select id="employeeId" name="employeeId" defaultValue="" required>
                <option value="" disabled>
                  Choose…
                </option>
                {lines.map((l) => (
                  <option key={l.employee.id} value={l.employee.id}>
                    {l.employee.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="kind">Type</label>
                <select id="kind" name="kind">
                  <option value="BONUS">Bonus</option>
                  <option value="REIMBURSEMENT">Reimbursement</option>
                  <option value="DEDUCTION">Deduction</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="amount">Amount ($)</label>
                <input id="amount" name="amount" inputMode="decimal" required placeholder="0.00" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="note">Note</label>
              <input id="note" name="note" required />
            </div>
            <div>
              <SubmitButton>Add adjustment</SubmitButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

async function HistoryTab({ periodId }: { periodId: string }) {
  const byId = await employeeMap();
  const rows = (await auditLog.where((a) => a.entity === 'PayPeriod' && a.entityId === periodId)).reverse();
  return (
    <div className="panel">
      {rows.length === 0 ? (
        <Empty title="No changes this period" />
      ) : (
        <div className="panel-body">
          {rows.map((r) => (
            <div className="activity-row" key={r.id}>
              <div className="activity-dot" />
              <div style={{ flex: 1 }}>
                {r.action.replace(/_/g, ' ').toLowerCase()} — {byId.get(r.actorId ?? '')?.name ?? 'System'}
                {r.detail ? <span className="faint"> · {r.detail}</span> : null}
              </div>
              <div className="activity-time">{fmtDateTime(r.at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
