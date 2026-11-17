import { useState } from 'react';
import Sidebar, { type Page } from './components/Sidebar.tsx';
import Login from './pages/Login.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Hotels from './pages/Hotels.tsx';
import Members from './pages/Members.tsx';
import Settlement from './pages/Settlement.tsx';
import Reviews from './pages/Reviews.tsx';
import Transactions from './pages/Transactions.tsx';
import Inventory from './pages/Inventory.tsx';
import RateParity from './pages/RateParity.tsx';
import AdrBands from './pages/AdrBands.tsx';
import SettlementJobLog from './pages/SettlementJobLog.tsx';
import ChannelKeys from './pages/ChannelKeys.tsx';
import Admins from './pages/Admins.tsx';
import AuditLog from './pages/AuditLog.tsx';
import SetPassword, { INVITE_ACCEPTED_NOTICE } from './pages/SetPassword.tsx';
import { clearSession, getAdminProfile } from './api.ts';

// Sessions from the retired shared login have a token but no admin profile: sign in again.
function isAuthenticated() {
  return !!localStorage.getItem('admin_token') && !!getAdminProfile();
}

// Admin invite emails link to /set-password?token=… (vercel.json rewrites every path to index.html).
const isSetPasswordPath = () => window.location.pathname.replace(/\/$/, '') === '/set-password';

const PAGE_TITLES: Record<Page, string> = {
  dashboard:           'Dashboard',
  hotels:              'Hotels',
  members:             'Members',
  settlement:          'Settlement',
  settlement_job_log:  'Job Monitor',
  channel_keys:        'Channel Keys',
  admins:              'Admins',
  audit_log:           'Audit Log',
  reviews:             'Reviews',
  transactions:        'Transactions',
  inventory:           'Inventory',
  rate_parity:         'Rate Parity',
  adr_bands:           'ADR Bands',
};

export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated);
  const [page, setPage] = useState<Page>('dashboard');
  const [settingPassword, setSettingPassword] = useState(isSetPasswordPath);
  const [notice, setNotice] = useState<string | undefined>();

  function logout() {
    clearSession();
    setAuthed(false);
  }

  if (settingPassword) {
    return (
      <SetPassword onDone={() => {
        clearSession();
        setAuthed(false);
        window.history.replaceState(null, '', '/');
        setNotice(INVITE_ACCEPTED_NOTICE);
        setSettingPassword(false);
      }} />
    );
  }

  if (!authed) {
    return <Login notice={notice} onSuccess={() => { setNotice(undefined); setAuthed(true); }} />;
  }

  function renderPage() {
    switch (page) {
      case 'dashboard':    return <Dashboard />;
      case 'hotels':       return <Hotels />;
      case 'members':      return <Members />;
      case 'settlement':   return <Settlement />;
      case 'reviews':      return <Reviews />;
      case 'transactions': return <Transactions />;
      case 'inventory':    return <Inventory />;
      case 'rate_parity':  return <RateParity />;
      case 'adr_bands':           return <AdrBands />;
      case 'settlement_job_log':  return <SettlementJobLog />;
      case 'channel_keys':        return <ChannelKeys />;
      case 'admins':              return <Admins />;
      case 'audit_log':           return <AuditLog />;
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar current={page} onChange={setPage} onLogout={logout} adminName={getAdminProfile()?.name} />
      <div className="flex-1 ml-60 flex flex-col">
        <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-0">
          <h2 className="text-base font-semibold text-gray-800">{PAGE_TITLES[page]}</h2>
          <div className="text-xs text-gray-400">Batasaclub Admin</div>
        </header>
        <main className="flex-1 overflow-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
