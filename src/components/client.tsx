'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Icon } from './Icon';

export function NavLink({ href, icon, children }: { href: string; icon: string; children: ReactNode }) {
  const path = usePathname();
  const active = path === href || (href !== '/' && path.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      className={`nav-item${active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon name={icon} />
      {children}
    </Link>
  );
}

export function SubmitButton({
  children,
  pendingText,
  className = 'btn btn-primary',
  confirm,
  name,
  value,
  formAction,
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  confirm?: string;
  name?: string;
  value?: string;
  formAction?: (fd: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      disabled={pending}
      name={name}
      value={value}
      formAction={formAction}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/** Masked sensitive value; "Show" asks the server (which records the read in the audit log). */
export function Reveal({ masked, load }: { masked: string; load: () => Promise<string | null> }) {
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <span>{value ?? masked}</span>
      <button
        type="button"
        className="reveal"
        style={{ background: 'none', border: 0 }}
        disabled={busy}
        onClick={async () => {
          if (value !== null) return setValue(null);
          setBusy(true);
          setValue((await load()) ?? '—');
          setBusy(false);
        }}
      >
        {value !== null ? 'Hide' : busy ? '…' : 'Show'}
      </button>
    </>
  );
}

export function PrintButton({ children = 'Print / Save as PDF' }: { children?: ReactNode }) {
  return (
    <button type="button" className="btn btn-secondary no-print" onClick={() => window.print()}>
      {children}
    </button>
  );
}
