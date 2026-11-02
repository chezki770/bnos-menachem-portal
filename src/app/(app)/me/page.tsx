import { BenefitsPanel } from '@/components/BenefitsPanel';
import { requireUser } from '@/lib/auth/current-user';
import { getEmployeeBenefits } from '@/lib/data/employees';

export default async function MePage() {
  const user = await requireUser();
  const data = await getEmployeeBenefits(user.id);
  if (!data) return <p className="note">Your employee record was not found.</p>;
  return (
    <>
      <h1>My benefits</h1>
      <p className="note">
        {data.employee.department} · {data.employee.position ?? 'Employee'}
      </p>
      <BenefitsPanel data={data} />
    </>
  );
}
