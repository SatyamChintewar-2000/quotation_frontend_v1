// Type definitions for the application
export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'superadmin' | 'admin' | 'client' | 'staff';  // Backend returns lowercase without underscore
  avatar?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  quantity: number;
  discount: number;
  taxType: string;
  gst: number;
  expiryDate: string;
  description: string;
  image?: string;
  createdBy: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  company: string;
  gstNumber?: string;
  createdBy: string;
}

export interface QuotationItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  discount: number;
  gst: number;
  subtotal: number;
}

export interface Quotation {
  id: string;
  clientId: string;
  clientName: string;
  items: QuotationItem[];
  subtotal: number;
  totalDiscount: number;
  totalGst: number;
  grandTotal: number;
  createdAt: string;
  status: 'draft' | 'generated' | 'sent' | 'approved' | 'rejected';
  createdBy: string;
}

// Menu permissions for role-based access control
export const menuPermissions: Record<string, string[]> = {
  super_admin: [
    'dashboard', 'master_settings', 'company_master',
    'add_product', 'enquiry_management', 'client_details',
    'new_quotation', 'quotation_history', 'new_invoice',
    'invoice_management', 'reports', 'user_management',
  ],
  superadmin: [
    'dashboard', 'master_settings', 'company_master',
    'add_product', 'enquiry_management', 'client_details',
    'new_quotation', 'quotation_history', 'new_invoice',
    'invoice_management', 'reports', 'user_management',
  ],
  // CLIENT = company owner — sees everything except company_master
  client: [
    'dashboard', 'master_settings',
    'add_product', 'enquiry_management', 'client_details',
    'new_quotation', 'quotation_history', 'new_invoice',
    'invoice_management', 'reports', 'user_management',
  ],
  // STAFF = employee — limited access
  staff: [
    'dashboard', 'master_settings', 'add_product', 'enquiry_management', 'client_details',
    'new_quotation', 'quotation_history', 'new_invoice', 'invoice_management',
  ],
  // admin = alias for client
  admin: [
    'dashboard', 'master_settings',
    'add_product', 'enquiry_management', 'client_details',
    'new_quotation', 'quotation_history', 'new_invoice',
    'invoice_management', 'reports', 'user_management',
  ],
};

// Helper function to check if a product is expired
export const isProductExpired = (expiryDate: string): boolean => {
  return new Date(expiryDate) < new Date();
};

// Empty arrays for backward compatibility (data should come from API)
export const clients: Client[] = [];
export const users: User[] = [];
export const initialProducts: Product[] = [];
export const sampleQuotations: Quotation[] = [];
