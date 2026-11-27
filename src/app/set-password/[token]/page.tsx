import Link from 'next/link';
import { SetPasswordForm } from '@/app/login/forms';
import { peekToken } from '@/lib/auth/tokens';
import { employees } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function SetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await peekToken(token);
  const emp = t ? await employees.get(t.employeeId) : undefined;
  return (
    <main className="login-wrap">
      <div className="login-card">
        <h1>{t?.kind === 'INVITE' ? 'Welcome' : 'Choose a password'}</h1>
        {emp ? (
          <>
            <p className="sub">
              {t?.kind === 'INVITE'
                ? `Set a password for ${emp.email} to finish setting up your account.`
                : `New password for ${emp.email}.`}
            </p>
            <SetPasswordForm token={token} />
          </>
        ) : (
          <>
            <p className="sub">This link has expired or was already used. Ask the office for a new one.</p>
            <Link className="btn btn-primary" href="/login">
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
