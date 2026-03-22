import api from './api';

export interface Company {
  id: number;
  companyName: string;
  address?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  active?: boolean;
}

export interface CompanyRequest {
  companyName: string;
  address?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
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
};
