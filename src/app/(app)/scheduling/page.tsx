import Link from 'next/link';
import { SubmitButton } from '@/components/client';
import { Badge, Empty, Notice, PageHead } from '@/components/ui';
import { requireManager } from '@/lib/auth/current-user';
import { employeeMap, visibleEmployees } from '@/lib/data/employees';
import { parseWeek, shiftsBetween, weekDays } from '@/lib/data/shifts';
import { addDays, fmtDate, fmtTime, shortName, todayIso, weekdayName } from '@/lib/format';
import { departments, shiftTemplates, type Shift } from '@/lib/store';
import { applyTemplate, deleteShift, deleteTemplate, fillShift, saveShift, saveTemplate } from './actions';

type SP = Record<string, string | undefined>;

export default async function SchedulingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireManager();
  const sp = await searchParams;
  const tab = sp.tab === 'open' || sp.tab === 'templates' ? sp.tab : 'week';
  const monday = parseWeek(sp.week);
  const days = weekDays(monday);
  const admin = user.role === 'ADMIN';
  const inScope = (s: Pick<Shift, 'department'>) => admin || s.department === user.department;
  const weekShifts = await shiftsBetween(days[0], days[4], inScope);
  const openAhead = await shiftsBetween(
    todayIso(),
    addDays(todayIso(), 42),
    (s) => !s.employeeId && inScope(s),
  );
  const people = await visibleEmployees(user);
  const byId = await employeeMap();
  const depts = admin ? (await departments.all()).map((d) => d.name).sort() : [user.department];
  const editing = sp.edit ? weekShifts.find((s) => s.id === sp.edit) : undefined;
  const here = `/scheduling?tab=${tab}&week=${monday}`;
  const templates = new Map<string, number>();
  for (const t of await shiftTemplates.where(inScope))
    templates.set(t.template, (templates.get(t.template) ?? 0) + 1);
  const openCount = weekShifts.filter((s) => !s.employeeId).length;

  const tabLink = (t: string, label: React.ReactNode) => (
    <Link href={`/scheduling?tab=${t}&week=${monday}`} className={`subtab${tab === t ? ' active' : ''}`}>
      {label}
    </Link>
  );

  return (
    <>
      <PageHead
        title="Scheduling"
        sub="Assign, fill, and reuse shift patterns in one place"
        actions={
          <>
            <Link
              className="btn btn-secondary btn-sm"
              href={`/scheduling?tab=${tab}&week=${addDays(monday, -7)}`}
            >
              ← Previous
            </Link>
            <Link className="btn btn-secondary btn-sm" href={`/scheduling?tab=${tab}`}>
              This week
            </Link>
            <Link
              className="btn btn-secondary btn-sm"
              href={`/scheduling?tab=${tab}&week=${addDays(monday, 7)}`}
            >
              Next →
            </Link>
          </>
        }
      />
      <Notice searchParams={sp} />
      <nav className="subtabs">
        {tabLink('week', `Week of ${fmtDate(monday, { year: false })}`)}
        {tabLink(
          'open',
          <>
            Open shifts <Badge tone={openAhead.length ? 'brick' : 'neutral'}>{openAhead.length}</Badge>
          </>,
        )}
        {tabLink('templates', 'Templates')}
      </nav>

      {tab === 'week' && (
        <>
          <div className="week-grid mb">
            {days.map((d) => (
              <div className="day-col" key={d}>
                <div className="day-label">
                  {weekdayName(d)} <span className="faint">{fmtDate(d, { year: false })}</span>
                </div>
                {weekShifts
                  .filter((s) => s.date === d)
                  .map((s) => (
                    <Link
                      key={s.id}
                      href={`${here}&edit=${s.id}`}
                      className={`shift-block${s.employeeId ? '' : ' open'}`}
                      style={{
                        display: 'block',
                        textDecoration: 'none',
                        outline: editing?.id === s.id ? '2px solid var(--brass)' : undefined,
                      }}
                    >
                      <strong>
                        {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                      </strong>
                      {s.department} ·{' '}
                      {s.employeeId ? shortName(byId.get(s.employeeId)?.name ?? '?') : 'Open shift'}
                    </Link>
                  ))}
              </div>
            ))}
          </div>
          <p className="faint">
            {weekShifts.length} shifts this week{openCount ? `, ${openCount} open` : ''}. Click a shift to
            edit it.
          </p>
          <div className="panel">
            <div className="panel-head">
              <h3>{editing ? 'Edit shift' : 'Add a shift'}</h3>
              {editing && (
                <Link className="btn btn-text btn-sm" href={here}>
                  Cancel
                </Link>
              )}
            </div>
            <form action={saveShift} className="panel-body" key={editing?.id ?? 'new'}>
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <input type="hidden" name="returnTo" value={here} />
              <div className="form-grid-3">
                <div className="field">
                  <label htmlFor="date">Day</label>
                  <select id="date" name="date" defaultValue={editing?.date ?? days[0]}>
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {weekdayName(d)} {fmtDate(d, { year: false })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="startTime">Start</label>
                  <input
                    id="startTime"
                    type="time"
                    name="startTime"
                    defaultValue={editing?.startTime ?? '08:00'}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="endTime">End</label>
                  <input
                    id="endTime"
                    type="time"
                    name="endTime"
                    defaultValue={editing?.endTime ?? '15:30'}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="department">Department</label>
                  <select id="department" name="department" defaultValue={editing?.department ?? depts[0]}>
                    {depts.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="employeeId">Assigned to</label>
                  <select id="employeeId" name="employeeId" defaultValue={editing?.employeeId ?? ''}>
                    <option value="">Open shift</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.department}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="reason">Reason (open shifts)</label>
                  <input
                    id="reason"
                    name="reason"
                    defaultValue={editing?.reason ?? ''}
                    placeholder="e.g. Unfilled — new position"
                  />
                </div>
              </div>
              <div className="form-actions">
                {editing && (
                  <SubmitButton
                    className="btn btn-danger"
                    formAction={deleteShift}
                    name="id"
                    value={editing.id}
                    confirm="Delete this shift?"
                  >
                    Delete
                  </SubmitButton>
                )}
                <SubmitButton>{editing ? 'Save shift' : 'Add shift'}</SubmitButton>
              </div>
            </form>
          </div>
        </>
      )}

      {tab === 'open' && (
        <div className="panel">
          {openAhead.length === 0 ? (
            <Empty title="No open shifts">Every shift in the next six weeks is filled.</Empty>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Reason</th>
                    <th className="num">Fill</th>
                  </tr>
                </thead>
                <tbody>
                  {openAhead.map((s) => (
                    <tr key={s.id}>
                      <td>{s.department}</td>
                      <td>
                        {weekdayName(s.date)}
                        <div className="cell-sub">{fmtDate(s.date)}</div>
                      </td>
                      <td>
                        {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                      </td>
                      <td className="muted">{s.reason ?? '—'}</td>
                      <td>
                        <form action={fillShift} className="row-actions">
                          <input type="hidden" name="id" value={s.id} />
                          <input
                            type="hidden"
                            name="returnTo"
                            value={`/scheduling?tab=open&week=${monday}`}
                          />
                          <select
                            className="pay-select"
                            name="employeeId"
                            defaultValue=""
                            aria-label="Employee"
                            required
                          >
                            <option value="" disabled>
                              Choose…
                            </option>
                            {people.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                                {p.department === s.department ? '' : ` · ${p.department}`}
                              </option>
                            ))}
                          </select>
                          <SubmitButton className="btn btn-primary btn-sm">Fill shift</SubmitButton>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'templates' && (
        <div className="two-col">
          <div className="panel">
            <div className="panel-head">
              <h3>Templates</h3>
            </div>
            {templates.size === 0 ? (
              <Empty title="No templates yet">
                Save a recurring weekly pattern once and reuse it each term instead of rebuilding shifts from
                scratch.
              </Empty>
            ) : (
              <div className="panel-body">
                {[...templates.entries()].map(([name, count]) => (
                  <div className="task-row" key={name}>
                    <div>
                      <div className="task-label">{name}</div>
                      <div className="task-sub">{count} shifts a week</div>
                    </div>
                    <div className="row-actions">
                      <form action={applyTemplate} className="hstack">
                        <input type="hidden" name="name" value={name} />
                        <input type="hidden" name="week" value={monday} />
                        <SubmitButton className="btn btn-secondary btn-sm">
                          Apply to week of {fmtDate(monday, { year: false })}
                        </SubmitButton>
                      </form>
                      <form action={deleteTemplate}>
                        <input type="hidden" name="name" value={name} />
                        <SubmitButton className="btn btn-text btn-sm" confirm={`Delete template "${name}"?`}>
                          Delete
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="panel" style={{ alignSelf: 'start' }}>
            <div className="panel-head">
              <h3>Create template</h3>
            </div>
            <form action={saveTemplate} className="panel-body stack">
              <input type="hidden" name="week" value={monday} />
              <p className="faint" style={{ margin: 0 }}>
                Saves every shift in the week of {fmtDate(monday)} as a reusable weekly pattern. Saving with
                an existing name replaces it.
              </p>
              <div className="field">
                <label htmlFor="tname">Template name</label>
                <input id="tname" name="name" placeholder="e.g. Fall term" required />
              </div>
              <div>
                <SubmitButton>Create template</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
