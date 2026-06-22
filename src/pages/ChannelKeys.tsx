import { useEffect, useState } from 'react';
import {
  getChannelKeys,
  createChannelKey,
  revokeChannelKey,
  type ChannelKeyHotel,
  type ChannelKey,
} from '../api.ts';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={copy}
      className="ml-2 px-2 py-0.5 rounded text-xs border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function HotelKeyCard({ hotel, onRefresh }: { hotel: ChannelKeyHotel; onRefresh: () => void }) {
  const [label, setLabel] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [err, setErr] = useState('');

  async function generate() {
    if (!label.trim()) return;
    setGenerating(true);
    setErr('');
    try {
      await createChannelKey(hotel.hotel_id, label.trim());
      setLabel('');
      setShowForm(false);
      onRefresh();
    } catch (e: unknown) {
      setErr((e as Error).message ?? 'Failed to generate key');
    } finally {
      setGenerating(false);
    }
  }

  async function revoke(key: ChannelKey) {
    if (!confirm(`Revoke key "${key.label}"? This cannot be undone.`)) return;
    setRevoking(key.id);
    try {
      await revokeChannelKey(key.id);
      onRefresh();
    } catch {
      // ignore
    } finally {
      setRevoking(null);
    }
  }

  const active = hotel.keys.filter((k) => k.is_active);
  const revoked = hotel.keys.filter((k) => !k.is_active);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">{hotel.hotel_name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{hotel.city}</p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setErr(''); }}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[#143D2D]/20 text-[#143D2D] hover:bg-[#143D2D]/5 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Generate key'}
        </button>
      </div>

      {showForm && (
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Key label (e.g. Production, MakeMyTrip)"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#143D2D]/40"
            onKeyDown={(e) => { if (e.key === 'Enter') { void generate(); } }}
          />
          <button
            onClick={() => { void generate(); }}
            disabled={generating || !label.trim()}
            className="text-xs font-semibold px-4 py-2 rounded-lg bg-[#143D2D] text-white disabled:opacity-40 hover:bg-[#143D2D]/90 transition-colors"
          >
            {generating ? 'Generating…' : 'Generate'}
          </button>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
      )}

      {hotel.keys.length === 0 ? (
        <div className="px-5 py-6 text-sm text-gray-400">No API keys yet — generate one above.</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {active.map((key) => (
            <div key={key.id} className="px-5 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-700">{key.label}</p>
                <div className="flex items-center mt-1">
                  <code className="text-xs text-gray-500 font-mono truncate">{key.api_key}</code>
                  <CopyButton text={key.api_key} />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Created {new Date(key.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Active</span>
              <button
                onClick={() => { void revoke(key); }}
                disabled={revoking === key.id}
                className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
              >
                {revoking === key.id ? 'Revoking…' : 'Revoke'}
              </button>
            </div>
          ))}
          {revoked.map((key) => (
            <div key={key.id} className="px-5 py-3 flex items-center gap-4 opacity-50">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-500">{key.label}</p>
                <code className="text-xs text-gray-400 font-mono truncate block mt-1">{key.api_key}</code>
              </div>
              <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-400">Revoked</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChannelKeys() {
  const [hotels, setHotels] = useState<ChannelKeyHotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await getChannelKeys();
      setHotels(data.hotels);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Channel API Keys</h1>
        <p className="text-sm text-gray-500 mt-1">
          Bearer token authentication for the channel manager API (<code className="bg-gray-100 px-1 rounded">/channel/*</code>).
          Each key is scoped to a single hotel. Pass as <code className="bg-gray-100 px-1 rounded">Authorization: Bearer &lt;key&gt;</code>.
        </p>
      </div>

      {hotels.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-sm text-gray-400">
          No active hotels found.
        </div>
      ) : (
        hotels.map((hotel) => (
          <HotelKeyCard key={hotel.hotel_id} hotel={hotel} onRefresh={() => { void load(); }} />
        ))
      )}
    </div>
  );
}
