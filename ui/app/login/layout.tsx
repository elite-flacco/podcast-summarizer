import type { ReactNode } from 'react';

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="login-shell">
      <main className="login-main">{children}</main>
    </div>
  );
}
