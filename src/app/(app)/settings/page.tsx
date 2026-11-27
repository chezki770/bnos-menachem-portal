import { SubmitButton } from '@/components/client';
import { Badge, Notice, PageHead } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/current-user';
import { fmtDate } from '@/lib/format';
import { departments, employees, payPeriods, schoolYears } from '@/lib/store';
import {
  addDepartment,
  addSchoolYear,
  deleteDepartment,
  generatePayPeriods,
  setCurrentYear,
} from './actions';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const years = (await schoolYears.all()).sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  const periods = await payPeriods.all();
  const depts = (await departments.all()).sort((a, b) => a.name.localeCompare(b.name));
  const emps = await employees.all();
  return (
    <>
      <PageHead title="Settings" sub="School years, pay periods and departments" />
      <Notice searchParams={await searchParams} />
      <div className="two-col mb">
        <div className="panel">
          <div className="panel-head">
            <h3>School years</h3>
          </div>
          <div className="panel-body">
            {years.map((y) => {
              const n = periods.filter((p) => p.schoolYearId === y.id).length;
              return (
                <div className="task-row" key={y.id}>
                  <div>
                    <div className="task-label">
                      {y.label} {y.current && <Badge tone="moss">Current</Badge>}
                    </div>
                    <div className="task-sub">
                      {fmtDate(y.startsOn)} – {fmtDate(y.endsOn)} · {n} pay periods
                    </div>
                  </div>
                  <div className="row-actions">
                    {!y.current && (
                      <form action={setCurrentYear}>
                        <input type="hidden" name="id" value={y.id} />
                        <SubmitButton className="btn btn-secondary btn-sm">Make current</SubmitButton>
                      </form>
                    )}
                    <form action={generatePayPeriods}>
                      <input type="hidden" name="id" value={y.id} />
                      <SubmitButton className="btn btn-secondary btn-sm">
                        {n ? 'Fill missing pay periods' : 'Generate pay periods'}
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              );
            })}
            {years.length === 0 && <p className="muted">No school years yet — add one below.</p>}
            <form action={addSchoolYear} className="stack" style={{ marginTop: 16 }}>
              <div className="form-grid-3">
                <div className="field">
                  <label htmlFor="label">Label</label>
                  <input id="label" name="label" placeholder="2027-2028" required />
                </div>
                <div className="field">
                  <label htmlFor="startsOn">Starts</label>
                  <input id="startsOn" type="date" name="startsOn" required />
                </div>
                <div className="field">
                  <label htmlFor="endsOn">Ends</label>
                  <input id="endsOn" type="date" name="endsOn" required />
                </div>
              </div>
              <div>
                <SubmitButton className="btn btn-secondary">Add school year</SubmitButton>
              </div>
            </form>
            <p className="faint">
              Pay periods are semi-monthly (1st–15th and 16th–end of month), paid 3 days after each period
              ends. To use a different calendar, import pay_periods.csv on the Data page.
            </p>
          </div>
        </div>
        <div className="panel" style={{ alignSelf: 'start' }}>
          <div className="panel-head">
            <h3>Departments</h3>
          </div>
          <div className="panel-body">
            {depts.map((d) => {
              const n = emps.filter((e) => e.department === d.name).length;
              return (
                <div className="task-row" key={d.id}>
                  <div>
                    <div className="task-label">{d.name}</div>
                    <div className="task-sub">
                      {n} employees{d.handbook ? ` · ${d.handbook} handbook` : ''}
                    </div>
                  </div>
                  {n === 0 && (
                    <form action={deleteDepartment}>
                      <input type="hidden" name="id" value={d.id} />
                      <SubmitButton className="btn btn-text btn-sm" confirm={`Remove ${d.name}?`}>
                        Remove
                      </SubmitButton>
                    </form>
                  )}
                </div>
              );
            })}
            <form action={addDepartment} className="stack" style={{ marginTop: 16 }}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="dname">Name</label>
                  <input id="dname" name="name" required />
                </div>
                <div className="field">
                  <label htmlFor="handbook">Handbook edition</label>
                  <input id="handbook" name="handbook" placeholder="e.g. High School" />
                </div>
              </div>
              <div>
                <SubmitButton className="btn btn-secondary">Add department</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
