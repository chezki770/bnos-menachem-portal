import type { ReactNode } from 'react';
import { initials } from '@/lib/format';

/** Plain link for file downloads (CSV exports) — not client-side navigation. */
export function Download({
  href,
  children,
  className = 'btn btn-secondary',
  title,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <a href={href} className={className} title={title} download>
      {children}
    </a>
  );
}

export function PageHead({
  title,
  sub,
  actions,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={`page-head${actions ? ' spread' : ''}`}>
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="hstack no-print">{actions}</div>}
    </div>
  );
}

export type Tone = 'moss' | 'brass' | 'brick' | 'neutral';
export function Badge({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Avatar({ name, big }: { name: string; big?: boolean }) {
  return (
    <div className="mini-avatar" style={big ? { width: 38, height: 38, fontSize: 13 } : undefined}>
      {initials(name)}
    </div>
  );
}

export function NameCell({ name, sub }: { name: ReactNode & string; sub?: ReactNode }) {
  return (
    <div className="name-cell">
      <Avatar name={name} />
      <div>
        {name}
        {sub && <div className="cell-sub">{sub}</div>}
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <h4>{title}</h4>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  flush,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <div className="panel">
      {title && (
        <div className="panel-head">
          <h3>{title}</h3>
          {actions}
        </div>
      )}
      {flush ? children : <div className="panel-body">{children}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  note,
  flag,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  flag?: boolean;
}) {
  return (
    <div className={`stat-card${flag ? ' flag' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-num">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}

/** Shows ?ok= / ?error= messages that server actions pass back through redirects. */
export function Notice({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ok = typeof searchParams.ok === 'string' ? searchParams.ok : null;
  const error = typeof searchParams.error === 'string' ? searchParams.error : null;
  if (!ok && !error) return null;
  return (
    <div className={`alert ${error ? 'alert-error' : 'alert-ok'}`} role={error ? 'alert' : 'status'}>
      {error ?? ok}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`field${className ? ` ${className}` : ''}`}>
      <label>
        <span style={{ display: 'block', marginBottom: 5 }}>{label}</span>
        {children}
      </label>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function ReadField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="value">{value ?? '—'}</div>
    </div>
  );
}
