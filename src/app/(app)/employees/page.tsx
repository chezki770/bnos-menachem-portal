import Link from 'next/link';
import { ContractBadge } from '@/components/status';
import { Empty, NameCell, PageHead, Download } from '@/components/ui';
import { requireManager } from '@/lib/auth/current-user';
import { visibleEmployees } from '@/lib/data/employees';
import { currentSchoolYear } from '@/lib/data/years';
import { contracts } from '@/lib/store';

type Search = Promise<{ q?: string; contract?: string; dept?: string; inactive?: string }>;

export default async function EmployeesPage({ searchParams }: { searchParams: Search }) {
  const user = await requireManager();
  const sp = await searchParams;
  const year = await currentSchoolYear();
  const all = await visibleEmployees(user, { includeInactive: sp.inactive === '1' });
  const yearContracts = year ? await contracts.where((c) => c.schoolYearId === year.id) : [];
  const contractOf = (id: string) => yearContracts.find((c) => c.employeeId === id);
  const q = (sp.q ?? '').trim().toLowerCase();
  const rows = all.filter((e) => {
    if (q && !`${e.name} ${e.email} ${e.position ?? ''}`.toLowerCase().includes(q)) return false;
    if (sp.dept && e.department !== sp.dept) return false;
    const st = contractOf(e.id)?.status ?? 'NOT_SENT';
    if (sp.contract && st !== sp.contract) return false;
    return true;
  });
  const depts = [...new Set(all.map((e) => e.department))].sort();
  const admin = user.role === 'ADMIN';
  return (
    <>
      <PageHead
        title="Employees"
        sub={`${all.length} people across ${depts.length} department${depts.length === 1 ? '' : 's'}`}
        actions={
          admin && (
            <>
              <Download className="btn btn-secondary" href="/api/export/employees">
                Export CSV
              </Download>
              <Link className="btn btn-primary" href="/employees/new">
                Add employee
              </Link>
            </>
          )
        }
      />
      <form className="toolbar" role="search">
        <div className="toolbar-left">
          <input
            className="search-input"
            name="q"
            defaultValue={sp.q}
            placeholder="Search by name, email or position"
            aria-label="Search employees"
          />
          <select
            className="pay-select"
            name="contract"
            defaultValue={sp.contract ?? ''}
            aria-label="Contract status"
          >
            <option value="">All contracts</option>
            <option value="SIGNED">Signed</option>
            <option value="SENT">Pending</option>
            <option value="NOT_SENT">Missing</option>
          </select>
          {admin && (
            <select className="pay-select" name="dept" defaultValue={sp.dept ?? ''} aria-label="Department">
              <option value="">All departments</option>
              {depts.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          )}
          <label className="check">
            <input type="checkbox" name="inactive" value="1" defaultChecked={sp.inactive === '1'} /> Show
            inactive
          </label>
          <button className="btn btn-secondary">Filter</button>
        </div>
      </form>
      <div className="panel">
        {rows.length === 0 ? (
          <Empty title="No matches">No employees match that search. Try a different name.</Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Position</th>
                  <th>Contact</th>
                  <th>Contract</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="clickable">
                    <td>
                      <Link href={`/employees/${e.id}`} style={{ textDecoration: 'none' }}>
                        <NameCell
                          name={e.name}
                          sub={
                            !e.active
                              ? 'Inactive'
                              : e.role !== 'STAFF'
                                ? e.role === 'ADMIN'
                                  ? 'Admin'
                                  : 'Department head'
                                : undefined
                          }
                        />
                      </Link>
                    </td>
                    <td>{e.department}</td>
                    <td>{e.position ?? '—'}</td>
                    <td>{e.email}</td>
                    <td>
                      <ContractBadge contract={contractOf(e.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
