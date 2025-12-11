'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.error || 'Invalid token';
        setError(message);
        setSubmitting(false);
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setError('Unable to log in right now. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="token">Access token</label>
        <input
          id="token"
          className="input"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Enter the AUTH_TOKEN value"
          required
        />
      </div>

      {error && <div className="error">{error}</div>}

      <button type="submit" className="primary" disabled={submitting}>
        {submitting ? 'Checking…' : 'Unlock'}
      </button>
    </form>
  );
}
