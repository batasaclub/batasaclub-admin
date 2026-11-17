import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { getHotels, freezeHotel, uploadHotelPhoto, updateHotelWhatsapp, getLedgerReconciliation, type Hotel, type ReconciliationReport } from '../api.ts';
import HotelLedgerPanel from '../components/HotelLedgerPanel.tsx';

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
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadError, setUploadError] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeHotelId = useRef<string | null>(null);
  const [whatsappDraft, setWhatsappDraft] = useState<Record<string, string>>({});
  const [savingWhatsapp, setSavingWhatsapp] = useState<Record<string, boolean>>({});
  const [whatsappError, setWhatsappError] = useState<Record<string, string>>({});
  const [ledgerHotelId, setLedgerHotelId] = useState<string | null>(null);
  const [recon, setRecon] = useState<ReconciliationReport | null>(null);
  const [reconError, setReconError] = useState('');

  function load() {
    setLoading(true);
    getHotels()
      .then((d) => setHotels(d.hotels))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    getLedgerReconciliation()
      .then((r) => { setRecon(r); setReconError(''); })
      .catch((e: Error) => setReconError(e.message));
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

  function handlePhotoClick(hotelId: string) {
    activeHotelId.current = hotelId;
    fileInputRef.current?.click();
  }

  async function handlePhotoSelected(e: ChangeEvent<HTMLInputElement>) {
    const hotelId = activeHotelId.current;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!hotelId || !file) return;

    setUploadError((prev) => ({ ...prev, [hotelId]: '' }));
    setUploading((prev) => ({ ...prev, [hotelId]: true }));
    try {
      const { photo_url } = await uploadHotelPhoto(hotelId, file);
      setHotels((prev) => prev.map((h) => (h.id === hotelId ? { ...h, photo_url } : h)));
    } catch (err) {
      setUploadError((prev) => ({ ...prev, [hotelId]: (err as Error).message }));
    } finally {
      setUploading((prev) => ({ ...prev, [hotelId]: false }));
    }
  }

  function handleWhatsappChange(hotelId: string, value: string) {
    setWhatsappDraft((prev) => ({ ...prev, [hotelId]: value }));
  }

  async function handleWhatsappSave(hotel: Hotel) {
    const value = whatsappDraft[hotel.id] ?? hotel.whatsapp_number ?? '';
    setWhatsappError((prev) => ({ ...prev, [hotel.id]: '' }));
    setSavingWhatsapp((prev) => ({ ...prev, [hotel.id]: true }));
    try {
      const { hotel: updated } = await updateHotelWhatsapp(hotel.id, value);
      setHotels((prev) => prev.map((h) => (h.id === hotel.id ? { ...h, whatsapp_number: updated.whatsapp_number } : h)));
    } catch (err) {
      setWhatsappError((prev) => ({ ...prev, [hotel.id]: (err as Error).message }));
    } finally {
      setSavingWhatsapp((prev) => ({ ...prev, [hotel.id]: false }));
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Hotels ({hotels.length})</h1>

      <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${reconError ? 'border-gray-200 bg-gray-50 text-gray-600' : recon?.ok ? 'border-green-100 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
        {reconError
          ? <>Batasa ledger reconciliation unavailable: {reconError}</>
          : !recon
          ? <>Checking Batasa ledger reconciliation…</>
          : recon.ok
          ? <>✓ Batasa ledger reconciled for all {recon.checked_hotels} hotels (both balances equal their ledger rows).</>
          : <>Batasa ledger mismatch at {new Set(recon.mismatches.map((m) => m.hotel_id)).size} hotel(s): {recon.mismatches.map((m) => `${m.hotel_name} (${m.bucket === 'general' ? 'general' : 'promotion-only'} ${m.difference})`).join(', ')}. Open the hotel's Batasa panel.</>}
      </div>

      {ledgerHotelId && <HotelLedgerPanel hotelId={ledgerHotelId} onClose={() => { setLedgerHotelId(null); load(); }} />}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handlePhotoSelected}
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Photo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Hotel</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">WhatsApp</th>
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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {h.photo_url ? (
                        <img src={h.photo_url} alt={h.name} className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300 text-xs">
                          No photo
                        </div>
                      )}
                      <button
                        onClick={() => handlePhotoClick(h.id)}
                        disabled={uploading[h.id]}
                        className="text-xs px-2 py-1 rounded-lg font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
                      >
                        {uploading[h.id] ? 'Uploading…' : h.photo_url ? 'Replace' : 'Upload'}
                      </button>
                    </div>
                    {uploadError[h.id] && (
                      <p className="text-xs text-red-600 mt-1">{uploadError[h.id]}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{h.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="e.g. 919876543210"
                        value={whatsappDraft[h.id] ?? h.whatsapp_number ?? ''}
                        onChange={(e) => handleWhatsappChange(h.id, e.target.value)}
                        className="w-32 text-xs px-2 py-1 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-green-400"
                      />
                      <button
                        onClick={() => handleWhatsappSave(h)}
                        disabled={savingWhatsapp[h.id]}
                        className="text-xs px-2 py-1 rounded-lg font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
                      >
                        {savingWhatsapp[h.id] ? '…' : 'Save'}
                      </button>
                    </div>
                    {whatsappError[h.id] && (
                      <p className="text-xs text-red-600 mt-1">{whatsappError[h.id]}</p>
                    )}
                  </td>
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
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => setLedgerHotelId(h.id)}
                      className="mr-2 text-xs px-3 py-1.5 rounded-lg font-medium bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-pointer"
                    >
                      Batasa
                    </button>
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
