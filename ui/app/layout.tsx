import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import Link from 'next/link';
import { LogOut, Disc } from 'lucide-react';
import './globals.css';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans' });
const siteName = process.env.SITE_NAME || 'The Rack';

export const metadata: Metadata = {
  title: siteName,
  description: 'Browse your podcast collection with AI-powered summaries.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
            <nav className="nav-actions">
              <Link href="/api/logout" className="ghost-button">
                <LogOut size={16} strokeWidth={2} />
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
