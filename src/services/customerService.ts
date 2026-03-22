import api from './api';

export interface Customer {
  id: number;
  customerName: string;
  email: string;
  phone: string;
  address?: string;
  gstNumber?: string;
  companyId?: number;
  companyName?: string;
  createdBy?: number;
  createdByName?: string;
}

export interface CustomerRequest {
  customerName: string;
  email: string;
  phone: string;
  address?: string;
}

export const customerService = {
  async getAll(): Promise<Customer[]> {
    const response = await api.get('/api/customers');
    return response.data;
  },

  async getById(id: number): Promise<Customer> {
    const response = await api.get(`/api/customers/${id}`);
    return response.data;
  },

  async create(customer: CustomerRequest): Promise<Customer> {
    const response = await api.post('/api/customers', customer);
    return response.data;
  },

  async update(id: number, customer: CustomerRequest): Promise<Customer> {
    const response = await api.put(`/api/customers/${id}`, customer);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/api/customers/${id}`);
  },
};
