import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuotations } from '@/contexts/QuotationContext';
import { Bell, LogOut, CheckCheck, Check } from 'lucide-react';


interface TopBarProps {
  title: string;
}

export const TopBar = ({ title }: TopBarProps) => {
  const { user, logout } = useAuth();
  const { quotations } = useQuotations();
  const [showNotifications, setShowNotifications] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const notifRef = useRef<HTMLDivElement>(null);

  const recentNotifications = quotations.slice(0, 5);
  const unreadCount = recentNotifications.filter(q => !readIds.has(q.id)).length;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const handleMarkAsRead = (id: string) => {
    setReadIds(prev => new Set([...prev, id]));
  };

  const handleMarkAllAsRead = () => {
    setReadIds(new Set(recentNotifications.map(q => q.id)));
  };

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-40">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Bell size={20} className="text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-primary rounded-full flex items-center justify-center text-[10px] text-primary-foreground font-bold px-0.5">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 bg-card border border-border rounded-xl shadow-lg z-50">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <p className="font-semibold text-foreground">Notifications</p>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <CheckCheck size={13} />
                    Mark all as read
                  </button>
                )}
              </div>
              {recentNotifications.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">No recent activity</div>
              ) : (
                recentNotifications.map((q) => {
                  const isRead = readIds.has(q.id);
                  return (
                    <div
                      key={q.id}
                      className={`p-4 border-b border-border last:border-0 transition-colors ${isRead ? 'opacity-60' : 'bg-primary/5 hover:bg-muted'}`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium text-foreground truncate ${!isRead ? 'font-semibold' : ''}`}>
                            #{q.id} — {q.clientName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{q.status} · ₹{q.grandTotal.toFixed(2)}</p>
                        </div>
                        {!isRead && (
                          <button
                            onClick={() => handleMarkAsRead(q.id)}
                            className="flex-shrink-0 p-1 rounded hover:bg-primary/10 text-primary transition-colors"
                            title="Mark as read"
                          >
                            <Check size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
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
