import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BenefitsPanel } from '@/components/BenefitsPanel';
import { requireAdmin } from '@/lib/auth/current-user';
import { getEmployeeBenefits } from '@/lib/data/employees';

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const data = await getEmployeeBenefits(id);
  if (!data) notFound();
  return (
    <>
      <p className="note">
        <Link href="/employees">← Employees</Link>
      </p>
      <h1>{data.employee.name}</h1>
      <p className="note">
        {data.employee.department} · {data.employee.position ?? 'Employee'} · {data.employee.email}
      </p>
      <h2>Benefits</h2>
      <BenefitsPanel data={data} />
    </>
  );
}
