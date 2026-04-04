import api from './api';

export interface StaffSummary {
  userId: number;
  userName: string;
  email: string;
  role: string;
  enquiries: number;
  customers: number;
  quotations: number;
  invoices: number;
  totalRevenue: number;
}

export const reportsService = {
  async getStaffSummary(): Promise<StaffSummary[]> {
    const res = await api.get('/api/reports/staff-summary');
    return res.data;
  },
};
