import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/client';
import { ContractView } from '@/components/ContractView';
import { PageHead } from '@/components/ui';
import { requireUser } from '@/lib/auth/current-user';
import { contracts, employees, schoolYears } from '@/lib/store';

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const c = await contracts.get((await params).id);
  if (!c || (user.role !== 'ADMIN' && c.employeeId !== user.id)) notFound();
  const emp = (await employees.get(c.employeeId))!;
  return (
    <>
      <p className="faint no-print">
        <Link className="link" href={user.role === 'ADMIN' ? '/contracts' : '/me/contract'}>
          ← Contracts
        </Link>
      </p>
      <PageHead
        title={emp.name}
        sub={`${emp.department} · ${emp.position ?? 'Employee'}`}
        actions={<PrintButton />}
      />
      <ContractView contract={c} employee={emp} year={await schoolYears.get(c.schoolYearId)} />
    </>
  );
}
