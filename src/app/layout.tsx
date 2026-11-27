import type { ReactNode } from 'react';
import { Fraunces, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const serif = Fraunces({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-serif' });
const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-sans' });

export const metadata = { title: 'Bnos Menachem Portal', description: 'Staff & Department Portal' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
