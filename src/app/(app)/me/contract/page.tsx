import Link from 'next/link';
import { signContract } from '@/app/(app)/contracts/actions';
import { SubmitButton } from '@/components/client';
import { ContractView } from '@/components/ContractView';
import { Empty, Notice, PageHead } from '@/components/ui';
import { requireUser } from '@/lib/auth/current-user';
import { currentContract } from '@/lib/data/employees';
import { currentSchoolYear } from '@/lib/data/years';
import { employees } from '@/lib/store';

export default async function MyContractPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const emp = (await employees.get(user.id))!;
  const contract = await currentContract(user.id);
  const year = await currentSchoolYear();
  return (
    <>
      <PageHead
        title="My contract"
        sub="A signed contract unlocks payroll. The handbook is part of every contract."
      />
      <Notice searchParams={await searchParams} />
      {!contract || contract.status === 'NOT_SENT' ? (
        <div className="panel">
          <Empty title="Not sent yet">
            The office hasn&apos;t sent your contract for this school year yet. You&apos;ll get an email when
            it&apos;s ready.
          </Empty>
        </div>
      ) : (
        <div className="stack">
          <ContractView contract={contract} employee={emp} year={year} />
          {contract.status === 'SENT' && (
            <div className="panel">
              <div className="panel-head">
                <h3>Sign</h3>
              </div>
              <form action={signContract} className="panel-body stack">
                <input type="hidden" name="contractId" value={contract.id} />
                <div className="field" style={{ maxWidth: 380 }}>
                  <label htmlFor="signedName">Type your full name: {emp.name}</label>
                  <input id="signedName" name="signedName" autoComplete="name" required />
                </div>
                <label className="check">
                  <input type="checkbox" name="agree" required /> I have read this contract and the{' '}
                  <Link className="link" href="/handbook">
                    employee handbook
                  </Link>
                  , and I agree to them. Typing my name is my electronic signature.
                </label>
                <div>
                  <SubmitButton pendingText="Signing…">Sign contract</SubmitButton>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
}
