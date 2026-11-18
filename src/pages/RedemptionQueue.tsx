import { useEffect, useState, type FormEvent } from 'react';
import { confirmRedemption, getPendingRedemptions, rejectRedemption, type PendingRedemption } from '../api.ts';

// Redemption queue (ARTHA_ADMIN only). A guest's slab booking waits here with nothing debited.
// Approve debits the guest's Batasa and confirms the booking; reject (reason required) cancels the
// booking, debits nothing and frees the room nights. The hotel is credited only when the stay checks
// out. Every decision is in the Audit Log.

const PAGE_SIZE = 50;
const fmt = (n: number) => n.toLocaleString('en-IN');
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function expiryLabel(r: PendingRedemption): { text: string; urgent: boolean } {
  if (!r.expires_at) return { text: 'No expiry', urgent: false };
  if (r.expired) return { text: `Expired ${fmtDateTime(r.expires_at)} — will auto-cancel tonight`, urgent: true };
  const hours = Math.max(0, Math.round((new Date(r.expires_at).getTime() - Date.now()) / 36e5));
  return { text: `${hours} h left · ${fmtDateTime(r.expires_at)}`, urgent: hours < 6 };
}

function Decision({ r, onDone }: { r: PendingRedemption; onDone: (msg: string) => void }) {
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const guestName = r.guest?.name ?? 'the guest';
  const cannotApprove = r.expired ? 'Redemption window expired — reject it' : !r.sufficient_balance ? 'Guest balance is below the Batasa needed' : null;

  async function approve() {
    setBusy(true); setError('');
    try {
      const res = await confirmRedemption(r.booking_ref);
      onDone(`Approved ${r.booking_ref}: ${fmt(res.pointsDeducted)} Batasa debited from ${guestName} (balance ${fmt(res.newBalance)})`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  async function reject(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError('A reason is required'); return; }
    setBusy(true); setError('');
    try {
      const res = await rejectRedemption(r.booking_ref, reason.trim());
      onDone(`Rejected ${r.booking_ref}: booking cancelled, nothing debited, ${res.nights_released.length} night(s) released`);
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  const btn = 'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="space-y-2 min-w-56">
      {mode === 'idle' && (
        <div className="flex gap-2">
          <button className={`${btn} bg-[#143D2D] text-white hover:bg-[#143D2D]/90`} disabled={!!cannotApprove} title={cannotApprove ?? undefined}
            onClick={() => { setMode('approve'); setError(''); }}>Approve</button>
          <button className={`${btn} border border-red-200 text-red-700 hover:bg-red-50`} onClick={() => { setMode('reject'); setError(''); }}>Reject</button>
        </div>
      )}
      {mode === 'approve' && (
        <div className="space-y-2">
          <div className="text-xs text-gray-600">
            Debit <strong>{fmt(r.batasa)} Batasa</strong> from {guestName} and confirm {r.booking_ref}? The guest pays {rupees(r.cash_due_paise)} in cash.
          </div>
          <div className="flex gap-2">
            <button className={`${btn} bg-[#143D2D] text-white hover:bg-[#143D2D]/90`} disabled={busy} onClick={approve}>{busy ? 'Approving…' : 'Confirm approve'}</button>
            <button className={`${btn} border border-gray-200 text-gray-600 hover:bg-gray-50`} disabled={busy} onClick={() => setMode('idle')}>Cancel</button>
          </div>
        </div>
      )}
      {mode === 'reject' && (
        <form onSubmit={reject} className="space-y-2">
          <div className="text-xs text-gray-600">Cancels the booking. Nothing is debited; the room nights are released; the guest gets the cancellation email.</div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required, shown in the audit log)"
            rows={2} maxLength={500} autoFocus
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-300" />
          <div className="flex gap-2">
            <button type="submit" className={`${btn} bg-red-600 text-white hover:bg-red-700`} disabled={busy || !reason.trim()}>{busy ? 'Rejecting…' : 'Confirm reject'}</button>
            <button type="button" className={`${btn} border border-gray-200 text-gray-600 hover:bg-gray-50`} disabled={busy} onClick={() => setMode('idle')}>Cancel</button>
          </div>
        </form>
      )}
      {cannotApprove && mode === 'idle' && <div className="text-[11px] text-red-600">{cannotApprove}</div>}
      {error && <div className="text-[11px] text-red-600">{error}</div>}
    </div>
  );
}

export default function RedemptionQueue() {
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{ key: string; rows: PendingRedemption[]; total: number; error: string } | null>(null);
  const [notice, setNotice] = useState('');
  const key = `${page}|${reload}`;

  useEffect(() => {
    let live = true;
    getPendingRedemptions(page, PAGE_SIZE)
      .then((d) => { if (live) setResult({ key, rows: d.redemptions, total: d.total, error: '' }); })
      .catch((e: Error) => { if (live) setResult({ key, rows: [], total: 0, error: e.message }); });
    return () => { live = false; };
  }, [page, key]);

  const loading = result?.key !== key;
  const rows = result?.rows ?? [];
  const total = result?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Redemption Queue</h1>
        <p className="text-sm text-gray-500 mt-1">
          Guests' Batasa redemption bookings, waiting for approval. Approve to debit the guest's Batasa and confirm the booking; reject (with a reason)
          to cancel it — nothing is debited and the room nights are released. Requests expire 24 hours after booking.
        </p>
      </div>

      {notice && <div className="mb-4 rounded-lg bg-green-50 border border-green-100 px-4 py-2 text-sm text-green-800">{notice}</div>}
      {!loading && result?.error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{result.error}</div>}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-gray-600">
              <th className="px-4 py-3 font-medium">Booking</th>
              <th className="px-4 py-3 font-medium">Guest</th>
              <th className="px-4 py-3 font-medium">Hotel · stay</th>
              <th className="px-4 py-3 font-medium text-right">Redemption</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              <th className="px-4 py-3 font-medium">Decision</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
            {!loading && rows.length === 0 && !result?.error && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No redemptions waiting.</td></tr>
            )}
            {!loading && rows.map((r) => {
              const exp = expiryLabel(r);
              return (
                <tr key={r.booking_id} className="border-b border-gray-50 align-top">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-gray-900">{r.booking_ref}</div>
                    <div className="text-xs text-gray-400">{r.requested_at ? fmtDateTime(r.requested_at) : ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{r.guest?.name ?? '—'}</div>
                    <div className="text-xs text-gray-500">{r.guest?.email ?? r.guest?.mobile ?? ''}</div>
                    <div className={`text-xs mt-0.5 ${r.sufficient_balance ? 'text-gray-500' : 'text-red-600 font-medium'}`}>
                      Balance {r.guest_balance == null ? '—' : fmt(r.guest_balance)} Batasa
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{r.hotel.name}</div>
                    <div className="text-xs text-gray-500">{fmtDate(r.check_in)} → {fmtDate(r.check_out)} · {r.nights} night{r.nights === 1 ? '' : 's'}{r.room ? ` · ${r.room}` : ''}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <div className="font-semibold text-gray-900">{fmt(r.batasa)} Batasa</div>
                    <div className="text-xs text-gray-500">Slab {r.slab ?? '—'} · cash due {rupees(r.cash_due_paise)}</div>
                  </td>
                  <td className={`px-4 py-3 text-xs ${exp.urgent ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{exp.text}</td>
                  <td className="px-4 py-3"><Decision r={r} onDone={(m) => { setNotice(m); setReload((n) => n + 1); }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 cursor-pointer">Previous</button>
          <span className="text-gray-500">Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 cursor-pointer">Next</button>
        </div>
      )}
    </div>
  );
}
