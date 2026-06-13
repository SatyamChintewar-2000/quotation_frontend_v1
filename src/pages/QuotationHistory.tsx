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
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [isPdfCapturing, setIsPdfCapturing] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshQuotations();
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

  const handleEditItems = (q: any) => {
    sessionStorage.setItem('editingQuotation', JSON.stringify(q));
    navigate('/new-quotation?mode=edit&id=' + q.id);
  };

  const handleDuplicate = async (q: any) => {
    try {
      const response = await api.post(`/api/quotations/${q.id}/duplicate`);
      toast.success(`Quotation duplicated! New quotation #${response.data.id} created in DRAFT status. You can now edit it.`);
      refreshQuotations();
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
          refreshQuotations();
        }
      }
      setEditingQuotation(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Download PDF using html2canvas with smart page-break detection.
  // Measures actual DOM row positions to ensure no row is ever split mid-page.
  const downloadPDF = async (quotation?: any) => {
    const target = quotation || viewingQuotation;
    if (!target) return;

    try {
      setDownloading(true);

      if (printRef.current && viewingQuotation && (!quotation || quotation.id === viewingQuotation.id)) {
        const html2canvas = (await import('html2canvas')).default;
        const { jsPDF }   = await import('jspdf');

        // 1. Hide watermark during capture
        setIsPdfCapturing(true);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        // 2. Wait until all product images are decoded
        await new Promise<void>((resolve) => {
          const el = printRef.current!;
          const check = () => {
            if (el.getAttribute('data-images-ready') === 'true') { resolve(); return; }
            setTimeout(check, 80);
          };
          check();
        });

        // 3. Scroll to top
        const scrollContainer = printRef.current.closest('.overflow-y-auto');
        if (scrollContainer) scrollContainer.scrollTop = 0;
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        const rootEl = printRef.current;

        // 4. Measure safe page-break positions.
        //    A4 at 794px wide = 1123px tall (794 * 297/210).
        //    We work in screen pixels (scale=1) then multiply for canvas coords.
        const pxPerMm    = rootEl.offsetWidth / 210;          // px per mm at screen scale
        const pageHeightPx = 297 * pxPerMm;                   // A4 height in px
        const rootTop    = rootEl.getBoundingClientRect().top + window.scrollY;

        // Collect all table rows in the product table — these must never be split
        const tableRows = Array.from(rootEl.querySelectorAll('tbody tr')) as HTMLElement[];

        // Build list of "forbidden zones": [rowTop, rowBottom] in component-relative px
        const forbiddenZones = tableRows.map(row => {
          const rect = row.getBoundingClientRect();
          const top    = rect.top    + window.scrollY - rootTop;
          const bottom = rect.bottom + window.scrollY - rootTop;
          return { top, bottom };
        });

        // Calculate smart page break positions:
        // Start with natural A4 breaks, then push each break to avoid splitting a row
        const totalHeightPx = rootEl.scrollHeight;
        const naturalBreaks: number[] = [];
        for (let y = pageHeightPx; y < totalHeightPx; y += pageHeightPx) {
          naturalBreaks.push(y);
        }

        const smartBreaks: number[] = naturalBreaks.map(breakY => {
          // Check if this break falls inside any row
          for (const zone of forbiddenZones) {
            if (breakY > zone.top && breakY < zone.bottom) {
              // Push break UP to just before this row starts
              return zone.top - 4; // 4px margin above row
            }
          }
          return breakY;
        });

        // 5. Capture the full canvas
        const SCALE = 2;
        const canvas = await html2canvas(rootEl, {
          scale: SCALE,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 30000,
          windowHeight: totalHeightPx,
          height: totalHeightPx,
          y: 0,
          onclone: (_doc, clonedEl) => {
            clonedEl.querySelectorAll('img').forEach((img: HTMLImageElement) => {
              img.style.display      = 'block';
              img.style.visibility   = 'visible';
              img.style.opacity      = '1';
            });
          },
        });

        // 6. Build PDF: slice canvas at smart break positions
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfPageW = pdf.internal.pageSize.getWidth();   // 210mm
        const pdfPageH = pdf.internal.pageSize.getHeight();  // 297mm

        // Convert smart breaks from screen-px to canvas-px
        const canvasBreaks = smartBreaks.map(b => Math.round(b * SCALE));
        const canvasTotal  = canvas.height;

        // Build slice boundaries: [0, break1, break2, ..., totalHeight]
        const sliceStarts  = [0, ...canvasBreaks];
        const sliceEnds    = [...canvasBreaks, canvasTotal];

        for (let i = 0; i < sliceStarts.length; i++) {
          const sliceTop    = sliceStarts[i];
          const sliceBottom = sliceEnds[i];
          const sliceH      = sliceBottom - sliceTop;

          if (sliceH <= 0) continue;

          // Create an offscreen canvas for this slice
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width  = canvas.width;
          sliceCanvas.height = sliceH;
          const ctx = sliceCanvas.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, sliceCanvas.width, sliceH);
          ctx.drawImage(canvas, 0, sliceTop, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

          const sliceData   = sliceCanvas.toDataURL('image/jpeg', 0.93);
          // Height of this slice in mm
          const sliceHeightMm = (sliceH / SCALE) * (pdfPageW / rootEl.offsetWidth);

          if (i > 0) pdf.addPage();
          pdf.addImage(sliceData, 'JPEG', 0, 0, pdfPageW, sliceHeightMm);
        }

        pdf.save(`quotation-${target.quotationNumber || target.id}.pdf`);
        setIsPdfCapturing(false);
        toast.success('PDF downloaded successfully');
        return;
      }

      // Fallback: open the view modal
      setViewingQuotation(target);
      toast.info('Click "Download PDF" in the view modal');
    } catch (err) {
      console.error('PDF generation failed:', err);
      setIsPdfCapturing(false);
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
                <QuotationPrintView ref={printRef} quotation={viewingQuotation} forPdf={isPdfCapturing} />
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
