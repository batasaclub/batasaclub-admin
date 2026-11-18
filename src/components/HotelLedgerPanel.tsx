import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ADJUSTMENT_REASON_MIN, adjustHotelBatasa, getHotelLedger, grantFoundingBatasa, topUpHotel,
  type AdminHotelLedger, type HotelLedgerEntry, type LedgerBucket,
} from '../api.ts';
import HotelStatementSection from './HotelStatementSection.tsx';

const TXN_LABEL: Record<string, string> = {
  founding_grant: 'Founding grant',
  top_up: 'Top-up',
  redemption_credit: 'Guest redemption',
  redemption_reversal: 'Redemption reversed',
  review_reward_debit: 'Review reward',
  gift_to_guest: 'Guest compensation',
  promotion_spend: 'Promotion',
  adjustment: 'Adjustment',
};

const BUCKET_LABEL: Record<LedgerBucket, string> = { general: 'General', promotion_only: 'Promotion-only' };

const fmt = (n: number) => n.toLocaleString('en-IN');
const rupees = (paise: number) => '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PAGE_SIZE = 25;

function newIdempotencyKey(): string {
  return `adj-${crypto.randomUUID()}`;
}

type AdjustmentDraft = { bucket: LedgerBucket; batasa: number; reason: string; reference: string | null; key: string };

