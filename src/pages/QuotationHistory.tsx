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
  const [cbmExcelCompany, setCbmExcelCompany] = useState<any>(null);

  // Load company settings once for CBM Excel button visibility
  React.useEffect(() => {
    if (!user) return;
    import('@/services/companyService').then(({ companyService }) => {
      companyService.getMyCompany()
        .then((c) => { if (c.cbmAdvancedMode) setCbmExcelCompany(c); })
        .catch(() => {});
    });
  }, [user]);
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
        hsnSacCode: item.hsnSacCode || '',
      }));
      setViewingQuotation({
        ...d,
        grandTotal: d.totalAmount ?? d.grandTotal ?? 0,
        clientName: d.customerName || d.clientName || '',
        customerAddress: d.customerAddress || '',
        shippingAddress: d.shippingAddress || '',
        items,
        // Preserve snapshot rates so PDF always shows historical rates
        usdExchangeRateSnapshot: d.usdExchangeRateSnapshot,
        ratePerCbmSnapshot: d.ratePerCbmSnapshot,
        // Preserve expiry date for Valid Till in PDF
        expiryDate: d.expiryDate,
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

  // Download CBM Excel (3-sheet) — values in Master, formulas in Sheet2
  const downloadCbmExcel = async () => {
    if (!viewingQuotation || !cbmExcelCompany) return;
    try {
      const XLSX = await import('xlsx');
      const q  = viewingQuotation;
      const co = cbmExcelCompany;

      // exchRate: use current company setting for Excel G8 (user-editable, should start from current rate)
      // ratePerCbm: use snapshot if available (locked at quotation time), else current
      const exchRate    = Number(co.usdExchangeRate) || Number(q.usdExchangeRateSnapshot) || 83;
      const ratePerCbm  = Number(q.ratePerCbmSnapshot ?? co.ratePerCbm) || 0;
      const clearPerCbm = Number(co.clearancePerCbm) || 1667;
      const allServices = (q.services || []) as any[];
      const installCost = allServices
        .filter((s: any) => /install/i.test(s.serviceName || ''))
        .reduce((sum: number, s: any) => {
          const p = Number(s.servicePrice) || 0;
          const t = Number(s.serviceTax) || 0;
          return sum + p + p * t / 100;
        }, 0);
      const shippingCost = allServices
        .filter((s: any) => /ship|freight|logistic/i.test(s.serviceName || ''))
        .reduce((sum: number, s: any) => {
          const p = Number(s.servicePrice) || 0;
          const t = Number(s.serviceTax) || 0;
          return sum + p + p * t / 100;
        }, 0);

      const wb = XLSX.utils.book_new();
      const compName = co.companyName || '';
      const qNo      = q.quotationNumber || String(q.id);
      const qDate    = q.quotationDate || q.createdAt || '';
      const discPct  = (q.items as any[]).length > 0
        ? Number((q.items as any[])[0].discountPercentage ?? 0) / 100 : 0;

      // ── SHEET 1: Master Feb22 — all calculated values (no cross-sheet formulas) ──
      const s1: any[][] = [];
      s1.push(['', compName]);                                        // row 1
      s1.push(['', co.address || '']);                                // row 2
      s1.push(['', `Website: ${co.email || ''}`]);                   // row 3
      s1.push(['', `Phone/WhatsApp: ${co.phone || ''}`]);            // row 4
      s1.push(['', `GST - ${co.gstNumber || ''}`]);                  // row 5
      s1.push(['Series:', '', 'Luxury', '', 'Invoice No:', '', '', '', '', qNo]); // row 6
      s1.push(['For: ', '', q.clientName || q.customerName || '', '', 'Date:', '', '', '', '', qDate, '', 'Discount', discPct]); // row 7
      s1.push(['No.', 'Model No', 'Name', 'Picture', 'N.W.(kg)', 'Stack Weight(kg)', 'Unit Price', 'Discounted Price', 'QTY', 'Total', 'USD', 'QTY', 'Total USD', 'CBM', 'Total CBM']); // row 8

      let totINR = 0, totUSD = 0, totCBM = 0;
      (q.items as any[]).forEach((item: any, idx: number) => {
        const unitP  = Number(item.unitPrice ?? 0);
        const disc   = Number(item.discountPercentage ?? 0);
        const qty    = Number(item.quantity ?? 1);
        const discP  = unitP * (1 - disc / 100);
        const total  = discP * qty;
        const usd    = Number((discP / exchRate).toFixed(0));
        const totU   = usd * qty;
        const cbm    = Number(item.cbmSnapshot ?? 0);
        const totC   = Number((cbm * qty).toFixed(4));
        const nw     = Number(item.netWeightSnapshot ?? 0);
        totINR += total; totUSD += totU; totCBM += totC;
        s1.push([
          idx + 1, item.productCode || '',
          item.productNameSnapshot || item.productName || '',
          '', nw || 'N/A', '',
          unitP, discP, qty, total,
          usd, qty, totU,
          cbm || '', totC || '',
        ]);
      });

      const gst18   = totINR * 0.18;  // selling GST (matches Bill Details B3)
      const grandT  = totINR + gst18;
      const totQty  = (q.items as any[]).reduce((s: number, i: any) => s + Number(i.quantity ?? 1), 0);
      s1.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '']); // blank
      s1.push(['', '', 'Total', '', '', '', '', '', totQty, totINR, '', totQty, totUSD, '', totCBM]);
      s1.push(['', '', 'GST 18%', '', '', '', '', '', '', gst18]);
      s1.push(['', '', 'Grand Total', '', '', '', '', '', '', grandT]);
      s1.push([]);
      s1.push(['', '', 'REMARKS:']);
      const terms = (q.termsAndConditions || '').split('\n').filter((l: string) => l.trim());
      terms.forEach((line: string, i: number) => s1.push(['', '', `${i + 1}. ${line.trim()}`]));
      s1.push(['', '', `Quotation: ${qNo}  |  Date: ${qDate}  |  Valid Till: ${q.expiryDate || 'N/A'}`]);

      const ws1 = XLSX.utils.aoa_to_sheet(s1);
      ws1['!cols'] = [
        {wch:5},{wch:10},{wch:28},{wch:8},{wch:8},{wch:12},
        {wch:12},{wch:14},{wch:5},{wch:12},{wch:8},{wch:5},{wch:12},{wch:7},{wch:10},
      ];
      XLSX.utils.book_append_sheet(wb, ws1, 'Master Feb22');

      // ── SHEET 2: Cost Analysis — values + formulas for user to change rates ──
      // Put named values in G column so formulas are live:
      //   G7 = Rate/CBM (user can change)
      //   G8 = Exchange Rate (user can change)
      //   G9 = Total CBM (linked to value)
      //   B2 = Total INR (value)
      // Then H column uses G column references — fully recalculates when user changes G7/G8

      const equipCost = await (async () => {
        // Try to load products to get purchase prices (same logic as NewQuotation panel)
        try {
          const { productService } = await import('@/services/productService');
          const prods = await productService.getAll();
          return (q.items as any[]).reduce((sum: number, item: any) => {
            const prod = prods.find((p) => p.id === item.productId);
            const pp = Number(prod?.purchasePrice ?? 0);
            const disc = Number(item.discountPercentage ?? 0);
            const costPerUnit = pp > 0 ? pp : Number(item.unitPrice ?? 0) * (1 - disc / 100);
            return sum + costPerUnit * Number(item.quantity ?? 1);
          }, 0);
        } catch {
          // Fallback to discounted selling price
          return totUSD * exchRate;
        }
      })();
      const freightUsd  = totCBM * ratePerCbm;
      const freightInr  = freightUsd * exchRate;
      const totalServiceCost = installCost + shippingCost;
      const totalCost   = equipCost + freightInr + totalServiceCost;
      const gstCost     = gst18;
      const clearCost   = totCBM * clearPerCbm;
      const grandCost   = totalCost + gstCost + clearCost;
      const profit      = grandT - grandCost;
      const profitPct   = grandT > 0 ? (profit / grandT) * 100 : 0;
      const instPerCbm  = totCBM > 0 ? Math.round(totalServiceCost / totCBM) : 1167;

      // Cross-sheet row references into "Master Feb22":
      // 8 header rows + N item rows + 1 blank = totals row
      const itemCount   = (q.items as any[]).length;
      const totRow      = 8 + itemCount + 2;  // +1 for blank row, +1 for 1-indexed
      const s1TotINR    = `'Master Feb22'!J${totRow}`;        // col J = Total INR
      const s1GstINR    = `'Master Feb22'!J${totRow + 1}`;    // col J = GST row
      const s1GrandINR  = `'Master Feb22'!J${totRow + 2}`;    // col J = Grand Total row
      const s1TotUSD    = `'Master Feb22'!M${totRow}`;         // col M = Total USD
      const s1TotCBM    = `'Master Feb22'!O${totRow}`;         // col O = Total CBM

      const s2: any[][] = [
        // Row 1
        ['Bill details', '', '', '', '', '', '', '', '', '', ''],
        // Row 2 — B2 = Total from Sheet1
        ['Total',        { f: s1TotINR },   '', '', '', '', '', '', '', '', ''],
        // Row 3 — B3 = GST from Sheet1 (not hardcoded 0.18 — rate may change)
        ['GST 18%',      { f: s1GstINR },   '', '', '', '', '', '', '', '', ''],
        // Row 4 — B4 = Grand Total from Sheet1
        ['Grand Total',  { f: s1GrandINR }, '', '', '', '', '', '', '', '', ''],
        // Row 5 — blank
        [],
        // Row 6 — D6="total USD", E6=Total USD, F6="total CBM", G6=Total CBM
        ['', '', '', 'total USD', { f: s1TotUSD }, 'total CBM', { f: s1TotCBM }, '', '', '', ''],
        // Row 7 — G7 = K10 (Rate/CBM, links to cost column)
        ['', '', '', '', '', '', { f: 'K10' }, 'Rate/CBM', '', '', ''],
        // Row 8 — G8 = exchRate (user editable), H8 = E6*G8 (Equipment Cost)
        ['', '', '', '', '', '', exchRate, { f: 'E6*G8' }, 'Equipment Cost', '', ''],
        // Row 9 — G9 = G6*K10 (freight USD), H9 = G9*G8 (Shipping Cost INR), K9 = Today Cost (all services)
        ['', '', '', '', '', '', { f: 'G6*K10' }, { f: 'G9*G8' }, 'Shipping Cost', 'Today Cost', shippingCost],
        // Row 10 — H10 = SUM(H8:H9), K10 = K9/60 (Cost/CBM)
        ['', '', '', '', '', '', '', { f: 'SUM(H8:H9)' }, 'Total', 'Cost/ CBM', { f: 'K9/60' }],
        // Row 11 — H11 = H10*(B3/B2) — GST rate derived from Sheet1, not hardcoded
        ['', '', '', '', '', '', '', { f: 'H10*(B3/B2)' }, 'GST', 'Installation per CBM', { f: '70000/60' }],
        // Row 12 — H12 = G6*K12, K12 = 100000/60 (Clearance per cbm)
        ['', '', '', '', '', '', '', { f: 'G6*K12' }, 'Clearance', 'Clearance per cbm', { f: '100000/60' }],
        // Row 13 — Transportation (blank value)
        ['', '', '', '', '', '', '', '', 'Transporatation', '', ''],
        // Row 14 — H14 = total service cost (installation + shipping), I14="Installation"
        ['', '', '', '', '', '', '', installCost, 'Installation', '', ''],
        // Row 15 — H15 = SUM(H10:H14)
        ['', '', '', '', '', '', '', { f: 'SUM(H10:H14)' }, 'Total', '', ''],
        // Row 16 — PRFT: H16 = Grand Total from Sheet1 - H15 (Total Cost)
        ['', '', '', '', '', 'PRFT', '', { f: `${s1GrandINR}-Sheet2!H15` }, '', '', ''],
        // Row 17 — %: H17 = H16 / Grand Total from Sheet1 * 100
        ['', '', '', '', '', '%', '', { f: `H16/${s1GrandINR}*100` }, '', '', ''],
      ];

      const ws2 = XLSX.utils.aoa_to_sheet(s2);
      ws2['!cols'] = [
        {wch:14},{wch:12},{wch:4},{wch:12},{wch:10},
        {wch:10},{wch:10},{wch:12},{wch:16},{wch:20},{wch:8},
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Sheet2');

      // ── SHEET 3: Series/Discount lookup ───────────────────────────────────
      const s3: any[][] = [
        ['Series:', 'Discount'],
        ['M05', 0.00], ['FW', 0.01], ['HAM', 0.02], ['T8', 0.03],
        ['CARD', 0.04], ['M8F', 0.05], ['SN', 0.06],
      ];
      for (let i = 7; i <= 46; i++) s3.push(['', Number((i / 100).toFixed(2))]);
      const ws3 = XLSX.utils.aoa_to_sheet(s3);
      ws3['!cols'] = [{wch:10},{wch:10}];
      XLSX.utils.book_append_sheet(wb, ws3, 'Sheet3');

      XLSX.writeFile(wb, `quotation-cbm-${qNo}.xlsx`);
      toast.success('CBM Excel downloaded');
    } catch (err) {
      console.error('CBM Excel failed:', err);
      toast.error('Failed to generate CBM Excel');
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
                          ?{new Intl.NumberFormat('en-IN').format(Math.round(q.grandTotal))}
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
                {cbmExcelCompany && viewingQuotation && !viewLoading && (
                  <button
                    onClick={downloadCbmExcel}
                    className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                    title="Download 3-sheet CBM Excel (Quotation + Cost Analysis + Rates)"
                  >
                    <Download size={15} />
                    Export Excel (CBM)
                  </button>
                )}
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
