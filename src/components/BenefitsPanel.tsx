import type { EmployeeBenefits } from '@/lib/data/employees';
import { Badge } from './ui';

function Row({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <div className="task-row">
      <div>
        <div className="task-label">{label}</div>
        {note && <div className="task-sub">{note}</div>}
      </div>
      <Badge tone={ok ? 'moss' : 'neutral'}>{ok ? 'Eligible' : 'Not eligible'}</Badge>
    </div>
  );
}

export function BenefitsPanel({ data }: { data: EmployeeBenefits }) {
  const { employee, rules, pto, maternity } = data;
  if (!rules) return <p className="muted">Set periods per week to see benefit eligibility.</p>;
  const yomtovNote =
    rules.yomtovAndVacation === 'PAID'
      ? 'Paid for yomtov and vacation days'
      : rules.yomtovAndVacation === 'ELIGIBLE'
        ? 'Eligible (10th year or more, 10+ periods)'
        : undefined;
  return (
    <div className="stack">
      <div className="pto-stats" style={{ marginBottom: 0 }}>
        <div className="pto-stat">
          <div className="n">{pto.allowance}</div>
          <div className="l">PTO allowance (days)</div>
        </div>
        <div className="pto-stat">
          <div className="n">{pto.used}</div>
          <div className="l">Used (days)</div>
        </div>
        <div className="pto-stat">
          <div className="n">{pto.left}</div>
          <div className="l">Balance (days)</div>
        </div>
      </div>
      <p className="faint" style={{ margin: 0 }}>
        {employee.periodsPerWeek} periods a week · {employee.yearsAtSchool} year(s) at Bnos Menachem ·{' '}
        {rules.basis === 'HOURLY' ? 'Hourly, paid only when present' : 'Per period / salaried'}
      </p>
      <div className="panel">
        <div className="panel-body">
          <Row label="Tuition & parsonage" ok={rules.tuitionAndParsonage} />
          <Row label="Paid time off (PTO)" ok={rules.pto} note="Sick, personal days and lateness" />
          <Row
            label="Simcha days & maternity leave"
            ok={rules.simchaAndMaternity}
            note="Only for employees eligible for PTO"
          />
          <Row label="Yomtov & vacation days" ok={rules.yomtovAndVacation !== 'NO'} note={yomtovNote} />
        </div>
      </div>
      {maternity && (
        <p className="faint" style={{ margin: 0 }}>
          Maternity leave: {maternity.weeks} paid weeks ({maternity.daysLeft} days left this school year).
        </p>
      )}
    </div>
  );
}
