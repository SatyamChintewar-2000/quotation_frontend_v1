import React, { useState, useMemo } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useInvoices } from '@/contexts/InvoiceContext';
import { Invoice } from '@/services/invoiceService';
import invoiceService from '@/services/invoiceService';
import { toast } from 'sonner';
import {
  FileText, Eye, Trash2, Plus, Download, Send,
  CheckCircle, Clock, AlertCircle, IndianRupee, X, FileCheck, FilePlus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { SearchBar } from '@/components/common/SearchBar';
import { Pagination } from '@/components/common/Pagination';
import { DeleteConfirmModal } from '@/components/common/DeleteConfirmModal';
import { SortableHeader } from '@/components/common/SortableHeader';
import { useSortable } from '@/hooks/useSortable';
import { StatusBadge } from '@/components/common/StatusBadge';
import NumericInput from '@/components/common/NumericInput';

const ITEMS_PER_PAGE = 10;

const InvoiceManagement = () => {
  const { invoices, loading, deleteInvoice, markAsSent } = useInvoices();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<number | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState({ paymentDate: new Date().toISOString().split('T')[0], paymentAmount: '', paymentMethod: 'CASH', paymentReference: '', notes: '' });
  const [paymentSaving, setPaymentSaving] = useState(false);

  React.useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, paymentStatusFilter, documentTypeFilter]);

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const matchesStatus = statusFilter === 'ALL' || invoice.status === statusFilter;
      const matchesPaymentStatus =
        paymentStatusFilter === 'ALL' || invoice.paymentStatus === paymentStatusFilter;
      const matchesDocType =
        documentTypeFilter === 'ALL' || (invoice.documentType || 'INVOICE') === documentTypeFilter;
      const matchesSearch =
        invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesStatus && matchesPaymentStatus && matchesDocType && matchesSearch;
    });
  }, [invoices, statusFilter, paymentStatusFilter, documentTypeFilter, searchTerm]);

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  const { sortedData: sortedInvoices, sort, handleSort } = useSortable(filteredInvoices);
  const paginatedInvoices = sortedInvoices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleDelete = (id: number | undefined) => {
    if (!id) return;
    setDeletingInvoiceId(id);
  };

  const handleSend = async (id: number | undefined) => {
    if (!id) return;
    await markAsSent(id);
  };

  const handleRecordPayment = async () => {
    if (!paymentInvoice?.id) return;
    const amount = parseFloat(paymentForm.paymentAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid payment amount'); return; }
    try {
      setPaymentSaving(true);
      await invoiceService.recordPayment(paymentInvoice.id, {
        paymentDate: paymentForm.paymentDate,
        paymentAmount: amount,
        paymentMethod: paymentForm.paymentMethod,
        paymentReference: paymentForm.paymentReference,
        notes: paymentForm.notes,
      });
      toast.success('Payment recorded successfully');
      setPaymentInvoice(null);
      setPaymentForm({ paymentDate: new Date().toISOString().split('T')[0], paymentAmount: '', paymentMethod: 'CASH', paymentReference: '', notes: '' });
      // Refresh invoices
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to record payment');
    } finally {
      setPaymentSaving(false);
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
          <div className="flex items-center gap-3">
            <Link to="/new-invoice" className="btn-primary flex items-center gap-2 px-5 py-2.5">
              <FileCheck className="w-5 h-5" />
              <div className="text-left">
                <div className="text-sm font-semibold">From Quotation</div>
                <div className="text-xs opacity-80">Convert approved quote</div>
              </div>
            </Link>
            <Link to="/direct-invoice" className="btn-secondary flex items-center gap-2 px-5 py-2.5 border-2 border-primary/20 hover:border-primary/40">
              <FilePlus className="w-5 h-5 text-primary" />
              <div className="text-left">
                <div className="text-sm font-semibold text-primary">Direct Invoice</div>
                <div className="text-xs text-muted-foreground">Create without quote</div>
              </div>
            </Link>
          </div>
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
            <select
              value={documentTypeFilter}
              onChange={(e) => setDocumentTypeFilter(e.target.value)}
              className="input-field flex-1"
            >
              <option value="ALL">All Document Types</option>
              <option value="INVOICE">Invoice</option>
              <option value="PROFORMA_INVOICE">Proforma Invoice</option>
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
                      <SortableHeader label="Invoice #" sortKey="invoiceNumber" sort={sort} onSort={handleSort} />
                      <th className="px-6 py-4 text-left">Type</th>
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
                          {(invoice.documentType || 'INVOICE') === 'PROFORMA_INVOICE' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                              Proforma
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
                              Invoice
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-foreground">{invoice.customerName}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-foreground">{formatCurrency(invoice.totalAmount)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={invoice.status} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getPaymentStatusIcon(invoice.paymentStatus)}
                            <StatusBadge status={invoice.paymentStatus} />
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
                            {invoice.paymentStatus !== 'PAID' && (
                              <button
                                onClick={() => setPaymentInvoice(invoice)}
                                className="p-2 rounded-lg hover:bg-green-50 transition-colors"
                                title="Record Payment"
                              >
                                <IndianRupee className="w-4 h-4 text-green-600" />
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
                totalItems={sortedInvoices.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingInvoiceId}
        onClose={() => setDeletingInvoiceId(null)}
        onConfirm={async () => { if (deletingInvoiceId) await deleteInvoice(deletingInvoiceId); }}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This action cannot be undone."
      />

      {/* Record Payment Modal */}
      {paymentInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="font-semibold text-foreground">Record Payment</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{paymentInvoice.invoiceNumber} · {paymentInvoice.customerName}</p>
              </div>
              <button onClick={() => setPaymentInvoice(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Outstanding amount */}
              <div className="bg-muted/30 rounded-xl p-4 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Invoice Total</span>
                <span className="font-bold text-foreground text-lg">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paymentInvoice.totalAmount)}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Payment Amount (₹) *</label>
                <NumericInput
                  value={paymentForm.paymentAmount === '' ? 0 : Number(paymentForm.paymentAmount)}
                  onChange={(val) => setPaymentForm((p) => ({ ...p, paymentAmount: String(val) }))}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Payment Date *</label>
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, paymentDate: e.target.value }))}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Payment Method</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                  className="input-field"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CARD">Card</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Reference / Transaction ID</label>
                <input
                  type="text"
                  value={paymentForm.paymentReference}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, paymentReference: e.target.value }))}
                  placeholder="UTR / Cheque no. / Transaction ID"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  placeholder="Optional notes..."
                  className="input-field resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setPaymentInvoice(null)} className="flex-1 btn-secondary">Cancel</button>
                <button
                  onClick={handleRecordPayment}
                  disabled={paymentSaving}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {paymentSaving ? 'Saving...' : <><IndianRupee size={15} /> Record Payment</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceManagement;
