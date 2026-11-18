import { useEffect, useState } from 'react';
import { getStats, getBatasaHealth, type StatsResponse, type BatasaHealth } from '../api.ts';

function rupees(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
  gold?: boolean;
}

function StatCard({ label, value, sub, alert, gold }: StatCardProps) {
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border ${alert ? 'border-red-300' : gold ? 'border-[#C79A3B]/30' : 'border-gray-100'}`}>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-2xl font-bold ${alert ? 'text-red-600' : gold ? 'text-[#C79A3B]' : 'text-gray-900'}`}>{value}</div>
      {sub && <div className={`text-xs mt-1 ${alert ? 'text-red-500' : 'text-gray-400'}`}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [health, setHealth] = useState<BatasaHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getStats(), getBatasaHealth()])
      .then(([s, h]) => { setStats(s); setHealth(h); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!stats) return null;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active Hotels"
          value={stats.total_hotels.toLocaleString()}
        />
        <StatCard
          label="Total Members"
          value={stats.total_members.toLocaleString()}
        />
        <StatCard
          label="Batasa Issued"
          value={stats.total_points_issued.toLocaleString()}
          sub="lifetime points earned"
        />
        <StatCard
          label="Batasa Redeemed"
          value={stats.total_points_redeemed.toLocaleString()}
          sub="lifetime points used"
        />
        <StatCard
          label="Monthly MRR"
          value={rupees(stats.mrr_paise)}
          sub="SaaS fees (active hotels)"
        />
        <StatCard
          label="Outstanding Batasa"
          value={(stats.total_points_issued - stats.total_points_redeemed).toLocaleString()}
          sub="unredeemed liability"
        />
      </div>

      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-8 mb-3">Locked vs Active Batasa</h2>
      {health && health.issued === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-5 text-sm text-gray-400">
          No Batasa issued yet — this section populates after the first hotel enrollment.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Locked Batasa"
            value={health ? health.locked.toLocaleString() : '—'}
            sub="earned, pending activation"
          />
          <StatCard
            label="Active Batasa"
            value={health ? health.active.toLocaleString() : '—'}
            sub="activated, redeemable"
            gold
          />
          <StatCard
            label="Activation Rate"
            value={health ? `${health.activation_rate_pct.toFixed(1)}%` : '—'}
            sub="active / total issued"
            gold={health ? health.activation_rate_pct >= 50 : false}
            alert={health ? health.activation_rate_pct < 20 : false}
          />
          <StatCard
            label="Expired Batasa"
            value={health ? health.expired.toLocaleString() : '—'}
            sub="locked entries expired"
          />
        </div>
      )}

    </div>
  );
}
