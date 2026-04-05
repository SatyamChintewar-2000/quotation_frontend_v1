import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, CheckCheck, Check, CalendarClock, Phone, Mail, MapPin, X, UserCheck, ExternalLink } from 'lucide-react';
import { enquiryService, Enquiry } from '@/services/enquiryService';
import { StatusBadge } from '@/components/common/StatusBadge';

interface TopBarProps {
  title: string;
}

export const TopBar = ({ title }: TopBarProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [followups, setFollowups] = useState<Enquiry[]>([]);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().split('T')[0];

  // Load today's follow-ups on mount
  useEffect(() => {
    enquiryService.getAll()
      .then((all) => {
        const todayFollowups = all.filter((e) => e.nextFollowupDate === today);
        setFollowups(todayFollowups);
      })
      .catch(() => {/* silently fail — notifications are non-critical */});
  }, []);

  const unreadCount = followups.filter((e) => !readIds.has(e.id)).length;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const handleMarkAsRead = (id: number, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setReadIds((prev) => new Set([...prev, id]));
  };

  const handleMarkAllAsRead = () => {
    setReadIds(new Set(followups.map((e) => e.id)));
  };

  const handleNotifClick = (enquiry: Enquiry) => {
    setSelectedEnquiry(enquiry);
    setShowNotifications(false);
    // Mark as read when opened
    setReadIds((prev) => new Set([...prev, enquiry.id]));
  };

  return (
    <>
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
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-destructive rounded-full flex items-center justify-center text-[10px] text-white font-bold px-0.5">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 w-96 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-2">
                    <CalendarClock size={16} className="text-primary" />
                    <p className="font-semibold text-foreground text-sm">Today's Follow-ups</p>
                    {followups.length > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {followups.length}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <CheckCheck size={12} /> Mark all read
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-[420px] overflow-y-auto">
                  {followups.length === 0 ? (
                    <div className="p-8 text-center">
                      <CalendarClock size={32} className="mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">No follow-ups scheduled for today</p>
                    </div>
                  ) : (
                    followups.map((e) => {
                      const isRead = readIds.has(e.id);
                      return (
                        <div
                          key={e.id}
                          onClick={() => handleNotifClick(e)}
                          className={`px-4 py-3 border-b border-border last:border-0 cursor-pointer transition-colors ${
                            isRead ? 'opacity-60 hover:bg-muted/50' : 'bg-primary/5 hover:bg-primary/10'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              {/* Avatar */}
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0 mt-0.5">
                                {e.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={`text-sm text-foreground truncate ${!isRead ? 'font-semibold' : 'font-medium'}`}>
                                    {e.name}
                                  </p>
                                  <StatusBadge status={e.status} />
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{e.contact}</p>
                                {e.enquiryFor && (
                                  <p className="text-xs text-muted-foreground truncate">For: {e.enquiryFor}</p>
                                )}
                                {e.comment && (
                                  <p className="text-xs text-muted-foreground italic truncate mt-0.5">"{e.comment}"</p>
                                )}
                              </div>
                            </div>
                            {!isRead && (
                              <button
                                onClick={(ev) => handleMarkAsRead(e.id, ev)}
                                className="flex-shrink-0 p-1 rounded hover:bg-primary/10 text-primary transition-colors"
                                title="Mark as read"
                              >
                                <Check size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                {followups.length > 0 && (
                  <div className="px-4 py-2.5 border-t border-border bg-muted/20">
                    <button
                      onClick={() => { setShowNotifications(false); navigate('/enquiries'); }}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={11} /> View all enquiries
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User info */}
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
          </div>
        </div>
      </header>

      {/* Enquiry Detail Slide-over */}
      {selectedEnquiry && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelectedEnquiry(null)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-md bg-card shadow-2xl flex flex-col h-full animate-slide-in-right overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <CalendarClock size={18} className="text-primary" />
                <h2 className="font-semibold text-foreground">Follow-up Details</h2>
              </div>
              <button
                onClick={() => setSelectedEnquiry(null)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Name + status */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
                  {selectedEnquiry.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{selectedEnquiry.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={selectedEnquiry.status} />
                    {selectedEnquiry.rating && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        selectedEnquiry.rating === 'Hot' ? 'bg-red-100 text-red-700' :
                        selectedEnquiry.rating === 'Warm' ? 'bg-orange-100 text-orange-700' :
                        selectedEnquiry.rating === 'Cold' ? 'bg-blue-100 text-blue-700' :
                        'bg-muted text-muted-foreground'
                      }`}>{selectedEnquiry.rating}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Info rows */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                <InfoRow icon={<Phone size={14} />} label="Contact" value={selectedEnquiry.contact} />
                {selectedEnquiry.email && <InfoRow icon={<Mail size={14} />} label="Email" value={selectedEnquiry.email} />}
                {selectedEnquiry.city && <InfoRow icon={<MapPin size={14} />} label="City" value={selectedEnquiry.city} />}
                {selectedEnquiry.address && <InfoRow icon={<MapPin size={14} />} label="Address" value={selectedEnquiry.address} />}
              </div>

              {/* Enquiry details */}
              <div className="space-y-3">
                {selectedEnquiry.enquiryFor && (
                  <DetailCard label="Enquiry For" value={selectedEnquiry.enquiryFor} />
                )}
                {selectedEnquiry.budget !== undefined && selectedEnquiry.budget > 0 && (
                  <DetailCard label="Budget" value={`₹${selectedEnquiry.budget.toLocaleString('en-IN')}`} />
                )}
                {selectedEnquiry.referType && (
                  <DetailCard label="Referred Via" value={selectedEnquiry.referType} />
                )}
                {selectedEnquiry.referBy && (
                  <DetailCard label="Referred By" value={selectedEnquiry.referBy} />
                )}
                <DetailCard label="Enquiry Date" value={selectedEnquiry.enquiryDate} />
                <DetailCard
                  label="Follow-up Date"
                  value={selectedEnquiry.nextFollowupDate || '—'}
                  highlight
                />
              </div>

              {/* Comment */}
              {selectedEnquiry.comment && (
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Comment</p>
                  <p className="text-sm text-foreground">{selectedEnquiry.comment}</p>
                </div>
              )}

              {/* Converted badge */}
              {selectedEnquiry.convertedCustomerId && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-4 py-3">
                  <UserCheck size={16} />
                  <span className="font-medium">Converted to Customer</span>
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div className="px-6 py-4 border-t border-border">
              <button
                onClick={() => { setSelectedEnquiry(null); navigate('/enquiries'); }}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                <ExternalLink size={16} /> Open in Enquiry Management
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Helper sub-components
const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-3 text-sm">
    <span className="text-primary/60">{icon}</span>
    <span className="text-muted-foreground w-16 flex-shrink-0">{label}</span>
    <span className="text-foreground font-medium">{value}</span>
  </div>
);

const DetailCard = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className="flex justify-between items-center text-sm py-2 border-b border-border last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-medium ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</span>
  </div>
);
