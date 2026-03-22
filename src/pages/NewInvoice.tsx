import React, { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useQuotations } from '@/contexts/QuotationContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

const NewInvoice = () => {
  const navigate = useNavigate();
  const { createInvoice } = useInvoices();
  const { quotations } = useQuotations();
  const [loading, setLoading] = useState(false);

  // Filter only APPROVED quotations (context stores status as lowercase)
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

      if (result) {
        navigate(`/invoice/${result.id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Create New Invoice" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/invoices')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Invoice</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Quotation Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Approved Quotation *
              </label>
              <select
                value={formData.quotationId}
                onChange={handleQuotationChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Select a quotation --</option>
                {approvedQuotations.map((q) => (
                  <option key={q.id} value={q.id}>
                    #{q.id} - {q.clientName} ({formatCurrency(q.grandTotal)})
                  </option>
                ))}
              </select>
              {approvedQuotations.length === 0 && (
                <p className="text-sm text-red-600 mt-2">
                  No approved quotations available. Please approve a quotation first.
                </p>
              )}
            </div>

            {/* Quotation Details Preview */}
            {selectedQuotation && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Quotation Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Quotation #</p>
                    <p className="font-semibold text-gray-900">#{selectedQuotation.id}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Customer</p>
                    <p className="font-semibold text-gray-900">{selectedQuotation.clientName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Items</p>
                    <p className="font-semibold text-gray-900">{selectedQuotation.items.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total Amount</p>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(selectedQuotation.grandTotal)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Invoice Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Date *
                </label>
                <input
                  type="date"
                  name="invoiceDate"
                  value={formData.invoiceDate}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date *
                </label>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Discount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Discount Percentage (%)
              </label>
              <input
                type="number"
                name="discountPercentage"
                value={formData.discountPercentage}
                onChange={handleInputChange}
                min="0"
                max="100"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                placeholder="Add any additional notes..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Terms and Conditions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Terms and Conditions
              </label>
              <textarea
                name="termsAndConditions"
                value={formData.termsAndConditions}
                onChange={handleInputChange}
                rows={3}
                placeholder="Add payment terms, conditions, etc..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate('/invoices')}
                className="flex-1 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.quotationId}
                className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NewInvoice;
