import api from './api';

export interface QuotationItem {
  id?: number;
  productId: number;
  productName?: string;
  productNameSnapshot?: string;
  productDescription?: string;
  productDescriptionSnapshot?: string;
  imagePath?: string;  // Current product image
  imagePathSnapshot?: string;  // Image snapshot at quotation time
  unitSnapshot?: string;
  unitPrice: number;
  quantity: number;
  discountPercentage: number;
  taxPercentage: number;
  taxAmount?: number;
  itemTotal: number;
}

export interface QuotationServiceItem {
  serviceName: string;
  servicePrice: number;
  serviceTax: number;
}

export interface Quotation {
  id: number;
  quotationNumber: string;
  customerId: number;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  shippingAddress?: string;
  subtotal: number;
  totalDiscount: number;
  totalGst: number;
  totalAmount: number;
  status: string;
  currency?: string;
  expiryDate?: string;
  quotationDate?: string;
  quotationCode?: string;
  deliveryDate?: string;
  executiveName?: string;
  notes?: string;
  termsAndConditions?: string;
  discountPercentage?: number;
  createdAt: string;
  createdBy?: number;
  createdByName?: string;
  items: QuotationItem[];
  services?: QuotationServiceItem[];
  isExpired?: boolean;
  canEdit?: boolean;
}

export interface QuotationRequest {
  customerId: number;
  items: {
    productId: number;
    quantity: number;
    unitPrice?: number;
    discountPercentage?: number;
    taxPercentage?: number;
  }[];
  services?: QuotationServiceItem[];
  status?: string;
  currency?: string;
  expiryDate?: string;
  quotationDate?: string;
  quotationCode?: string;
  deliveryDate?: string;
  executiveName?: string;
  notes?: string;
  termsAndConditions?: string;
  discountPercentage?: number;
  customerAddress?: string;
  shippingAddress?: string;
}

export interface QuotationPageResponse {
  content: Quotation[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export const quotationService = {
  async getAll(): Promise<Quotation[]> {
    const response = await api.get('/api/quotations');
    return response.data;
  },

  async getPaged(page = 0, size = 10): Promise<QuotationPageResponse> {
    const response = await api.get('/api/quotations/paged', { params: { page, size } });
    return response.data;
  },

  async getById(id: number): Promise<Quotation> {
    const response = await api.get(`/api/quotations/${id}`);
    return response.data;
  },

  async create(quotation: QuotationRequest): Promise<Quotation> {
    const response = await api.post('/api/quotations', quotation);
    return response.data;
  },

  async update(id: number, quotation: Partial<QuotationRequest>): Promise<Quotation> {
    const response = await api.put(`/api/quotations/${id}`, quotation);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/api/quotations/${id}`);
  },

  async duplicate(id: number): Promise<Quotation> {
    const response = await api.post(`/api/quotations/${id}/duplicate`);
    return response.data;
  },

  async changeStatus(id: number, status: string): Promise<{ success: boolean; message: string; quotation: Quotation }> {
    const response = await api.put(`/api/quotations/${id}/status`, { status });
    return response.data;
  },

  async getByStatus(status: string): Promise<Quotation[]> {
    const response = await api.get(`/api/quotations/status/${status}`);
    return response.data;
  },

  async getExpired(): Promise<Quotation[]> {
    const response = await api.get('/api/quotations/expired');
    return response.data;
  },

  async sendEmail(id: number): Promise<{ success: boolean; message: string; emailLogId: number }> {
    const response = await api.post(`/api/quotations/${id}/send-email`);
    return response.data;
  },

  async retryEmail(emailLogId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/api/quotations/email/${emailLogId}/retry`);
    return response.data;
  },
};
