import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuotations } from '@/contexts/QuotationContext';
import { TopBar } from '@/components/layout/TopBar';
import { customerService } from '@/services/customerService';
import { enquiryService, Enquiry } from '@/services/enquiryService';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { SortableHeader } from '@/components/common/SortableHeader';
import { useSortable } from '@/hooks/useSortable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  FileText,
  Users,
  Package,
  ArrowUpRight,
  ClipboardList,
  CalendarClock,
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const { quotations = [] } = useQuotations();
  const navigate = useNavigate();
  const [clientsCount, setClientsCount] = useState(0);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Don't set default dates - show all data by default
        // const today = new Date().toISOString().split('T')[0];
        // setFromDate(today);
        // setToDate(today);

        const [customers, enqs] = await Promise.all([
          customerService.getAll(),
          enquiryService.getAll(),
        ]);
        setClientsCount(customers.length);
        setEnquiries(enqs);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setError('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const isSuperAdmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin';

  // Staff sees only their own; admin/superadmin sees all in context (API already filters by role)
  const userQuotations = (isSuperAdmin || isAdmin)
    ? quotations
    : quotations.filter(q => q.createdBy === user?.id);

  // Helper: check if a date string falls within the selected range
  const inRange = (dateStr: string) => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const from = fromDate ? new Date(fromDate) : null;
    if (from) from.setHours(0, 0, 0, 0);
    const to = toDate ? new Date(toDate) : null;
    if (to) to.setHours(23, 59, 59, 999);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  // Filter quotations by date range
  const filteredQuotations = userQuotations.filter((q) =>
    !fromDate && !toDate ? true : inRange(q.createdAt)
  );

  // Today's Enquiries — enquiries whose enquiryDate falls in the selected range
  const filteredEnquiries = enquiries.filter((e) =>
    !fromDate && !toDate ? true : inRange(e.enquiryDate)
  );

  // Today's Follow-ups — enquiries whose nextFollowupDate falls in the selected range
  const filteredFollowups = enquiries.filter((e) =>
    e.nextFollowupDate && (!fromDate && !toDate ? true : inRange(e.nextFollowupDate))
  );

  // Today's Sales — quotations with status approved/sent in range
  const filteredSales = filteredQuotations.filter((q) =>
    ['approved', 'sent', 'generated'].includes(q.status?.toLowerCase() || '')
  );

  // Revenue from filtered sales
  const filteredRevenue = filteredSales.reduce((sum, q) => sum + q.grandTotal, 0);

  const isToday = fromDate === toDate && fromDate === new Date().toISOString().split('T')[0];
  const hasDateFilter = fromDate || toDate;
  const dateLabel = !hasDateFilter ? "All" : isToday ? "Today's" : "Filtered";

  const stats = [
    {
      label: `${dateLabel} Enquiries`,
      value: filteredEnquiries.length,
      sub: 'New leads added',
      icon: ClipboardList,
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      route: '/enquiries',
    },
    {
      label: `${dateLabel} Quotations`,
      value: filteredQuotations.length,
      sub: 'Quotations created',
      icon: FileText,
      color: 'bg-primary/10 text-primary',
      route: '/quotation-history',
    },
    {
      label: `${dateLabel} Follow-ups`,
      value: filteredFollowups.length,
      sub: 'Scheduled follow-ups',
      icon: CalendarClock,
      color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
      route: '/enquiries',
    },
    {
      label: `${dateLabel} Sales`,
      value: filteredSales.length,
      sub: `₹${filteredRevenue.toLocaleString('en-IN')} revenue`,
      icon: TrendingUp,
      color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      route: '/invoices',
    },
  ];

  const recentQuotations = filteredQuotations.slice(0, 5);
  const { sortedData: sortedRecentQuotations, sort, handleSort } = useSortable(recentQuotations);

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <TopBar title="Dashboard" />
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <TopBar title="Dashboard" />
        <div className="p-6">
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
            <p className="font-semibold">Error loading dashboard</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar title="Dashboard" />
      <div className="p-6 space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                Welcome back, {user?.name}! 👋
              </h2>
              <p className="text-primary-foreground/80">
                {(isSuperAdmin || isAdmin)
                  ? "Here's today's business summary."
                  : "Here's your today's business overview."}
              </p>
            </div>
            <div className="flex items-center">
              <DateRangePicker
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={setFromDate}
                onToDateChange={setToDate}
                label="Filter Period"
                variant="light"
              />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="card-stat animate-slide-in-up cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => navigate(stat.route)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.color}`}>
                  <stat.icon size={24} />
                </div>
                <ArrowUpRight size={16} className="text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm font-medium text-foreground mt-1">{stat.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Recent Quotations */}
        <div className="bg-card rounded-xl shadow-md border border-border">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">
              {(isSuperAdmin || isAdmin) ? "Today's Quotations" : "My Today's Quotations"}
            </h3>
          </div>
          {recentQuotations.length === 0 ? (
            <div className="p-12 text-center">
              <FileText size={48} className="mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                No quotations yet. Create your first quotation!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <SortableHeader label="ID" sortKey="id" sort={sort} onSort={handleSort} />
                    <th className="px-6 py-4 text-left">Client</th>
                    <th className="px-6 py-4 text-left">Items</th>
                    <th className="px-6 py-4 text-left">Total</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="px-6 py-4 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecentQuotations.map((quotation) => (
                    <tr key={quotation.id} className="table-row">
                      <td className="px-6 py-4 font-medium text-foreground">
                        {quotation.id}
                      </td>
                      <td className="px-6 py-4 text-foreground">
                        {quotation.clientName}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {quotation.items.length} items
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">
                        ${quotation.grandTotal.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={quotation.status} />
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(quotation.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <a
            href="/new-quotation"
            className="card-stat flex items-center gap-4 cursor-pointer group"
          >
            <div className="p-4 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <FileText size={28} />
            </div>
            <div>
              <p className="font-semibold text-foreground">Create Quotation</p>
              <p className="text-sm text-muted-foreground">
                Generate a new quotation
              </p>
            </div>
          </a>
          <a
            href="/add-product"
            className="card-stat flex items-center gap-4 cursor-pointer group"
          >
            <div className="p-4 rounded-xl bg-success/10 text-success group-hover:bg-success group-hover:text-success-foreground transition-colors">
              <Package size={28} />
            </div>
            <div>
              <p className="font-semibold text-foreground">Add Product</p>
              <p className="text-sm text-muted-foreground">
                Add a new product to catalog
              </p>
            </div>
          </a>
          <a
            href="/client-details"
            className="card-stat flex items-center gap-4 cursor-pointer group"
          >
            <div className="p-4 rounded-xl bg-warning/10 text-warning group-hover:bg-warning group-hover:text-warning-foreground transition-colors">
              <Users size={28} />
            </div>
            <div>
              <p className="font-semibold text-foreground">View Clients</p>
              <p className="text-sm text-muted-foreground">
                Manage your client list
              </p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
