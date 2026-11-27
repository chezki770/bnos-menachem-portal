import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sendContract, remindContract } from '@/app/(app)/contracts/actions';
import { BenefitsPanel } from '@/components/BenefitsPanel';
import { Reveal, SubmitButton } from '@/components/client';
import { DocumentsList } from '@/components/DocumentsList';
import { ContractBadge } from '@/components/status';
import { Avatar, Badge, Notice, ReadField } from '@/components/ui';
import { canManageEmployee, requireManager } from '@/lib/auth/current-user';
import { latestDocuments } from '@/lib/data/documents';
import { absenceUsage, currentContract, getEmployeeBenefits } from '@/lib/data/employees';
import { currentSchoolYear } from '@/lib/data/years';
import { mask, type SensitiveField } from '@/lib/forms/employee';
import { ABSENCE_LABEL, fmtDate, fmtDateTime, fmtRange, money, ROLE_LABEL } from '@/lib/format';
import { departments } from '@/lib/store';
import { revealField } from '../actions';
import { EmployeeForm, InviteButton } from '../forms';

const TABS = [
  ['info', 'Info'],
  ['documents', 'Documents'],
  ['benefits', 'Benefits'],
  ['contract', 'Contract'],
] as const;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function EmployeePage({ params, searchParams }: Props) {
  const user = await requireManager();
  const { id } = await params;
  const sp = await searchParams;
  const data = await getEmployeeBenefits(id);
  if (!data) notFound();
  const emp = data.employee;
  if (!canManageEmployee(user, emp)) redirect('/employees');
  const admin = user.role === 'ADMIN';
  const tab = TABS.some(([t]) => t === sp.tab) ? sp.tab! : 'info';
  const here = `/employees/${id}?tab=${tab}`;

  const sensitive = (field: SensitiveField, label: string) => (
    <div className="field">
      <label>{label}</label>
      <div className="value">
        {admin ? (
          <Reveal masked={mask(field, emp[field])} load={revealField.bind(null, emp.id, field)} />
        ) : (
          mask(field, emp[field])
        )}
      </div>
    </div>
  );

  return (
    <>
      <p className="faint">
        <Link className="link" href="/employees">
          ← Employees
        </Link>
      </p>
      <div className="drawer-head" style={{ padding: '0 0 18px', borderBottom: 0 }}>
        <div className="who">
          <Avatar name={emp.name} big />
          <div>
            <h1 style={{ fontSize: 24 }}>{emp.name}</h1>
            <div className="role">
              {emp.department} · {emp.position ?? 'Employee'} · {ROLE_LABEL[emp.role]}{' '}
              {!emp.active && <Badge tone="neutral">Inactive</Badge>}
            </div>
          </div>
        </div>
      </div>
      <Notice searchParams={sp} />
      <nav className="subtabs" aria-label="Employee sections">
        {TABS.map(([t, label]) => (
          <Link
            key={t}
            href={`/employees/${id}?tab=${t}`}
            className={`subtab${tab === t ? ' active' : ''}`}
            aria-current={tab === t ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === 'info' && (
        <div className="two-col">
          <div className="panel">
            <div className="panel-head">
              <h3>{admin ? 'Employment details' : 'Details'}</h3>
            </div>
            <div className="panel-body">
              {admin ? (
                <EmployeeForm
                  employee={emp}
                  departments={(await departments.all()).map((d) => d.name).sort()}
                />
              ) : (
                <div className="form-grid">
                  <ReadField label="Email" value={emp.email} />
                  <ReadField label="Position" value={emp.position} />
                  <ReadField label="Periods per week" value={emp.periodsPerWeek} />
                  <ReadField label="Days per week" value={emp.daysPerWeek} />
                  <ReadField label="Hired" value={fmtDate(emp.hiredOn)} />
                </div>
              )}
            </div>
          </div>
          <div className="stack" style={{ alignContent: 'start' }}>
            <div className="panel">
              <div className="panel-head">
                <h3>Personal</h3>
              </div>
              <div className="panel-body stack-sm">
                {sensitive('dateOfBirth', 'Date of birth')}
                {sensitive('cellPhone', 'Cell phone')}
                {sensitive('address', 'Address')}
                <ReadField
                  label="Emergency contact"
                  value={
                    emp.emergencyName
                      ? `${emp.emergencyName}${emp.emergencyRelationship ? ` (${emp.emergencyRelationship})` : ''}`
                      : '—'
                  }
                />
                {sensitive('emergencyPhone', 'Emergency phone')}
                {admin && <p className="faint">Viewing a hidden value is recorded in the audit log.</p>}
              </div>
            </div>
            {admin && (
              <div className="panel">
                <div className="panel-head">
                  <h3>Portal account</h3>
                </div>
                <div className="panel-body stack-sm">
                  <p className="faint" style={{ margin: 0 }}>
                    {emp.passwordHash ? 'Has a password and can sign in.' : 'Has not set a password yet.'}
                  </p>
                  <InviteButton id={emp.id} hasPassword={!!emp.passwordHash} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="panel">
          <div className="panel-body">
            {admin ? (
              <DocumentsList
                employeeId={emp.id}
                docs={await latestDocuments(emp.id)}
                returnTo={here}
                canUpload
              />
            ) : (
              <p className="muted">Only the office can see employee documents.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'benefits' && <BenefitsTab id={emp.id} data={data} />}

      {tab === 'contract' && (
        <ContractTab
          id={emp.id}
          admin={admin}
          here={here}
          salary={emp.annualSalaryCents}
          rate={emp.hourlyRateCents}
        />
      )}
    </>
  );
}

async function BenefitsTab({
  id,
  data,
}: {
  id: string;
  data: NonNullable<Awaited<ReturnType<typeof getEmployeeBenefits>>>;
}) {
  const year = await currentSchoolYear();
  const usage = year ? await absenceUsage(id, year.id) : null;
  return (
    <div className="stack">
      <BenefitsPanel data={data} />
      <div className="panel">
        <div className="panel-head">
          <h3>Absences this school year</h3>
        </div>
        {usage && usage.rows.length ? (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Dates</th>
                <th className="num">Days</th>
                <th className="num">Paid</th>
                <th className="num">PTO</th>
                <th className="num">Docked</th>
              </tr>
            </thead>
            <tbody>
              {usage.rows
                .sort((a, b) => b.startsOn.localeCompare(a.startsOn))
                .map((a) => (
                  <tr key={a.id}>
                    <td>{ABSENCE_LABEL[a.type]}</td>
                    <td>{fmtRange(a.startsOn, a.endsOn)}</td>
                    <td className="num">{a.schoolDays}</td>
                    <td className="num">{a.paidDays}</td>
                    <td className="num">{a.ptoDays}</td>
                    <td className="num">{a.dockedDays}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <div className="panel-body muted">None posted.</div>
        )}
      </div>
    </div>
  );
}

async function ContractTab({
  id,
  admin,
  here,
  salary,
  rate,
}: {
  id: string;
  admin: boolean;
  here: string;
  salary: number | null;
  rate: number | null;
}) {
  const c = await currentContract(id);
  return (
    <div className="panel">
      <div className="panel-body stack-sm">
        <div className="form-grid">
          <ReadField label="Status" value={<ContractBadge contract={c} />} />
          <ReadField
            label="Type"
            value={
              c
                ? c.type === 'HOURLY'
                  ? `Hourly · ${money(c.hourlyRateCents)}/hr`
                  : `Full-year · per period (${c.periodsPerWeek}/wk) · ${money(c.annualSalaryCents)}`
                : salary
                  ? `Full-year · ${money(salary)}`
                  : rate
                    ? `Hourly · ${money(rate)}/hr`
                    : '—'
            }
          />
          <ReadField label="Sent" value={fmtDateTime(c?.sentAt)} />
          <ReadField
            label="Signed"
            value={c?.signedAt ? `${fmtDateTime(c.signedAt)} by ${c.signedName}` : '—'}
          />
        </div>
        <div className="hstack" style={{ marginTop: 10 }}>
          {c && (
            <Link className="btn btn-secondary" href={`/contracts/${c.id}`}>
              View contract
            </Link>
          )}
          {admin && c?.status !== 'SIGNED' && (
            <form action={sendContract}>
              <input type="hidden" name="employeeId" value={id} />
              <input type="hidden" name="returnTo" value={here} />
              <SubmitButton pendingText="Sending…">
                {c?.status === 'SENT' ? 'Re-send with current terms' : 'Send contract'}
              </SubmitButton>
            </form>
          )}
          {admin && c?.status === 'SENT' && (
            <form action={remindContract}>
              <input type="hidden" name="contractId" value={c.id} />
              <input type="hidden" name="returnTo" value={here} />
              <SubmitButton className="btn btn-secondary" pendingText="Sending…">
                Remind
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
