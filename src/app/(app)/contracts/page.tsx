import Link from 'next/link';
import { SubmitButton } from '@/components/client';
import { ContractBadge } from '@/components/status';
import { Empty, NameCell, Notice, PageHead, Stat, Download } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/current-user';
import { isHourly, visibleEmployees } from '@/lib/data/employees';
import { currentSchoolYear } from '@/lib/data/years';
import { daysAgoIso, fmtDate } from '@/lib/format';
import { contracts } from '@/lib/store';
import { remindContract, sendContract } from './actions';

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const year = await currentSchoolYear();
  const people = await visibleEmployees(user);
  const rows = year ? await contracts.where((c) => c.schoolYearId === year.id) : [];
  const of = (id: string) => rows.find((c) => c.employeeId === id);
  const counts = { SIGNED: 0, SENT: 0, NOT_SENT: 0 };
  for (const p of people) counts[of(p.id)?.status ?? 'NOT_SENT']++;
  const weekAgo = daysAgoIso(7);
  const stale = rows.filter((c) => c.status === 'SENT' && c.sentAt && c.sentAt < weekAgo).length;
  return (
    <>
      <PageHead
        title="Contracts"
        sub="A signed contract unlocks payroll for that employee. The handbook is part of every contract."
        actions={
          <Download className="btn btn-secondary" href="/api/reports/contracts.csv">
            Export CSV
          </Download>
        }
      />
      <Notice searchParams={sp} />
      <div className="stat-row">
        <Stat label="Signed" value={counts.SIGNED} note={year?.label} />
        <Stat
          label="Awaiting signature"
          value={counts.SENT}
          note={stale ? `${stale} sent over a week ago` : 'All recent'}
          flag={counts.SENT > 0}
        />
        <Stat label="Not sent" value={counts.NOT_SENT} flag={counts.NOT_SENT > 0} />
        <Stat label="Employees" value={people.length} />
      </div>
      <div className="panel">
        {people.length === 0 ? (
          <Empty title="No employees yet" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th className="num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => {
                  const c = of(p.id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/employees/${p.id}?tab=contract`} style={{ textDecoration: 'none' }}>
                          <NameCell name={p.name} />
                        </Link>
                      </td>
                      <td>{p.department}</td>
                      <td>{isHourly(p) ? 'Hourly' : `Full-year · per period (${p.periodsPerWeek}/wk)`}</td>
                      <td>
                        <ContractBadge contract={c} />
                        {c?.status === 'SENT' && (
                          <div className="cell-sub">
                            Sent {fmtDate(c.sentAt)}
                            {c.remindedAt ? ` · reminded ${fmtDate(c.remindedAt)}` : ''}
                          </div>
                        )}
                        {c?.status === 'SIGNED' && (
                          <div className="cell-sub">Signed {fmtDate(c.signedAt)}</div>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          {c && c.status !== 'NOT_SENT' && (
                            <Link className="btn btn-secondary btn-sm" href={`/contracts/${c.id}`}>
                              View
                            </Link>
                          )}
                          {c?.status === 'SENT' && (
                            <form action={remindContract}>
                              <input type="hidden" name="contractId" value={c.id} />
                              <SubmitButton className="btn btn-secondary btn-sm">Remind</SubmitButton>
                            </form>
                          )}
                          {(!c || c.status === 'NOT_SENT') && (
                            <form action={sendContract}>
                              <input type="hidden" name="employeeId" value={p.id} />
                              <SubmitButton className="btn btn-primary btn-sm" pendingText="Sending…">
                                Send contract
                              </SubmitButton>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
