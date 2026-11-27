'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { login, requestReset, setPassword, type FormState } from './actions';

function Message({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p className="alert alert-error" role="alert">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p className="alert alert-ok" role="status">
        {state.ok}
      </p>
    );
  return null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <Message state={state} />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="foot">
        <Link className="link" href="/forgot">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestReset, {});
  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <Message state={state} />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? 'Sending…' : 'Email me a reset link'}
      </button>
      <p className="foot">
        <Link className="link" href="/login">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setPassword, {});
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <div className="field">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="confirm">Confirm password</label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>
      <Message state={state} />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? 'Saving…' : 'Save password and sign in'}
      </button>
    </form>
  );
}
