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
import AdrBands from './pages/AdrBands.tsx';

function isAuthenticated() {
  return !!localStorage.getItem('admin_token');
}

const PAGE_TITLES: Record<Page, string> = {
  dashboard: 'Dashboard',
  hotels: 'Hotels',
  members: 'Members',
  settlement: 'Settlement',
  reviews: 'Reviews',
  transactions: 'Transactions',
  inventory: 'Inventory',
  adr_bands: 'ADR Bands',
};

export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated);
  const [page, setPage] = useState<Page>('dashboard');

  function logout() {
    localStorage.removeItem('admin_token');
    setAuthed(false);
  }

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  function renderPage() {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'hotels': return <Hotels />;
      case 'members': return <Members />;
      case 'settlement': return <Settlement />;
      case 'reviews': return <Reviews />;
      case 'transactions': return <Transactions />;
      case 'inventory': return <Inventory />;
      case 'adr_bands': return <AdrBands />;
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar current={page} onChange={setPage} onLogout={logout} />
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
