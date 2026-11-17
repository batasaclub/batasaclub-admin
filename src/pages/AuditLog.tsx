import { useEffect, useState, type FormEvent } from 'react';
import {
  getAuditLog, listAdmins,
  type AdminAccount, type AuditJson, type AuditLogEntry, type AuditLogFilters,
} from '../api.ts';

// Read-only view of admin_audit_log: every admin write, newest first. There are no edit or
// delete controls: the log is append-only in the database.

const PAGE_SIZE = 50;

// Mirrors AdminEntityType in batasaclub-api src/lib/adminAudit.ts.
const ENTITY_TYPES = [
  'hotel', 'room', 'channel_key', 'adr_band', 'network_config', 'batasa_inventory', 'funding_invoice',
  'settlement', 'redemption', 'booking', 'complaint', 'hotel_user', 'admin_user',
] as const;

// Known system actors (cron jobs / scripts). A person is filtered by their admin_users.id.
const SYSTEM_ACTORS = [
  { id: 'system:settlementJob', label: 'System — settlement job' },
  { id: 'system:create-admin', label: 'System — create-admin script' },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

const label = (s: string) => s.replace(/_/g, ' ');

function fmtValue(v: unknown): string {
  if (v === undefined) return '—';
  if (v === null) return 'null';
  if (typeof v === 'string') return v === '' ? '""' : v;
  return JSON.stringify(v);
}

const isObject = (v: AuditJson): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

type Change = { key: string; before: unknown; after: unknown; changed: boolean };

// Field-by-field before → after. Non-object snapshots are shown as one "value" row.
function diff(before: AuditJson, after: AuditJson): Change[] {
  if (!isObject(before) && !isObject(after)) {
    return [{ key: 'value', before: before ?? undefined, after: after ?? undefined, changed: JSON.stringify(before) !== JSON.stringify(after) }];
  }
  const b = isObject(before) ? before : {};
  const a = isObject(after) ? after : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys.map((key) => {
    const bv = key in b ? b[key] : undefined;
    const av = key in a ? a[key] : undefined;
    return { key, before: bv, after: av, changed: JSON.stringify(bv) !== JSON.stringify(av) };
  });
}

function BeforeAfter({ entry }: { entry: AuditLogEntry }) {
  const [showAll, setShowAll] = useState(false);
  const changes = diff(entry.before, entry.after);
  const changed = changes.filter((c) => c.changed);
  const rows = showAll ? changes : changed;
  const kind = entry.before == null ? 'created' : entry.after == null ? 'removed' : null;

  return (
    <div className="text-xs">
      {kind && <div className="text-gray-400 mb-1">{kind === 'created' ? 'No previous state (created)' : 'Removed (no state after)'}</div>}
      {rows.length === 0 ? (
        <div className="text-gray-400">No field changed</div>
      ) : (
        <table className="w-full">
          <tbody>
            {rows.map((c) => (
              <tr key={c.key} className="align-top">
                <td className="pr-3 py-0.5 font-medium text-gray-500 whitespace-nowrap">{label(c.key)}</td>
                <td className="py-0.5 font-mono break-all">
                  {kind !== 'created' && (
                    <span className={c.changed ? 'text-red-600 line-through decoration-red-300' : 'text-gray-500'}>{fmtValue(c.before)}</span>
                  )}
                  {c.changed && kind !== 'created' && kind !== 'removed' && <span className="text-gray-400 px-1.5">→</span>}
                  {c.changed && kind !== 'removed' && <span className="text-green-700">{fmtValue(c.after)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {changes.length > changed.length && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-1 text-[#143D2D]/70 hover:text-[#143D2D] underline cursor-pointer">
          {showAll ? 'Show changed fields only' : `Show all ${changes.length} fields`}
        </button>
      )}
    </div>
  );
}

function actorLabel(e: AuditLogEntry): { name: string; sub: string } {
  if (e.actor) return { name: e.actor.name, sub: e.actor.email };
  const sys = SYSTEM_ACTORS.find((s) => s.id === e.actor_id);
  if (sys) return { name: sys.label, sub: e.actor_id };
  return { name: e.actor_id.startsWith('system:') ? e.actor_id : 'Unknown admin', sub: e.actor_id };
}

const emptyFilters: AuditLogFilters = { actor_id: '', entity_type: '', entity_id: '', from: '', to: '' };

export default function AuditLog() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [draft, setDraft] = useState<AuditLogFilters>(emptyFilters);
  const [filters, setFilters] = useState<AuditLogFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listAdmins().then((d) => setAdmins(d.admins)).catch(() => { /* filter falls back to system actors only */ });
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAuditLog({ ...filters, entity_id: filters.entity_id?.trim(), page, limit: PAGE_SIZE })
      .then((d) => { if (!cancelled) { setEntries(d.entries); setTotal(d.total); setError(''); } })
      .catch((e: unknown) => { if (!cancelled) setError((e as Error).message ?? 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters, page]);

  // Every page / filter change goes through here, so loading is set before the effect refetches.
  function load(next: AuditLogFilters, nextPage: number) {
    setLoading(true);
    setPage(nextPage);
    setFilters(next);
  }

  function apply(e: FormEvent) {
    e.preventDefault();
    load({ ...draft }, 1);
  }

  function reset() {
    setDraft(emptyFilters);
    load(emptyFilters, 1);
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const input = 'text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#143D2D]/40 bg-white';

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">
          Every admin change, newest first: who made it, when, and the state before and after. Entries cannot be edited or deleted.
        </p>
      </div>

      <form onSubmit={apply} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            Admin
            <select value={draft.actor_id} onChange={(e) => setDraft({ ...draft, actor_id: e.target.value })} className={`${input} min-w-48`}>
              <option value="">All admins</option>
              {admins.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.email})</option>)}
              {SYSTEM_ACTORS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            Entity
            <select value={draft.entity_type} onChange={(e) => setDraft({ ...draft, entity_type: e.target.value })} className={`${input} min-w-40`}>
              <option value="">All entities</option>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            Entity ID
            <input value={draft.entity_id} onChange={(e) => setDraft({ ...draft, entity_id: e.target.value })} placeholder="Any" className={`${input} w-72 font-mono`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            From
            <input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            To
            <input type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={input} />
          </label>
          <button type="submit" className="text-xs font-semibold px-4 py-2.5 rounded-lg bg-[#143D2D] text-white hover:bg-[#143D2D]/90 transition-colors cursor-pointer">
            Apply
          </button>
          <button type="button" onClick={reset} className="text-xs font-medium px-3 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
            Clear
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Dates are in UTC; "To" includes that whole day.</p>
      </form>

      {error && <div className="text-sm bg-red-50 text-red-600 rounded-lg px-3 py-2 mb-4">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="px-5 py-3 font-medium whitespace-nowrap">When</th>
              <th className="px-5 py-3 font-medium">Admin</th>
              <th className="px-5 py-3 font-medium">Action</th>
              <th className="px-5 py-3 font-medium">Entity</th>
              <th className="px-5 py-3 font-medium w-[40%]">Before → after</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {entries.map((e) => {
              const who = actorLabel(e);
              return (
                <tr key={e.id} className="align-top">
                  <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(e.at)}</td>
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{who.name}</div>
                    <div className="text-xs text-gray-400 break-all">{who.sub}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#143D2D]/10 text-[#143D2D] font-mono whitespace-nowrap">{e.action}</span>
                    {e.request_id && <div className="text-[11px] text-gray-400 mt-1 font-mono break-all">req {e.request_id}</div>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-gray-700">{label(e.entity_type)}</div>
                    <div className="text-xs text-gray-400 font-mono break-all">{e.entity_id}</div>
                  </td>
                  <td className="px-5 py-3"><BeforeAfter entry={e} /></td>
                </tr>
              );
            })}
            {!loading && entries.length === 0 && !error && (
              <tr><td colSpan={5} className="px-5 py-6 text-gray-400">No entries match these filters.</td></tr>
            )}
            {loading && entries.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-gray-400">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
        <span>{total === 0 ? 'No entries' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}{loading && entries.length > 0 ? ' · loading…' : ''}</span>
        <div className="flex gap-2">
          <button onClick={() => load(filters, page - 1)} disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">← Newer</button>
          <span className="px-2 py-1.5">Page {page} of {pages}</span>
          <button onClick={() => load(filters, page + 1)} disabled={page >= pages || loading}
            className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">Older →</button>
        </div>
      </div>
    </div>
  );
}
