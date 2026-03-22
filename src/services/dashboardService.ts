import api from './api';

export interface DashboardDTO {
  customers?: number;
  quotations?: number;
  products?: number;
  staff?: number;
  users?: number;
  revenue?: number;
}

export interface DashboardMetrics {
  customers?: number;
  quotations?: number;
  products?: number;
  staff?: number;
  users?: number;
  revenue?: number;
}

export const dashboardService = {
  async getMetrics(): Promise<DashboardMetrics> {
    const response = await api.get('/api/dashboard');
    return response.data;
  },
  
  async getDashboard(): Promise<DashboardDTO> {
    const response = await api.get('/api/dashboard');
    return response.data;
  },
};
