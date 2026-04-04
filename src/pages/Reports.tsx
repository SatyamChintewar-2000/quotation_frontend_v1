import React, { useEffect, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { reportsService, StaffSummary } from '@/services/reportsService';
import { toast } from 'sonner';
import {
  BarChart3, Users, FileText, ClipboardList, Receipt,
  TrendingUp, Medal, Search,
} from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const Reports = () => {
  const { user } = useAuth();
  const [staffData, setStaffData] = useState<StaffSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const isAdminOrAbove = ['superadmin', 'super_admin', 'admin', 'client'].includes(
    user?.role?.toLowerCase() || ''
  );

  useEffect(() => {
    if (!isAdminOrAbove) { setLoading(false); return; }
    reportsService.getStaffSummary()
      .then(setStaffData)
      .catch(() => toast.error('Failed to load staff summary'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = staffData.filter((s) =>
    s.userName.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  );

  // Totals row
  const totals = filtered.reduce(
    (acc, s) => ({
      enquiries: acc.enquiries + s.enquiries,
      customers: acc.customers + s.customers,
      quotations: acc.quotations + s.quotations,
      invoices: acc.invoices + s.invoices,
      totalRevenue: acc.totalRevenue + s.totalRevenue,
    }),
    { enquiries: 0, customers: 0, quotations: 0, invoices: 0, totalRevenue: 0 }
  );

  // Top performer by quotations
  const topPerformer = [...staffData].sort((a, b) => b.quotations - a.quotations)[0];

  const summaryCards = [
    { label: 'Total Staff', value: staffData.length, icon: Users, color: 'bg-blue-100 text-blue-600' },
    { label: 'Total Enquiries', value: totals.enquiries, icon: ClipboardList, color: 'bg-orange-100 text-orange-600' },
    { label: 'Total Quotations', value: totals.quotations, icon: FileText, color: 'bg-primary/10 text-primary' },
    { label: 'Total Revenue', value: fmt(totals.totalRevenue), icon: TrendingUp, color: 'bg-green-100 text-green-600' },
  ];

  if (loading) return (
    <div className="min-h-screen">
      <TopBar title="Reports" />
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    </div>
  );

  if (!isAdminOrAbove) return (
    <div className="min-h-screen">
      <TopBar title="Reports" />
      <div className="p-6">
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <BarChart3 size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Reports are available for admin and above.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <TopBar title="Reports" />
      <div className="p-6 space-y-6">

        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-foreground">Staff Performance Report</h2>
          <p className="text-muted-foreground">See how each team member is performing across all activities</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((c) => (
            <div key={c.label} className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${c.color}`}>
                <c.icon size={20} />
              </div>
              <p className="text-2xl font-bold text-foreground">{c.value}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Top performer banner */}
        {topPerformer && (
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <Medal size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Top Performer</p>
              <p className="text-lg font-bold text-foreground">{topPerformer.userName}</p>
              <p className="text-sm text-muted-foreground">
                {topPerformer.quotations} quotations · {topPerformer.enquiries} enquiries · {fmt(topPerformer.totalRevenue)} revenue
              </p>
            </div>
          </div>
        )}

        {/* Staff table */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between gap-4 flex-wrap">
            <h3 className="font-semibold text-foreground">Staff Activity Breakdown</h3>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff..."
                className="input-field pl-9 h-9 w-56 text-sm"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Users size={40} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No staff found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-header">
                    <th className="px-5 py-3 text-left">#</th>
                    <th className="px-5 py-3 text-left">Staff Member</th>
                    <th className="px-5 py-3 text-left">Role</th>
                    <th className="px-5 py-3 text-center">
                      <span className="flex items-center justify-center gap-1"><ClipboardList size={13} />Enquiries</span>
                    </th>
                    <th className="px-5 py-3 text-center">
                      <span className="flex items-center justify-center gap-1"><Users size={13} />Customers</span>
                    </th>
                    <th className="px-5 py-3 text-center">
                      <span className="flex items-center justify-center gap-1"><FileText size={13} />Quotations</span>
                    </th>
                    <th className="px-5 py-3 text-center">
                      <span className="flex items-center justify-center gap-1"><Receipt size={13} />Invoices</span>
                    </th>
                    <th className="px-5 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => (
                    <tr key={s.userId} className="table-row">
                      <td className="px-5 py-4 text-muted-foreground">{i + 1}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                            {s.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{s.userName}</p>
                            <p className="text-xs text-muted-foreground">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground capitalize">
                          {s.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`font-semibold ${s.enquiries > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                          {s.enquiries}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`font-semibold ${s.customers > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                          {s.customers}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`font-semibold ${s.quotations > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                          {s.quotations}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`font-semibold ${s.invoices > 0 ? 'text-purple-600' : 'text-muted-foreground'}`}>
                          {s.invoices}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-green-600">
                        {fmt(s.totalRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td className="px-5 py-3" colSpan={3}>
                      <span className="font-semibold text-foreground text-sm">Total</span>
                    </td>
                    <td className="px-5 py-3 text-center font-bold text-orange-600">{totals.enquiries}</td>
                    <td className="px-5 py-3 text-center font-bold text-blue-600">{totals.customers}</td>
                    <td className="px-5 py-3 text-center font-bold text-primary">{totals.quotations}</td>
                    <td className="px-5 py-3 text-center font-bold text-purple-600">{totals.invoices}</td>
                    <td className="px-5 py-3 text-right font-bold text-green-600">{fmt(totals.totalRevenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
