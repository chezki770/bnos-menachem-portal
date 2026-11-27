import { NextResponse } from 'next/server';
import { z } from 'zod';
import { safePath } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { canManageEmployee, getSessionUser } from '@/lib/auth/current-user';
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, saveEncryptedFile } from '@/lib/data/files';
import { DOC_LABEL } from '@/lib/format';
import { redirectBack, sameOrigin } from '@/lib/http';
import { DOCUMENT_KINDS, documents, employees } from '@/lib/store';

const fields = z.object({
  employeeId: z.string().min(1),
  kind: z.enum(DOCUMENT_KINDS),
  returnTo: z.string().optional(),
});

/** Upload a document (multipart form). Staff upload their own; admins upload for anyone. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL('/login', req.url), 303);
  if (!sameOrigin(req)) return new NextResponse('Forbidden', { status: 403 });
  const form = await req.formData();
  const parsed = fields.safeParse({
    employeeId: form.get('employeeId'),
    kind: form.get('kind'),
    returnTo: form.get('returnTo') ?? undefined,
  });
  const back = safePath(parsed.data?.returnTo, '/me/documents');
  if (!parsed.success) return redirectBack(req, back, 'Invalid upload', 'error');
  const emp = await employees.get(parsed.data.employeeId);
  if (!emp || !(user.id === emp.id || (user.role === 'ADMIN' && canManageEmployee(user, emp))))
    return redirectBack(req, back, 'Not allowed', 'error');

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0)
    return redirectBack(req, back, 'Choose a file to upload', 'error');
  if (file.size > MAX_UPLOAD_BYTES) return redirectBack(req, back, 'That file is over 10 MB', 'error');
  if (!ALLOWED_MIME.includes(file.type))
    return redirectBack(req, back, 'Upload a PDF, JPG, PNG or HEIC file', 'error');

  const fileKey = await saveEncryptedFile(Buffer.from(await file.arrayBuffer()));
  const row = await documents.insert({
    employeeId: emp.id,
    kind: parsed.data.kind,
    fileKey,
    fileName: file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'document',
    mimeType: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedById: user.id,
  });
  await audit(user.id, 'DOCUMENT_UPLOADED', 'Document', row.id, `${emp.name}: ${parsed.data.kind}`);
  return redirectBack(req, back, `${DOC_LABEL[parsed.data.kind]} uploaded`);
}
