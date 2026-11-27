import Link from 'next/link';
import { PageHead, Panel } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/current-user';
import { departments } from '@/lib/store';
import { EmployeeForm } from '../forms';

export default async function NewEmployeePage() {
  await requireAdmin();
  const depts = (await departments.all()).map((d) => d.name).sort();
  return (
    <>
      <p className="faint">
        <Link className="link" href="/employees">
          ← Employees
        </Link>
      </p>
      <PageHead title="Add employee" sub="They get a sign-in invite once added." />
      <Panel>
        <EmployeeForm departments={depts} />
      </Panel>
    </>
  );
}
