import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { siteName } from '@/lib/site';

export const metadata: Metadata = {
  title: siteName,
  description: 'Browse your podcast collection with AI-powered summaries.',
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
