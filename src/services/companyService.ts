import api from './api';

export interface Company {
  id: number;
  companyName: string;
  address?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  state?: string;
  city?: string;
  termsAndConditions?: string;
  logo?: string;
  active?: boolean;
  // Bank details
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  upiId?: string;
  // Feature 1: PDF Theme
  pdfThemeName?: string;
  pdfAccentColor?: string;
  pdfWatermarkEnabled?: boolean;
  pdfWatermarkOpacity?: number;
  // Company name is controlled by Super Admin only — read-only for clients
  companyNameLocked?: boolean;
  // License ID — auto-generated on creation, never changes
  licenseId?: string;
}

export interface CompanyRequest {
  companyName: string;
  address?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  state?: string;
  city?: string;
  termsAndConditions?: string;
  logo?: string;
  // Bank details
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  upiId?: string;
  // Feature 1: PDF Theme
  pdfThemeName?: string;
  pdfAccentColor?: string;
  pdfWatermarkEnabled?: boolean;
  pdfWatermarkOpacity?: number;
}

export const companyService = {
  async getAll(): Promise<Company[]> {
    const response = await api.get('/api/companies');
    return response.data;
  },

  async getById(id: number): Promise<Company> {
    const response = await api.get(`/api/companies/${id}`);
    return response.data;
  },

  async create(company: CompanyRequest): Promise<Company> {
    const response = await api.post('/api/companies', company);
    return response.data;
  },

  async update(id: number, company: Partial<CompanyRequest>): Promise<Company> {
    const response = await api.put(`/api/companies/${id}`, company);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/api/companies/${id}`);
  },

  async toggleActive(id: number): Promise<Company> {
    const response = await api.put(`/api/companies/${id}/toggle-active`);
    return response.data;
  },

  async getMyCompany(): Promise<Company> {
    const response = await api.get('/api/companies/my-company');
    return response.data;
  },

  async updateMyCompany(data: Partial<CompanyRequest>): Promise<Company> {
    const response = await api.put('/api/companies/my-company', data);
    return response.data;
  },
};
