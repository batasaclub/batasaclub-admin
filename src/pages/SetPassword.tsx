import { useEffect, useState, type FormEvent } from 'react';
import { acceptAdminInvite } from '../api.ts';
import { PASSWORD_RULES, meetsPasswordPolicy } from '../lib/passwordPolicy.ts';

export const INVITE_ACCEPTED_NOTICE = 'Your password is set. Sign in to continue.';

// Read once, before the URL is cleaned. The token is kept only in memory.
function readTokenFromUrl(): string | null {
  const token = new URLSearchParams(window.location.search).get('token');
  return token && /^[0-9a-f]{64}$/.test(token) ? token : null;
}

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#143D2D] focus:border-transparent';

export default function SetPassword({ onDone }: { onDone: () => void }) {
  const [token] = useState(readTokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Drop ?token= from the address bar and history so it isn't kept, shared or sent as a referrer.
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const policyOk = meetsPasswordPolicy(password);
  const matches = password.length > 0 && password === confirm;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !policyOk || !matches) return;
    setError('');
    setLoading(true);
    try {
      await acceptAdminInvite(token, password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set your password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="text-[#C79A3B] text-3xl font-bold mb-1">Batasaclub</div>
          <div className="text-gray-500 text-sm">Admin Console</div>
        </div>

        {!token ? (
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800">This invite link is not valid</p>
            <p className="text-sm text-gray-500 mt-1">Ask another Batasaclub admin to send you a new invite.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h1 className="text-base font-semibold text-gray-900">Set your password</h1>
              <p className="text-sm text-gray-500 mt-0.5">Choose a password to activate your admin account.</p>
            </div>

            {error && <div role="alert" className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</div>}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input id="password" type="password" autoComplete="new-password" required autoFocus
                value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </div>

            <ul className="space-y-1" aria-label="Password requirements">
              {PASSWORD_RULES.map((rule) => {
                const ok = rule.test(password);
                return (
                  <li key={rule.label} className={`text-xs ${ok ? 'text-green-700' : 'text-gray-400'}`}>
                    {ok ? '✓' : '○'} {rule.label}
                  </li>
                );
              })}
            </ul>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input id="confirm" type="password" autoComplete="new-password" required
                value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
              {confirm.length > 0 && !matches && <p className="text-xs text-red-600 mt-1">Passwords do not match</p>}
            </div>

            <button type="submit" disabled={loading || !policyOk || !matches}
              className="w-full bg-[#143D2D] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#1b5238] transition-colors disabled:opacity-60 cursor-pointer">
              {loading ? 'Setting password…' : 'Set password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
