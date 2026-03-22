import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/contexts/ProductContext';
import { useQuotations } from '@/contexts/QuotationContext';
import { TopBar } from '@/components/layout/TopBar';
import { dashboardService, DashboardDTO } from '@/services/dashboardService';
import { customerService } from '@/services/customerService';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import {
  TrendingUp,
  FileText,
  Users,
  Package,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const { products = [] } = useProducts();
  const { quotations = [] } = useQuotations();
  const [dashboardData, setDashboardData] = useState<DashboardDTO | null>(null);
  const [clientsCount, setClientsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Set default date range to current date
        const today = new Date();
        const todayString = today.toISOString().split('T')[0];
        setFromDate(todayString);
        setToDate(todayString);
        
        const [dashboard, customers] = await Promise.all([
          dashboardService.getDashboard(),
          customerService.getAll(),
        ]);
        setDashboardData(dashboard);
        setClientsCount(customers.length);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setError('Failed to load dashboard data');
        // Set default values so page doesn't break
        setDashboardData({ quotations: 0, customers: 0, products: 0, users: 0, revenue: 0 });
        setClientsCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Filter data based on user role
  const isSuperAdmin = user?.role === 'superadmin';
  
  const userQuotations = isSuperAdmin 
    ? quotations 
    : quotations.filter(q => q.createdBy === user?.id);

  // Filter quotations by date range
  const filteredQuotations = userQuotations.filter((quotation) => {
    if (!fromDate && !toDate) return true;
    
    // Parse quotation date and strip time component
    const quotationDate = new Date(quotation.createdAt);
    quotationDate.setHours(0, 0, 0, 0);
    
    // Parse filter dates and strip time component
    const from = fromDate ? new Date(fromDate) : null;
    if (from) from.setHours(0, 0, 0, 0);
    
    const to = toDate ? new Date(toDate) : null;
    if (to) to.setHours(23, 59, 59, 999); // End of day
    
    // Compare dates
    if (from && quotationDate < from) return false;
    if (to && quotationDate > to) return false;
    
    return true;
  });

  // Calculate filtered revenue
  const filteredRevenue = filteredQuotations
    .filter(q => q.status === 'accepted')
    .reduce((sum, q) => sum + q.grandTotal, 0);

  // Calculate today's metrics
  const todayQuotations = filteredQuotations.length;
  const todayRevenue = filteredRevenue;
  
  // Determine label based on date filter
  const isToday = fromDate === toDate && fromDate === new Date().toISOString().split('T')[0];
  const dateLabel = isToday ? "Today's" : "Filtered";
  
  const stats = [
    {
      label: `${dateLabel} Sales`,
      value: todayQuotations,
      change: '+12%',
      positive: true,
      icon: FileText,
      color: 'bg-primary/10 text-primary',
    },
    {
      label: `${dateLabel} Enquires`,
      value: clientsCount,
      change: '+8%',
      positive: true,
      icon: Users,
      color: 'bg-success/10 text-success',
    },

    {
      label: `${dateLabel} Revenue`,
      value: `₹${todayRevenue.toFixed(2)}`,
      change: todayRevenue > 0 ? '+15%' : '0%',
      positive: todayRevenue > 0,
      icon: TrendingUp,
      color: 'bg-accent/10 text-accent',
    },
  ];

  const recentQuotations = filteredQuotations.slice(0, 5);

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
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                Welcome back, {user?.name}! 👋
              </h2>
              <p className="text-primary-foreground/80">
                {isSuperAdmin 
                  ? "Here's today's business summary."
                  : "Here's your today's business overview."}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <DateRangePicker
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={setFromDate}
                onToDateChange={setToDate}
                label="Filter Period"
              />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="card-stat animate-slide-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.color}`}>
                  <stat.icon size={24} />
                </div>
                <div
                  className={`flex items-center gap-1 text-sm font-medium ${
                    stat.positive ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {stat.positive ? (
                    <ArrowUpRight size={16} />
                  ) : (
                    <ArrowDownRight size={16} />
                  )}
                  {stat.change}
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Recent Quotations */}
        <div className="bg-card rounded-xl shadow-md border border-border">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">
              {isSuperAdmin ? "Today's Quotations" : "My Today's Quotations"}
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
                    <th className="px-6 py-4 text-left">ID</th>
                    <th className="px-6 py-4 text-left">Client</th>
                    <th className="px-6 py-4 text-left">Items</th>
                    <th className="px-6 py-4 text-left">Total</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="px-6 py-4 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentQuotations.map((quotation) => (
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
                        <span
                          className={
                            quotation.status === 'accepted'
                              ? 'badge-success'
                              : 'badge-warning'
                          }
                        >
                          {quotation.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {quotation.createdAt}
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
