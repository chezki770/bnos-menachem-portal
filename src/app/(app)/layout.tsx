import Link from 'next/link';
import type { ReactNode } from 'react';
import { logout } from '@/app/login/actions';
import { requireUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          Bnos Menachem<small>Staff &amp; Department Portal</small>
        </div>
        <nav>
          {user.role === 'ADMIN' ? (
            <Link href="/employees">Employees</Link>
          ) : (
            <Link href="/me">My benefits</Link>
          )}
        </nav>
        <form action={logout} className="foot">
          <div className="note">
            {user.name} · {user.role === 'ADMIN' ? 'Admin' : 'Staff'}
          </div>
          <button className="btn btn-text">Sign out</button>
        </form>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
