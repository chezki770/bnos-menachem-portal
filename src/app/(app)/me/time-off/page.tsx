import { AbsenceForm } from '@/components/AbsenceForm';
import { SubmitButton } from '@/components/client';
import { RequestBadge } from '@/components/status';
import { Empty, Notice, PageHead } from '@/components/ui';
import { requireUser } from '@/lib/auth/current-user';
import { getEmployeeBenefits } from '@/lib/data/employees';
import { ABSENCE_LABEL, fmtDate, fmtRange, OCCASION_LABEL } from '@/lib/format';
import { timeOffRequests } from '@/lib/store';
import { cancelRequest, requestTimeOff } from '../actions';

export default async function TimeOffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const data = (await getEmployeeBenefits(user.id))!;
  const mine = (await timeOffRequests.where((r) => r.employeeId === user.id)).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return (
    <>
      <PageHead title="Time off" sub="Request days off. Your department head or the office approves them." />
      <Notice searchParams={await searchParams} />
      <div className="pto-stats">
        <div className="pto-stat">
          <div className="n">{data.pto.allowance}</div>
          <div className="l">PTO allowance (days)</div>
        </div>
        <div className="pto-stat">
          <div className="n">{data.pto.used}</div>
          <div className="l">Used (days)</div>
        </div>
        <div className="pto-stat">
          <div className="n">{data.pto.left}</div>
          <div className="l">Balance (days)</div>
        </div>
      </div>
      <div className="two-col">
        <div className="panel">
          <div className="panel-head">
            <h3>My requests</h3>
          </div>
          {mine.length === 0 ? (
            <Empty title="No requests yet" />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Dates</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {mine.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {ABSENCE_LABEL[r.type]}
                        {r.occasion && <div className="cell-sub">{OCCASION_LABEL[r.occasion]}</div>}
                      </td>
                      <td>
                        {fmtRange(r.startsOn, r.endsOn)}
                        <div className="cell-sub">Sent {fmtDate(r.createdAt)}</div>
                      </td>
                      <td>
                        <RequestBadge status={r.status} />
                        {r.decisionNote && <div className="cell-sub">{r.decisionNote}</div>}
                      </td>
                      <td>
                        {r.status === 'PENDING' && (
                          <form action={cancelRequest}>
                            <input type="hidden" name="id" value={r.id} />
                            <SubmitButton className="btn btn-text btn-sm" confirm="Cancel this request?">
                              Cancel
                            </SubmitButton>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="panel" style={{ alignSelf: 'start' }}>
          <div className="panel-head">
            <h3>Request time off</h3>
          </div>
          <div className="panel-body">
            <AbsenceForm
              action={requestTimeOff}
              fixedEmployeeId={user.id}
              submitLabel="Send request"
              withNote
            />
          </div>
        </div>
      </div>
    </>
  );
}
