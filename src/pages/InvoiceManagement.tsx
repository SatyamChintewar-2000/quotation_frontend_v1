import React, { useState, useMemo } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useInvoices } from '@/contexts/InvoiceContext';
import { Invoice } from '@/services/invoiceService';
import { toast } from 'sonner';
import {
  FileText,
  Eye,
  Trash2,
  Plus,
  Filter,
  Download,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  DollarSign,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { SearchBar } from '@/components/common/SearchBar';
import { Pagination } from '@/components/common/Pagination';

const ITEMS_PER_PAGE = 10;

const InvoiceManagement = () => {
  const { invoices, loading, deleteInvoice, markAsSent } = useInvoices();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  React.useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, paymentStatusFilter]);

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const matchesStatus = statusFilter === 'ALL' || invoice.status === statusFilter;
      const matchesPaymentStatus =
        paymentStatusFilter === 'ALL' || invoice.paymentStatus === paymentStatusFilter;
      const matchesSearch =
        invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesStatus && matchesPaymentStatus && matchesSearch;
    });
  }, [invoices, statusFilter, paymentStatusFilter, searchTerm]);

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleDelete = async (id: number | undefined) => {
    if (!id) return;
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      await deleteInvoice(id);
    }
  };

  const handleSend = async (id: number | undefined) => {
    if (!id) return;
    await markAsSent(id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'SENT':
        return 'bg-blue-100 text-blue-800';
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'PARTIAL':
        return 'bg-yellow-100 text-yellow-800';
      case 'OVERDUE':
        return 'bg-red-100 text-red-800';
      case 'CANCELLED':
        return 'bg-gray-300 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'PARTIAL':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'PENDING':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  return (
    <div className="min-h-screen">
      <TopBar title="Invoice Management" />
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
            <p className="text-muted-foreground mt-1">Manage and track all invoices</p>
          </div>
          <Link to="/new-invoice" className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            New Invoice
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-stat">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Invoices</p>
                <p className="text-2xl font-bold text-foreground">{invoices.length}</p>
              </div>
              <FileText className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div className="card-stat">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Pending Payment</p>
                <p className="text-2xl font-bold text-destructive">
                  {invoices.filter((i) => i.paymentStatus === 'PENDING').length}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
          </div>
          <div className="card-stat">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Partially Paid</p>
                <p className="text-2xl font-bold text-warning">
                  {invoices.filter((i) => i.paymentStatus === 'PARTIAL').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-warning" />
            </div>
          </div>
          <div className="card-stat">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Paid</p>
                <p className="text-2xl font-bold text-success">
                  {invoices.filter((i) => i.paymentStatus === 'PAID').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl shadow-md border border-border p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by invoice number or customer..."
              className="flex-1"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field flex-1"
            >
              <option value="ALL">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="PAID">Paid</option>
              <option value="PARTIAL">Partially Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="input-field flex-1"
            >
              <option value="ALL">All Payment Status</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partially Paid</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-card rounded-xl shadow-md border border-border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-muted-foreground mt-2">Loading invoices...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No invoices found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="px-6 py-4 text-left">Invoice #</th>
                      <th className="px-6 py-4 text-left">Customer</th>
                      <th className="px-6 py-4 text-left">Amount</th>
                      <th className="px-6 py-4 text-left">Status</th>
                      <th className="px-6 py-4 text-left">Payment</th>
                      <th className="px-6 py-4 text-left">Due Date</th>
                      <th className="px-6 py-4 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInvoices.map((invoice) => (
                      <tr key={invoice.id} className="table-row">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-foreground">{invoice.invoiceNumber}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-foreground">{invoice.customerName}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-foreground">{formatCurrency(invoice.totalAmount)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getPaymentStatusIcon(invoice.paymentStatus)}
                            <span className="text-sm text-foreground">{invoice.paymentStatus}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-muted-foreground">{formatDate(invoice.dueDate)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Link to={`/invoice/${invoice.id}`} className="p-2 rounded-lg hover:bg-muted transition-colors" title="View">
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            </Link>
                            {invoice.status === 'DRAFT' && (
                              <button onClick={() => handleSend(invoice.id)} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Send">
                                <Send className="w-4 h-4 text-muted-foreground" />
                              </button>
                            )}
                            <button onClick={() => handleDelete(invoice.id)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredInvoices.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceManagement;
