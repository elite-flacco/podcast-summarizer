import Link from 'next/link';
import { Disc, LogOut } from 'lucide-react';
import { FilterBar } from '@/components/FilterBar';
import { getChannels } from '@/lib/data';
import { siteName } from '@/lib/site';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const channels = await getChannels();

  return (
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
  );
}
