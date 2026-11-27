import { ForgotForm } from '@/app/login/forms';

export default function ForgotPage() {
  return (
    <main className="login-wrap">
      <div className="login-card">
        <h1>Reset password</h1>
        <p className="sub">We&apos;ll email you a link to choose a new password.</p>
        <ForgotForm />
      </div>
    </main>
  );
}
