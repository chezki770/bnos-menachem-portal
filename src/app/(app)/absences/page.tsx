import Link from 'next/link';
import { AbsenceForm } from '@/components/AbsenceForm';
import { SubmitButton } from '@/components/client';
import { HandbookRules } from '@/components/Handbook';
import { Badge, Empty, Notice, PageHead, Download } from '@/components/ui';
import { requireManager } from '@/lib/auth/current-user';
import { employeeMap, visibleEmployees } from '@/lib/data/employees';
import { currentSchoolYear } from '@/lib/data/years';
import { ABSENCE_LABEL, fmtDate, fmtRange, OCCASION_LABEL, shortName } from '@/lib/format';
import { absences, timeOffRequests } from '@/lib/store';
import { decideRequest, deleteAbsence, postAbsenceAction } from './actions';

export default async function AbsencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireManager();
  const sp = await searchParams;
  const year = await currentSchoolYear();
  const people = await visibleEmployees(user);
  const visible = new Set(people.map((p) => p.id));
  const byId = await employeeMap();
  const pending = (
    await timeOffRequests.where((r) => r.status === 'PENDING' && visible.has(r.employeeId))
  ).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const posted = (
    await absences.where(
      (a) =>
        visible.has(a.employeeId) &&
        (!year || a.schoolYearId === year.id) &&
        (!sp.employee || a.employeeId === sp.employee),
    )
  ).sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  const admin = user.role === 'ADMIN';

  return (
    <>
      <PageHead
        title="Absences"
        sub="Post and track time off across departments"
        actions={
          admin && (
            <Download className="btn btn-secondary" href="/api/reports/absences.csv">
              Export CSV
            </Download>
          )
        }
      />
      <Notice searchParams={sp} />

      <div className="panel mb">
        <div className="panel-head">
          <h3>Time-off requests</h3>
          <Badge tone={pending.length ? 'brass' : 'neutral'}>{pending.length} pending</Badge>
        </div>
        {pending.length === 0 ? (
          <Empty title="Nothing waiting">New requests from staff show up here for approval.</Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Note</th>
                  <th className="num">Decision</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {byId.get(r.employeeId)?.name}
                      <div className="cell-sub">{byId.get(r.employeeId)?.department}</div>
                    </td>
                    <td>
                      {ABSENCE_LABEL[r.type]}
                      {r.occasion && <div className="cell-sub">{OCCASION_LABEL[r.occasion]}</div>}
                    </td>
                    <td>
                      {fmtRange(r.startsOn, r.endsOn)}
                      {r.adjacentToVacation && <div className="cell-sub">Next to vacation</div>}
                    </td>
                    <td className="muted" style={{ maxWidth: 240 }}>
                      {r.note ?? '—'}
                    </td>
                    <td>
                      <form action={decideRequest} className="row-actions">
                        <input type="hidden" name="requestId" value={r.id} />
                        <input
                          name="note"
                          placeholder="Note (optional)"
                          className="search-input"
                          style={{ width: 150 }}
                          aria-label="Decision note"
                        />
                        <SubmitButton className="btn btn-primary btn-sm" name="decision" value="APPROVED">
                          Approve
                        </SubmitButton>
                        <SubmitButton className="btn btn-secondary btn-sm" name="decision" value="DECLINED">
                          Decline
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="two-col mb">
        <div className="panel">
          <div className="panel-head">
            <h3>Posted absences</h3>
            <form className="hstack">
              <select
                className="pay-select"
                name="employee"
                defaultValue={sp.employee ?? ''}
                aria-label="Filter by employee"
              >
                <option value="">Everyone</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-secondary btn-sm">Filter</button>
            </form>
          </div>
          {posted.length === 0 ? (
            <Empty title="No absences posted">
              Absences you post, and requests you approve, appear here.
            </Empty>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Dates</th>
                    <th className="num">PTO</th>
                    <th className="num">Docked</th>
                    <th>Posted by</th>
                    {admin && <th />}
                  </tr>
                </thead>
                <tbody>
                  {posted.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link className="link" href={`/employees/${a.employeeId}?tab=benefits`}>
                          {byId.get(a.employeeId)?.name ?? 'Unknown'}
                        </Link>
                      </td>
                      <td>
                        <Badge
                          tone={a.dockedDays > 0 ? 'brick' : a.ptoDays > 0 ? 'brass' : 'moss'}
                          title={a.notes ?? undefined}
                        >
                          {ABSENCE_LABEL[a.type]}
                        </Badge>
                      </td>
                      <td>{fmtRange(a.startsOn, a.endsOn)}</td>
                      <td className="num">{a.ptoDays}</td>
                      <td className="num">{a.dockedDays}</td>
                      <td>
                        {shortName(byId.get(a.postedById)?.name ?? '—')}
                        <div className="cell-sub">{fmtDate(a.createdAt)}</div>
                      </td>
                      {admin && (
                        <td>
                          <form action={deleteAbsence}>
                            <input type="hidden" name="id" value={a.id} />
                            <SubmitButton
                              className="btn btn-text btn-sm"
                              confirm="Remove this absence? PTO usage will be recalculated."
                            >
                              Remove
                            </SubmitButton>
                          </form>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="panel" style={{ alignSelf: 'start' }}>
          <div className="panel-head">
            <h3>Post an absence</h3>
          </div>
          <div className="panel-body">
            <AbsenceForm
              action={postAbsenceAction}
              employees={people.map((p) => ({ id: p.id, name: p.name }))}
              submitLabel="Save absence"
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Handbook rules</h3>
          <Badge tone="neutral">From employee handbook</Badge>
        </div>
        <div className="panel-body">
          <HandbookRules />
        </div>
      </div>
    </>
  );
}
