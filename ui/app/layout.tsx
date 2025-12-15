import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import Link from 'next/link';
import { LogOut, Disc } from 'lucide-react';
import { FilterBar } from '@/components/FilterBar';
import { getChannels } from '@/lib/data';
import './globals.css';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans' });
const siteName = process.env.SITE_NAME || 'The Rack';

export const metadata: Metadata = {
  title: siteName,
  description: 'Browse your podcast collection with AI-powered summaries.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const channels = await getChannels();

  return (
    <html lang="en">
      <body className={spaceGrotesk.variable}>
        <div className="app-shell">
          <header className="app-header">
            <Link href="/" className="brand">
              <div className="brand-mark">
                <Disc size={20} strokeWidth={1.5} />
              </div>
              <div>
                <div className="brand-title">{siteName}</div>
                <div className="brand-subtitle">Browse the collection</div>
              </div>
            </Link>
            <FilterBar channels={channels} />
            <nav className="nav-actions">
              <Link href="/api/logout" className="ghost-button">
                <LogOut size={12} strokeWidth={2} />
              </Link>
            </nav>
          </header>
          <main className="app-main">{children}</main>
          <footer className="app-footer">
            <span>Press play on your collection</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
