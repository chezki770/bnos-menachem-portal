import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/current-user';
import { LoginForm } from './forms';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await getSessionUser()) redirect('/');
  return (
    <main className="login-wrap">
      <div className="login-card">
        <h1>Bnos Menachem</h1>
        <p className="sub">Staff &amp; Department Portal</p>
        <LoginForm />
      </div>
    </main>
  );
}
