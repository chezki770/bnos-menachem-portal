'use client';

import { useActionState, type ReactNode } from 'react';
import { updateMyInfo, type State } from '../actions';

export function MyInfoForm({ children }: { children: ReactNode }) {
  const [state, action, pending] = useActionState<State, FormData>(updateMyInfo, {});
  return (
    <form action={action}>
      {children}
      {state.error && (
        <p className="alert alert-error mt" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="alert alert-ok mt" role="status">
          {state.ok}
        </p>
      )}
      <div className="form-actions">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
