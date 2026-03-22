import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService, Product, ProductRequest } from '@/services/productService';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// Query keys
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: string) => [...productKeys.lists(), { filters }] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: number) => [...productKeys.details(), id] as const,
};

// Hook to fetch all products
export function useProductsQuery() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: productKeys.lists(),
    queryFn: async () => {
      console.log('🔄 Fetching products from API...');
      const products = await productService.getAll();
      console.log('✅ Products fetched:', products.length);
      return products;
    },
    enabled: isAuthenticated, // Only fetch when authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Hook to fetch single product
export function useProductQuery(id: number) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => productService.getById(id),
    enabled: isAuthenticated && !!id,
  });
}

// Hook to create product
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (product: ProductRequest) => productService.create(product),
    onMutate: async (newProduct) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: productKeys.lists() });

      // Snapshot previous value
      const previousProducts = queryClient.getQueryData(productKeys.lists());

      // Optimistically update cache
      queryClient.setQueryData<Product[]>(productKeys.lists(), (old = []) => [
        ...old,
        {
          ...newProduct,
          id: Date.now(), // Temporary ID
          active: true,
          createdAt: new Date().toISOString(),
        } as Product,
      ]);

      return { previousProducts };
    },
    onError: (err, newProduct, context) => {
      // Rollback on error
      if (context?.previousProducts) {
        queryClient.setQueryData(productKeys.lists(), context.previousProducts);
      }
      console.error('Failed to create product:', err);
      toast.error('Failed to create product');
    },
    onSuccess: (data) => {
      toast.success('Product created successfully');
    },
    onSettled: () => {
      // Refetch to get accurate data from server
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}

// Hook to update product
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, product }: { id: number; product: ProductRequest }) =>
      productService.update(id, product),
    onMutate: async ({ id, product }) => {
      await queryClient.cancelQueries({ queryKey: productKeys.lists() });
      await queryClient.cancelQueries({ queryKey: productKeys.detail(id) });

      const previousProducts = queryClient.getQueryData(productKeys.lists());
      const previousProduct = queryClient.getQueryData(productKeys.detail(id));

      // Optimistically update
      queryClient.setQueryData<Product[]>(productKeys.lists(), (old = []) =>
        old.map((p) => (p.id === id ? { ...p, ...product } : p))
      );

      return { previousProducts, previousProduct };
    },
    onError: (err, { id }, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(productKeys.lists(), context.previousProducts);
      }
      if (context?.previousProduct) {
        queryClient.setQueryData(productKeys.detail(id), context.previousProduct);
      }
      console.error('Failed to update product:', err);
      toast.error('Failed to update product');
    },
    onSuccess: () => {
      toast.success('Product updated successfully');
    },
    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      queryClient.invalidateQueries({ queryKey: productKeys.detail(id) });
    },
  });
}

// Hook to delete product
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => productService.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: productKeys.lists() });

      const previousProducts = queryClient.getQueryData(productKeys.lists());

      // Optimistically remove from cache
      queryClient.setQueryData<Product[]>(productKeys.lists(), (old = []) =>
        old.filter((p) => p.id !== id)
      );

      return { previousProducts };
    },
    onError: (err, id, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(productKeys.lists(), context.previousProducts);
      }
      console.error('Failed to delete product:', err);
      toast.error('Failed to delete product');
    },
    onSuccess: () => {
      toast.success('Product deleted successfully');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}
