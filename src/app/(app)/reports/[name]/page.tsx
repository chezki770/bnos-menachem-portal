import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/client';
import { Empty, PageHead, Download } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/current-user';
import { buildReport, REPORTS, type ReportName } from '@/lib/data/reports';
import { fmtDate, todayIso } from '@/lib/format';
import { reportRuns } from '@/lib/store';

/** Printable report — "Export PDF" opens this page; use the browser's Save as PDF. */
export default async function ReportPage({ params }: { params: Promise<{ name: string }> }) {
  const user = await requireAdmin();
  const name = (await params).name as ReportName;
  if (!(name in REPORTS)) notFound();
  const r = await buildReport(name);
  await reportRuns.append({
    report: name,
    format: 'PDF',
    generatedById: user.id,
    at: new Date().toISOString(),
  });
  return (
    <>
      <p className="faint no-print">
        <Link className="link" href="/reports">
          ← Reports
        </Link>
      </p>
      <PageHead
        title={r.title}
        sub={`Bnos Menachem · generated ${fmtDate(todayIso())} by ${user.name}`}
        actions={
          <>
            <Download className="btn btn-secondary" href={`/api/reports/${name}.csv`}>
              Export CSV
            </Download>
            <PrintButton />
          </>
        }
      />
      <div className="panel">
        {r.rows.length === 0 ? (
          <Empty title="No data yet" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {r.header.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((c, j) => (
                      <td key={j}>{String(c)}</td>
                    ))}
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
