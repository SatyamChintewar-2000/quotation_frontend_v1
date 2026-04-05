import { useEffect, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { reportsService, StaffSummary } from '@/services/reportsService';
import { exportToExcel } from '@/utils/excelExport';
import { customerService } from '@/services/customerService';
import { productService } from '@/services/productService';
import { enquiryService } from '@/services/enquiryService';
import { quotationService } from '@/services/quotationService';
import invoiceService from '@/services/invoiceService';
import { toast } from 'sonner';
import {
  BarChart3, Users, FileText, ClipboardList, Receipt,
  TrendingUp, Medal, Search, Download, Package, UserCheck,
} from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const Reports = () => {
  const { user } = useAuth();
  const [staffData, setStaffData] = useState<StaffSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

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

  const topPerformer = [...staffData].sort((a, b) => b.quotations - a.quotations)[0];

  const summaryCards = [
    { label: 'Total Staff', value: staffData.length, icon: Users, color: 'bg-blue-100 text-blue-600' },
    { label: 'Total Enquiries', value: totals.enquiries, icon: ClipboardList, color: 'bg-orange-100 text-orange-600' },
    { label: 'Total Quotations', value: totals.quotations, icon: FileText, color: 'bg-primary/10 text-primary' },
    { label: 'Total Revenue', value: fmt(totals.totalRevenue), icon: TrendingUp, color: 'bg-green-100 text-green-600' },
  ];

  // Download handlers
  const handleDownload = async (type: string) => {
    setDownloading(type);
    try {
      switch (type) {
        case 'staff': {
          exportToExcel(
            staffData.map((s, i) => ({
              no: i + 1, name: s.userName, email: s.email, role: s.role,
              enquiries: s.enquiries, customers: s.customers,
              quotations: s.quotations, invoices: s.invoices,
              revenue: s.totalRevenue,
            })),
            [
              { header: '#', key: 'no', width: 5 },
              { header: 'Name', key: 'name', width: 20 },
              { header: 'Email', key: 'email', width: 28 },
              { header: 'Role', key: 'role', width: 12 },
              { header: 'Enquiries', key: 'enquiries', width: 12 },
              { header: 'Customers', key: 'customers', width: 12 },
              { header: 'Quotations', key: 'quotations', width: 12 },
              { header: 'Invoices', key: 'invoices', width: 12 },
              { header: 'Revenue (₹)', key: 'revenue', width: 15 },
            ],
            'staff-performance-report'
          );
          break;
        }
        case 'customers': {
          const data = await customerService.getAll();
          exportToExcel(
            data.map((c) => ({ name: c.customerName, email: c.email, phone: c.phone, address: c.address || '', company: c.companyName || '' })),
            [
              { header: 'Customer Name', key: 'name', width: 25 },
              { header: 'Email', key: 'email', width: 30 },
              { header: 'Phone', key: 'phone', width: 15 },
              { header: 'Address', key: 'address', width: 35 },
              { header: 'Company', key: 'company', width: 20 },
            ],
            'customers-report'
          );
          break;
        }
        case 'products': {
          const data = await productService.getAll();
          exportToExcel(
            data.map((p) => ({ code: p.productCode || '', name: p.productName, brand: p.brand || '', category: p.category || '', price: p.price, qty: p.quantity, unit: p.unit, gst: p.taxPercentage })),
            [
              { header: 'Code', key: 'code', width: 12 },
              { header: 'Product Name', key: 'name', width: 25 },
              { header: 'Brand', key: 'brand', width: 15 },
              { header: 'Category', key: 'category', width: 15 },
              { header: 'Price (₹)', key: 'price', width: 12 },
              { header: 'Quantity', key: 'qty', width: 10 },
              { header: 'Unit', key: 'unit', width: 10 },
              { header: 'GST (%)', key: 'gst', width: 10 },
            ],
            'products-report'
          );
          break;
        }
        case 'enquiries': {
          const data = await enquiryService.getAll();
          exportToExcel(
            data.map((e) => ({ date: e.enquiryDate, name: e.name, contact: e.contact, email: e.email || '', city: e.city || '', status: e.status, rating: e.rating || '', enquiryFor: e.enquiryFor || '', budget: e.budget || 0 })),
            [
              { header: 'Date', key: 'date', width: 15 },
              { header: 'Name', key: 'name', width: 25 },
              { header: 'Contact', key: 'contact', width: 15 },
              { header: 'Email', key: 'email', width: 28 },
              { header: 'City', key: 'city', width: 15 },
              { header: 'Status', key: 'status', width: 12 },
              { header: 'Rating', key: 'rating', width: 12 },
              { header: 'Enquiry For', key: 'enquiryFor', width: 20 },
              { header: 'Budget (₹)', key: 'budget', width: 12 },
            ],
            'enquiries-report'
          );
          break;
        }
        case 'quotations': {
          const data = await quotationService.getAll();
          exportToExcel(
            data.map((q) => ({ no: q.quotationNumber, customer: q.customerName || '', date: q.createdAt?.split('T')[0] || '', status: q.status, subtotal: q.subtotal, discount: q.totalDiscount, gst: q.totalGst, total: q.totalAmount })),
            [
              { header: 'Quotation #', key: 'no', width: 15 },
              { header: 'Customer', key: 'customer', width: 25 },
              { header: 'Date', key: 'date', width: 15 },
              { header: 'Status', key: 'status', width: 12 },
              { header: 'Subtotal (₹)', key: 'subtotal', width: 15 },
              { header: 'Discount (₹)', key: 'discount', width: 15 },
              { header: 'GST (₹)', key: 'gst', width: 12 },
              { header: 'Total (₹)', key: 'total', width: 15 },
            ],
            'quotations-report'
          );
          break;
        }
        case 'invoices': {
          const data = await invoiceService.getInvoices();
          exportToExcel(
            data.map((i) => ({ no: i.invoiceNumber, customer: i.customerName, date: i.invoiceDate, due: i.dueDate, status: i.status, payment: i.paymentStatus, total: i.totalAmount })),
            [
              { header: 'Invoice #', key: 'no', width: 15 },
              { header: 'Customer', key: 'customer', width: 25 },
              { header: 'Invoice Date', key: 'date', width: 15 },
              { header: 'Due Date', key: 'due', width: 15 },
              { header: 'Status', key: 'status', width: 12 },
              { header: 'Payment', key: 'payment', width: 12 },
              { header: 'Total (₹)', key: 'total', width: 15 },
            ],
            'invoices-report'
          );
          break;
        }
      }
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} report downloaded`);
    } catch {
      toast.error('Failed to download report');
    } finally {
      setDownloading(null);
    }
  };

  const downloadCards = [
    { type: 'staff', label: 'Staff Performance', desc: 'Enquiries, quotations, revenue per staff', icon: Users, color: 'from-blue-500 to-blue-600' },
    { type: 'customers', label: 'Customers', desc: 'All customer details and contacts', icon: UserCheck, color: 'from-teal-500 to-teal-600' },
    { type: 'products', label: 'Products', desc: 'Product catalog with pricing', icon: Package, color: 'from-purple-500 to-purple-600' },
    { type: 'enquiries', label: 'Enquiries', desc: 'All leads with status and ratings', icon: ClipboardList, color: 'from-orange-500 to-orange-600' },
    { type: 'quotations', label: 'Quotations', desc: 'All quotations with totals', icon: FileText, color: 'from-indigo-500 to-indigo-600' },
    { type: 'invoices', label: 'Invoices', desc: 'All invoices with payment status', icon: Receipt, color: 'from-green-500 to-green-600' },
  ];

  if (loading) return (
    <div className="min-h-screen">
      <TopBar title="Reports" />
      <div className="p-6 flex items-center justify-center h-64">
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
          <h2 className="text-2xl font-bold text-foreground">Reports & Analytics</h2>
          <p className="text-muted-foreground">Download reports and view staff performance</p>
        </div>

        {/* Download Report Cards */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Download Reports</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {downloadCards.map((card) => (
              <button
                key={card.type}
                onClick={() => handleDownload(card.type)}
                disabled={downloading === card.type}
                className="group relative bg-card rounded-xl border border-border p-4 text-left hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-3`}>
                  {downloading === card.type
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <card.icon size={18} className="text-white" />
                  }
                </div>
                <p className="font-semibold text-foreground text-sm">{card.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{card.desc}</p>
                <div className="flex items-center gap-1 mt-2 text-xs text-primary font-medium">
                  <Download size={11} />
                  <span>Excel</span>
                </div>
              </button>
            ))}
          </div>
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

        {/* Top performer */}
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
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search staff..." className="input-field pl-9 h-9 w-56 text-sm" />
              </div>
              <button onClick={() => handleDownload('staff')} disabled={downloading === 'staff'}
                className="flex items-center gap-1.5 text-sm btn-secondary h-9 px-3">
                <Download size={14} /> Export
              </button>
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
                    <th className="px-5 py-3 text-center"><span className="flex items-center justify-center gap-1"><ClipboardList size={13} />Enquiries</span></th>
                    <th className="px-5 py-3 text-center"><span className="flex items-center justify-center gap-1"><Users size={13} />Customers</span></th>
                    <th className="px-5 py-3 text-center"><span className="flex items-center justify-center gap-1"><FileText size={13} />Quotations</span></th>
                    <th className="px-5 py-3 text-center"><span className="flex items-center justify-center gap-1"><Receipt size={13} />Invoices</span></th>
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
                        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground capitalize">{s.role}</span>
                      </td>
                      <td className="px-5 py-4 text-center"><span className={`font-semibold ${s.enquiries > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>{s.enquiries}</span></td>
                      <td className="px-5 py-4 text-center"><span className={`font-semibold ${s.customers > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>{s.customers}</span></td>
                      <td className="px-5 py-4 text-center"><span className={`font-semibold ${s.quotations > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{s.quotations}</span></td>
                      <td className="px-5 py-4 text-center"><span className={`font-semibold ${s.invoices > 0 ? 'text-purple-600' : 'text-muted-foreground'}`}>{s.invoices}</span></td>
                      <td className="px-5 py-4 text-right font-semibold text-green-600">{fmt(s.totalRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td className="px-5 py-3" colSpan={3}><span className="font-semibold text-foreground text-sm">Total</span></td>
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
