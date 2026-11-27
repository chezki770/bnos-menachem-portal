import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { canManageEmployee, getSessionUser } from '@/lib/auth/current-user';
import { readEncryptedFile } from '@/lib/data/files';
import { documents, employees } from '@/lib/store';

/** Download a document. The owner or an admin only; every download is audited. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new NextResponse('Not signed in', { status: 401 });
  const { id } = await params;
  const doc = await documents.get(id);
  const emp = doc ? await employees.get(doc.employeeId) : undefined;
  if (!doc || !emp) return new NextResponse('Not found', { status: 404 });
  if (!(user.id === emp.id || (user.role === 'ADMIN' && canManageEmployee(user, emp))))
    return new NextResponse('Not found', { status: 404 });
  const data = await readEncryptedFile(doc.fileKey);
  await audit(user.id, 'DOCUMENT_DOWNLOADED', 'Document', doc.id, `${emp.name}: ${doc.kind}`);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': doc.mimeType,
      'Content-Disposition': `attachment; filename="${doc.fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
