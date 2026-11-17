import { useEffect, useState, type FormEvent } from 'react';
import {
  listAdmins, inviteAdmin, deactivateAdmin, getAdminProfile,
  type AdminAccount, type AdminStatus,
} from '../api.ts';

const STATUS_STYLE: Record<AdminStatus, { label: string; cls: string }> = {
  active:         { label: 'Active',         cls: 'bg-green-100 text-green-700' },
  invited:        { label: 'Invited',        cls: 'bg-amber-100 text-amber-700' },
  invite_expired: { label: 'Invite expired', cls: 'bg-gray-100 text-gray-500' },
  inactive:       { label: 'Deactivated',    cls: 'bg-gray-100 text-gray-400' },
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

function InviteForm({ onInvited }: { onInvited: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setSending(true);
    try {
      await inviteAdmin(email.trim(), name.trim());
      onInvited(email.trim().toLowerCase());
      setEmail('');
      setName('');
    } catch (e: unknown) {
      setErr((e as Error).message ?? 'Failed to send invite');
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
      <p className="text-sm font-semibold text-gray-900 mb-3">Invite an admin</p>
      <div className="flex flex-wrap items-center gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required
          className="flex-1 min-w-40 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#143D2D]/40" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required
          className="flex-1 min-w-56 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#143D2D]/40" />
        <button type="submit" disabled={sending || !email.trim() || !name.trim()}
          className="text-xs font-semibold px-4 py-2 rounded-lg bg-[#143D2D] text-white disabled:opacity-40 hover:bg-[#143D2D]/90 transition-colors cursor-pointer">
          {sending ? 'Sending…' : 'Send invite'}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2">They get an email with a link to set their password (works once, expires in 48 hours).</p>
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </form>
  );
}

export default function Admins() {
  const me = getAdminProfile();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  function load(): Promise<void> {
    return listAdmins()
      .then((data) => { setAdmins(data.admins); setError(''); })
      .catch((e: unknown) => { setError((e as Error).message ?? 'Failed to load'); })
      .finally(() => { setLoading(false); });
  }

  useEffect(() => {
    listAdmins()
      .then((data) => setAdmins(data.admins))
      .catch((e: unknown) => setError((e as Error).message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  async function deactivate(a: AdminAccount) {
    const what = a.status === 'active' ? 'They will be signed out and can no longer sign in.' : 'Their invite link will stop working.';
    if (!confirm(`Deactivate ${a.name} (${a.email})? ${what}`)) return;
    setBusy(a.id);
    setNotice('');
    try {
      await deactivateAdmin(a.id);
      setNotice(`${a.name} deactivated.`);
      await load();
    } catch (e: unknown) {
      setNotice((e as Error).message ?? 'Failed to deactivate');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admins</h1>
        <p className="text-sm text-gray-500 mt-1">
          Each admin signs in with their own account. Approvals and config changes are recorded against the admin who made them.
        </p>
      </div>

      <InviteForm onInvited={(email) => { setNotice(`Invite sent to ${email}.`); void load(); }} />

      {notice && <div className="text-sm bg-gray-100 text-gray-700 rounded-lg px-3 py-2 mb-4">{notice}</div>}
      {error && <div className="text-sm bg-red-50 text-red-600 rounded-lg px-3 py-2 mb-4">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Last sign-in</th>
              <th className="px-5 py-3 font-medium">Added</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {admins.map((a) => {
              const isMe = a.id === me?.id;
              const st = STATUS_STYLE[a.status];
              const canDeactivate = !isMe && (a.status === 'active' || a.status === 'invited' || a.status === 'invite_expired');
              return (
                <tr key={a.id} className={a.status === 'inactive' ? 'opacity-50' : ''}>
                  <td className="px-5 py-3 font-medium text-gray-900">{a.name}{isMe && <span className="text-xs text-gray-400 font-normal"> (you)</span>}</td>
                  <td className="px-5 py-3 text-gray-600">{a.email}</td>
                  <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span></td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{fmtDate(a.last_login_at)}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{fmtDate(a.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    {canDeactivate && (
                      <button onClick={() => { void deactivate(a); }} disabled={busy === a.id}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors cursor-pointer">
                        {busy === a.id ? 'Deactivating…' : 'Deactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {admins.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-6 text-gray-400">No admins.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
