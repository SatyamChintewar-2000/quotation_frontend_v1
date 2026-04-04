import api from './api';

export interface Enquiry {
  id: number;
  enquiryDate: string;
  name: string;
  contact: string;
  email?: string;
  gender?: string;
  birthDate?: string;
  budget?: number;
  address?: string;
  enquiryFor?: string;
  rating?: string;
  status: string;
  city?: string;
  referType?: string;
  referBy?: string;
  nextFollowupDate?: string;
  comment?: string;
  convertedCustomerId?: number;
  companyId?: number;
  createdAt?: string;
}

export interface EnquiryRequest {
  enquiryDate: string;
  name: string;
  contact: string;
  email?: string;
  gender?: string;
  birthDate?: string;
  budget?: number;
  address?: string;
  enquiryFor?: string;
  rating?: string;
  status: string;
  city?: string;
  referType?: string;
  referBy?: string;
  nextFollowupDate?: string;
  comment?: string;
}

export const ENQUIRY_STATUSES = ['open', 'in_progress', 'converted', 'closed'];
export const ENQUIRY_RATINGS = ['Cold', 'Warm', 'Hot', 'Expected', 'Not Interested'];
export const REFER_TYPES = ['Walk-in', 'Reference', 'Online', 'Social Media', 'Advertisement', 'Other'];

export const enquiryService = {
  async getAll(): Promise<Enquiry[]> {
    const res = await api.get('/api/enquiries');
    return res.data;
  },
  async getById(id: number): Promise<Enquiry> {
    const res = await api.get(`/api/enquiries/${id}`);
    return res.data;
  },
  async create(data: EnquiryRequest): Promise<Enquiry> {
    const res = await api.post('/api/enquiries', data);
    return res.data;
  },
  async update(id: number, data: EnquiryRequest): Promise<Enquiry> {
    const res = await api.put(`/api/enquiries/${id}`, data);
    return res.data;
  },
  async delete(id: number): Promise<void> {
    await api.delete(`/api/enquiries/${id}`);
  },
};
