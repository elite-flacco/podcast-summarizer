import { redirect } from 'next/navigation';
import { getSessionTokenFromCookies, requireAuthToken } from '@/lib/auth';
import { LoginForm } from './login-form';

export default function LoginPage() {
  const authToken = requireAuthToken();
  const session = getSessionTokenFromCookies();

  if (session === authToken) {
    redirect('/');
  }

  return (
    <div className="card login-card">
      <div className="page-title">
        <h1>Enter Access Token</h1>
        <span>Single-user gate for your deployment</span>
      </div>
      <LoginForm />
    </div>
  );
}
