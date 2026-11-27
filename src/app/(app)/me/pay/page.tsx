import Link from 'next/link';
import { BenefitsPanel } from '@/components/BenefitsPanel';
import { Icon } from '@/components/Icon';
import { Empty, PageHead } from '@/components/ui';
import { requireUser } from '@/lib/auth/current-user';
import { currentContract, getEmployeeBenefits } from '@/lib/data/employees';
import { buildRun } from '@/lib/data/payroll';
import { fmtDate, fmtRange, money, todayIso } from '@/lib/format';
import { PAYROLL_STATUS_LABEL } from '@/lib/rules/payroll';
import { adjustments, payPeriods, payrollLines } from '@/lib/store';

export default async function MyPayPage() {
  const user = await requireUser();
  const data = (await getEmployeeBenefits(user.id))!;
  const contract = await currentContract(user.id);
  const signed = contract?.status === 'SIGNED';
  const today = todayIso();
  const periods = await payPeriods.all();
  const history = (await payrollLines.where((l) => l.employeeId === user.id))
    .map((l) => ({ line: l, period: periods.find((p) => p.id === l.payPeriodId)! }))
    .filter((x) => x.period)
    .sort((a, b) => b.period.startsOn.localeCompare(a.period.startsOn));
  const current = periods.find((p) => p.startsOn <= today && today <= p.endsOn && p.status === 'DRAFT');
  const estimate =
    signed && current ? (await buildRun(current)).find((l) => l.employee.id === user.id) : undefined;
  const myAdj = signed
    ? (await adjustments.where((a) => a.employeeId === user.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10)
    : [];

  return (
    <>
      <PageHead title="My pay" sub="Pay, PTO, and adjustments" />
      {!signed ? (
        <div className="locked-card mb">
          <div className="hstack" style={{ gap: 16, flexWrap: 'nowrap' }}>
            <div className="lock-icon">
              <Icon name="lock" />
            </div>
            <div>
              <h4>Pay is locked</h4>
              <p>Sign your contract to unlock pay history and this pay period&apos;s breakdown.</p>
            </div>
          </div>
          <Link className="btn btn-primary" href="/me/contract">
            Go to contract
          </Link>
        </div>
      ) : (
        <div className="stack mb">
          {estimate && current && (
            <div className="panel">
              <div className="panel-head">
                <h3>This pay period · {fmtRange(current.startsOn, current.endsOn)}</h3>
                <span className="faint">Pay date {fmtDate(current.payDate)}</span>
              </div>
              <div className="panel-body">
                <div className="pay-breakdown">
                  {estimate.basis === 'HOURLY' && (
                    <div className="pay-breakdown-row">
                      <span>
                        Hours ({estimate.regularHours} regular, {estimate.overtimeHours} overtime)
                      </span>
                      <span className="amt">{money(estimate.grossCents)}</span>
                    </div>
                  )}
                  {estimate.basis === 'SALARIED' && (
                    <div className="pay-breakdown-row">
                      <span>Salary for the period</span>
                      <span className="amt">{money(estimate.grossCents)}</span>
                    </div>
                  )}
                  {estimate.dockedCents > 0 && (
                    <div className="pay-breakdown-row">
                      <span>Docked ({estimate.dockedDays} day(s))</span>
                      <span className="amt">−{money(estimate.dockedCents)}</span>
                    </div>
                  )}
                  {estimate.adjustmentsCents !== 0 && (
                    <div className="pay-breakdown-row">
                      <span>Adjustments</span>
                      <span className="amt">{money(estimate.adjustmentsCents)}</span>
                    </div>
                  )}
                  <div className="pay-breakdown-row total">
                    <span>Gross before taxes (estimate)</span>
                    <span className="amt">{money(estimate.totalCents)}</span>
                  </div>
                </div>
                {estimate.status !== 'READY' && (
                  <p className="alert alert-warn" style={{ margin: 0 }}>
                    {PAYROLL_STATUS_LABEL[estimate.status]}
                  </p>
                )}
                <p className="faint">Taxes and net pay are calculated by the payroll provider.</p>
              </div>
            </div>
          )}
          <div className="panel">
            <div className="panel-head">
              <h3>Pay history</h3>
            </div>
            {history.length === 0 ? (
              <Empty title="No submitted pay periods yet" />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Pay period</th>
                    <th>Pay date</th>
                    <th className="num">Gross</th>
                    <th className="num">Docked</th>
                    <th className="num">Adjustments</th>
                    <th className="num">Total before tax</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(({ line, period }) => (
                    <tr key={line.id}>
                      <td>{fmtRange(period.startsOn, period.endsOn)}</td>
                      <td>{fmtDate(period.payDate)}</td>
                      <td className="num">{money(line.grossCents)}</td>
                      <td className="num">{money(line.dockedCents)}</td>
                      <td className="num">{money(line.adjustmentsCents)}</td>
                      <td className="num">{money(line.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {myAdj.length > 0 && (
            <div className="panel">
              <div className="panel-head">
                <h3>Adjustments</h3>
              </div>
              <div className="panel-body">
                {myAdj.map((a) => (
                  <div className="pay-adj-item" key={a.id}>
                    <span>
                      {a.note}{' '}
                      <span className="faint">
                        · {a.kind.toLowerCase()} · {fmtDate(a.createdAt)}
                      </span>
                    </span>
                    <span className="amt">
                      {a.kind === 'DEDUCTION' ? '−' : ''}
                      {money(a.cents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="section-label">PTO balance</div>
      <BenefitsPanel data={data} />
      <p className="faint">
        Your PTO allowance is one week&apos;s worth of your working days. It covers sick days, personal days
        and lateness, resets each school year and does not carry over.
      </p>
    </>
  );
}
