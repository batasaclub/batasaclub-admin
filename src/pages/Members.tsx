import { useEffect, useState } from 'react';
import { getMembers, type Member } from '../api.ts';

const TIER_COLORS: Record<string, string> = {
  silver: 'bg-gray-100 text-gray-700',
  elite: 'bg-[#C79A3B]/20 text-[#8B6A1F]',
  ambassador: 'bg-[#143D2D]/15 text-[#143D2D]',
};

function TierBadge({ tier }: { tier: string }) {
  const cls = TIER_COLORS[tier.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize ${cls}`}>
      {tier}
    </span>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    getMembers(query || undefined, page)
      .then((d) => { setMembers(d.members); setTotal(d.total); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query, page]);

  function handleSearch() {
    setPage(1);
    setQuery(search);
  }

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by mobile, email or name…"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#143D2D]"
          />
          <button
            onClick={handleSearch}
            className="bg-[#143D2D] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1b5238] transition-colors cursor-pointer"
          >
            Search
          </button>
          {query && (
            <button
              onClick={() => { setSearch(''); setQuery(''); setPage(1); }}
              className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="text-sm text-gray-500 mb-3">{total.toLocaleString()} members{query && ` matching "${query}"`}</div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Tier</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Batasa Balance</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Stays (yr)</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Corporate</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center text-gray-400 py-12">Loading…</td></tr>
            ) : error ? (
              <tr><td colSpan={7} className="text-center text-red-600 py-12">{error}</td></tr>
            ) : members.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-gray-400 py-12">No members found</td></tr>
            ) : members.map((m, i) => (
              <tr key={m.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{m.name ?? <span className="text-gray-400 italic">—</span>}</td>
                <td className="px-4 py-3 text-gray-600">
                  <div>{m.mobile ?? ''}</div>
                  {m.email && <div className="text-xs text-gray-400">{m.email}</div>}
                </td>
                <td className="px-4 py-3 text-center"><TierBadge tier={m.tier} /></td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{m.total_points.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-600">{m.stay_count_yr}</td>
                <td className="px-4 py-3 text-center">
                  {m.is_corporate_verified ? (
                    <span className="text-green-600 font-medium text-xs">✓ Verified</span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">{fmt(m.created_at)}</td>
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
