import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { getSessionUser } from '@/lib/auth/current-user';
import { exportCsv } from '@/lib/data/csv-io';
import { todayIso } from '@/lib/format';
import { TABLES, type TableName } from '@/lib/store';

/** Download one table as CSV. ?sensitive=1 includes encrypted columns (decrypted) and is audited. */
export async function GET(req: Request, { params }: { params: Promise<{ table: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role !== 'ADMIN') return new NextResponse('Admins only', { status: 403 });
  const name = (await params).table as TableName;
  const table = TABLES[name];
  if (!table) return new NextResponse('Unknown table', { status: 404 });
  const sensitive = new URL(req.url).searchParams.get('sensitive') === '1';
  const rows = await table.all();
  await audit(user.id, sensitive ? 'EXPORT_SENSITIVE' : 'EXPORT', 'Table', name, `${rows.length} rows`);
  return new NextResponse(exportCsv(table as never, rows as never, sensitive), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}-${todayIso()}${sensitive ? '-SENSITIVE' : ''}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
