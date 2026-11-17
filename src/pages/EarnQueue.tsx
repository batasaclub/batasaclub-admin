import { useEffect, useState, type FormEvent } from 'react';
import {
  approveEarnRequest, getEarnRequests, getHotels, rejectEarnRequest,
  type EarnRequest, type EarnRequestStatus, type Hotel,
} from '../api.ts';

// Earn approval queue. Earn is never auto-credited: hotel staff / channels submit it, an admin
// checks the settled booking and approves (credits the guest's usable balance) or rejects (reason
// required). One request at a time — there is deliberately no bulk approve.

const PAGE_SIZE = 50;

const TABS: { id: EarnRequestStatus; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'cancelled', label: 'Cancelled' },
];

const SOURCE_LABEL: Record<string, string> = {
  checkout: 'Checkout',
  walk_in: 'Walk-in',
  batasa_channel: 'Batasa booking',
  channel_api: 'Channel manager',
  ancillary: 'Ancillary spend',
  tier_job: 'Tier job',
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Cash / card (no Batasa)',
  cash_and_batasa: 'Cash + Batasa redemption',
  batasa: 'Batasa redemption only',
};

const rupees = (paise: string | number | null | undefined) =>
  paise == null ? '—' : `₹${(Number(paise) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function bookingStatusClass(status: string | null) {
  if (status === 'cancelled') return 'bg-red-50 text-red-700';
  if (status === 'checked_out') return 'bg-green-50 text-green-700';
  return 'bg-amber-50 text-amber-700';
}

type Filters = { hotel_id: string; from: string; to: string };
const emptyFilters: Filters = { hotel_id: '', from: '', to: '' };

function Decision({ r, onDone }: { r: EarnRequest; onDone: (msg: string) => void }) {
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bookingCancelled = r.booking?.status === 'cancelled';

  async function approve() {
    setBusy(true); setError('');
    try {
      const res = await approveEarnRequest(r.id, note.trim() || undefined);
      const tier = res.tier_change ? ` · tier ${res.tier_change.from} → ${res.tier_change.to}` : '';
      onDone(`Approved ${r.batasa_requested.toLocaleString('en-IN')} Batasa for ${r.member?.name ?? 'member'} (balance ${res.member.total_points.toLocaleString('en-IN')})${tier}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function reject(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError('A reason is required'); return; }
    setBusy(true); setError('');
    try {
      await rejectEarnRequest(r.id, reason.trim());
      onDone(`Rejected ${r.batasa_requested.toLocaleString('en-IN')} Batasa for ${r.member?.name ?? 'member'}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const btn = 'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="space-y-2 min-w-56">
      {mode === 'idle' && (
        <div className="flex gap-2">
          <button className={`${btn} bg-[#143D2D] text-white hover:bg-[#143D2D]/90`} disabled={bookingCancelled}
            title={bookingCancelled ? 'Booking is cancelled — cannot approve' : undefined}
            onClick={() => { setMode('approve'); setError(''); }}>Approve</button>
          <button className={`${btn} border border-red-200 text-red-700 hover:bg-red-50`} onClick={() => { setMode('reject'); setError(''); }}>Reject</button>
        </div>
      )}
      {mode === 'approve' && (
        <div className="space-y-2">
          <div className="text-xs text-gray-600">
            Credit <strong>{r.batasa_requested.toLocaleString('en-IN')} Batasa</strong> to {r.member?.name ?? 'this member'}'s usable balance?
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={500}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#143D2D]/40" />
          <div className="flex gap-2">
            <button className={`${btn} bg-[#143D2D] text-white hover:bg-[#143D2D]/90`} disabled={busy} onClick={approve}>
              {busy ? 'Approving…' : 'Confirm approve'}
            </button>
            <button className={`${btn} border border-gray-200 text-gray-600 hover:bg-gray-50`} disabled={busy} onClick={() => setMode('idle')}>Cancel</button>
          </div>
        </div>
      )}
      {mode === 'reject' && (
        <form onSubmit={reject} className="space-y-2">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required, shown in the audit log)"
            rows={2} maxLength={500} autoFocus
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-300" />
          <div className="flex gap-2">
            <button type="submit" className={`${btn} bg-red-600 text-white hover:bg-red-700`} disabled={busy || !reason.trim()}>
              {busy ? 'Rejecting…' : 'Confirm reject'}
            </button>
            <button type="button" className={`${btn} border border-gray-200 text-gray-600 hover:bg-gray-50`} disabled={busy} onClick={() => setMode('idle')}>Cancel</button>
          </div>
        </form>
      )}
      {bookingCancelled && mode === 'idle' && <div className="text-[11px] text-red-600">Booking cancelled — reject it.</div>}
      {error && <div className="text-[11px] text-red-600">{error}</div>}
    </div>
  );
}

