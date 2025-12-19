import { redirect } from 'next/navigation';
import { Disc3 } from 'lucide-react';
import {
  getSessionTokenFromCookies,
  isAuthDisabled,
  requireAuthToken,
} from '@/lib/auth';
import { LoginForm } from './login-form';

export default function LoginPage() {
  if (isAuthDisabled()) {
    redirect('/');
  }

  const authToken = requireAuthToken();
  const session = getSessionTokenFromCookies();

  if (session === authToken) {
    redirect('/');
  }

  return (
    <div className="card login-card">
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Disc3 size={48} strokeWidth={1} className="login-disc" />
      </div>
      <div
        className="page-title"
        style={{ justifyContent: 'center', textAlign: 'center' }}
      >
        <h1>The Collection</h1>
      </div>
      <p className="login-subtitle">
        Enter your access token to access your collection
      </p>
      <LoginForm />
    </div>
  );
}
