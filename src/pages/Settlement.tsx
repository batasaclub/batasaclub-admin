import { useEffect, useState } from 'react';
import {
  getSettlementHotels,
  getReserveHealth,
  runSettlement,
  markPaid,
  type SettlementRow,
  type ReserveHealth,
} from '../api.ts';

function paise(v: number) {
  return '₹' + (v / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    overdue: 'bg-red-100 text-red-700',
  };
  const cls = map[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}

function ReservePanel({ health }: { health: ReserveHealth }) {
  const bad = health.flags.below_min_coverage || health.flags.liability_exceeds_cap;
  return (
    <div className={`rounded-xl p-5 border ${bad ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className={`text-sm font-bold ${bad ? 'text-red-700' : 'text-green-700'}`}>
          Reserve Pool Health — {bad ? 'WARNING' : 'Healthy'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">Pool Balance</div>
          <div className="font-bold text-gray-900">{paise(health.reserve_balance_paise)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Coverage Ratio</div>
          <div className={`font-bold ${health.flags.below_min_coverage ? 'text-red-600' : 'text-green-700'}`}>
            {health.coverage_ratio === 999 ? '∞' : `${health.coverage_ratio.toFixed(2)}x`}
            <span className="text-xs font-normal text-gray-400 ml-1">(min 1.25x)</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Point Liability</div>
          <div className={`font-bold ${health.flags.liability_exceeds_cap ? 'text-red-600' : 'text-gray-900'}`}>
            {paise(health.point_liability_paise)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Expected 12-mo</div>
          <div className="font-bold text-gray-900">{paise(health.expected_12mo_reimbursement_paise)}</div>
        </div>
      </div>
      {health.flags.below_min_coverage && (
        <div className="mt-3 text-xs text-red-600 font-medium">⚠ Reserve below 1.25× 12-month obligation</div>
      )}
      {health.flags.liability_exceeds_cap && (
        <div className="mt-1 text-xs text-red-600 font-medium">⚠ Point liability exceeds 3× reserve pool</div>
      )}
    </div>
  );
}

export default function Settlement() {
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [health, setHealth] = useState<ReserveHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string>('');
  const [marking, setMarking] = useState<string | null>(null);

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}-01`;
  const [month, setMonth] = useState(defaultMonth);

  function load() {
    Promise.all([getSettlementHotels(), getReserveHealth()])
      .then(([s, h]) => { setRows(s.hotels); setHealth(h); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleRun() {
    setRunning(true);
    setRunResult('');
    try {
      const res = await runSettlement(month);
      setRunResult(`Done — processed ${res.processed}, skipped ${res.skipped}`);
      load();
    } catch (e) {
      setRunResult('Error: ' + (e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function handleMarkPaid(settlementId: string) {
    setMarking(settlementId);
    try {
      await markPaid(settlementId, 'bank_transfer');
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setMarking(null);
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settlement</h1>

      {/* Run settlement panel */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
        <div className="text-sm font-medium text-gray-700 mb-3">Run Monthly Settlement</div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="month"
            value={month.slice(0, 7)}
            onChange={(e) => setMonth(e.target.value + '-01')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#143D2D]"
          />
          <button
            onClick={handleRun}
            disabled={running}
            className="bg-[#143D2D] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#1b5238] transition-colors disabled:opacity-60 cursor-pointer"
          >
            {running ? 'Running…' : 'Run Settlement'}
          </button>
          {runResult && (
            <span className={`text-sm font-medium ${runResult.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>
              {runResult}
            </span>
          )}
        </div>
      </div>

      {/* Reserve health */}
      {health && <ReservePanel health={health} />}

      {/* Hotels table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 font-medium text-gray-700">
          Hotel Settlement Status — Current Month
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Hotel</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Contribution</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Reimbursements</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Net Payable</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Float</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const s = r.latest_settlement;
              return (
                <tr key={r.hotel_id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.hotel_name}</div>
                    <div className="text-xs text-gray-400">{r.city}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {paise(r.current_month.contribution_paise)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {s ? paise(Number(s.redemptions_paise)) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {s ? (
                      <span className={Number(s.net_payable_paise) < 0 ? 'text-green-600' : 'text-gray-900'}>
                        {paise(Number(s.net_payable_paise))}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s ? <StatusPill status={s.payment_status} /> : <span className="text-gray-400 text-xs">Not run</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium ${r.float_status.issuance_allowed ? 'text-green-600' : 'text-red-600'}`}>
                      {r.float_status.issuance_allowed ? '✓' : '✗ Suspended'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s && s.payment_status === 'pending' && (
                      <button
                        onClick={() => handleMarkPaid(s.id)}
                        disabled={marking === s.id}
                        className="text-xs px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {marking === s.id ? '…' : 'Mark Paid'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="text-center text-gray-400 py-12">No settlement data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
