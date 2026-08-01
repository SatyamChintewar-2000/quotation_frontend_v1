import React, { createContext, useContext, useState, useRef, ReactNode, useEffect } from 'react';
import { productService, Product as APIProduct, ProductRequest } from '@/services/productService';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

// Map API Product to frontend Product type
interface Product {
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
  companyId?: number; // For SUPER_ADMIN to specify company
}

interface ProductContextType {
  products: Product[];
  loading: boolean;
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  getProductsByUser: (userId: string) => Product[];
  refreshProducts: (force?: boolean) => Promise<void>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

// Helper function to map API product to frontend product
const mapAPIProductToProduct = (apiProduct: APIProduct): Product => ({
  id: apiProduct.id.toString(),
  name: apiProduct.productName,
  price: apiProduct.price,
  unit: apiProduct.unit,
  quantity: apiProduct.quantity,
  discount: apiProduct.discountPercentage,
  taxType: apiProduct.taxType,
  gst: apiProduct.taxPercentage,
  expiryDate: apiProduct.expiryDate,
  description: apiProduct.description || '',
  image: apiProduct.imagePath,
  createdBy: apiProduct.createdBy?.toString() || '',
});

// Helper function to map frontend product to API request
const mapProductToAPIRequest = (product: Omit<Product, 'id'> | Partial<Product>): ProductRequest => ({
  productName: product.name || '',
  description: product.description,
  price: product.price || 0,
  unit: product.unit || 'piece',
  quantity: product.quantity || 0,
  discountPercentage: product.discount || 0,
  taxType: product.taxType || 'GST',
  taxPercentage: product.gst || 0,
  expiryDate: product.expiryDate,
  imagePath: product.image,
  companyId: product.companyId ? Number(product.companyId) : undefined,
});

export const ProductProvider = ({ children }: { children: ReactNode }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, loading: authLoading } = useAuth();

  // 60-second stale threshold — same pattern as QuotationContext
  const lastFetchedAt = useRef<number | null>(null);
  const STALE_AFTER_MS = 60_000;

  const refreshProducts = async (force = false) => {
    if (!isAuthenticated) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const now = Date.now();
    if (!force && lastFetchedAt.current && (now - lastFetchedAt.current) < STALE_AFTER_MS) {
      console.log('⚡ Products still fresh — serving from memory');
      return;
    }

    try {
      setLoading(true);
      const apiProducts = await productService.getAll();
      setProducts(apiProducts.map(mapAPIProductToProduct));
      lastFetchedAt.current = Date.now();
    } catch (error: any) {
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        console.error('Failed to fetch products:', error);
      }
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for auth to finish loading before checking authentication
    if (authLoading) {
      console.log('⏳ Waiting for auth to initialize...');
      return;
    }

    // Only fetch when authenticated
    if (isAuthenticated) {
      refreshProducts(true); // force=true on auth change to always get fresh data after login
    } else {
      setProducts([]);
      lastFetchedAt.current = null; // reset stale timer on logout
      setLoading(false);
    }
  }, [isAuthenticated, authLoading]);

  const addProduct = async (product: Omit<Product, 'id'>) => {
    try {
      const apiRequest = mapProductToAPIRequest(product);
      const newProduct = await productService.create(apiRequest);
      setProducts((prev) => [...prev, mapAPIProductToProduct(newProduct)]);
      lastFetchedAt.current = null; // force fresh fetch next time
      toast.success('Product added successfully');
    } catch (error) {
      console.error('Failed to add product:', error);
      toast.error('Failed to add product');
      throw error;
    }
  };

  const updateProduct = async (id: string, updatedFields: Partial<Product>) => {
    try {
      const apiRequest = mapProductToAPIRequest(updatedFields);
      const updated = await productService.update(Number(id), apiRequest);
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? mapAPIProductToProduct(updated) : p))
      );
      lastFetchedAt.current = null;
      toast.success('Product updated successfully');
    } catch (error) {
      console.error('Failed to update product:', error);
      toast.error('Failed to update product');
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await productService.delete(Number(id));
      setProducts((prev) => prev.filter((p) => p.id !== id));
      lastFetchedAt.current = null;
      toast.success('Product deleted successfully');
    } catch (error) {
      console.error('Failed to delete product:', error);
      toast.error('Failed to delete product');
      throw error;
    }
  };

  const getProductsByUser = (userId: string) => {
    return products.filter((p) => p.createdBy === userId);
  };

  return (
    <ProductContext.Provider
      value={{
        products,
        loading,
        addProduct,
        updateProduct,
        deleteProduct,
        getProductsByUser,
        refreshProducts,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductProvider');
  }
  return context;
};
