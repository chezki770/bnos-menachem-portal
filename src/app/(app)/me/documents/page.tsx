import Link from 'next/link';
import { DocumentsList } from '@/components/DocumentsList';
import { Notice, PageHead } from '@/components/ui';
import { requireUser } from '@/lib/auth/current-user';
import { latestDocuments, REQUIRED_DOCS } from '@/lib/data/documents';
import { departments } from '@/lib/store';

export default async function MyDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const docs = await latestDocuments(user.id);
  const done = REQUIRED_DOCS.filter((k) => docs.has(k)).length;
  const dept = await departments.find((d) => d.name === user.department);
  return (
    <>
      <PageHead title="Documents" sub={`${done} of ${REQUIRED_DOCS.length} submitted`} />
      <Notice searchParams={await searchParams} />
      <div className="panel mb">
        <div className="panel-body">
          <DocumentsList employeeId={user.id} docs={docs} returnTo="/me/documents" canUpload />
        </div>
      </div>
      <div className="locked-card">
        <div>
          <h4>Employee handbook</h4>
          <p>
            Bnos Menachem Handbook{dept?.handbook ? ` — ${dept.handbook}` : ''}. Part of your employment
            contract. Covers punctuality, benefits, PTO, simcha days and maternity leave.
          </p>
        </div>
        <Link className="btn btn-secondary" href="/handbook">
          View rules
        </Link>
      </div>
    </>
  );
}
