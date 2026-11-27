import { Empty, PageHead, Download } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/current-user';
import { employeeMap } from '@/lib/data/employees';
import { fmtDateTime } from '@/lib/format';
import { auditLog, IMPORTABLE, TABLES, type TableName } from '@/lib/store';
import { dataDir } from '@/lib/store/table';
import { ImportForm } from './ImportForm';

const LABEL: Record<TableName, string> = {
  employees: 'Employees',
  departments: 'Departments',
  school_years: 'School years',
  contracts: 'Contracts',
  documents: 'Documents (file list)',
  absences: 'Absences',
  time_off_requests: 'Time-off requests',
  shifts: 'Shifts',
  shift_templates: 'Shift templates',
  time_entries: 'Time clock entries',
  time_cards: 'Time cards',
  pay_periods: 'Pay periods',
  adjustments: 'Pay adjustments',
  payroll_lines: 'Submitted payroll',
  report_runs: 'Report history',
  audit_log: 'Audit log',
};

export default async function DataPage() {
  await requireAdmin();
  const counts = await Promise.all(
    (Object.keys(TABLES) as TableName[]).map(async (t) => [t, (await TABLES[t].all()).length] as const),
  );
  const byId = await employeeMap();
  const recent = (await auditLog.all()).slice(-40).reverse();
  return (
    <>
      <PageHead
        title="Data (CSV)"
        sub={`Every table is a CSV file in ${dataDir()}. Download, edit in a spreadsheet, and import back.`}
      />
      <div className="two-col mb">
        <div className="panel">
          <div className="panel-head">
            <h3>Export</h3>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Table</th>
                  <th className="num">Rows</th>
                  <th className="num">Download</th>
                </tr>
              </thead>
              <tbody>
                {counts.map(([t, n]) => (
                  <tr key={t}>
                    <td>
                      {LABEL[t]}
                      <div className="cell-sub">
                        {t}.csv{IMPORTABLE.includes(t) ? ' · importable' : ''}
                      </div>
                    </td>
                    <td className="num">{n}</td>
                    <td>
                      <div className="row-actions">
                        <Download className="btn btn-secondary btn-sm" href={`/api/export/${t}`}>
                          CSV
                        </Download>
                        {t === 'employees' && (
                          <Download
                            className="btn btn-text btn-sm"
                            href={`/api/export/${t}?sensitive=1`}
                            title="Includes birth dates, phones and addresses. Recorded in the audit log."
                          >
                            With sensitive fields
                          </Download>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel" style={{ alignSelf: 'start' }}>
          <div className="panel-head">
            <h3>Import</h3>
          </div>
          <div className="panel-body">
            <ImportForm tables={IMPORTABLE.map((t) => ({ name: t, label: LABEL[t] }))} />
            <p className="faint">
              Tip: export a table first to get the right columns. Dates are YYYY-MM-DD, times HH:MM, money in
              cents. Absences imported without paidDays / ptoDays / dockedDays are worked out by the handbook
              rules. Every import is recorded in the audit log, and a backup copy of the data folder is a good
              idea before a large import (<code>npm run backup</code>).
            </p>
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <h3>Audit log</h3>
          <Download className="btn btn-secondary btn-sm" href="/api/export/audit_log">
            Download full log
          </Download>
        </div>
        {recent.length === 0 ? (
          <Empty title="No entries yet" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Record</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(a.at)}</td>
                    <td>{byId.get(a.actorId ?? '')?.name ?? '—'}</td>
                    <td>
                      <code style={{ fontSize: 12 }}>{a.action}</code>
                    </td>
                    <td>
                      {a.entity}
                      {a.entityId ? (
                        <div className="cell-sub">{byId.get(a.entityId)?.name ?? a.entityId.slice(0, 8)}</div>
                      ) : null}
                    </td>
                    <td className="muted" style={{ maxWidth: 280 }}>
                      {a.detail ?? ''}
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
