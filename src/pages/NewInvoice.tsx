import React, { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useQuotations } from '@/contexts/QuotationContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, FileText, User, Package, IndianRupee, CalendarDays, Percent, StickyNote, ScrollText } from 'lucide-react';
import NumericInput from '@/components/common/NumericInput';

const NewInvoice = () => {
  const navigate = useNavigate();
  const { createInvoice } = useInvoices();
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
  });

  const [selectedQuotation, setSelectedQuotation] = useState<(typeof quotations)[0] | null>(null);

  const handleQuotationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const quotationId = e.target.value;
    setFormData({ ...formData, quotationId });
    const quotation = quotations.find((q) => q.id === quotationId);
    setSelectedQuotation(quotation || null);
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
      });
      if (result) navigate(`/invoice/${result.id}`);
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
                  <span className="flex items-center gap-1.5"><CalendarDays size={14} />Due Date *</span>
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

            <div className="max-w-xs">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                <span className="flex items-center gap-1.5"><Percent size={14} />Discount Percentage (%)</span>
              </label>
              <NumericInput
                value={formData.discountPercentage}
                onChange={(val) => setFormData({ ...formData, discountPercentage: val })}
                min={0}
                max={100}
                step={0.01}
                placeholder="0"
                className="input-field"
              />
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
