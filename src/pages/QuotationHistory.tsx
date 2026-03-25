import React, { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useQuotations } from '@/contexts/QuotationContext';
import { Quotation } from '@/data/mockData';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { ExportButton } from '@/components/common/ExportButton';
import { exportToExcel, formatDateForExcel, formatCurrencyForExcel } from '@/utils/excelExport';
import { History, Eye, Download, Edit, Trash2, X, Save, ChevronDown } from 'lucide-react';
import api from '@/services/api';
import { SearchBar } from '@/components/common/SearchBar';
import { Pagination } from '@/components/common/Pagination';
import { DeleteConfirmModal } from '@/components/common/DeleteConfirmModal';
import { SortableHeader } from '@/components/common/SortableHeader';
import { useSortable } from '@/hooks/useSortable';
import { StatusBadge } from '@/components/common/StatusBadge';

const ITEMS_PER_PAGE = 10;

const QuotationHistory = () => {
  const { user } = useAuth();
  const { quotations, updateQuotation, deleteQuotation, loading, refreshQuotations } = useQuotations();
  const [viewingQuotation, setViewingQuotation] = useState<Quotation | null>(null);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [selectedNewStatus, setSelectedNewStatus] = useState<string>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Fetch notification settings on mount
  useEffect(() => {
    api.get('/api/quotations/notification-settings')
      .then(res => setNotificationsEnabled(res.data.notificationsEnabled))
      .catch(() => setNotificationsEnabled(true)); // default: assume notifications on
  }, []);

  // Get valid status options based on current status and notification settings
  const getValidStatusOptions = (currentStatus: string): string[] => {
    const generatedOptions = notificationsEnabled ? ['sent'] : ['approved'];
    const statusMap: Record<string, string[]> = {
      'draft': ['generated', 'rejected'],
      'generated': generatedOptions,
      'sent': ['approved', 'rejected'],
      'approved': [],
      'rejected': [],
    };
    return statusMap[currentStatus.toLowerCase()] || [];
  };

  // Get helper text for status transitions
  const getStatusHelpText = (currentStatus: string): string => {
    const generatedHelp = notificationsEnabled
      ? 'Can change to: Sent (notifications are ON)'
      : 'Can change to: Approved (notifications are OFF)';
    const helpMap: Record<string, string> = {
      'draft': 'Can change to: Generated, Rejected',
      'generated': generatedHelp,
      'sent': 'Can change to: Approved, Rejected',
      'approved': 'Terminal state - cannot change',
      'rejected': 'Terminal state - cannot change',
    };
    return helpMap[currentStatus.toLowerCase()] || '';
  };

  // Filter quotations based on user role
  const isSuperAdmin = user?.role === 'superadmin';
  const userQuotations = isSuperAdmin
    ? quotations
    : quotations.filter((q) => q.createdBy === user?.id);

  // Filter by date range + search
  const filteredQuotations = userQuotations.filter((quotation) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        quotation.id.toString().toLowerCase().includes(term) ||
        quotation.clientName.toLowerCase().includes(term) ||
        quotation.status.toLowerCase().includes(term);
      if (!matchesSearch) return false;
    }
    if (!fromDate && !toDate) return true;
    const quotationDate = new Date(quotation.createdAt);
    quotationDate.setHours(0, 0, 0, 0);
    const from = fromDate ? new Date(fromDate) : null;
    if (from) from.setHours(0, 0, 0, 0);
    const to = toDate ? new Date(toDate) : null;
    if (to) to.setHours(23, 59, 59, 999);
    if (from && quotationDate < from) return false;
    if (to && quotationDate > to) return false;
    return true;
  });

  // Sorting
  const { sortedData: sortedQuotations, sort, handleSort } = useSortable(filteredQuotations);

  // Pagination
  const totalPages = Math.ceil(sortedQuotations.length / ITEMS_PER_PAGE);
  const paginatedQuotations = sortedQuotations.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  React.useEffect(() => { setCurrentPage(1); }, [searchTerm, fromDate, toDate]);

  // Export quotations to Excel
  const handleExportToExcel = () => {
    if (filteredQuotations.length === 0) {
      toast.error('No quotations to export');
      return;
    }

    const columns = [
      { header: 'Quotation ID', key: 'id', width: 15 },
      { header: 'Client Name', key: 'clientName', width: 20 },
      { header: 'Items Count', key: 'itemsCount', width: 12 },
      { header: 'Subtotal', key: 'subtotal', width: 15 },
      { header: 'Discount', key: 'totalDiscount', width: 15 },
      { header: 'GST', key: 'totalGst', width: 15 },
      { header: 'Grand Total', key: 'grandTotal', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Date', key: 'createdAt', width: 15 },
    ];

    const exportData = filteredQuotations.map(quotation => ({
      id: quotation.id,
      clientName: quotation.clientName,
      itemsCount: quotation.items.length,
      subtotal: formatCurrencyForExcel(quotation.subtotal),
      totalDiscount: formatCurrencyForExcel(quotation.totalDiscount),
      totalGst: formatCurrencyForExcel(quotation.totalGst),
      grandTotal: formatCurrencyForExcel(quotation.grandTotal),
      status: quotation.status.toUpperCase(),
      createdAt: formatDateForExcel(quotation.createdAt),
    }));

    exportToExcel(exportData, columns, 'quotations');
    toast.success('Quotations exported to Excel');
  };

  const handleView = (quotation: Quotation) => {
    setViewingQuotation(quotation);
  };

  const handleEdit = (quotation: Quotation) => {
    setEditingQuotation({ ...quotation });
    const options = getValidStatusOptions(quotation.status);
    setSelectedNewStatus(options.length > 0 ? options[0] : quotation.status);
    setShowStatusDropdown(false);
  };

  const handleSaveEdit = async () => {
    if (!editingQuotation) return;
    
    try {
      const statusChanged = selectedNewStatus !== editingQuotation.status;
      
      if (statusChanged) {
        await updateQuotation(editingQuotation.id, { status: selectedNewStatus as Quotation['status'] });
        if (selectedNewStatus === 'approved') {
          toast.success('Invoice auto-created for this quotation. Check the Invoices section.');
          refreshQuotations();
        }
      }
      
      setEditingQuotation(null);
    } catch (error) {
      console.error('Error updating quotation:', error);
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
  };

  const generatePDF = (quotation: Quotation) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(24);
    doc.setTextColor(15, 118, 110);
    doc.text('QUOTATION', 105, 25, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Quotation #: ${quotation.id}`, 15, 40);
    doc.text(`Date: ${quotation.createdAt}`, 15, 47);
    doc.text(`Status: ${quotation.status.toUpperCase()}`, 15, 54);

    // Client Details
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Bill To:', 15, 67);
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(quotation.clientName, 15, 75);

    // Table
    const tableData = quotation.items.map((item) => [
      item.productName,
      `$${item.price.toFixed(2)}`,
      item.quantity.toString(),
      `${item.discount}%`,
      `${item.gst}%`,
      `$${item.subtotal.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: 85,
      head: [['Product', 'Price', 'Qty', 'Discount', 'GST', 'Subtotal']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [15, 118, 110],
        textColor: 255,
        fontStyle: 'bold',
      },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: 'right' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'right' },
      },
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    doc.text('Subtotal:', 140, finalY);
    doc.text(`$${quotation.subtotal.toFixed(2)}`, 195, finalY, { align: 'right' });

    doc.text('Discount:', 140, finalY + 7);
    doc.text(`-$${quotation.totalDiscount.toFixed(2)}`, 195, finalY + 7, { align: 'right' });

    doc.text('GST:', 140, finalY + 14);
    doc.text(`$${quotation.totalGst.toFixed(2)}`, 195, finalY + 14, { align: 'right' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Grand Total:', 140, finalY + 24);
    doc.setTextColor(15, 118, 110);
    doc.text(`$${quotation.grandTotal.toFixed(2)}`, 195, finalY + 24, { align: 'right' });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Thank you for your business!', 105, 280, { align: 'center' });

    doc.save(`quotation-${quotation.id}.pdf`);
    toast.success('PDF downloaded');
  };

  return (
    <div className="min-h-screen">
      <TopBar title="Quotation History" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <History size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {isSuperAdmin ? 'All Quotations' : 'My Quotations'}
              </h2>
              <p className="text-sm text-muted-foreground">
                View and manage your quotation history
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search quotations..."
              className="w-64"
            />
            <DateRangePicker
              fromDate={fromDate}
              toDate={toDate}
              onFromDateChange={setFromDate}
              onToDateChange={setToDate}
              label="Filter by Date"
            />
            <ExportButton
              onClick={handleExportToExcel}
              disabled={filteredQuotations.length === 0}
              count={filteredQuotations.length}
            />
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-md border border-border overflow-hidden">
          {filteredQuotations.length === 0 ? (
            <div className="p-12 text-center">
              <History size={48} className="mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                {fromDate || toDate ? 'No quotations found for selected date range' : 'No quotations yet'}
              </p>
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <SortableHeader label="ID" sortKey="id" sort={sort} onSort={handleSort} />
                    <th className="px-6 py-4 text-left">Client</th>
                    <th className="px-6 py-4 text-left">Items</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="px-6 py-4 text-left">Date</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedQuotations.map((quotation) => (
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
                      <td className="px-6 py-4 text-right font-medium text-foreground">
                        ${quotation.grandTotal.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={quotation.status} />
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {quotation.createdAt}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleView(quotation)}
                            className="p-2 rounded-lg hover:bg-muted transition-colors"
                            title="View"
                          >
                            <Eye size={16} className="text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleEdit(quotation)}
                            className="p-2 rounded-lg hover:bg-muted transition-colors"
                            title="Edit"
                          >
                            <Edit size={16} className="text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => generatePDF(quotation)}
                            className="p-2 rounded-lg hover:bg-muted transition-colors"
                            title="Download PDF"
                          >
                            <Download size={16} className="text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDelete(quotation.id)}
                            className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} className="text-destructive" />
                          </button>                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sortedQuotations.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
            </div>
          )}
        </div>
      </div>

      {/* View Modal */}
      {viewingQuotation && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-lg border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Quotation {viewingQuotation.id}
              </h3>
              <button
                onClick={() => setViewingQuotation(null)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium text-foreground">{viewingQuotation.clientName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium text-foreground">{viewingQuotation.createdAt}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <StatusBadge status={viewingQuotation.status} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Grand Total</p>
                  <p className="font-bold text-primary text-lg">${viewingQuotation.grandTotal.toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm font-medium text-foreground mb-3">Items</p>
                <div className="space-y-2">
                  {viewingQuotation.items.map((item) => (
                    <div key={item.productId} className="p-3 bg-muted rounded-lg flex justify-between">
                      <div>
                        <p className="font-medium text-foreground">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">
                          Qty: {item.quantity} × ${item.price.toFixed(2)} | Discount: {item.discount}% | GST: {item.gst}%
                        </p>
                      </div>
                      <p className="font-medium text-foreground">${item.subtotal.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingQuotation && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-lg border border-border max-w-lg w-full">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Edit Quotation {editingQuotation.id}
              </h3>
              <button
                onClick={() => setEditingQuotation(null)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Status</label>
                <div className="space-y-2">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium text-foreground">Current Status: <StatusBadge status={editingQuotation.status} /></p>
                  </div>
                  
                  {getValidStatusOptions(editingQuotation.status).length > 0 ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowStatusDropdown(p => !p)}
                        className="input-field w-full flex items-center justify-between text-left capitalize"
                      >
                        <span>{selectedNewStatus.charAt(0).toUpperCase() + selectedNewStatus.slice(1)}</span>
                        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showStatusDropdown && (
                        <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                          {getValidStatusOptions(editingQuotation.status).map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => { setSelectedNewStatus(status); setShowStatusDropdown(false); }}
                              className={`w-full text-left px-4 py-2.5 text-sm capitalize transition-colors hover:bg-muted ${selectedNewStatus === status ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                            >
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                      <p className="text-sm text-destructive font-medium">This status cannot be changed</p>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded">
                    ℹ️ {getStatusHelpText(editingQuotation.status)}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setEditingQuotation(null)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={getValidStatusOptions(editingQuotation.status).length === 0}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={18} />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={() => {
          if (deletingId) {
            deleteQuotation(deletingId);
            toast.success('Quotation deleted');
            setDeletingId(null);
          }
        }}
        title="Delete Quotation"
        itemName={deletingId ? `Quotation #${deletingId}` : undefined}
      />
    </div>
  );
};

export default QuotationHistory;
