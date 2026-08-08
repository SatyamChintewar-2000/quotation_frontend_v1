import api from './api';

export interface InvoiceItem {
  id?: number;
  invoiceId?: number;
  productId: number;
  productName: string;
  productDescription?: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  taxPercentage: number;
  taxAmount: number;
  itemTotal: number;
  total: number;
}

export interface Payment {
  id?: number;
  invoiceId?: number;
  paymentDate: string;
  paymentAmount: number;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  createdBy?: number;
  createdByName?: string;
  createdAt?: string;
}

export interface Invoice {
  id?: number;
  invoiceNumber: string;
  quotationId: number;
  customerId: number;
  customerName: string;
  companyId: number;
  companyName: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  discountPercentage: number;
  totalDiscount: number;
  totalTax: number;
  totalAmount: number;
  status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID';
  notes?: string;
  termsAndConditions?: string;
  documentType?: 'INVOICE' | 'PROFORMA_INVOICE';
  gstType?: 'IGST' | 'SGST_CGST';
  customerAddress?: string;
  shippingAddress?: string;
  deliveryDate?: string;
  expiryDate?: string;
  emailSent: boolean;
  emailSentAt?: string;
  createdBy?: number;
  createdByName?: string;
  createdAt?: string;
  updatedBy?: number;
  updatedAt?: string;
  active: boolean;
  items?: InvoiceItem[];
  payments?: Payment[];
  totalPaid?: number;
  remainingBalance?: number;
}

export interface InvoiceRequest {
  quotationId?: number;
  customerId?: number;
  customerName?: string;
  invoiceDate: string;
  dueDate: string;
  discountPercentage?: number;
  notes?: string;
  termsAndConditions?: string;
  documentType?: 'INVOICE' | 'PROFORMA_INVOICE';
  gstType?: 'IGST' | 'SGST_CGST';
  shippingAddress?: string;
  deliveryDate?: string;
  expiryDate?: string;
  items?: InvoiceItem[];
}

const invoiceService = {
  // Create invoice from quotation
  createInvoice: async (data: InvoiceRequest): Promise<Invoice> => {
    const response = await api.post('/api/invoices', data);
    return response.data;
  },

  // Create direct invoice (without quotation)
  createDirectInvoice: async (data: InvoiceRequest): Promise<Invoice> => {
    const response = await api.post('/api/invoices/direct', data);
    return response.data;
  },

  // Get all invoices
  getInvoices: async (): Promise<Invoice[]> => {
    const response = await api.get('/api/invoices');
    return response.data;
  },

  // Get invoice by ID
  getInvoiceById: async (id: number): Promise<Invoice> => {
    const response = await api.get(`/api/invoices/${id}`);
    return response.data;
  },

  // Get invoice by number
  getInvoiceByNumber: async (invoiceNumber: string): Promise<Invoice> => {
    const response = await api.get(`/api/invoices/number/${invoiceNumber}`);
    return response.data;
  },

  // Get invoices by quotation
  getInvoicesByQuotation: async (quotationId: number): Promise<Invoice[]> => {
    const response = await api.get(`/api/invoices/quotation/${quotationId}`);
    return response.data;
  },

  // Get invoices by customer
  getInvoicesByCustomer: async (customerId: number): Promise<Invoice[]> => {
    const response = await api.get(`/api/invoices/customer/${customerId}`);
    return response.data;
  },

  // Get invoices by status
  getInvoicesByStatus: async (status: string): Promise<Invoice[]> => {
    const response = await api.get(`/api/invoices/status/${status}`);
    return response.data;
  },

  // Get invoices by payment status
  getInvoicesByPaymentStatus: async (paymentStatus: string): Promise<Invoice[]> => {
    const response = await api.get(`/api/invoices/payment-status/${paymentStatus}`);
    return response.data;
  },

  // Get overdue invoices
  getOverdueInvoices: async (): Promise<Invoice[]> => {
    const response = await api.get('/api/invoices/overdue');
    return response.data;
  },

  // Get invoices by date range
  getInvoicesByDateRange: async (startDate: string, endDate: string): Promise<Invoice[]> => {
    const response = await api.get('/api/invoices/date-range', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  // Update invoice
  updateInvoice: async (id: number, data: InvoiceRequest): Promise<Invoice> => {
    const response = await api.put(`/api/invoices/${id}`, data);
    return response.data;
  },

  // Delete invoice
  deleteInvoice: async (id: number): Promise<void> => {
    await api.delete(`/api/invoices/${id}`);
  },

  // Change invoice status
  changeStatus: async (id: number, status: string): Promise<Invoice> => {
    const response = await api.put(`/api/invoices/${id}/status`, { status });
    return response.data;
  },

  // Mark as sent
  markAsSent: async (id: number): Promise<Invoice> => {
    const response = await api.put(`/api/invoices/${id}/mark-as-sent`);
    return response.data;
  },

  // Mark as paid
  markAsPaid: async (id: number): Promise<Invoice> => {
    const response = await api.put(`/api/invoices/${id}/mark-as-paid`);
    return response.data;
  },

  // Record payment
  recordPayment: async (invoiceId: number, payment: Payment): Promise<Payment> => {
    const response = await api.post(`/api/invoices/${invoiceId}/payments`, payment);
    return response.data;
  },

  // Get payment history
  getPaymentHistory: async (invoiceId: number): Promise<Payment[]> => {
    const response = await api.get(`/api/invoices/${invoiceId}/payments`);
    return response.data;
  },

  // Delete payment
  deletePayment: async (invoiceId: number, paymentId: number): Promise<void> => {
    await api.delete(`/api/invoices/${invoiceId}/payments/${paymentId}`);
  },
};

export default invoiceService;