// Adjustment of one balance, in two steps inside the page: fill in → review and confirm. The
// idempotency key is made when the review opens and reused if the confirm is retried, so a retry
// (network error, double click) never adjusts twice; editing the form makes a new one.
function AdjustmentForm({ hotelName, balances, hotelId, onDone }: {
  hotelName: string; balances: Record<LedgerBucket, number>; hotelId: string; onDone: (message: string) => void;
}) {
  const [bucket, setBucket] = useState<LedgerBucket>('general');
  const [direction, setDirection] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [draft, setDraft] = useState<AdjustmentDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const amountNum = Number(amount);
  const amountValid = amount !== '' && Number.isSafeInteger(amountNum) && amountNum > 0;
  const signed = direction === 'add' ? amountNum : -amountNum;
  const current = balances[bucket];
  const wouldGoNegative = amountValid && current + signed < 0;

  function review(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!amountValid) return setError('Enter a whole number of Batasa greater than 0');
    if (reason.trim().length < ADJUSTMENT_REASON_MIN) return setError(`Reason is required (at least ${ADJUSTMENT_REASON_MIN} characters)`);
    if (reference.trim().length > 100) return setError('Reference must be at most 100 characters');
    if (wouldGoNegative) return setError(`Cannot remove ${fmt(amountNum)}: the ${BUCKET_LABEL[bucket].toLowerCase()} balance is ${fmt(current)} and can never go below 0`);
    setDraft({ bucket, batasa: signed, reason: reason.trim(), reference: reference.trim() || null, key: newIdempotencyKey() });
  }

  async function confirm() {
    if (!draft) return;
    setSaving(true); setError('');
    try {
      const r = await adjustHotelBatasa(hotelId, { bucket: draft.bucket, batasa: draft.batasa, reason: draft.reason, reference: draft.reference, idempotency_key: draft.key });
      const msg = r.duplicate
        ? 'This adjustment was already recorded — nothing changed.'
        : `Adjusted ${BUCKET_LABEL[draft.bucket].toLowerCase()} by ${draft.batasa > 0 ? '+' : ''}${fmt(draft.batasa)} Batasa. New balance ${fmt(r.balances[draft.bucket])}.`;
      setDraft(null); setAmount(''); setReason(''); setReference(''); setDirection('add');
      onDone(msg);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Any edit after review invalidates the draft (and its idempotency key).
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDraft(null); setError(''); };

  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-gray-800">Adjustment (admin correction)</h3>
      <p className="mt-1 text-xs text-gray-500">Adds to or removes from one balance. Recorded in the ledger and the audit log with your name and reason. A balance can never go below 0.</p>

      {!draft ? (
        <form onSubmit={review} className="mt-3 space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="text-xs text-gray-600">
              Balance
              <select value={bucket} onChange={(e) => edit(setBucket)(e.target.value as LedgerBucket)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="general">General ({fmt(balances.general)})</option>
                <option value="promotion_only">Promotion-only ({fmt(balances.promotion_only)})</option>
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Direction
              <select value={direction} onChange={(e) => edit(setDirection)(e.target.value as 'add' | 'remove')} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="add">Add (+)</option>
                <option value="remove">Remove (−)</option>
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Amount (Batasa)
              <input
                value={amount}
                onChange={(e) => edit(setAmount)(e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block text-xs text-gray-600">
            Reason (required, at least {ADJUSTMENT_REASON_MIN} characters)
            <textarea
              value={reason}
              onChange={(e) => edit(setReason)(e.target.value)}
              rows={2}
              placeholder="Why this correction is needed"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-gray-600">
            Reference (optional)
            <input
              value={reference}
              onChange={(e) => edit(setReference)(e.target.value)}
              maxLength={100}
              placeholder="Ticket, booking ref, payment ref…"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          {amountValid && (
            <p className={`text-xs ${wouldGoNegative ? 'text-red-600' : 'text-gray-600'}`}>
              {BUCKET_LABEL[bucket]}: {fmt(current)} → {fmt(current + signed)}
            </p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" className="w-full cursor-pointer rounded-lg bg-[#143D2D] px-3 py-2 text-sm font-medium text-white">
            Review adjustment
          </button>
        </form>
      ) : (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-gray-800" role="alertdialog" aria-label="Confirm adjustment">
          <p className="font-semibold">Confirm this adjustment for {hotelName}</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-gray-500">Balance</dt><dd>{BUCKET_LABEL[draft.bucket]}</dd>
            <dt className="text-gray-500">Change</dt>
            <dd className={draft.batasa < 0 ? 'font-semibold text-red-700' : 'font-semibold text-green-700'}>{draft.batasa > 0 ? '+' : ''}{fmt(draft.batasa)} Batasa</dd>
            <dt className="text-gray-500">Balance after</dt><dd>{fmt(balances[draft.bucket])} → {fmt(balances[draft.bucket] + draft.batasa)}</dd>
            <dt className="text-gray-500">Reason</dt><dd className="break-words">{draft.reason}</dd>
            <dt className="text-gray-500">Reference</dt><dd className="break-words">{draft.reference ?? '—'}</dd>
          </dl>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => { setDraft(null); setError(''); }}
              disabled={saving}
              className="flex-1 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={saving}
              className="flex-1 cursor-pointer rounded-lg bg-[#143D2D] px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Confirm adjustment'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BalanceCard({ label, value, explanation, tone }: { label: string; value: number; explanation: string; tone: 'green' | 'gold' }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === 'green' ? 'border-green-100 bg-green-50/60' : 'border-amber-100 bg-amber-50/60'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{fmt(value)} <span className="text-sm font-medium text-gray-500">Batasa</span></p>
      <p className="mt-1 text-xs text-gray-600">{explanation}</p>
    </div>
  );
}

export default function HotelLedgerPanel({ hotelId, onClose }: { hotelId: string; onClose: () => void }) {
  const [data, setData] = useState<AdminHotelLedger | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [grantRef, setGrantRef] = useState('');
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState('');
  const [topBatasa, setTopBatasa] = useState('');
  const [topRef, setTopRef] = useState('');
  const [topping, setTopping] = useState(false);
  const [topError, setTopError] = useState('');
  const [topNotice, setTopNotice] = useState('');
  const [adjustNotice, setAdjustNotice] = useState('');

  const load = useCallback(() => {
    getHotelLedger(hotelId, page, PAGE_SIZE)
      .then((d) => { setData(d); setError(''); })
      .catch((e: Error) => setError(e.message));
  }, [hotelId, page]);

  useEffect(load, [load]);

  async function submitGrant(e: FormEvent) {
    e.preventDefault();
    if (!grantRef.trim()) return setGrantError('Payment reference is required');
    if (!window.confirm(`Credit the founding grant to ${data?.hotel.name}? This can be done once per hotel, ever.`)) return;
    setGranting(true); setGrantError('');
    try {
      await grantFoundingBatasa(hotelId, grantRef.trim());
      setGrantRef('');
      load();
    } catch (err) {
      setGrantError((err as Error).message);
    } finally {
      setGranting(false);
    }
  }

  const rate = data?.effective_topup_rate ?? null;
  const batasaNum = Number(topBatasa);
  const batasaValid = Number.isSafeInteger(batasaNum) && batasaNum > 0;

  async function submitTopUp(e: FormEvent) {
    e.preventDefault();
    if (!batasaValid) return setTopError('Enter a whole number of Batasa greater than 0');
    if (!topRef.trim()) return setTopError('Payment reference is required — record a top-up only after payment is received');
    if (!rate) return setTopError('No top-up rate is in effect');
    if (!window.confirm(`Top up ${fmt(batasaNum)} Batasa for ${data?.hotel.name} at ${rupees(rate.price_paise_per_batasa)} per Batasa (${rupees(batasaNum * rate.price_paise_per_batasa)})?`)) return;
    setTopping(true); setTopError(''); setTopNotice('');
    try {
      const r = await topUpHotel(hotelId, batasaNum, topRef.trim());
      setTopNotice(r.duplicate
        ? `This payment reference was already credited (${fmt(r.entry.batasa)} Batasa) — nothing added.`
        : `Credited ${fmt(r.entry.batasa)} Batasa at ${rupees(r.applied_rate.price_paise_per_batasa)} per Batasa.`);
      setTopBatasa(''); setTopRef('');
      load();
    } catch (err) {
      setTopError((err as Error).message);
    } finally {
      setTopping(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const recon = data?.reconciliation;

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{data?.hotel.name ?? 'Hotel'} — Batasa</h2>
            <p className="text-xs text-gray-500">Hotel ledger · 1 Batasa = ₹1</p>
          </div>
          <button onClick={onClose} className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">Close</button>
        </div>

        {error && <div className="m-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {!data && !error && <div className="p-6 text-gray-500">Loading…</div>}

        {data && (
          <div className="space-y-6 p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <BalanceCard label="General" value={data.balances.general} explanation={data.balances.explanation.general} tone="green" />
              <BalanceCard label="Promotion-only" value={data.balances.promotion_only} explanation={data.balances.explanation.promotion_only} tone="gold" />
            </div>

            <div className={`rounded-lg border px-4 py-3 text-sm ${recon?.ok ? 'border-green-100 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
              {recon?.ok ? (
                <>✓ Reconciled: both balances equal the sum of their ledger rows.</>
              ) : (
                <>
                  <p className="font-semibold">Reconciliation mismatch — do not move Batasa for this hotel until it is investigated.</p>
                  <ul className="mt-1 list-disc pl-5">
                    {recon?.mismatches.map((m) => (
                      <li key={m.bucket}>{BUCKET_LABEL[m.bucket]}: balance {m.balance}, ledger sum {m.ledger_sum} (difference {m.difference})</li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <form onSubmit={submitGrant} className="rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-800">Founding grant</h3>
                {data.founding_grant ? (
                  <p className="mt-2 text-sm text-gray-600">
                    Given {new Date(data.founding_grant.created_at).toLocaleDateString('en-IN')}: {fmt(data.founding_grant.batasa)} Batasa
                    (payment ref {data.founding_grant.payment_reference}). One per hotel, ever.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">Credited once to the general balance. The amount is set in network config (founding_grant_batasa).</p>
                )}
                <input
                  value={grantRef}
                  onChange={(e) => setGrantRef(e.target.value)}
                  disabled={!!data.founding_grant || granting}
                  placeholder="Payment reference"
                  className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                />
                {grantError && <p className="mt-2 text-xs text-red-600">{grantError}</p>}
                <button
                  type="submit"
                  disabled={!!data.founding_grant || granting}
                  className="mt-3 w-full cursor-pointer rounded-lg bg-[#143D2D] px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {data.founding_grant ? 'Founding grant used' : granting ? 'Granting…' : 'Give founding grant'}
                </button>
              </form>

              <form onSubmit={submitTopUp} className="rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-800">Top up (after payment is received)</h3>
                <p className="mt-2 text-xs text-gray-600">
                  {rate
                    ? <>Rate that will apply: <strong>{rupees(rate.price_paise_per_batasa)}</strong> per Batasa ({rate.scope === 'hotel' ? 'this hotel\'s rate' : 'network default'}, from {new Date(rate.effective_from).toLocaleDateString('en-IN')}).</>
                    : <span className="text-red-600">No top-up rate is in effect. Add a network default or a hotel rate in Top-up Rates first.</span>}
                </p>
                <input
                  value={topBatasa}
                  onChange={(e) => setTopBatasa(e.target.value.replace(/[^0-9]/g, ''))}
                  inputMode="numeric"
                  placeholder="Batasa"
                  className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <input
                  value={topRef}
                  onChange={(e) => setTopRef(e.target.value)}
                  placeholder="Payment reference (one payment can only be credited once)"
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                {rate && batasaValid && (
                  <p className="mt-2 text-xs text-gray-600">Payment expected: {rupees(batasaNum * rate.price_paise_per_batasa)}</p>
                )}
                {topError && <p className="mt-2 text-xs text-red-600">{topError}</p>}
                {topNotice && <p className="mt-2 text-xs text-green-700">{topNotice}</p>}
                <button
                  type="submit"
                  disabled={!rate || topping}
                  className="mt-3 w-full cursor-pointer rounded-lg bg-[#143D2D] px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {topping ? 'Crediting…' : 'Credit top-up'}
                </button>
              </form>
            </div>

            <AdjustmentForm
              hotelId={hotelId}
              hotelName={data.hotel.name}
              balances={{ general: data.balances.general, promotion_only: data.balances.promotion_only }}
              onDone={(msg) => { setAdjustNotice(msg); load(); }}
            />
            {adjustNotice && <p className="-mt-4 text-xs text-green-700">{adjustNotice}</p>}

            <HotelStatementSection hotelId={hotelId} refreshKey={data.total} />

            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-800">Ledger ({fmt(data.total)} entries)</h3>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-gray-600">
                      <th className="px-3 py-2 font-medium">When</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Balance</th>
                      <th className="px-3 py-2 text-right font-medium">Batasa</th>
                      <th className="px-3 py-2 text-right font-medium">After</th>
                      <th className="px-3 py-2 font-medium">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((e: HotelLedgerEntry) => (
                      <tr key={e.id} className="border-b border-gray-50">
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600">{new Date(e.created_at).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-gray-800">{TXN_LABEL[e.txn_type] ?? e.txn_type}</td>
                        <td className="px-3 py-2 text-gray-600">{BUCKET_LABEL[e.bucket]}</td>
                        <td className={`px-3 py-2 text-right font-medium ${e.batasa < 0 ? 'text-red-600' : 'text-green-700'}`}>{e.batasa > 0 ? '+' : ''}{fmt(e.batasa)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmt(e.balance_after)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {e.payment_reference
                            ? `Payment ${e.payment_reference}`
                            : e.reference_type === 'admin_reference'
                            ? `Ref ${e.reference_id}`
                            : e.reference_type ? `${e.reference_type} ${e.reference_id?.slice(0, 8) ?? ''}` : e.txn_type === 'adjustment' ? '' : '—'}
                          {e.reason && <span className="block text-gray-600">{e.reason}</span>}
                          {e.price_paise_per_batasa != null && ` · ${rupees(e.price_paise_per_batasa)}/Batasa`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.entries.length === 0 && <div className="py-8 text-center text-sm text-gray-400">No ledger entries yet</div>}
              </div>
              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-end gap-2 text-sm">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="cursor-pointer rounded-lg px-3 py-1 hover:bg-gray-100 disabled:opacity-40">Previous</button>
                  <span className="text-gray-500">Page {page} of {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="cursor-pointer rounded-lg px-3 py-1 hover:bg-gray-100 disabled:opacity-40">Next</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
