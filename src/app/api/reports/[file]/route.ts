import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/current-user';
import { buildReport, REPORTS, type ReportName } from '@/lib/data/reports';
import { spreadsheetSafe, stringifyCsv } from '@/lib/store/csv';
import { reportRuns } from '@/lib/store';
import { todayIso } from '@/lib/format';

/** /api/reports/<name>.csv */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role !== 'ADMIN') return new NextResponse('Admins only', { status: 403 });
  const name = (await params).file.replace(/\.csv$/, '') as ReportName;
  if (!Object.hasOwn(REPORTS, name)) return new NextResponse('Unknown report', { status: 404 });
  const r = await buildReport(name);
  await reportRuns.append({
    report: name,
    format: 'CSV',
    generatedById: user.id,
    at: new Date().toISOString(),
  });
  const body = stringifyCsv(
    [r.header, ...r.rows.map((row) => row.map(String))].map((row) => row.map(spreadsheetSafe)),
  );
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}-${todayIso()}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
