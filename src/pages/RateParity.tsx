import { useEffect, useState } from 'react';
import { getAdminRateParity, type RateParityLog } from '../api.ts';

function rupees(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function RateParity() {
  const [logs, setLogs] = useState<RateParityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminRateParity()
      .then(({ logs: fetched }) => setLogs(fetched))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Loading rate parity log…</div>;
  if (error)   return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rate Parity Log</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Auto-adjustments to member rates when OTA rates were updated — last 30 days, all hotels.
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="text-3xl mb-3 text-gray-300">⊞</div>
          <p className="text-sm font-medium text-gray-600">No rate adjustments in the last 30 days</p>
          <p className="text-xs text-gray-400 mt-1">Member rates are current across the network.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-[#143D2D] px-5 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
              {logs.length} adjustment{logs.length !== 1 ? 's' : ''} · last 30 days
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Hotel', 'Room', 'OTA Rate', 'Prev Member Rate', 'New Member Rate', 'Discount', 'Date'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((row, i) => (
                  <tr key={row.id} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {row.hotel_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {row.room_name}
                      {row.room_type && (
                        <span className="text-gray-400 font-normal"> · {row.room_type}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 tabular-nums">
                      {rupees(row.ota_rate_paise)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 tabular-nums">
                      {row.previous_member_rate_paise != null ? rupees(row.previous_member_rate_paise) : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: '#C79A3B' }}>
                      {rupees(row.new_member_rate_paise)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 tabular-nums">
                      {row.discount_pct_applied}%
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap tabular-nums">
                      {new Date(row.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
