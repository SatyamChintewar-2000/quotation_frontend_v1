import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotationService, Quotation } from '@/services/quotationService';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// Query keys
export const quotationKeys = {
  all: ['quotations'] as const,
  lists: () => [...quotationKeys.all, 'list'] as const,
  list: (filters: string) => [...quotationKeys.lists(), { filters }] as const,
  details: () => [...quotationKeys.all, 'detail'] as const,
  detail: (id: number) => [...quotationKeys.details(), id] as const,
  byStatus: (status: string) => [...quotationKeys.all, 'status', status] as const,
};

// Hook to fetch all quotations
export function useQuotationsQuery() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: quotationKeys.lists(),
    queryFn: async () => {
      console.log('🔄 Fetching quotations from API...');
      const quotations = await quotationService.getAll();
      console.log('✅ Quotations fetched:', quotations.length);
      return quotations;
    },
    enabled: isAuthenticated,
    staleTime: 3 * 60 * 1000, // 3 minutes (quotations change more frequently)
    cacheTime: 10 * 60 * 1000,
  });
}

// Hook to fetch single quotation
export function useQuotationQuery(id: number) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: quotationKeys.detail(id),
    queryFn: () => quotationService.getById(id),
    enabled: isAuthenticated && !!id,
  });
}

// Hook to fetch quotations by status
export function useQuotationsByStatus(status: string) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: quotationKeys.byStatus(status),
    queryFn: () => quotationService.getByStatus(status),
    enabled: isAuthenticated && !!status,
  });
}

// Hook to create quotation
export function useCreateQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (quotation: any) => quotationService.create(quotation),
    onSuccess: (data) => {
      toast.success(`Quotation ${data.quotationNumber} created successfully`);
      queryClient.invalidateQueries({ queryKey: quotationKeys.lists() });
    },
    onError: (err: any) => {
      console.error('Failed to create quotation:', err);
      toast.error(err.response?.data?.message || 'Failed to create quotation');
    },
  });
}

// Hook to update quotation
export function useUpdateQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, quotation }: { id: number; quotation: any }) =>
      quotationService.update(id, quotation),
    onSuccess: (data, { id }) => {
      toast.success('Quotation updated successfully');
      queryClient.invalidateQueries({ queryKey: quotationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: quotationKeys.detail(id) });
    },
    onError: (err: any) => {
      console.error('Failed to update quotation:', err);
      toast.error(err.response?.data?.message || 'Failed to update quotation');
    },
  });
}

// Hook to delete quotation
export function useDeleteQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => quotationService.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: quotationKeys.lists() });

      const previousQuotations = queryClient.getQueryData(quotationKeys.lists());

      queryClient.setQueryData<Quotation[]>(quotationKeys.lists(), (old = []) =>
        old.filter((q) => q.id !== id)
      );

      return { previousQuotations };
    },
    onError: (err, id, context) => {
      if (context?.previousQuotations) {
        queryClient.setQueryData(quotationKeys.lists(), context.previousQuotations);
      }
      console.error('Failed to delete quotation:', err);
      toast.error('Failed to delete quotation');
    },
    onSuccess: () => {
      toast.success('Quotation deleted successfully');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.lists() });
    },
  });
}

// Hook to change quotation status
export function useChangeQuotationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      quotationService.changeStatus(id, status),
    onSuccess: (data, { id }) => {
      toast.success(`Quotation status changed to ${data.quotation.status}`);
      queryClient.invalidateQueries({ queryKey: quotationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: quotationKeys.detail(id) });
    },
    onError: (err: any) => {
      console.error('Failed to change status:', err);
      toast.error(err.response?.data?.message || 'Failed to change status');
    },
  });
}

// Hook to send quotation email
export function useSendQuotationEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => quotationService.sendEmail(id),
    onSuccess: (data, id) => {
      toast.success(data.message || 'Email sent successfully');
      queryClient.invalidateQueries({ queryKey: quotationKeys.detail(id) });
    },
    onError: (err: any) => {
      console.error('Failed to send email:', err);
      toast.error(err.response?.data?.message || 'Failed to send email');
    },
  });
}

// Hook to duplicate quotation
export function useDuplicateQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => quotationService.duplicate(id),
    onSuccess: (data) => {
      toast.success(`Quotation duplicated: ${data.quotationNumber}`);
      queryClient.invalidateQueries({ queryKey: quotationKeys.lists() });
    },
    onError: (err: any) => {
      console.error('Failed to duplicate quotation:', err);
      toast.error(err.response?.data?.message || 'Failed to duplicate quotation');
    },
  });
}
