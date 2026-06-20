type Page = 'dashboard' | 'hotels' | 'members' | 'settlement' | 'reviews' | 'transactions' | 'inventory' | 'adr_bands';

interface SidebarProps {
  current: Page;
  onChange: (page: Page) => void;
  onLogout: () => void;
}

const nav: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'hotels', label: 'Hotels', icon: '⌂' },
  { id: 'members', label: 'Members', icon: '◉' },
  { id: 'settlement', label: 'Settlement', icon: '₹' },
  { id: 'reviews', label: 'Reviews', icon: '★' },
  { id: 'transactions', label: 'Transactions', icon: '⇄' },
  { id: 'inventory', label: 'Inventory', icon: '◈' },
  { id: 'adr_bands', label: 'ADR Bands', icon: '◎' },
];

export default function Sidebar({ current, onChange, onLogout }: SidebarProps) {
  return (
    <aside className="w-60 min-h-screen flex flex-col bg-[#143D2D] text-white fixed top-0 left-0 z-10">
      <div className="px-5 py-6 border-b border-white/10">
        <div className="text-[#C79A3B] font-bold text-lg tracking-wide">Batasaclub</div>
        <div className="text-white/50 text-xs mt-0.5">Admin Console</div>
      </div>
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {nav.map((item) => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer ${
                active ? 'bg-[#C79A3B]/20 text-[#C79A3B]' : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <button onClick={onLogout}
          className="w-full text-sm text-white/50 hover:text-white/80 py-2 text-left transition-colors cursor-pointer">
          ⊗ Sign out
        </button>
      </div>
    </aside>
  );
}

export type { Page };
