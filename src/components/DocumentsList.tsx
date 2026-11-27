import { DOC_HINT, REQUIRED_DOCS } from '@/lib/data/documents';
import { DOC_LABEL, fmtDate } from '@/lib/format';
import { DOCUMENT_KINDS, type DocumentKind, type DocumentRow } from '@/lib/store';
import { Badge } from './ui';

/** Required documents with status, download links and an upload form per kind. */
export function DocumentsList({
  employeeId,
  docs,
  returnTo,
  canUpload,
}: {
  employeeId: string;
  docs: Map<DocumentKind, DocumentRow>;
  returnTo: string;
  canUpload: boolean;
}) {
  return (
    <div>
      {DOCUMENT_KINDS.map((kind) => {
        const doc = docs.get(kind);
        const required = REQUIRED_DOCS.includes(kind);
        return (
          <div className="drawer-doc-row" key={kind} style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="doc-name">{DOC_LABEL[kind]}</div>
              <div className="doc-sub">
                {doc ? (
                  <>
                    Submitted {fmtDate(doc.uploadedAt)} ·{' '}
                    <a className="link" href={`/api/documents/${doc.id}`}>
                      {doc.fileName}
                    </a>
                  </>
                ) : required ? (
                  (DOC_HINT[kind] ?? 'Required')
                ) : (
                  'Optional'
                )}
              </div>
            </div>
            <div className="hstack">
              {doc ? (
                <Badge tone="moss">Submitted</Badge>
              ) : required ? (
                <Badge tone="brick">Needed</Badge>
              ) : (
                <Badge tone="neutral">Not required</Badge>
              )}
              {canUpload && (
                <form action="/api/documents" method="post" encType="multipart/form-data" className="hstack">
                  <input type="hidden" name="employeeId" value={employeeId} />
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <input
                    type="file"
                    name="file"
                    required
                    accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
                    aria-label={`Upload ${DOC_LABEL[kind]}`}
                    style={{ fontSize: 12, maxWidth: 190 }}
                  />
                  <button className="btn btn-secondary btn-sm">{doc ? 'Replace' : 'Upload'}</button>
                </form>
              )}
            </div>
          </div>
        );
      })}
      <p className="faint" style={{ marginTop: 12 }}>
        PDF, JPG, PNG or HEIC, up to 10 MB. Files are encrypted on the server.
      </p>
    </div>
  );
}
