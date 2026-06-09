import { useEffect, useState } from 'react';
import { getTransactions, type Transaction } from '../api.ts';

const TYPE_COLORS: Record<string, string> = {
  earn: 'bg-green-100 text-green-700',
  redeem: 'bg-blue-100 text-blue-700',
  expire: 'bg-gray-100 text-gray-600',
};

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize ${cls}`}>
      {type}
    </span>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function memberLabel(t: Transaction) {
  if (!t.member) return '—';
  return t.member.name ?? t.member.mobile ?? t.member.email ?? '—';
}

export default function Transactions() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    getTransactions(page)
      .then((d) => { setTxns(d.transactions); setTotal(d.total); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <div className="text-sm text-gray-500">{total.toLocaleString()} total entries</div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Member</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Hotel</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Points</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center text-gray-400 py-12">Loading…</td></tr>
            ) : error ? (
              <tr><td colSpan={6} className="text-center text-red-600 py-12">{error}</td></tr>
            ) : txns.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-gray-400 py-12">No transactions</td></tr>
            ) : txns.map((t, i) => (
              <tr key={t.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{memberLabel(t)}</div>
                  {t.member?.mobile && t.member.name && (
                    <div className="text-xs text-gray-400">{t.member.mobile}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{t.hotel?.name ?? '—'}</td>
                <td className="px-4 py-3 text-center"><TypeBadge type={t.txn_type} /></td>
                <td className={`px-4 py-3 text-right font-semibold ${t.txn_type === 'earn' ? 'text-green-700' : t.txn_type === 'redeem' ? 'text-blue-700' : 'text-gray-600'}`}>
                  {t.txn_type === 'earn' ? '+' : t.txn_type === 'redeem' ? '−' : ''}{Math.abs(t.points).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-500 capitalize">{t.booking_type ?? '—'}</td>
                <td className="px-4 py-3 text-right text-gray-500">{fmt(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
