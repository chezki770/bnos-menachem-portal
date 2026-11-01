import type { ReactNode } from 'react';

export const metadata = { title: 'Bnos Menachem Portal' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#EDEFE9', color: '#1C2B45' }}
      >
        {children}
      </body>
    </html>
  );
}
