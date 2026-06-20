import { useEffect, useState } from 'react';
import { getAdrBands, updateAdrBand, type AdrBand } from '../api.ts';

interface RowState {
  consumption_rate: string;
  label: string;
  saving: boolean;
  saved: boolean;
  error: string;
}

function rupees(n: number | null): string {
  if (n === null) return '∞';
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function AdrBands() {
  const [bands, setBands] = useState<AdrBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Record<string, RowState>>({});

  useEffect(() => {
    getAdrBands()
      .then(({ bands: fetched }) => {
        setBands(fetched);
        const init: Record<string, RowState> = {};
        fetched.forEach(b => {
          init[b.id] = {
            consumption_rate: String(b.consumption_rate),
            label: b.label,
            saving: false,
            saved: false,
            error: '',
          };
        });
        setRows(init);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function setField(id: string, field: 'consumption_rate' | 'label', value: string) {
    setRows(prev => ({
      ...prev,
      [id]: { ...prev[id]!, [field]: value, saved: false, error: '' },
    }));
  }

  function isDirty(band: AdrBand): boolean {
    const r = rows[band.id];
    if (!r) return false;
    return (
      parseFloat(r.consumption_rate) !== parseFloat(band.consumption_rate) ||
      r.label !== band.label
    );
  }

  async function save(band: AdrBand) {
    const r = rows[band.id];
    if (!r) return;
    const rate = parseFloat(r.consumption_rate);
    if (isNaN(rate) || rate <= 0) {
      setRows(prev => ({ ...prev, [band.id]: { ...prev[band.id]!, error: 'Must be a positive number' } }));
      return;
    }
    setRows(prev => ({ ...prev, [band.id]: { ...prev[band.id]!, saving: true, error: '' } }));
    try {
      const { band: updated } = await updateAdrBand(band.id, {
        consumption_rate: rate,
        label: r.label.trim(),
      });
      setBands(prev => prev.map(b => b.id === band.id ? updated : b));
      setRows(prev => ({
        ...prev,
        [band.id]: {
          consumption_rate: String(updated.consumption_rate),
          label: updated.label,
          saving: false,
          saved: true,
          error: '',
        },
      }));
    } catch (e) {
      setRows(prev => ({
        ...prev,
        [band.id]: {
          ...prev[band.id]!,
          saving: false,
          error: e instanceof Error ? e.message : 'Save failed',
        },
      }));
    }
  }

  async function toggleActive(band: AdrBand) {
    try {
      const { band: updated } = await updateAdrBand(band.id, { is_active: !band.is_active });
      setBands(prev => prev.map(b => b.id === band.id ? updated : b));
    } catch {
      // toggle reverts naturally since band state didn't change
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading ADR bands…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ADR Bands</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Consumption rate controls redemption value — at 1.15×, a guest spends 1.15 Batasa to unlock ₹1.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Min ADR', 'Max ADR', 'Label', 'Consumption Rate', 'Active', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bands.map((band, i) => {
              const r = rows[band.id];
              const dirty = isDirty(band);
              const active = band.is_active ?? false;
              return (
                <tr
                  key={band.id}
                  className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} ${!active ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3 font-semibold text-gray-900 tabular-nums">
                    {rupees(band.adr_min_rupees)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 tabular-nums">
                    {rupees(band.adr_max_rupees)}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={r?.label ?? band.label}
                      onChange={e => setField(band.id, 'label', e.target.value)}
                      className="w-48 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#143D2D] focus:ring-1 focus:ring-[#143D2D]/20"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={r?.consumption_rate ?? band.consumption_rate}
                        onChange={e => setField(band.id, 'consumption_rate', e.target.value)}
                        className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#143D2D] focus:ring-1 focus:ring-[#143D2D]/20 tabular-nums"
                      />
                      <span className="text-xs text-gray-400">×</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(band)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                        active ? 'bg-[#143D2D]' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        active ? 'translate-x-[18px]' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      {dirty && (
                        <button
                          onClick={() => save(band)}
                          disabled={r?.saving}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#143D2D] text-white hover:bg-[#1e5540] disabled:opacity-60 transition-colors"
                        >
                          {r?.saving ? 'Saving…' : 'Save'}
                        </button>
                      )}
                      {r?.saved && !dirty && (
                        <span className="text-xs font-medium text-green-600">✓ Saved</span>
                      )}
                      {r?.error && (
                        <span className="text-xs text-red-600">{r.error}</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
        <p className="text-xs text-amber-800">
          <strong>Note:</strong> Changes apply to new bookings immediately. Existing hotels retain their current consumption rate until the ADR job runs at month-end.
        </p>
      </div>
    </div>
  );
}
