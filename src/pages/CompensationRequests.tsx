import { useEffect, useState, type FormEvent } from 'react';
import {
  approveCompensationRequest, getCompensationRequests, rejectCompensationRequest,
  type CompensationRequest, type CompensationRequestStatus,
} from '../api.ts';

// Compensation requests. A GM asks for Batasa for a guest complaint (one request per complaint);
// only ARTHA_ADMIN approves or rejects. Approving debits the hotel's GENERAL Batasa balance 1:1 and
// credits the guest in one step; promotion-only Batasa can never fund it. A complaint is paid once,
// even if it was also compensated directly. Every decision is in the Audit Log.

const PAGE_SIZE = 50;
const TABS: { id: CompensationRequestStatus; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];
const fmt = (n: number) => n.toLocaleString('en-IN');
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function Decision({ r, onDone }: { r: CompensationRequest; onDone: (msg: string) => void }) {
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const short = !r.sufficient_general_balance;

  async function approve() {
    setBusy(true); setError('');
    try {
      const res = await approveCompensationRequest(r.id, note.trim() || undefined);
      onDone(`Approved: ${fmt(res.batasa_awarded)} Batasa to ${r.guest.name ?? 'the guest'}; ${r.hotel.name} general balance now ${fmt(res.hotel_general_balance_after)}`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  async function reject(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError('A reason is required'); return; }
    setBusy(true); setError('');
    try {
      await rejectCompensationRequest(r.id, reason.trim());
      onDone(`Rejected the ${fmt(r.batasa_requested)} Batasa request for ${r.guest.name ?? 'the guest'}`);
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  const btn = 'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="space-y-2 min-w-56">
      {mode === 'idle' && (
        <div className="flex gap-2">
          <button className={`${btn} bg-[#143D2D] text-white hover:bg-[#143D2D]/90`} onClick={() => { setMode('approve'); setError(''); }}>Approve</button>
          <button className={`${btn} border border-red-200 text-red-700 hover:bg-red-50`} onClick={() => { setMode('reject'); setError(''); }}>Reject</button>
        </div>
      )}
      {mode === 'approve' && (
        <div className="space-y-2">
          <div className="text-xs text-gray-600">
            Debit <strong>{fmt(r.batasa_requested)} Batasa</strong> from {r.hotel.name}'s general balance ({fmt(r.hotel.general_balance)}) and credit {r.guest.name ?? 'the guest'}?
          </div>
          {short && <div className="text-[11px] text-red-600">The general balance is below the amount: approval will be refused until the hotel tops up.</div>}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={500}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#143D2D]/40" />
          <div className="flex gap-2">
            <button className={`${btn} bg-[#143D2D] text-white hover:bg-[#143D2D]/90`} disabled={busy} onClick={approve}>{busy ? 'Approving…' : 'Confirm approve'}</button>
            <button className={`${btn} border border-gray-200 text-gray-600 hover:bg-gray-50`} disabled={busy} onClick={() => setMode('idle')}>Cancel</button>
          </div>
        </div>
      )}
      {mode === 'reject' && (
        <form onSubmit={reject} className="space-y-2">
          <div className="text-xs text-gray-600">Final: the GM cannot request again for this complaint.</div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required, shown to the GM and in the audit log)"
            rows={2} maxLength={500} autoFocus
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-300" />
          <div className="flex gap-2">
            <button type="submit" className={`${btn} bg-red-600 text-white hover:bg-red-700`} disabled={busy || !reason.trim()}>{busy ? 'Rejecting…' : 'Confirm reject'}</button>
            <button type="button" className={`${btn} border border-gray-200 text-gray-600 hover:bg-gray-50`} disabled={busy} onClick={() => setMode('idle')}>Cancel</button>
          </div>
        </form>
      )}
      {error && <div className="text-[11px] text-red-600">{error}</div>}
    </div>
  );
}

export default function CompensationRequests() {
  const [tab, setTab] = useState<CompensationRequestStatus>('pending');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{ key: string; rows: CompensationRequest[]; total: number; error: string } | null>(null);
  const [notice, setNotice] = useState('');
  const key = `${tab}|${page}|${reload}`;

  useEffect(() => {
    let live = true;
    getCompensationRequests(tab, page, PAGE_SIZE)
      .then((d) => { if (live) setResult({ key, rows: d.requests, total: d.total, error: '' }); })
      .catch((e: Error) => { if (live) setResult({ key, rows: [], total: 0, error: e.message }); });
    return () => { live = false; };
  }, [tab, page, key]);

  const loading = result?.key !== key;
  const rows = result?.rows ?? [];
  const total = result?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isPending = tab === 'pending';

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Compensation Requests</h1>
        <p className="text-sm text-gray-500 mt-1">
          GMs request Batasa for guest complaints. Approving debits the hotel's general Batasa balance and credits the guest in one step;
          a complaint is never paid twice. Reject with a reason.
        </p>
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setNotice(''); setTab(t.id); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors cursor-pointer ${
              tab === t.id ? 'border-[#143D2D] text-[#143D2D]' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {t.label}{tab === t.id && !loading ? ` (${total})` : ''}
          </button>
        ))}
      </div>

      {notice && <div className="mb-4 rounded-lg bg-green-50 border border-green-100 px-4 py-2 text-sm text-green-800">{notice}</div>}
      {!loading && result?.error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{result.error}</div>}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-gray-600">
              <th className="px-4 py-3 font-medium">Complaint</th>
              <th className="px-4 py-3 font-medium">Guest</th>
              <th className="px-4 py-3 font-medium">Hotel · general balance</th>
              <th className="px-4 py-3 font-medium text-right">Requested</th>
              <th className="px-4 py-3 font-medium">GM's reason</th>
              <th className="px-4 py-3 font-medium">{isPending ? 'Decision' : 'Outcome'}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
            {!loading && rows.length === 0 && !result?.error && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No {tab} requests.</td></tr>
            )}
            {!loading && rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-50 align-top">
                <td className="px-4 py-3 max-w-64">
                  <div className="text-gray-900">{r.complaint.category}</div>
                  <div className="text-xs text-gray-500 break-words">{r.complaint.description}</div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">{r.complaint.booking_ref ?? ''}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-gray-900">{r.guest.name ?? '—'}</div>
                  <div className="text-xs text-gray-500">{r.guest.email ?? ''}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-gray-900">{r.hotel.name}</div>
                  <div className={`text-xs tabular-nums ${isPending && !r.sufficient_general_balance ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    General {fmt(r.hotel.general_balance)} Batasa{isPending && !r.sufficient_general_balance ? ' — below request' : ''}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <div className="font-semibold text-gray-900">{fmt(r.batasa_requested)}</div>
                  <div className="text-xs text-gray-400">{fmtDateTime(r.requested_at)}</div>
                  <div className="text-xs text-gray-400">{r.requested_by?.full_name ?? r.requested_by?.email ?? ''}</div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-700 max-w-64 break-words">{r.reason}</td>
                <td className="px-4 py-3">
                  {isPending ? (
                    <Decision r={r} onDone={(m) => { setNotice(m); setReload((n) => n + 1); }} />
                  ) : (
                    <div className="text-xs space-y-0.5">
                      <div className="text-gray-700">{r.decided_at ? fmtDateTime(r.decided_at) : '—'}</div>
                      <div className="text-gray-500">{r.decided_by ? `by ${r.decided_by.name}` : ''}</div>
                      {r.batasa_paid != null && <div className="text-gray-700">Paid {fmt(r.batasa_paid)} Batasa</div>}
                      {r.decision_note && <div className="text-gray-600 italic break-words">“{r.decision_note}”</div>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
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
