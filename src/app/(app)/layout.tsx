import type { ReactNode } from 'react';
import { logout } from '@/app/login/actions';
import { NavLink } from '@/components/client';
import { requireUser } from '@/lib/auth/current-user';
import { currentSchoolYear } from '@/lib/data/years';
import { initials, ROLE_LABEL } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const year = await currentSchoolYear();
  const admin = user.role === 'ADMIN';
  const manager = user.role !== 'STAFF';
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">Bnos Menachem</div>
        <div className="brand-sub">Staff &amp; Department Portal</div>
        <div className="year-select" title="Current school year (change it in Settings)">
          {year ? year.label.replace('-', ' – ') : 'No school year'}
        </div>
        <nav className="primary-nav" aria-label="Main">
          {manager && (
            <>
              <div className="nav-label">{admin ? 'ADMIN VIEW' : 'DEPARTMENT VIEW'}</div>
              <NavLink href="/dashboard" icon="dashboard">
                Dashboard
              </NavLink>
              <NavLink href="/employees" icon="people">
                Employees
              </NavLink>
              <NavLink href="/scheduling" icon="calendar">
                Scheduling
              </NavLink>
              {admin && (
                <NavLink href="/contracts" icon="file">
                  Contracts
                </NavLink>
              )}
              {admin && (
                <NavLink href="/payroll" icon="pay">
                  Payroll
                </NavLink>
              )}
              <NavLink href="/absences" icon="sun">
                Absences
              </NavLink>
              {admin && (
                <NavLink href="/reports" icon="chart">
                  Reports
                </NavLink>
              )}
              {admin && (
                <NavLink href="/data" icon="database">
                  Data (CSV)
                </NavLink>
              )}
              {admin && (
                <NavLink href="/settings" icon="settings">
                  Settings
                </NavLink>
              )}
              <div className="nav-label" style={{ marginTop: 18 }}>
                MY PORTAL
              </div>
            </>
          )}
          <NavLink href="/home" icon="home">
            Home
          </NavLink>
          <NavLink href="/me/info" icon="user">
            My info
          </NavLink>
          <NavLink href="/me/documents" icon="folder">
            Documents
          </NavLink>
          <NavLink href="/me/contract" icon="pen">
            My contract
          </NavLink>
          <NavLink href="/me/schedule" icon="clock">
            My schedule
          </NavLink>
          <NavLink href="/me/time-off" icon="sun">
            Time off
          </NavLink>
          <NavLink href="/me/pay" icon="pay">
            My pay
          </NavLink>
          <NavLink href="/handbook" icon="book">
            Handbook
          </NavLink>
        </nav>
        <div className="sidebar-foot">Data is stored in CSV files on the school server.</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="crumb-current">{user.name}</span>
            <span>
              · {ROLE_LABEL[user.role]}
              {user.role !== 'ADMIN' ? ` · ${user.department}` : ''}
            </span>
          </div>
          <div className="topbar-right">
            <form action={logout}>
              <button className="btn btn-text">Sign out</button>
            </form>
            <div className="avatar" aria-hidden="true">
              {initials(user.name)}
            </div>
          </div>
        </header>
        <main className="content">
          <div className="screen">{children}</div>
        </main>
      </div>
    </div>
  );
}
