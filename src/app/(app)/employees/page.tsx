import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/current-user';
import { listEmployees } from '@/lib/data/employees';

export default async function EmployeesPage() {
  await requireAdmin();
  const employees = await listEmployees();
  return (
    <>
      <h1>Employees</h1>
      <p className="note">{employees.length} people</p>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>Position</th>
              <th>Email</th>
              <th>Contract</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/employees/${e.id}`}>{e.name}</Link>
                </td>
                <td>{e.department}</td>
                <td>{e.position ?? '—'}</td>
                <td>{e.email}</td>
                <td>
                  <span
                    className={`badge ${e.contract?.status === 'SIGNED' ? 'badge-moss' : e.contract?.status === 'SENT' ? 'badge-brass' : 'badge-brick'}`}
                  >
                    {e.contract?.status === 'SIGNED'
                      ? 'Signed'
                      : e.contract?.status === 'SENT'
                        ? 'Pending'
                        : 'Missing'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
