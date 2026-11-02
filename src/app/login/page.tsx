import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/current-user';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  if (await getSessionUser()) redirect('/');
  return (
    <main className="login">
      <h1>Bnos Menachem</h1>
      <p className="note">Staff &amp; Department Portal</p>
      <LoginForm />
    </main>
  );
}