function Outcome({ r }: { r: EarnRequest }) {
  return (
    <div className="text-xs space-y-0.5">
      <div className="text-gray-700">{r.decided_at ? fmtDateTime(r.decided_at) : '—'}</div>
      <div className="text-gray-500">
        {r.decided_by_admin ? `by ${r.decided_by_admin.name}` : r.status === 'cancelled' ? 'by system (booking cancelled)' : r.decided_by ?? ''}
      </div>
      {r.decision_note && <div className="text-gray-600 italic break-words">“{r.decision_note}”</div>}
    </div>
  );
}

export default function EarnQueue() {
  const [tab, setTab] = useState<EarnRequestStatus>('pending');
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<EarnRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    getHotels().then((d) => setHotels(d.hotels)).catch(() => { /* hotel filter stays empty */ });
  }, []);

  useEffect(() => {
    let cancelled = false;
    getEarnRequests({ status: tab, ...filters, page, limit: PAGE_SIZE })
      .then((d) => { if (!cancelled) { setRows(d.requests); setTotal(d.total); setError(''); } })
      .catch((e: unknown) => { if (!cancelled) setError((e as Error).message ?? 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab, filters, page, reload]);

  function go(nextTab: EarnRequestStatus, nextFilters: Filters, nextPage: number) {
    setLoading(true);
    setTab(nextTab);
    setFilters(nextFilters);
    setPage(nextPage);
  }

  function decided(msg: string) {
    setNotice(msg);
    setLoading(true);
    setReload((n) => n + 1);
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const input = 'text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#143D2D]/40 bg-white';
  const isPending = tab === 'pending';

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Earn Queue</h1>
        <p className="text-sm text-gray-500 mt-1">
          Batasa earned at checkout, walk-in, bookings, channel managers and ancillary spend wait here. Check the booking, then approve to credit
          the guest's usable balance, or reject with a reason. Every decision is in the Audit Log.
        </p>
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setNotice(''); go(t.id, filters, 1); }}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors cursor-pointer ${
              tab === t.id ? 'border-[#143D2D] text-[#143D2D]' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {t.label}{tab === t.id && !loading ? ` (${total})` : ''}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); go(tab, { ...draft }, 1); }} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            Hotel
            <select value={draft.hotel_id} onChange={(e) => setDraft({ ...draft, hotel_id: e.target.value })} className={`${input} min-w-56`}>
              <option value="">All hotels</option>
              {hotels.map((h) => <option key={h.id} value={h.id}>{h.name} · {h.city}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            Requested from
            <input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            To
            <input type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={input} />
          </label>
          <button type="submit" className="text-xs font-semibold px-4 py-2.5 rounded-lg bg-[#143D2D] text-white hover:bg-[#143D2D]/90 transition-colors cursor-pointer">Apply</button>
          <button type="button" onClick={() => { setDraft(emptyFilters); go(tab, emptyFilters, 1); }}
            className="text-xs font-medium px-3 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">Clear</button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Dates are in UTC; "To" includes that whole day. Pending shows oldest first.</p>
      </form>

      {notice && <div className="text-sm bg-green-50 text-green-700 rounded-lg px-3 py-2 mb-4">{notice}</div>}
      {error && <div className="text-sm bg-red-50 text-red-600 rounded-lg px-3 py-2 mb-4">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="px-5 py-3 font-medium whitespace-nowrap">Requested</th>
              <th className="px-5 py-3 font-medium">Guest</th>
              <th className="px-5 py-3 font-medium">Hotel / source</th>
              <th className="px-5 py-3 font-medium">Booking</th>
              <th className="px-5 py-3 font-medium">Charged / payment</th>
              <th className="px-5 py-3 font-medium text-right">Batasa</th>
              <th className="px-5 py-3 font-medium">{isPending ? 'Decision' : 'Outcome'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(r.requested_at)}</td>
                <td className="px-5 py-3">
                  <div className="font-medium text-gray-900">{r.member?.name ?? 'Unknown member'}</div>
                  <div className="text-xs text-gray-400">{r.member?.mobile ?? r.member?.email ?? r.member_id}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Tier at request: {r.tier_at_request}</div>
                </td>
                <td className="px-5 py-3">
                  <div className="text-gray-800">{r.hotel?.name ?? r.hotel_id}</div>
                  <div className="text-xs text-gray-500">{SOURCE_LABEL[r.source] ?? r.source}{r.category ? ` · ${r.category.replace(/_/g, ' ')}` : ''}</div>
                </td>
                <td className="px-5 py-3">
                  {r.booking ? (
                    <div className="space-y-0.5">
                      <div className="font-mono text-xs text-gray-800">{r.booking.booking_ref}</div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(r.booking.check_in)} → {fmtDate(r.booking.check_out)} · {r.booking.nights} night{r.booking.nights === 1 ? '' : 's'}
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${bookingStatusClass(r.booking.status)}`}>
                        {(r.booking.status ?? 'unknown').replace(/_/g, ' ')}
                      </span>
                      <div className="text-[11px] text-gray-400">{r.booking.booking_channel ?? '—'}{r.booking.is_corporate ? ' · corporate' : ''}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">No booking (ancillary)</span>
                  )}
                </td>
                <td className="px-5 py-3 text-xs">
                  <div className="text-gray-800 font-medium">{rupees(r.booking?.amount_charged_paise ?? r.base_amount_paise)}</div>
                  {r.booking ? (
                    <>
                      <div className="text-gray-500">{PAYMENT_LABEL[r.booking.payment_method]}</div>
                      {(r.booking.points_used ?? 0) > 0 && (
                        <div className="text-gray-400">Cash {rupees(r.booking.cash_paid_paise)} · {r.booking.points_used?.toLocaleString('en-IN')} B redeemed</div>
                      )}
                    </>
                  ) : (
                    <div className="text-gray-500">Spend logged by hotel</div>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="font-semibold text-gray-900">{r.batasa_requested.toLocaleString('en-IN')}</div>
                  <div className="text-[11px] text-gray-400">{r.earn_rate_at_request}/₹100</div>
                </td>
                <td className="px-5 py-3">
                  {isPending ? <Decision r={r} onDone={decided} /> : <Outcome r={r} />}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && !error && (
              <tr><td colSpan={7} className="px-5 py-6 text-gray-400">{isPending ? 'Nothing waiting for approval.' : `No ${tab} requests match these filters.`}</td></tr>
            )}
            {loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-6 text-gray-400">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
        <span>{total === 0 ? 'No requests' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}{loading && rows.length > 0 ? ' · loading…' : ''}</span>
        <div className="flex gap-2">
          <button onClick={() => go(tab, filters, page - 1)} disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">← Previous</button>
          <span className="px-2 py-1.5">Page {page} of {pages}</span>
          <button onClick={() => go(tab, filters, page + 1)} disabled={page >= pages || loading}
            className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">Next →</button>
        </div>
      </div>
    </div>
  );
}
