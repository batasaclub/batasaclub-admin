import { useEffect, useState } from 'react';
import { getReviews, getHotels, type Review, type Hotel } from '../api.ts';

const SCORE_FIELDS: { key: keyof Review; label: string }[] = [
  { key: 'welcome_experience', label: 'Welcome' },
  { key: 'room_quality', label: 'Room' },
  { key: 'staff_responsiveness', label: 'Staff' },
  { key: 'direct_booking_value', label: 'Value' },
  { key: 'would_return', label: 'Return' },
  { key: 'host_experience', label: 'Host' },
];

function avgScore(r: Review): number | null {
  const vals = SCORE_FIELDS.map((f) => r[f.key] as number | null).filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function ScoreCell({ val }: { val: number | null }) {
  if (val == null) return <td className="px-2 py-3 text-center text-gray-300 text-xs">—</td>;
  const low = val < 4;
  return (
    <td className={`px-2 py-3 text-center text-xs font-semibold ${low ? 'text-red-600' : 'text-gray-700'}`}>
      {val}
    </td>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hotelFilter, setHotelFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getHotels().then((d) => setHotels(d.hotels)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    getReviews(hotelFilter || undefined, page)
      .then((d) => { setReviews(d.reviews); setTotal(d.total); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [hotelFilter, page]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
        <select
          value={hotelFilter}
          onChange={(e) => { setHotelFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#143D2D]"
        >
          <option value="">All Hotels</option>
          {hotels.map((h) => (
            <option key={h.id} value={h.id}>{h.name} — {h.city}</option>
          ))}
        </select>
      </div>

      <div className="text-sm text-gray-500 mb-3">{total.toLocaleString()} reviews</div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Hotel</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Member</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Date</th>
              {SCORE_FIELDS.map((f) => (
                <th key={f.key} className="text-center px-2 py-3 font-medium text-gray-600 text-xs">{f.label}</th>
              ))}
              <th className="text-center px-3 py-3 font-medium text-gray-600 text-xs">Avg</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-center text-gray-400 py-12">Loading…</td></tr>
            ) : error ? (
              <tr><td colSpan={10} className="text-center text-red-600 py-12">{error}</td></tr>
            ) : reviews.length === 0 ? (
              <tr><td colSpan={10} className="text-center text-gray-400 py-12">No reviews found</td></tr>
            ) : reviews.map((r, i) => {
              const avg = avgScore(r);
              const flagRow = avg != null && avg < 4;
              return (
                <tr
                  key={r.id}
                  className={`border-b border-gray-50 ${flagRow ? 'bg-red-50' : i % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.hotels?.name ?? '—'}</div>
                    <div className="text-xs text-gray-400">{r.hotels?.city}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.members?.name ?? r.members?.mobile ?? '—'}
                    {r.bookings && <div className="text-xs text-gray-400">{r.bookings.booking_ref}</div>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{fmt(r.created_at)}</td>
                  {SCORE_FIELDS.map((f) => (
                    <ScoreCell key={f.key} val={r[f.key] as number | null} />
                  ))}
                  <td className={`px-3 py-3 text-center text-xs font-bold ${flagRow ? 'text-red-600' : 'text-gray-900'}`}>
                    {avg ?? '—'}
                  </td>
                </tr>
              );
            })}
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
