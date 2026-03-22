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
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  createdBy: string;
}

// Menu permissions for role-based access control
export const menuPermissions: Record<string, string[]> = {
  super_admin: [
    'dashboard',
    'master_settings',
    'company_master',
    'sms_template',
    'add_product',
    'client_details',
    'new_quotation',
    'quotation_history',
    'new_invoice',
    'invoice_management',
    'reports',
    'user_management',
    'color_theme',
  ],
  superadmin: [  // Backend returns this format (no underscore)
    'dashboard',
    'master_settings',
    'company_master',
    'sms_template',
    'add_product',
    'client_details',
    'new_quotation',
    'quotation_history',
    'new_invoice',
    'invoice_management',
    'reports',
    'user_management',
    'color_theme',
  ],
  admin: [
    'dashboard',
    'add_product',
    'client_details',
    'new_quotation',
    'quotation_history',
    'new_invoice',
    'invoice_management',
    'color_theme',
  ],
  client: [  // CLIENT can manage products, customers, quotations, invoices and users
    'dashboard',
    'add_product',
    'client_details',
    'new_quotation',
    'quotation_history',
    'new_invoice',
    'invoice_management',
    'user_management',
    'color_theme',
  ],
  staff: [  // STAFF can manage products, customers, quotations and invoices
    'dashboard',
    'add_product',
    'client_details',
    'new_quotation',
    'quotation_history',
    'new_invoice',
    'invoice_management',
    'color_theme',
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
