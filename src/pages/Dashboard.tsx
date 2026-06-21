import { useEffect, useState } from 'react';
import { getStats, getBreakage, type StatsResponse, type BreakageSummary } from '../api.ts';

function rupees(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}

function StatCard({ label, value, sub, alert }: StatCardProps) {
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border ${alert ? 'border-red-300' : 'border-gray-100'}`}>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-2xl font-bold ${alert ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
      {sub && <div className={`text-xs mt-1 ${alert ? 'text-red-500' : 'text-gray-400'}`}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [breakage, setBreakage] = useState<BreakageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getStats(), getBreakage()])
      .then(([s, b]) => { setStats(s); setBreakage(b.summary); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!stats) return null;

  const coverageLow = stats.coverage_ratio < 1.25 && stats.coverage_ratio !== 999;

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
          label="Reserve Pool"
          value={rupees(stats.reserve_balance_paise)}
          sub="global reserve balance"
        />
        <StatCard
          label="Reserve Coverage"
          value={stats.coverage_ratio === 999 ? '∞' : `${stats.coverage_ratio.toFixed(2)}x`}
          sub={coverageLow ? 'Below 1.25x minimum' : '12-month obligation coverage'}
          alert={coverageLow}
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

      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-8 mb-3">Breakage Observability</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Network Breakage Rate"
          value={breakage != null ? `${breakage.network_breakage_rate_pct.toFixed(1)}%` : '—'}
          sub="(expired + dormant) / issued"
        />
        <StatCard
          label="Reserve Benefit"
          value={breakage != null ? rupees(breakage.total_reserve_benefit_paise) : '—'}
          sub="33% of breakage @ ₹1/pt"
        />
        <StatCard
          label="Expired Batasa"
          value={breakage != null ? Math.round(breakage.total_expired).toLocaleString() : '—'}
          sub="pro-rata to issuing hotel"
        />
        <StatCard
          label="Dormant Estimate"
          value={breakage != null ? Math.round(breakage.total_dormant).toLocaleString() : '—'}
          sub=">12 mo, never redeemed"
        />
      </div>
    </div>
  );
}
