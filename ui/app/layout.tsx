import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import './globals.css';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans' });
const siteName = process.env.SITE_NAME || 'Pod Worker UI';

export const metadata: Metadata = {
  title: siteName,
  description: 'Browse podcast episodes and AI summaries from your Pod Worker.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.variable}>
        <div className="app-shell">
          <header className="app-header">
            <Link href="/" className="brand">
              <div className="brand-mark">PW</div>
              <div>
                <div className="brand-title">{siteName}</div>
                <div className="brand-subtitle">Episodes &amp; AI summaries</div>
              </div>
            </Link>
            <nav className="nav-actions">
              <Link href="/api/logout" className="ghost-button">
                <LogOut size={18} strokeWidth={2.5} />
              </Link>
            </nav>
          </header>
          <main className="app-main">{children}</main>
          <footer className="app-footer">
            <span>Powered by your Pod Worker</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
