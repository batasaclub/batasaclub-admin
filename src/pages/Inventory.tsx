import { useEffect, useState } from 'react';
import { getInventoryMonitoring, type InventoryRow } from '../api.ts';

function pct(row: InventoryRow) {
  return row.available_pct !== null ? row.available_pct : null;
}

function StatusBadge({ row }: { row: InventoryRow }) {
  if (row.is_zero) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
      ⚠ Zero
    </span>
  );
  if (row.is_low) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
      ↓ Low
    </span>
  );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
      ✓ OK
    </span>
  );
}

export default function Inventory() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'zero'>('all');

  useEffect(() => {
    getInventoryMonitoring()
      .then(setRows)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function exportCSV() {
    const headers = ['Hotel', 'City', 'Rooms', 'Available Batasa', 'Minimum Batasa', 'Available %', 'Status'];
    const csvRows = filtered.map(r => [
      r.hotel_name, r.city, r.total_rooms,
      r.available_batasa, r.minimum_batasa,
      r.available_pct !== null ? r.available_pct + '%' : '—',
      r.is_zero ? 'Zero' : r.is_low ? 'Low' : 'OK'
    ]);
    const csv = [headers, ...csvRows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `inventory-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const filtered = rows.filter(r => {
    if (filter === 'zero') return r.is_zero;
    if (filter === 'low') return r.is_low || r.is_zero;
    return true;
  });

  const zeroCount = rows.filter(r => r.is_zero).length;
  const lowCount = rows.filter(r => r.is_low && !r.is_zero).length;

  if (loading) return <div className="p-8 text-gray-500">Loading inventory…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Monitoring</h1>
          <p className="text-sm text-gray-500 mt-0.5">Batasa inventory levels across all active hotels</p>
        </div>
        <button onClick={exportCSV}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#143D2D] text-white hover:bg-[#1e5540] transition-colors">
          ↓ Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Total Hotels</div>
          <div className="text-2xl font-bold text-gray-900">{rows.length}</div>
        </div>
        <div className={`bg-white rounded-xl p-5 border shadow-sm ${zeroCount > 0 ? 'border-red-300' : 'border-gray-100'}`}>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Zero Inventory</div>
          <div className={`text-2xl font-bold ${zeroCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{zeroCount}</div>
          {zeroCount > 0 && <div className="text-xs text-red-500 mt-1">Issuance suspended</div>}
        </div>
        <div className={`bg-white rounded-xl p-5 border shadow-sm ${lowCount > 0 ? 'border-amber-300' : 'border-gray-100'}`}>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Low Inventory</div>
          <div className={`text-2xl font-bold ${lowCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{lowCount}</div>
          {lowCount > 0 && <div className="text-xs text-amber-500 mt-1">Below 20% of minimum</div>}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'low', 'zero'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === f ? 'bg-[#143D2D] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}>
            {f === 'all' ? `All (${rows.length})` : f === 'low' ? `Low / Zero (${lowCount + zeroCount})` : `Zero (${zeroCount})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['Hotel', 'City', 'Rooms', 'Available', 'Minimum', 'Coverage', 'Bar', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">No hotels match this filter</td></tr>
            ) : filtered.map((row, i) => {
              const p = pct(row);
              const barColor = row.is_zero ? '#dc2626' : row.is_low ? '#d97706' : '#143D2D';
              return (
                <tr key={row.hotel_id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${row.is_zero ? 'bg-red-50/40' : row.is_low ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.hotel_name}</td>
                  <td className="px-4 py-3 text-gray-500">{row.city}</td>
                  <td className="px-4 py-3 text-gray-700">{row.total_rooms}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{row.available_batasa.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-gray-500">{row.minimum_batasa.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: barColor }}>
                    {p !== null ? `${p}%` : '—'}
                  </td>
                  <td className="px-4 py-3 w-32">
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(p ?? 0, 100)}%`, backgroundColor: barColor }} />
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge row={row} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
