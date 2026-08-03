import api from './api';

export interface Product {
  id: number;
  productName: string;
  productCode?: string;
  brand?: string;
  category?: string;
  description?: string;
  price: number;
  purchasePrice?: number;
  unit: string;
  quantity: number;
  discountPercentage: number;
  taxType: string;
  taxPercentage: number;
  expiryDate?: string;
  imagePath?: string;
  companyId?: number;
  companyName?: string;
  createdBy?: number;
  createdByName?: string;
  createdAt?: string;
  active?: boolean;
  // Optional: weight and volume per unit (for export/logistics quotations)
  netWeight?: number;
  cbm?: number;
}

export interface ProductRequest {
  productName: string;
  productCode?: string;
  brand?: string;
  category?: string;
  description?: string;
  price: number;
  purchasePrice?: number;
  unit?: string;
  quantity: number;
  discountPercentage?: number;
  taxType?: string;
  taxPercentage?: number;
  expiryDate?: string;
  imagePath?: string;
  companyId?: number; // Required for SUPER_ADMIN
  // Optional: weight and volume per unit (for export/logistics quotations)
  netWeight?: number;
  cbm?: number;
}

export const productService = {
  async getAll(): Promise<Product[]> {
    const response = await api.get('/api/products');
    return response.data;
  },

  async getById(id: number): Promise<Product> {
    const response = await api.get(`/api/products/${id}`);
    return response.data;
  },

  async create(product: ProductRequest): Promise<Product> {
    const response = await api.post('/api/products', product);
    return response.data;
  },

  async update(id: number, product: ProductRequest): Promise<Product> {
    const response = await api.put(`/api/products/${id}`, product);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/api/products/${id}`);
  },

  async bulkCreate(products: ProductRequest[]): Promise<{ created: number; failed: number; errors: string[] }> {
    const response = await api.post('/api/products/bulk', products);
    return response.data;
  },
};
