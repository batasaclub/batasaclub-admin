import { useEffect, useState } from 'react';
import { getHotelStatement, type HotelStatement, type LedgerBucket } from '../api.ts';

// Monthly statement of one hotel (replaces the retired v1 settlement): GET /admin/hotels/:id/statement.
// Read-only, computed by the API from the hotel Batasa ledger. Months are India time (Asia/Kolkata).

const TXN_LABEL: Record<string, string> = {
  founding_grant: 'Founding grant',
  top_up: 'Top-ups',
  redemption_credit: 'Guest redemptions',
  redemption_reversal: 'Redemption reversals',
  review_reward_debit: 'Review rewards',
  gift_to_guest: 'Guest compensation',
  promotion_spend: 'Promotions',
  adjustment: 'Adjustments',
};
const BUCKETS: { key: LedgerBucket; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'promotion_only', label: 'Promotion-only' },
];

const fmt = (n: number) => n.toLocaleString('en-IN');
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '0');

function currentMonthKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
}
function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// refreshKey: bump it after a ledger write in the panel so the statement re-reads.
export default function HotelStatementSection({ hotelId, refreshKey }: { hotelId: string; refreshKey: number }) {
  const current = currentMonthKey();
  const [month, setMonth] = useState(current);
  const [result, setResult] = useState<{ key: string; data: HotelStatement | null; error: string } | null>(null);
  const requestKey = `${hotelId}|${month}|${refreshKey}`;

  useEffect(() => {
    let live = true;
    getHotelStatement(hotelId, month)
      .then((d) => { if (live) setResult({ key: requestKey, data: d, error: '' }); })
      .catch((e: Error) => { if (live) setResult({ key: requestKey, data: null, error: e.message }); });
    return () => { live = false; };
  }, [hotelId, month, requestKey]);

  const loading = result?.key !== requestKey;
  const data = loading ? null : result.data;
  const error = loading ? '' : result.error;
  const types = data?.totals_by_type.filter((t) => t.count > 0) ?? [];

  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-800">Monthly statement</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"
            className="cursor-pointer rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100">‹</button>
          <input type="month" value={month} max={current} aria-label="Statement month"
            onChange={(e) => { if (e.target.value && e.target.value <= current) setMonth(e.target.value); }}
            className="rounded-lg border border-gray-200 px-2 py-1 text-sm" />
          <button onClick={() => month < current && setMonth(shiftMonth(month, 1))} disabled={month >= current} aria-label="Next month"
            className="cursor-pointer rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-default disabled:text-gray-300">›</button>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        From the hotel ledger · India time{data && !data.complete ? ' · month in progress' : ''} · 1 Batasa = ₹1
      </p>

      {loading && <p className="mt-3 text-sm text-gray-500">Loading…</p>}
      {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {data && (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-600">
                  <th className="py-2 pr-3 font-medium">Balance</th>
                  <th className="py-2 pr-3 text-right font-medium">Opening</th>
                  <th className="py-2 pr-3 text-right font-medium">Credits</th>
                  <th className="py-2 pr-3 text-right font-medium">Debits</th>
                  <th className="py-2 text-right font-medium">Closing</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {BUCKETS.map(({ key, label }) => {
                  const b = data.buckets[key];
                  return (
                    <tr key={key} className="border-b border-gray-50">
                      <td className="py-2 pr-3 text-gray-800">{label}</td>
                      <td className="py-2 pr-3 text-right">{fmt(b.opening)}</td>
                      <td className="py-2 pr-3 text-right text-green-700">+{fmt(b.credits)}</td>
                      <td className="py-2 pr-3 text-right text-red-700">{b.debits ? `−${fmt(b.debits)}` : '0'}</td>
                      <td className="py-2 text-right font-semibold">{fmt(b.closing)}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="py-2 pr-3 font-semibold text-gray-800">Total</td>
                  <td className="py-2 pr-3 text-right">{fmt(data.totals.opening)}</td>
                  <td className="py-2 pr-3 text-right">+{fmt(data.totals.credits)}</td>
                  <td className="py-2 pr-3 text-right">{data.totals.debits ? `−${fmt(data.totals.debits)}` : '0'}</td>
                  <td className="py-2 text-right font-semibold">{fmt(data.totals.closing)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4 className="mt-4 text-xs font-semibold uppercase tracking-wider text-gray-500">By type ({fmt(data.entry_count)} entries)</h4>
          {types.length === 0 ? (
            <p className="mt-1 text-sm text-gray-400">No Batasa moved this month.</p>
          ) : (
            <table className="mt-1 w-full text-sm">
              <tbody className="tabular-nums">
                {types.map((t) => (
                  <tr key={t.txn_type} className="border-b border-gray-50">
                    <td className="py-1.5 pr-3 text-gray-700">{TXN_LABEL[t.txn_type] ?? t.txn_type}</td>
                    <td className="py-1.5 pr-3 text-right text-xs text-gray-500">{t.count} · general {signed(t.by_bucket.general)} · promotion-only {signed(t.by_bucket.promotion_only)}</td>
                    <td className="py-1.5 text-right font-medium">{signed(t.batasa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
