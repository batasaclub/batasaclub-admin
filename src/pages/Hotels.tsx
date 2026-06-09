import { useEffect, useState } from 'react';
import { getHotels, freezeHotel, type Hotel } from '../api.ts';

const SLAB_COLORS: Record<string, string> = {
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  green: 'bg-green-100 text-green-700',
};

function SlabBadge({ slab }: { slab: string }) {
  const cls = SLAB_COLORS[slab.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${cls}`}>
      {slab}
    </span>
  );
}

function paise(v: number) {
  return '₹' + (v / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function Hotels() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  function load() {
    setLoading(true);
    getHotels()
      .then((d) => setHotels(d.hotels))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleFreeze(hotel: Hotel) {
    setToggling(hotel.id);
    const currentlySuspended = hotel.hotel_security_float?.status === 'suspended';
    try {
      await freezeHotel(hotel.id, !currentlySuspended);
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setToggling(null);
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Hotels ({hotels.length})</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Hotel</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">City</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Slab</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Enrol Rate</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Monthly Fee</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Pay Score</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Float Status</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Issuance</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {hotels.map((h, i) => {
              const suspended = h.hotel_security_float?.status === 'suspended';
              return (
                <tr key={h.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{h.name}</td>
                  <td className="px-4 py-3 text-gray-600">{h.city}</td>
                  <td className="px-4 py-3 text-center">
                    <SlabBadge slab={h.slab} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {(Number(h.enrol_rate) * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{paise(h.monthly_fee_paise)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${h.payment_score < 70 ? 'text-red-600' : h.payment_score < 85 ? 'text-amber-600' : 'text-green-600'}`}>
                      {h.payment_score}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {h.hotel_security_float ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${suspended ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {suspended ? 'Suspended' : 'Active'}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">No float</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {h.issuance_frozen ? (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">
                        Frozen
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleFreeze(h)}
                      disabled={toggling === h.id}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                        suspended
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-red-50 text-red-700 hover:bg-red-100'
                      }`}
                    >
                      {toggling === h.id ? '…' : suspended ? 'Unfreeze' : 'Freeze'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {hotels.length === 0 && (
          <div className="text-center text-gray-400 py-12">No hotels found</div>
        )}
      </div>
    </div>
  );
}
