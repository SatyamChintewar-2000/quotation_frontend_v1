import React, { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useQuotations } from '@/contexts/QuotationContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, FileText, User, Package, IndianRupee, CalendarDays, Percent, StickyNote, ScrollText, FileCheck, FileBadge } from 'lucide-react';
import NumericInput from '@/components/common/NumericInput';

const NewInvoice = () => {
  const navigate = useNavigate();
  const { createInvoice, fetchInvoices } = useInvoices();
  const { quotations } = useQuotations();
  const [loading, setLoading] = useState(false);

  const approvedQuotations = quotations.filter((q) => q.status === 'approved');

  const [formData, setFormData] = useState({
    quotationId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    discountPercentage: 0,
    notes: '',
    termsAndConditions: '',
    documentType: 'INVOICE' as 'INVOICE' | 'PROFORMA_INVOICE' | 'TAX_INVOICE',
    gstType: 'SGST_CGST' as 'IGST' | 'SGST_CGST',
    shippingAddress: '',
    deliveryDate: '',
    expiryDate: '',
    paymentTerms: '',
  });

  const [selectedQuotation, setSelectedQuotation] = useState<(typeof quotations)[0] | null>(null);
  const [discountMode, setDiscountMode] = useState<'percent' | 'amount'>('percent');
  const [discountRawInput, setDiscountRawInput] = useState('0');

  const handleQuotationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const quotationId = e.target.value;
    const quotation = quotations.find((q) => q.id === quotationId);
    setSelectedQuotation(quotation || null);
    // Pre-fill invoice-level discount from quotation's stored discount percentage
    const quotDiscount = Number((quotation as any)?.discountPercentage ?? 0);
    setDiscountRawInput(String(quotDiscount));
    setFormData({ ...formData, quotationId, discountPercentage: quotDiscount });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'discountPercentage' ? parseFloat(value) || 0 : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.quotationId) {
      toast.error('Please select a quotation');
      return;
    }
    setLoading(true);
    try {
      const result = await createInvoice({
        quotationId: parseInt(formData.quotationId),
        invoiceDate: formData.invoiceDate,
        dueDate: formData.dueDate,
        discountPercentage: formData.discountPercentage,
        notes: formData.notes,
        termsAndConditions: formData.termsAndConditions,
        documentType: formData.documentType,
        gstType: formData.gstType,
        shippingAddress: formData.shippingAddress || undefined,
        deliveryDate: formData.deliveryDate || undefined,
        expiryDate: formData.expiryDate || undefined,
        paymentTerms: formData.paymentTerms || undefined,
      });
      if (result) {
        await fetchInvoices();
        navigate(`/invoice/${result.id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

  return (
    <div className="min-h-screen">
      <TopBar title="Create New Invoice" />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back */}
        <button
          onClick={() => navigate('/invoices')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Invoices
        </button>

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Create New Invoice</h1>
            <p className="text-sm text-muted-foreground">Generate an invoice from an approved quotation</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Quotation Selection */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Quotation</h2>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Select Approved Quotation *
              </label>
              <select
                value={formData.quotationId}
                onChange={handleQuotationChange}
                required
                className="input-field"
              >
                <option value="">-- Select a quotation --</option>
                {approvedQuotations.map((q) => (
                  <option key={q.id} value={q.id}>
                    #{q.id} — {q.clientName} ({formatCurrency(q.grandTotal)})
                  </option>
                ))}
              </select>
              {approvedQuotations.length === 0 && (
                <p className="text-xs text-destructive mt-1.5">
                  No approved quotations available. Please approve a quotation first.
                </p>
              )}
            </div>

            {/* Quotation preview */}
            {selectedQuotation && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                {[
                  { icon: FileText, label: 'Quotation #', value: `#${selectedQuotation.id}` },
                  { icon: User, label: 'Customer', value: selectedQuotation.clientName },
                  { icon: Package, label: 'Items', value: `${selectedQuotation.items.length} item${selectedQuotation.items.length !== 1 ? 's' : ''}` },
                  { icon: IndianRupee, label: 'Total', value: formatCurrency(selectedQuotation.grandTotal) },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="bg-primary/5 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Icon size={12} />
                      {label}
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dates & Discount */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Invoice Details</h2>

            {/* Document Type Toggle */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Document Type</label>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, documentType: 'INVOICE' })}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                    formData.documentType === 'INVOICE'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <FileCheck size={16} />
                  Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, documentType: 'PROFORMA_INVOICE' })}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                    formData.documentType === 'PROFORMA_INVOICE'
                      ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                      : 'border-border bg-card text-muted-foreground hover:border-amber-300'
                  }`}
                >
                  <FileBadge size={16} />
                  Proforma Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, documentType: 'TAX_INVOICE' })}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                    formData.documentType === 'TAX_INVOICE'
                      ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                      : 'border-border bg-card text-muted-foreground hover:border-green-400'
                  }`}
                >
                  <FileText size={16} />
                  Tax Invoice
                </button>
              </div>
              {formData.documentType === 'PROFORMA_INVOICE' && (
                <p className="text-xs text-amber-600 mt-1.5 dark:text-amber-400">
                  This is a Proforma Invoice and is not a Tax Invoice.
                </p>
              )}
              {formData.documentType === 'TAX_INVOICE' && (
                <p className="text-xs text-green-600 mt-1.5 dark:text-green-400">
                  This is a Tax Invoice with full GST breakdown.
                </p>
              )}
            </div>

            {/* GST Type — relevant for Proforma and Tax Invoice */}
            {(formData.documentType === 'PROFORMA_INVOICE' || formData.documentType === 'TAX_INVOICE') && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">GST Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gstType: 'SGST_CGST' })}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                    formData.gstType === 'SGST_CGST'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  SGST + CGST
                  <span className="block text-xs font-normal opacity-70">Intra-state</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gstType: 'IGST' })}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                    formData.gstType === 'IGST'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  IGST
                  <span className="block text-xs font-normal opacity-70">Inter-state</span>
                </button>
              </div>
            </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <span className="flex items-center gap-1.5"><CalendarDays size={14} />Invoice Date *</span>
                </label>
                <input
                  type="date"
                  name="invoiceDate"
                  value={formData.invoiceDate}
                  onChange={handleInputChange}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <span className="flex items-center gap-1.5"><CalendarDays size={14} />Valid Till : *</span>
                </label>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleInputChange}
                  required
                  className="input-field"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <span className="flex items-center gap-1.5"><CalendarDays size={14} />Expected Delivery Date:</span>
                </label>
                <input
                  type="date"
                  name="deliveryDate"
                  value={formData.deliveryDate}
                  onChange={handleInputChange}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <span className="flex items-center gap-1.5"><CalendarDays size={14} />Expiry Date</span>
                </label>
                <input
                  type="date"
                  name="expiryDate"
                  value={formData.expiryDate}
                  onChange={handleInputChange}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Shipping Address</label>
              <textarea
                name="shippingAddress"
                value={formData.shippingAddress}
                onChange={handleInputChange}
                rows={2}
                placeholder="Shipping address (leave blank to use customer's shipping address)"
                className="input-field resize-none"
              />
            </div>

            {/* Payment Terms — shown for Proforma, useful for any invoice */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Payment Terms
                <span className="text-xs text-muted-foreground ml-2">(optional)</span>
              </label>
              <input
                type="text"
                name="paymentTerms"
                value={formData.paymentTerms}
                onChange={handleInputChange}
                placeholder="e.g. 100% advance, 50% advance + 50% before dispatch"
                className="input-field"
              />
            </div>

            <div className="max-w-xs">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                <span className="flex items-center gap-1.5"><Percent size={14} />Invoice Discount</span>
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={discountRawInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDiscountRawInput(val);
                    if (discountMode === 'percent') {
                      setFormData({ ...formData, discountPercentage: val === '' ? 0 : Math.min(100, Math.max(0, parseFloat(val) || 0)) });
                    } else {
                      // amount mode — compute % from selected quotation subtotal
                      const amt = parseFloat(val) || 0;
                      const sub = selectedQuotation ? (Number(selectedQuotation.subtotal) || 0) : 0;
                      setFormData({ ...formData, discountPercentage: sub > 0 ? Math.min(100, (amt / sub) * 100) : 0 });
                    }
                  }}
                  placeholder="0"
                  min="0"
                  max={discountMode === 'percent' ? 100 : undefined}
                  step="0.01"
                  className="input-field [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (discountMode === 'percent') {
                      const sub = selectedQuotation ? (Number(selectedQuotation.subtotal) || 0) : 0;
                      const amt = sub * formData.discountPercentage / 100;
                      setDiscountRawInput(amt.toFixed(2));
                      setDiscountMode('amount');
                    } else {
                      const sub = selectedQuotation ? (Number(selectedQuotation.subtotal) || 0) : 0;
                      const amt = parseFloat(discountRawInput) || 0;
                      const pct = sub > 0 ? Math.min(100, (amt / sub) * 100) : 0;
                      setDiscountRawInput(pct.toFixed(2));
                      setFormData({ ...formData, discountPercentage: pct });
                      setDiscountMode('percent');
                    }
                  }}
                  className="flex-shrink-0 w-9 h-10 rounded-md border border-input bg-muted hover:bg-muted/80 text-xs font-semibold text-muted-foreground transition-colors"
                >
                  {discountMode === 'percent' ? '%' : '₹'}
                </button>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Additional Info</h2>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                <span className="flex items-center gap-1.5"><StickyNote size={14} />Notes</span>
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                placeholder="Add any additional notes..."
                className="input-field resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                <span className="flex items-center gap-1.5"><ScrollText size={14} />Terms and Conditions</span>
              </label>
              <textarea
                name="termsAndConditions"
                value={formData.termsAndConditions}
                onChange={handleInputChange}
                rows={3}
                placeholder="Add payment terms, conditions, etc..."
                className="input-field resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate('/invoices')}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.quotationId}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewInvoice;
