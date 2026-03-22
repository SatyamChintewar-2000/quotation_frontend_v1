import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
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
}

interface ProductContextType {
  products: Product[];
  loading: boolean;
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  getProductsByUser: (userId: string) => Product[];
  refreshProducts: () => Promise<void>;
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
});

export const ProductProvider = ({ children }: { children: ReactNode }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, loading: authLoading } = useAuth();

  const refreshProducts = async () => {
    // Don't fetch if not authenticated
    if (!isAuthenticated) {
      console.log('⏭️ Skipping product fetch - user not authenticated');
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 Fetching products from API...');
      
      const apiProducts = await productService.getAll();
      
      console.log('✅ Products fetched:', apiProducts.length);
      
      const mappedProducts = apiProducts.map(mapAPIProductToProduct);
      setProducts(mappedProducts);
    } catch (error: any) {
      console.error('❌ Failed to fetch products:', error);
      
      // Only show toast for non-auth errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Silent fail for auth errors - user will be redirected to login
        console.log('🔒 Authentication/permission error - silent fail');
      } else if (error.response?.status === 500) {
        // Only show error if user is on a page that needs products
        console.error('Server error loading products');
      } else if (error.code === 'ERR_NETWORK') {
        // Silent fail for network errors on initial load
        console.error('Network error loading products');
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
      console.log('✅ User authenticated, fetching products...');
      refreshProducts();
    } else {
      console.log('❌ User not authenticated, skipping product fetch');
      setProducts([]);
      setLoading(false);
    }
  }, [isAuthenticated, authLoading]); // Re-run when auth state changes

  const addProduct = async (product: Omit<Product, 'id'>) => {
    try {
      const apiRequest = mapProductToAPIRequest(product);
      const newProduct = await productService.create(apiRequest);
      setProducts((prev) => [...prev, mapAPIProductToProduct(newProduct)]);
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
