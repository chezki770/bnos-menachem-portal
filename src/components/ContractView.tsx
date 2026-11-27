import { contractSections } from '@/lib/contract';
import { fmtDateTime } from '@/lib/format';
import type { Contract, Employee, SchoolYear } from '@/lib/store';
import { ContractBadge } from './status';

export function ContractView({
  contract,
  employee,
  year,
}: {
  contract: Contract;
  employee: Employee;
  year?: SchoolYear;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Employment contract — {year?.label}</h3>
        <ContractBadge contract={contract} />
      </div>
      <div className="panel-body contract-text">
        {contractSections(contract, employee, year).map((s, i) => (
          <section key={s.title}>
            <h3>
              {i + 1}. {s.title}
            </h3>
            <p>{s.body}</p>
          </section>
        ))}
        {contract.status === 'SIGNED' && (
          <div className="preview-box" style={{ marginTop: 20 }}>
            <div className="signature">{contract.signedName}</div>
            <div className="faint">
              Signed electronically {fmtDateTime(contract.signedAt)}
              {contract.signedIp ? ` from ${contract.signedIp}` : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
