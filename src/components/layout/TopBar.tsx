import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuotations } from '@/contexts/QuotationContext';
import { Bell, Search, LogOut } from 'lucide-react';


interface TopBarProps {
  title: string;
}

export const TopBar = ({ title }: TopBarProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { quotations } = useQuotations();
  const [showNotifications, setShowNotifications] = useState(false);
  const recentNotifications = quotations.slice(0, 5);


  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/quotation-history?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };


  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-40">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search quotations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            className="pl-10 pr-4 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring w-64"
          />

        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Bell size={20} className="text-muted-foreground" />
            {recentNotifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 bg-card border border-border rounded-xl shadow-lg z-50">
              <div className="p-4 border-b border-border">
                <p className="font-semibold text-foreground">Recent Quotations</p>
              </div>
              {recentNotifications.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">No recent activity</div>
              ) : (
                recentNotifications.map((q) => (
                  <div key={q.id} className="p-4 border-b border-border last:border-0 hover:bg-muted transition-colors">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium text-foreground">#{q.id} — {q.clientName}</p>
                      <span className="text-xs text-muted-foreground">{q.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">₹{q.grandTotal.toFixed(2)} · {q.createdAt}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>


        {/* User Menu */}
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground">{user?.name}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {user?.role.replace('_', ' ')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
            {user?.name.charAt(0)}
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-muted transition-colors md:hidden"
            title="Logout"
          >
            <LogOut size={18} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
};
