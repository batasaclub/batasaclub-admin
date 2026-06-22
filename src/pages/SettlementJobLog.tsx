import { useEffect, useState } from 'react';
import { getSettlementJobLog, type SettlementJobRun } from '../api';

export default function SettlementJobLog() {
  const [runs, setRuns] = useState<SettlementJobRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    getSettlementJobLog()
      .then((data) => {
        setRuns(data.runs);
        if (data.runs.length > 0) {
          setExpanded(new Set([data.runs[0].run_date]));
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  function toggleRun(runDate: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(runDate)) next.delete(runDate);
      else next.add(runDate);
      return next;
    });
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  if (error)   return <div className="p-8 text-sm text-red-500">{error}</div>;
  if (runs.length === 0)
    return <div className="p-8 text-sm text-gray-400">No settlement job runs in the last 3 months.</div>;

  return (
    <div className="p-8 space-y-4">
      {runs.map((run) => {
        const isOpen = expanded.has(run.run_date);
        const allOk = run.failed === 0;

        return (
          <div key={run.run_date} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleRun(run.run_date)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <span className="font-semibold text-gray-800 text-sm">{run.run_date}</span>
                <span className="text-xs text-gray-400">{run.total} hotel{run.total !== 1 ? 's' : ''}</span>
                <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  {run.succeeded} success
                </span>
                {run.failed > 0 && (
                  <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                    {run.failed} failed
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${allOk ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-6 py-3 font-medium">Hotel</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Error</th>
                      <th className="px-6 py-3 font-medium">Processed at</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {run.entries.map((entry) => {
                      const ok = entry.status === 'success';
                      return (
                        <tr key={entry.id} className={ok ? 'bg-white' : 'bg-red-50/40'}>
                          <td className="px-6 py-3 text-gray-800 font-medium">{entry.hotel_name}</td>
                          <td className="px-6 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                                ok
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
                              {ok ? 'success' : 'failed'}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-xs text-red-600 font-mono max-w-sm break-words">
                            {entry.error_message ?? <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-6 py-3 text-xs text-gray-400">
                            {new Date(entry.processed_at).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
