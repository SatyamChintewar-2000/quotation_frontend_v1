import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useQuotations } from '@/contexts/QuotationContext';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { ExportButton } from '@/components/common/ExportButton';
import { exportToExcel, formatDateForExcel, formatCurrencyForExcel } from '@/utils/excelExport';
import { History, Eye, Download, Edit, Trash2, X, Save, ChevronDown, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { SearchBar } from '@/components/common/SearchBar';
import { Pagination } from '@/components/common/Pagination';
import { DeleteConfirmModal } from '@/components/common/DeleteConfirmModal';
import { SortableHeader } from '@/components/common/SortableHeader';
import { useSortable } from '@/hooks/useSortable';
import { StatusBadge } from '@/components/common/StatusBadge';
import QuotationPrintView from '@/components/common/QuotationPrintView';

const ITEMS_PER_PAGE = 10;

const QuotationHistory = () => {
  const { user } = useAuth();
  const { quotations, updateQuotation, deleteQuotation, refreshQuotations } = useQuotations();
  const [viewingQuotation, setViewingQuotation] = useState<any>(null);
  const [editingQuotation, setEditingQuotation] = useState<any>(null);
  const [selectedNewStatus, setSelectedNewStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/api/quotations/notification-settings')
      .then(res => setNotificationsEnabled(res.data.notificationsEnabled))
      .catch(() => setNotificationsEnabled(true));
  }, []);

  const getValidStatusOptions = (s: string): string[] => {
    const gen = notificationsEnabled ? ['sent'] : ['approved'];
    const map: Record<string, string[]> = {
      draft: ['generated', 'rejected'],
      generated: gen,
      sent: ['approved', 'rejected'],
      approved: [],
      rejected: [],
    };
    return map[s.toLowerCase()] || [];
  };

  const getStatusHelpText = (s: string): string => {
    const genHelp = notificationsEnabled ? 'Can change to: Sent' : 'Can change to: Approved';
    const map: Record<string, string> = {
      draft: 'Can change to: Generated, Rejected',
      generated: genHelp,
      sent: 'Can change to: Approved, Rejected',
      approved: 'Terminal state',
      rejected: 'Terminal state',
    };
    return map[s.toLowerCase()] || '';
  };

  const isSuperAdmin = user?.role === 'superadmin';
  const userQuotations: any[] = isSuperAdmin
    ? quotations
    : quotations.filter((q: any) => q.createdBy === user?.id);

  const filteredQuotations = userQuotations.filter((q: any) => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      if (
        !q.id.toString().includes(t) &&
        !(q.clientName || q.customerName || '').toLowerCase().includes(t) &&
        !q.status.toLowerCase().includes(t)
      ) return false;
    }
    if (!fromDate && !toDate) return true;
    const d = new Date(q.createdAt);
    d.setHours(0, 0, 0, 0);
    const from = fromDate ? new Date(fromDate) : null;
    if (from) from.setHours(0, 0, 0, 0);
    const to = toDate ? new Date(toDate) : null;
    if (to) to.setHours(23, 59, 59, 999);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  const { sortedData: sorted, sort, handleSort } = useSortable(filteredQuotations);
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  React.useEffect(() => { setCurrentPage(1); }, [searchTerm, fromDate, toDate]);

  const handleExportToExcel = () => {
    if (!filteredQuotations.length) { toast.error('No quotations to export'); return; }
    exportToExcel(
      filteredQuotations.map((q: any) => ({
        id: q.id,
        clientName: q.clientName || q.customerName,
        itemsCount: q.items?.length || 0,
        subtotal: formatCurrencyForExcel(q.subtotal),
        totalDiscount: formatCurrencyForExcel(q.totalDiscount),
        totalGst: formatCurrencyForExcel(q.totalGst),
        grandTotal: formatCurrencyForExcel(q.grandTotal),
        status: q.status.toUpperCase(),
        createdAt: formatDateForExcel(q.createdAt),
      })),
      [
        { header: 'Quotation ID', key: 'id', width: 15 },
        { header: 'Client Name', key: 'clientName', width: 20 },
        { header: 'Items Count', key: 'itemsCount', width: 12 },
        { header: 'Subtotal', key: 'subtotal', width: 15 },
        { header: 'Discount', key: 'totalDiscount', width: 15 },
        { header: 'GST', key: 'totalGst', width: 15 },
        { header: 'Grand Total', key: 'grandTotal', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Date', key: 'createdAt', width: 15 },
      ],
      'quotations'
    );
    toast.success('Quotations exported to Excel');
  };

  const handleEdit = (q: any) => {
    setEditingQuotation({ ...q });
    const opts = getValidStatusOptions(q.status);
    setSelectedNewStatus(opts.length > 0 ? opts[0] : q.status);
    setShowStatusDropdown(false);
  };

  const handleSaveEdit = async () => {
    if (!editingQuotation) return;
    try {
      if (selectedNewStatus !== editingQuotation.status) {
        await updateQuotation(editingQuotation.id, { status: selectedNewStatus });
        if (selectedNewStatus === 'approved') {
          toast.success('Invoice auto-created. Check the Invoices section.');
          refreshQuotations();
        }
      }
      setEditingQuotation(null);
    } catch (err) {
      console.error(err);
    }
  };

  const downloadPDF = async (quotation?: any) => {
    const target = quotation || viewingQuotation;
    if (!target) return;
    if (!viewingQuotation) {
      setViewingQuotation(target);
      await new Promise(r => setTimeout(r, 400));
    }
    if (!printRef.current) { toast.error('Could not render quotation'); return; }
    try {
      setDownloading(true);
      const canvas = await html2canvas(printRef.current, {
        scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = (canvas.height * pw) / canvas.width;
      const pageH = pdf.internal.pageSize.getHeight();
      let y = 0;
      while (y < ph) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -y, pw, ph);
        y += pageH;
      }
      pdf.save(`quotation-${target.quotationNumber || target.id}.pdf`);
      toast.success('PDF downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <TopBar title="Quotation History" />
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary"><History size={24} /></div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {isSuperAdmin ? 'All Quotations' : 'My Quotations'}
              </h2>
              <p className="text-sm text-muted-foreground">View and manage your quotation history</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search quotations..." className="w-64" />
            <DateRangePicker fromDate={fromDate} toDate={toDate} onFromDateChange={setFromDate} onToDateChange={setToDate} label="Filter by Date" />
            <ExportButton onClick={handleExportToExcel} disabled={!filteredQuotations.length} count={filteredQuotations.length} />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl shadow-md border border-border overflow-hidden">
          {filteredQuotations.length === 0 ? (
            <div className="p-12 text-center">
              <History size={48} className="mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                {fromDate || toDate ? 'No quotations for selected date range' : 'No quotations yet'}
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
                    {paginated.map((q: any) => (
                      <tr key={q.id} className="table-row">
                        <td className="px-6 py-4 font-medium text-foreground">{q.id}</td>
                        <td className="px-6 py-4 text-foreground">{q.clientName || q.customerName}</td>
                        <td className="px-6 py-4 text-muted-foreground">{q.items?.length || 0} items</td>
                        <td className="px-6 py-4 text-right font-medium text-foreground">
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(q.grandTotal)}
                        </td>
                        <td className="px-6 py-4"><StatusBadge status={q.status} /></td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(q.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setViewingQuotation(q)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="View">
                              <Eye size={15} className="text-muted-foreground" />
                            </button>
                            <button onClick={() => handleEdit(q)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Edit">
                              <Edit size={15} className="text-muted-foreground" />
                            </button>
                            <button onClick={() => downloadPDF(q)} disabled={downloading} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Download PDF">
                              {downloading
                                ? <Loader2 size={15} className="animate-spin text-muted-foreground" />
                                : <Download size={15} className="text-muted-foreground" />}
                            </button>
                            <button onClick={() => setDeletingId(q.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" title="Delete">
                              <Trash2 size={15} className="text-destructive" />
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
                totalItems={sorted.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* View Modal */}
      {viewingQuotation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {viewingQuotation.quotationNumber || `Quotation #${viewingQuotation.id}`}
                </h3>
                <p className="text-sm text-gray-500">{viewingQuotation.clientName || viewingQuotation.customerName}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadPDF()}
                  disabled={downloading}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium disabled:opacity-60"
                >
                  {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  {downloading ? 'Generating...' : 'Download PDF'}
                </button>
                <button onClick={() => setViewingQuotation(null)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 bg-gray-100 p-4">
              <div className="mx-auto shadow-lg">
                <QuotationPrintView ref={printRef} quotation={viewingQuotation} />
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
              <h3 className="text-lg font-semibold text-foreground">Edit Quotation {editingQuotation.id}</h3>
              <button onClick={() => setEditingQuotation(null)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground mb-2">Status</label>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium text-foreground">
                    Current: <StatusBadge status={editingQuotation.status} />
                  </p>
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
                        {getValidStatusOptions(editingQuotation.status).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => { setSelectedNewStatus(s); setShowStatusDropdown(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm capitalize transition-colors hover:bg-muted ${selectedNewStatus === s ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                          >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
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
                <p className="text-xs text-muted-foreground p-2 bg-blue-50 dark:bg-blue-950 rounded">
                  {getStatusHelpText(editingQuotation.status)}
                </p>
              </div>
              <div className="flex gap-4 mt-6">
                <button onClick={() => setEditingQuotation(null)} className="flex-1 btn-secondary">Cancel</button>
                <button
                  onClick={handleSaveEdit}
                  disabled={getValidStatusOptions(editingQuotation.status).length === 0}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={18} /> Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
