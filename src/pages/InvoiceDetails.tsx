import React, { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Download,
  Send,
  CheckCircle,
  Plus,
  Trash2,
  Edit,
  AlertCircle,
  Clock,
  DollarSign,
  Loader2,
} from 'lucide-react';
import { Invoice, Payment } from '@/services/invoiceService';
import { DeleteConfirmModal } from '@/components/common/DeleteConfirmModal';
import { StatusBadge } from '@/components/common/StatusBadge';
import NumericInput from '@/components/common/NumericInput';

const InvoiceDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchInvoiceById, markAsSent, recordPayment, deletePayment } = useInvoices();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);
  const [paymentData, setPaymentData] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentAmount: 0,
    paymentMethod: 'Bank Transfer',
    paymentReference: '',
    notes: '',
  });

  useEffect(() => {
    const loadInvoice = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await fetchInvoiceById(parseInt(id));
        setInvoice(data);
      } finally {
        setLoading(false);
      }
    };
    loadInvoice();
  }, [id, fetchInvoiceById]);

  const handleSendInvoice = async () => {
    if (!invoice?.id) return;
    await markAsSent(invoice.id);
    const updated = await fetchInvoiceById(invoice.id);
    setInvoice(updated);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice?.id) return;

    if (paymentData.paymentAmount <= 0) {
      toast.error('Payment amount must be greater than 0');
      return;
    }

    const result = await recordPayment(invoice.id, {
      paymentDate: paymentData.paymentDate,
      paymentAmount: paymentData.paymentAmount,
      paymentMethod: paymentData.paymentMethod,
      paymentReference: paymentData.paymentReference,
      notes: paymentData.notes,
    });

    if (result) {
      setPaymentData({
        paymentDate: new Date().toISOString().split('T')[0],
        paymentAmount: 0,
        paymentMethod: 'Bank Transfer',
        paymentReference: '',
        notes: '',
      });
      setShowPaymentForm(false);
      const updated = await fetchInvoiceById(invoice.id);
      setInvoice(updated);
    }
  };

  const handleDeletePayment = (paymentId: number | undefined) => {
    if (!invoice?.id || !paymentId) return;
    setDeletingPaymentId(paymentId);
  };

  const handleDownloadPDF = async () => {
    if (!invoice) { toast.error('No invoice to download'); return; }
    try {
      setDownloading(true);

      const { generateInvoicePdf } = await import('@/utils/generateInvoicePdf');
      const { companyService }      = await import('@/services/companyService');
      const QRCode                  = await import('qrcode');

      let company: any = {};
      try {
        company = await companyService.getMyCompany();
      } catch {
        try {
          const list = await companyService.getAll();
          if (list.length) company = list[0];
        } catch { /* proceed without company */ }
      }

      // Build QR code from UPI ID (same pattern as quotation)
      let qrDataUrl = '';
      if (company?.upiId && invoice.totalAmount) {
        const upiStr = `upi://pay?pa=${company.upiId}&pn=${encodeURIComponent(company.companyName || '')}&am=${invoice.totalAmount}&cu=INR`;
        try { qrDataUrl = await QRCode.default.toDataURL(upiStr, { width: 120, margin: 1 }); } catch { /* skip */ }
      }

      await generateInvoicePdf(
        invoice,
        company,
        qrDataUrl,
        `invoice-${invoice.invoiceNumber || id}.pdf`,
      );

      toast.success('PDF downloaded successfully');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  const confirmDeletePayment = async () => {
    if (!invoice?.id || !deletingPaymentId) return;
    await deletePayment(invoice.id, deletingPaymentId);
    const updated = await fetchInvoiceById(invoice.id);
    setInvoice(updated);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar title="Invoice Details" />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-2">Loading invoice...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar title="Invoice Details" />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <p className="text-gray-600">Invoice not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Invoice Details" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/invoices')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </button>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
                {invoice.documentType === 'PROFORMA_INVOICE' && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                    Proforma Invoice
                  </span>
                )}
                {invoice.documentType === 'TAX_INVOICE' && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                    Tax Invoice
                  </span>
                )}
              </div>
              <p className="text-gray-600 mt-1">Invoice Date: {formatDate(invoice.invoiceDate)}</p>
            </div>
            <div className="text-right">
              <StatusBadge status={invoice.status} />
              <p className="text-gray-600 mt-2">Payment: <StatusBadge status={invoice.paymentStatus} /></p>
            </div>
          </div>

          {/* Customer & Company Info */}
          <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-gray-200">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">Bill To</h3>
              <p className="text-lg font-semibold text-gray-900">{invoice.customerName}</p>
              <p className="text-gray-600 text-sm mt-1">Company: {invoice.companyName}</p>
              {invoice.customerAddress && (
                <p className="text-gray-500 text-sm mt-1">📍 {invoice.customerAddress}</p>
              )}
              {invoice.shippingAddress && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Ship To</p>
                  <p className="text-gray-600 text-sm mt-0.5">📦 {invoice.shippingAddress}</p>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">Invoice Details</h3>
              <div className="text-sm text-gray-600 space-y-1">
                {invoice.documentType && invoice.documentType !== 'INVOICE' && (
                  <p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      invoice.documentType === 'TAX_INVOICE'
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-amber-100 text-amber-700 border-amber-200'
                    }`}>
                      {invoice.documentType === 'TAX_INVOICE' ? 'Tax Invoice' : 'Proforma Invoice'}
                    </span>
                  </p>
                )}
                <p>
                  <span className="font-medium">Invoice Date:</span> {formatDate(invoice.invoiceDate)}
                </p>
                <p>
                  <span className="font-medium">Valid Till:</span> {formatDate(invoice.dueDate)}
                </p>
                {invoice.deliveryDate && (
                  <p>
                    <span className="font-medium">Expected Delivery Date:</span> {formatDate(invoice.deliveryDate)}
                  </p>
                )}
                {invoice.expiryDate && (
                  <p>
                    <span className="font-medium">Valid Till:</span>{' '}
                    <span className="text-red-600 font-medium">{formatDate(invoice.expiryDate)}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            {invoice.documentType === 'PROFORMA_INVOICE' && (
              <button
                onClick={() => navigate(`/invoice/${invoice.id}/edit`)}
                className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition"
              >
                <Edit className="w-4 h-4" />
                Edit Invoice
              </button>
            )}
            {invoice.status === 'DRAFT' && (
              <button
                onClick={handleSendInvoice}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
              >
                <Send className="w-4 h-4" />
                Send Invoice
              </button>
            )}
            {invoice.paymentStatus !== 'PAID' && (
              <button
                onClick={() => setShowPaymentForm(!showPaymentForm)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" />
                Record Payment
              </button>
            )}
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition disabled:opacity-60"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? 'Generating...' : 'Download PDF'}
            </button>
          </div>
        </div>

        {/* Payment Form */}
        {showPaymentForm && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Record Payment</h2>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={paymentData.paymentDate}
                    onChange={(e) =>
                      setPaymentData({ ...paymentData, paymentDate: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Amount *
                  </label>
                  <NumericInput
                    value={paymentData.paymentAmount}
                    onChange={(val) => setPaymentData({ ...paymentData, paymentAmount: val })}
                    min={0}
                    step={0.01}
                    required
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <select
                    value={paymentData.paymentMethod}
                    onChange={(e) =>
                      setPaymentData({ ...paymentData, paymentMethod: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Reference
                  </label>
                  <input
                    type="text"
                    value={paymentData.paymentReference}
                    onChange={(e) =>
                      setPaymentData({ ...paymentData, paymentReference: e.target.value })
                    }
                    placeholder="Transaction ID, Cheque #, etc."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  rows={2}
                  placeholder="Add any notes about this payment..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Invoice Items */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Invoice Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Product
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                    Qty
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                    Unit Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                    Discount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                    Tax
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoice.items?.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">{item.productName}</p>
                        {item.productDescription && (
                          <p className="text-sm text-gray-600">{item.productDescription}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900">{item.quantity}</td>
                    <td className="px-6 py-4 text-right text-gray-900">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900">
                      {item.discountPercentage}%
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900">
                      {formatCurrency(item.taxAmount)}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-8 flex justify-end">
            <div className="w-full md:w-96 space-y-2 border-t border-gray-200 pt-4">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal:</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.totalDiscount > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Discount ({invoice.discountPercentage}%):</span>
                  <span>-{formatCurrency(invoice.totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-700">
                <span>Tax:</span>
                <span>{formatCurrency(invoice.totalTax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-200 pt-2">
                <span>Total Amount:</span>
                <span>{formatCurrency(invoice.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Status & History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Payment Status */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Payment Status</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Total Amount:</span>
                <span className="font-bold text-lg text-gray-900">
                  {formatCurrency(invoice.totalAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <span className="text-gray-700">Total Paid:</span>
                <span className="font-bold text-lg text-blue-600">
                  {formatCurrency(invoice.totalPaid || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                <span className="text-gray-700">Remaining Balance:</span>
                <span className="font-bold text-lg text-red-600">
                  {formatCurrency(invoice.remainingBalance || 0)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mt-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Payment Progress</span>
                  <span>
                    {invoice.totalAmount > 0
                      ? Math.round(((invoice.totalPaid || 0) / invoice.totalAmount) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        invoice.totalAmount > 0
                          ? Math.min(
                              100,
                              ((invoice.totalPaid || 0) / invoice.totalAmount) * 100
                            )
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Payment History</h2>
            {invoice.payments && invoice.payments.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {invoice.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(payment.paymentAmount)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {formatDate(payment.paymentDate)} • {payment.paymentMethod}
                      </p>
                      {payment.paymentReference && (
                        <p className="text-xs text-gray-500">Ref: {payment.paymentReference}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeletePayment(payment.id)}
                      className="text-red-600 hover:text-red-800 transition ml-4"
                      title="Delete payment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No payments recorded yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Payment Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingPaymentId}
        onClose={() => setDeletingPaymentId(null)}
        onConfirm={confirmDeletePayment}
        title="Delete Payment"
        message="Are you sure you want to delete this payment record? This action cannot be undone."
      />

    </div>
  );
};

export default InvoiceDetails;
