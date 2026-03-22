export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
  },
  CUSTOMERS: '/api/customers',
  PRODUCTS: '/api/products',
  QUOTATIONS: '/api/quotations',
  USERS: '/api/users',
  DASHBOARD: '/api/dashboard',
};
