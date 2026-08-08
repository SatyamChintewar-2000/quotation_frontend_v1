import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useQuotations } from '@/contexts/QuotationContext';
import { toast } from 'sonner';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { ExportButton } from '@/components/common/ExportButton';
import { exportToExcel, formatDateForExcel, formatCurrencyForExcel } from '@/utils/excelExport';
import { History, Eye, Download, Edit, Trash2, X, Save, ChevronDown, Loader2, Copy, Edit2 } from 'lucide-react';
import api from '@/services/api';
import { SearchBar } from '@/components/common/SearchBar';
import { Pagination } from '@/components/common/Pagination';
import { DeleteConfirmModal } from '@/components/common/DeleteConfirmModal';
import { SortableHeader } from '@/components/common/SortableHeader';
import { useSortable } from '@/hooks/useSortable';
import { StatusBadge } from '@/components/common/StatusBadge';
import QuotationPrintView from '@/components/common/QuotationPrintView';
import { useNavigate } from 'react-router-dom';

const ITEMS_PER_PAGE = 10;

const QuotationHistory = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const {
    quotations,
    loading: quotationsLoading,
    totalElements,
    totalPages,
    currentPage: serverPage,
    fetchPage,
    updateQuotation,
    deleteQuotation,
    refreshQuotations,
  } = useQuotations();
  const [viewingQuotation, setViewingQuotation] = useState<any>(null);
  const [editingQuotation, setEditingQuotation] = useState<any>(null);
  const [selectedNewStatus, setSelectedNewStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
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
    const generatedNext = notificationsEnabled ? ['sent', 'approved'] : ['approved'];
    const map: Record<string, string[]> = {
      draft: ['generated', 'rejected'],
      generated: generatedNext,
      sent: ['approved', 'rejected'],
      approved: [],
      rejected: [],
    };
    return map[s.toLowerCase()] || [];
  };

  const getStatusHelpText = (s: string): string => {
    const generatedHelp = notificationsEnabled
      ? 'Can change to: Sent, Approved'
      : 'Can change to: Approved (notifications are off)';
    const map: Record<string, string> = {
      draft: 'Can change to: Generated, Rejected',
      generated: generatedHelp,
      sent: 'Can change to: Approved, Rejected',
      approved: 'Terminal state',
      rejected: 'Terminal state',
    };
    return map[s.toLowerCase()] || '';
  };

  const isSuperAdmin = user?.role === 'superadmin';
  const userQuotations: any[] = quotations;

  /**
   * Fetch full quotation detail (with items + images) from the server
   * and open the view modal. The list endpoint excludes images for performance,
   * so we always need to call GET /api/quotations/{id} before showing the modal.
   */
  const [viewLoading, setViewLoading] = useState(false);
  const handleView = async (q: any) => {
    setViewingQuotation(q); // open modal immediately with summary
    setViewLoading(true);
    try {
      const res = await api.get(`/api/quotations/${q.id}`);
      const d = res.data;
      // Remap items to ensure all display fields are populated
      const items = (d.items || []).map((item: any) => ({
        ...item,
        // productName = current product name from DB (reliable)
        // productNameSnapshot = name at time of quoting (may be corrupted in old records)
        // QuotationPrintView reads productNameSnapshot first, then productName
        // So we set productNameSnapshot to the best available name
        productName: item.productName || item.productNameSnapshot || '—',
        productNameSnapshot: item.productNameSnapshot && item.productNameSnapshot !== item.productName
          ? item.productNameSnapshot  // keep snapshot if it differs (genuine historical data)
          : item.productName || item.productNameSnapshot || '—', // prefer current name
        productDescription: item.productDescriptionSnapshot || item.productDescription || '',
        // For image: try snapshot first, then current product image
        imagePathSnapshot: item.imagePathSnapshot || item.imagePath || '',
        imagePath: item.imagePath || item.imagePathSnapshot || '',
        // Ensure numeric fields are numbers
        unitPrice: Number(item.unitPrice ?? 0),
        quantity: Number(item.quantity ?? 0),
        discountPercentage: Number(item.discountPercentage ?? 0),
        taxPercentage: Number(item.taxPercentage ?? 0),
        itemTotal: Number(item.itemTotal ?? 0),
      }));
      setViewingQuotation({
        ...d,
        grandTotal: d.totalAmount ?? d.grandTotal ?? 0,
        clientName: d.customerName || d.clientName || '',
        customerAddress: d.customerAddress || '',
        shippingAddress: d.shippingAddress || '',
        items,
      });
    } catch {
      // keep summary already shown
    } finally {
      setViewLoading(false);
    }
  };

  // Client-side filter applied on the current page of server-returned records
  // (search, date range — these filter the already-loaded page)
  const filteredQuotations = userQuotations.filter((q: any) => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      if (
        !q.id.toString().includes(t) &&
        !(q.clientName || q.customerName || '').toLowerCase().includes(t) &&
        !q.status.toLowerCase().includes(t) &&
        !(q.quotationNumber || '').toLowerCase().includes(t)
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

  // Server controls order (createdAt DESC) and pagination
  // Client-side sort still allows column header clicks for secondary sorting
  const { sortedData: sorted, sort, handleSort } = useSortable(filteredQuotations, { key: 'createdAt', direction: 'desc' });

  // Server-side page navigation
  const handlePageChange = (newPage: number) => {
    // newPage from Pagination component is 1-based; server is 0-based
    fetchPage(newPage - 1);
  };

  React.useEffect(() => { fetchPage(0); }, [searchTerm, fromDate, toDate]);

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

  const handleEditItems = (q: any) => {
    sessionStorage.setItem('editingQuotation', JSON.stringify(q));
    navigate('/new-quotation?mode=edit&id=' + q.id);
  };

  const handleDuplicate = async (q: any) => {
    try {
      const response = await api.post(`/api/quotations/${q.id}/duplicate`);
      toast.success(`Quotation duplicated! New quotation #${response.data.id} created in DRAFT status. You can now edit it.`);
      refreshQuotations(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to duplicate quotation');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingQuotation) return;
    try {
      if (selectedNewStatus !== editingQuotation.status) {
        await updateQuotation(editingQuotation.id, { status: selectedNewStatus });
        if (selectedNewStatus === 'approved') {
          toast.success('Invoice auto-created. Check the Invoices section.');
          refreshQuotations(true);
        }
      }
      setEditingQuotation(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Download PDF — uses pure jsPDF programmatic renderer (no html2canvas).
  // Delivers enterprise-grade output: repeated headers, complete borders,
  // proper row-level page breaks, no content clipping.
  const downloadPDF = async (quotation?: any) => {
    const target = quotation || viewingQuotation;
    if (!target) return;

    try {
      setDownloading(true);

      // If called from the row button and the modal is NOT open,
      // open the view modal first — load full detail including images
      if (quotation && (!viewingQuotation || viewingQuotation.id !== quotation.id)) {
        handleView(quotation);
        toast.info('Opening view — click "Download PDF" to generate');
        setDownloading(false);
        return;
      }

      if (viewingQuotation) {
        const { generateQuotationPdf } = await import('@/utils/generateQuotationPdf');
        const { companyService }        = await import('@/services/companyService');
        const QRCode                    = await import('qrcode');

        // Load company data
        let company: any = {};
        try {
          company = await companyService.getMyCompany();
        } catch {
          try {
            const list = await companyService.getAll();
            if (list.length) company = list[0];
          } catch { /* proceed without company */ }
        }

        // Build QR code
        let qrDataUrl = '';
        if (company?.upiId) {
          const serviceTotal = (viewingQuotation.services || []).reduce((acc: number, sv: any) => {
            const p = Number(sv.servicePrice) || 0, t = Number(sv.serviceTax) || 0;
            return acc + p + p * t / 100;
          }, 0);
          const grandTotal = viewingQuotation.subtotal - viewingQuotation.totalDiscount
            + viewingQuotation.totalGst + serviceTotal;
          const upiStr = `upi://pay?pa=${company.upiId}&pn=${encodeURIComponent(company.companyName || '')}&am=${grandTotal}&cu=INR`;
          try { qrDataUrl = await QRCode.default.toDataURL(upiStr, { width: 120, margin: 1 }); } catch { /* skip */ }
        }

        await generateQuotationPdf(
          viewingQuotation,
          company,
          qrDataUrl,
          `quotation-${viewingQuotation.quotationNumber || viewingQuotation.id}.pdf`,
        );

        toast.success('PDF downloaded successfully');
        return;
      }

      // Fallback: open the view modal with full detail
      handleView(target);
      toast.info('Click "Download PDF" in the view modal');
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <TopBar title="Quotation record" />
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary"><History size={24} /></div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {isSuperAdmin ? 'All Quotations' : 'My Quotations'}
              </h2>
              <p className="text-sm text-muted-foreground">View and manage your Quotation record</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search quotations..." className="w-64" />
            <DateRangePicker fromDate={fromDate} toDate={toDate} onFromDateChange={setFromDate} onToDateChange={setToDate} label="Filter by Date" />
            <ExportButton onClick={handleExportToExcel} disabled={!filteredQuotations.length} count={filteredQuotations.length} />
          </div>
        </div>

        {/* Workflow Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">Quotation Workflow Guide</h4>
              <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                <p><strong>DRAFT:</strong> Click <strong>Edit Items</strong> (✏️ blue icon) to modify items/prices</p>
                <p><strong>GENERATED/SENT/APPROVED:</strong> Cannot edit items (maintains audit trail). Use <strong>Duplicate & Edit</strong> (📋 icon) to create a revision</p>
                <p><strong>Duplicate & Edit:</strong> Creates a new quotation with a new number, preserving the original for records</p>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl shadow-md border border-border overflow-hidden">
          {(quotationsLoading || (!authLoading && isAuthenticated && quotations.length === 0 && !searchTerm && !fromDate && !toDate)) ? (
            /* ── Skeleton rows for the quotation list table ── */
            <div className="animate-pulse">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="px-6 py-4 text-left">ID</th>
                    <th className="px-6 py-4 text-left">Client</th>
                    <th className="px-6 py-4 text-left">Items</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="px-6 py-4 text-left">Date</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-8" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-28" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-14" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 bg-muted rounded w-20 ml-auto" /></td>
                      <td className="px-6 py-4"><div className="h-6 bg-muted rounded-full w-20" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-20" /></td>
                      <td className="px-6 py-4"><div className="h-6 bg-muted rounded w-32 mx-auto" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredQuotations.length === 0 ? (
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
                    {sorted.map((q: any) => (
                      <tr key={q.id} className="table-row">
                        <td className="px-6 py-4 font-medium text-foreground">{q.id}</td>
                        <td className="px-6 py-4 text-foreground">{q.clientName || q.customerName}</td>
                        <td className="px-6 py-4 text-muted-foreground">{q.items?.length || 0} items</td>
                        <td className="px-6 py-4 text-right font-medium text-foreground">
                          ₹{new Intl.NumberFormat('en-IN').format(Math.round(q.grandTotal))}
                        </td>
                        <td className="px-6 py-4"><StatusBadge status={q.status} /></td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(q.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleView(q)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="View">
                              <Eye size={15} className="text-muted-foreground" />
                            </button>
                            {q.status.toLowerCase() === 'draft' && (
                              <button
                                onClick={() => handleEditItems(q)}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                                title="Edit Items & Prices"
                              >
                                <Edit2 size={15} className="text-blue-600" />
                              </button>
                            )}
                            <button onClick={() => handleEdit(q)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Change Status">
                              <ChevronDown size={15} className="text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => handleDuplicate(q)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                              title="Duplicate & Edit"
                            >
                              <Copy size={15} className="text-muted-foreground" />
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
                currentPage={serverPage + 1}
                totalPages={totalPages}
                totalItems={totalElements}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={handlePageChange}
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
                  disabled={downloading || viewLoading}
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
              {viewLoading ? (
                /* ── Skeleton loader mimicking the quotation PDF layout ── */
                <div className="mx-auto bg-white rounded shadow-lg p-6 space-y-5 animate-pulse">
                  {/* Company header */}
                  <div className="flex items-start justify-between">
                    <div className="w-24 h-24 bg-gray-200 rounded" />
                    <div className="space-y-2 flex-1 ml-6">
                      <div className="h-6 bg-gray-200 rounded w-48 ml-auto" />
                      <div className="h-4 bg-gray-200 rounded w-64 ml-auto" />
                      <div className="h-4 bg-gray-200 rounded w-40 ml-auto" />
                    </div>
                  </div>
                  {/* Bill to + Quotation title */}
                  <div className="grid grid-cols-3 gap-4 border-t border-b border-gray-100 py-4">
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-16" />
                      <div className="h-5 bg-gray-200 rounded w-32" />
                      <div className="h-4 bg-gray-200 rounded w-24" />
                    </div>
                    <div className="flex items-center justify-center">
                      <div className="h-8 bg-gray-200 rounded w-36" />
                    </div>
                    <div className="space-y-2 text-right">
                      <div className="h-4 bg-gray-200 rounded w-28 ml-auto" />
                      <div className="h-4 bg-gray-200 rounded w-24 ml-auto" />
                    </div>
                  </div>
                  {/* Product table header */}
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-32" />
                    <div className="h-10 bg-gray-300 rounded w-full" />
                    {/* Product rows */}
                    {[1, 2, 3].map(i => (
                      <div key={i} className="grid grid-cols-6 gap-3 items-center py-3 border-b border-gray-100">
                        <div className="col-span-1 flex justify-center">
                          <div className="w-16 h-16 bg-gray-200 rounded" />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-32" />
                          <div className="h-3 bg-gray-200 rounded w-24" />
                        </div>
                        <div className="h-4 bg-gray-200 rounded w-16" />
                        <div className="h-4 bg-gray-200 rounded w-16" />
                        <div className="h-4 bg-gray-200 rounded w-16" />
                      </div>
                    ))}
                  </div>
                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between"><div className="h-4 bg-gray-200 rounded w-20" /><div className="h-4 bg-gray-200 rounded w-24" /></div>
                      <div className="flex justify-between"><div className="h-4 bg-gray-200 rounded w-20" /><div className="h-4 bg-gray-200 rounded w-24" /></div>
                      <div className="flex justify-between"><div className="h-4 bg-gray-200 rounded w-20" /><div className="h-4 bg-gray-200 rounded w-24" /></div>
                      <div className="flex justify-between mt-2"><div className="h-5 bg-gray-300 rounded w-24" /><div className="h-5 bg-gray-300 rounded w-28" /></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mx-auto shadow-lg">
                  <QuotationPrintView ref={printRef} quotation={viewingQuotation} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingQuotation && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-lg border border-border max-w-lg w-full">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Change Status - Quotation {editingQuotation.id}</h3>
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
