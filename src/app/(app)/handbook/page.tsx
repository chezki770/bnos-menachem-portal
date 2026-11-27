import { HandbookRules } from '@/components/Handbook';
import { PageHead, Panel } from '@/components/ui';
import { requireUser } from '@/lib/auth/current-user';
import { departments } from '@/lib/store';

export default async function HandbookPage() {
  const user = await requireUser();
  const dept = await departments.find((d) => d.name === user.department);
  return (
    <>
      <PageHead
        title="Employee handbook"
        sub={`Bnos Menachem Handbook${dept?.handbook ? ` — ${dept.handbook}` : ''}. Part of your employment contract. Covers punctuality, benefits, PTO, simcha days and maternity leave.`}
      />
      <Panel>
        <HandbookRules />
      </Panel>
    </>
  );
}
