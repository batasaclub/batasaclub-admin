import { useEffect, useState, type FormEvent } from 'react';
import { addTopupRate, getHotels, getTopupRates, type Hotel, type TopupRate } from '../api.ts';

// Price a hotel pays per Batasa on a top-up. The network default applies to every hotel without its
// own rate; a hotel rate overrides it. Rates are never edited: a new rate is a new row, effective
// from its date. A top-up uses the latest rate in effect on the day it is credited.

const rupees = (paise: number) => '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TopupRates() {
  const [rates, setRates] = useState<TopupRate[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scope, setScope] = useState<string>('network'); // 'network' or a hotel id
  const [price, setPrice] = useState('');
  const [from, setFrom] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [filter, setFilter] = useState<string>('');

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => { setLoading(true); setReloadKey((k) => k + 1); };
  useEffect(() => {
    let live = true;
    Promise.all([getTopupRates(filter || undefined), getHotels()])
      .then(([r, h]) => { if (live) { setRates(r.rates); setHotels(h.hotels); setError(''); } })
      .catch((e: Error) => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [filter, reloadKey]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const rupeesValue = Number(price);
    const paise = Math.round(rupeesValue * 100);
    if (!Number.isFinite(rupeesValue) || paise <= 0 || Math.abs(rupeesValue * 100 - paise) > 1e-6) {
      return setFormError('Enter a price in rupees greater than 0, at most two decimals');
    }
    const effective = from ? new Date(from) : null;
    if (effective && Number.isNaN(effective.getTime())) return setFormError('Effective date is not valid');
    const target = scope === 'network' ? 'the network default' : hotels.find((h) => h.id === scope)?.name ?? 'this hotel';
    if (!window.confirm(`Set ${rupees(paise)} per Batasa for ${target}, effective ${effective ? effective.toLocaleString('en-IN') : 'now'}? Rates cannot be edited afterwards.`)) return;
    setSaving(true); setFormError('');
    try {
      await addTopupRate(scope === 'network' ? null : scope, paise, effective?.toISOString());
      setPrice(''); setFrom('');
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const current = rates.filter((r) => r.in_effect);
  const networkNow = current.find((r) => r.scope === 'network');

  return (
    <div className="p-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Top-up Rates</h1>
      <p className="mb-6 max-w-2xl text-sm text-gray-600">
        What a hotel pays per Batasa when it tops up its general balance. The network default applies to every hotel
        without its own rate; a hotel rate overrides it. A top-up uses the latest rate in effect on the day it is credited,
        and the ledger stores the rate it used.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800">In effect now</h2>
          <p className="mt-2 text-sm text-gray-700">
            Network default: {networkNow ? <strong>{rupees(networkNow.price_paise_per_batasa)}</strong> : <span className="text-red-600">none — every hotel without its own rate cannot be topped up</span>}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {current.filter((r) => r.scope === 'hotel').map((r) => (
              <li key={r.id}>{r.hotel_name ?? r.hotel_id}: <strong>{rupees(r.price_paise_per_batasa)}</strong> (override)</li>
            ))}
          </ul>
        </div>

        <form onSubmit={submit} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800">Add a rate</h2>
          <label className="mt-3 block text-xs font-medium text-gray-600">Applies to</label>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="network">Network default (all hotels without their own rate)</option>
            {hotels.map((h) => <option key={h.id} value={h.id}>{h.name} (override)</option>)}
          </select>
          <label className="mt-3 block text-xs font-medium text-gray-600">Price per Batasa (₹)</label>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="e.g. 0.90" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <label className="mt-3 block text-xs font-medium text-gray-600">Effective from (blank = now)</label>
          <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
          <button type="submit" disabled={saving} className="mt-4 w-full cursor-pointer rounded-lg bg-[#143D2D] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving ? 'Saving…' : 'Add rate'}
          </button>
        </form>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-800">History</h2>
        <select value={filter} onChange={(e) => { setLoading(true); setFilter(e.target.value); }} className="rounded-lg border border-gray-200 px-2 py-1 text-xs">
          <option value="">All</option>
          <option value="network">Network default</option>
          {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-gray-600">
              <th className="px-4 py-3 font-medium">Applies to</th>
              <th className="px-4 py-3 text-right font-medium">Price / Batasa</th>
              <th className="px-4 py-3 font-medium">Effective from</th>
              <th className="px-4 py-3 font-medium">Added</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => {
              const futureRate = new Date(r.effective_from) > new Date();
              return (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-gray-800">{r.scope === 'network' ? 'Network default' : r.hotel_name ?? r.hotel_id}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{rupees(r.price_paise_per_batasa)}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(r.effective_from).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(r.created_at).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    {r.in_effect
                      ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">In effect</span>
                      : futureRate
                      ? <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Scheduled</span>
                      : <span className="text-xs text-gray-400">Superseded</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && rates.length === 0 && <div className="py-10 text-center text-sm text-gray-400">No rates yet. Add a network default before the first top-up.</div>}
        {loading && <div className="py-10 text-center text-sm text-gray-400">Loading…</div>}
      </div>
    </div>
  );
}
