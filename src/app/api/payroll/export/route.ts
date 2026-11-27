import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { getSessionUser } from '@/lib/auth/current-user';
import { buildRun, providerExport } from '@/lib/data/payroll';
import { spreadsheetSafe, stringifyCsv } from '@/lib/store/csv';
import { payPeriods } from '@/lib/store';

/** CSV for the payroll provider: one row per employee ready to be paid. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== 'ADMIN') return new NextResponse('Admins only', { status: 403 });
  const id = new URL(req.url).searchParams.get('period') ?? '';
  const period = await payPeriods.get(id);
  if (!period) return new NextResponse('Pay period not found', { status: 404 });
  const rows = providerExport(period, await buildRun(period));
  await audit(user.id, 'PAYROLL_EXPORTED', 'PayPeriod', period.id, `${rows.length - 1} rows`);
  return new NextResponse(stringifyCsv(rows.map((r) => r.map(spreadsheetSafe))), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="payroll-${period.startsOn}-to-${period.endsOn}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
