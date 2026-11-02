import type { getEmployeeBenefits } from '@/lib/data/employees';

type Benefits = NonNullable<Awaited<ReturnType<typeof getEmployeeBenefits>>>;

function Row({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <div className="row">
      <div>
        <div className="row-title">{label}</div>
        {note && <div className="row-sub">{note}</div>}
      </div>
      <span className={`badge ${ok ? 'badge-moss' : 'badge-neutral'}`}>
        {ok ? 'Eligible' : 'Not eligible'}
      </span>
    </div>
  );
}

export function BenefitsPanel({ data }: { data: Benefits }) {
  const { employee, rules, pto, maternity } = data;
  if (!rules) return <p className="note">Set periods per week to see benefit eligibility.</p>;

  const yomtovNote =
    rules.yomtovAndVacation === 'PAID'
      ? 'Paid for yomtov and vacation days'
      : rules.yomtovAndVacation === 'ELIGIBLE'
        ? 'Eligible (10th year or more, 10+ periods)'
        : undefined;

  return (
    <div className="stack">
      <div className="stats">
        <div className="stat">
          <div className="n">{pto.allowance}</div>
          <div className="l">PTO allowance (days)</div>
        </div>
        <div className="stat">
          <div className="n">{pto.used}</div>
          <div className="l">Used (days)</div>
        </div>
        <div className="stat">
          <div className="n">{pto.left}</div>
          <div className="l">Left (days)</div>
        </div>
      </div>
      <p className="note">
        {employee.periodsPerWeek} periods a week · {employee.yearsAtSchool} year(s) at Bnos Menachem ·{' '}
        {rules.basis === 'HOURLY' ? 'Hourly, paid only when present' : 'Per period / salaried'}
      </p>
      <div className="panel">
        <Row label="Tuition & parsonage" ok={rules.tuitionAndParsonage} />
        <Row label="Paid time off (PTO)" ok={rules.pto} note="Sick, personal days and lateness" />
        <Row
          label="Simcha days & maternity leave"
          ok={rules.simchaAndMaternity}
          note="Only for employees eligible for PTO"
        />
        <Row label="Yomtov & vacation days" ok={rules.yomtovAndVacation !== 'NO'} note={yomtovNote} />
      </div>
      {maternity && (
        <p className="note">
          Maternity leave: {maternity.weeks} paid weeks ({maternity.daysLeft} days left this school year).
        </p>
      )}
    </div>
  );
}
