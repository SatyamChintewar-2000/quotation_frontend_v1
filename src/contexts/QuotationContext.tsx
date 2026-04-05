import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { quotationService, Quotation as APIQuotation } from '@/services/quotationService';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface QuotationItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  discount: number;
  gst: number;
  subtotal: number;
}

interface Quotation {
  id: string;
  clientId: string;
  clientName: string;
  items: QuotationItem[];
  subtotal: number;
  totalDiscount: number;
  totalGst: number;
  grandTotal: number;
  createdAt: string;
  status: string;
  createdBy: string;
}

interface QuotationContextType {
  quotations: Quotation[];
  loading: boolean;
  addQuotation: (quotation: Omit<Quotation, 'id'>) => Promise<string>;
  updateQuotation: (id: string, quotation: Partial<Quotation> & { status?: string }) => Promise<void>;
  deleteQuotation: (id: string) => Promise<void>;
  getQuotationsByUser: (userId: string) => Quotation[];
  getQuotationById: (id: string) => Quotation | undefined;
  refreshQuotations: () => Promise<void>;
}

const QuotationContext = createContext<QuotationContextType | undefined>(undefined);

// Helper function to map API quotation to frontend quotation
const mapAPIQuotationToQuotation = (apiQuotation: APIQuotation): Quotation => ({
  id: apiQuotation.id.toString(),
  clientId: apiQuotation.customerId.toString(),
  clientName: apiQuotation.customerName || '',
  items: apiQuotation.items.map(item => ({
    productId: item.productId.toString(),
    productName: item.productName || '',
    price: Number(item.unitPrice),
    quantity: item.quantity,
    discount: Number(item.discountPercentage),
    gst: Number(item.taxPercentage),
    subtotal: Number(item.itemTotal),
  })),
  subtotal: Number(apiQuotation.subtotal),
  totalDiscount: Number(apiQuotation.totalDiscount),
  totalGst: Number(apiQuotation.totalGst),
  grandTotal: Number(apiQuotation.totalAmount),
  createdAt: apiQuotation.createdAt,
  status: apiQuotation.status.toLowerCase(),
  createdBy: apiQuotation.createdBy?.toString() || '',
});

export const QuotationProvider = ({ children }: { children: ReactNode }) => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, loading: authLoading } = useAuth();

  const refreshQuotations = async () => {
    // Don't fetch if not authenticated
    if (!isAuthenticated) {
      console.log('⏭️ Skipping quotation fetch - user not authenticated');
      setQuotations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 Fetching quotations from API...');
      
      const apiQuotations = await quotationService.getAll();
      
      console.log('✅ Quotations fetched:', apiQuotations.length);
      
      const mappedQuotations = apiQuotations.map(mapAPIQuotationToQuotation);
      setQuotations(mappedQuotations);
    } catch (error: any) {
      console.error('❌ Failed to fetch quotations:', error);
      
      // Only show toast for non-auth errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Silent fail for auth errors - user will be redirected to login
        console.log('🔒 Authentication/permission error - silent fail');
      } else if (error.response?.status === 500) {
        // Only show error if user is on a page that needs quotations
        console.error('Server error loading quotations');
      } else if (error.code === 'ERR_NETWORK') {
        // Silent fail for network errors on initial load
        console.error('Network error loading quotations');
      }
      
      setQuotations([]);
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
      console.log('✅ User authenticated, fetching quotations...');
      refreshQuotations();
    } else {
      console.log('❌ User not authenticated, skipping quotation fetch');
      setQuotations([]);
      setLoading(false);
    }
  }, [isAuthenticated, authLoading]); // Re-run when auth state changes

  const addQuotation = async (quotation: Omit<Quotation, 'id'>): Promise<string> => {
    try {
      // Map frontend quotation to API request
      const apiRequest = {
        customerId: Number(quotation.clientId),
        expiryDate: quotation.createdAt, // This should be expiryDate, not createdAt
        currency: 'INR',
        status: quotation.status.toUpperCase(), // Send status to backend
        notes: '',
        termsAndConditions: '',
        discountPercentage: quotation.totalDiscount,
        items: quotation.items.map(item => ({
          productId: Number(item.productId),
          quantity: item.quantity,
          unitPrice: item.price,
          discountPercentage: item.discount,
          taxPercentage: item.gst,
        })),
      };
      
      const newQuotation = await quotationService.create(apiRequest);
      const mapped = mapAPIQuotationToQuotation(newQuotation);
      setQuotations((prev) => [...prev, mapped]);
      toast.success('Quotation created successfully');
      return mapped.id;
    } catch (error) {
      console.error('Failed to create quotation:', error);
      toast.error('Failed to create quotation');
      throw error;
    }
  };

  const updateQuotation = async (id: string, updatedFields: Partial<Quotation> & { status?: string }) => {
    try {
      let updated;
      
      // If only status is being changed, use the dedicated changeStatus endpoint
      if (updatedFields.status && Object.keys(updatedFields).length === 1) {
        console.log('📝 Changing status for quotation', id, 'to', updatedFields.status);
        
        // Map frontend status to backend status (uppercase)
        const statusMap: Record<string, string> = {
          'draft': 'DRAFT',
          'generated': 'GENERATED',
          'sent': 'SENT',
          'approved': 'APPROVED',
          'rejected': 'REJECTED',
        };
        const backendStatus = statusMap[updatedFields.status.toLowerCase()] || updatedFields.status.toUpperCase();
        
        const response = await quotationService.changeStatus(Number(id), backendStatus);
        console.log('✅ Status change response:', response);
        
        if (response.quotation) {
          updated = response.quotation;
        } else {
          console.error('❌ No quotation in response:', response);
          throw new Error('Invalid response from server');
        }
      } else {
        // For other updates, use the generic update endpoint
        // Build complete request with all required fields
        const apiRequest: any = {
          customerId: updatedFields.customerId,
          status: updatedFields.status?.toUpperCase() || 'DRAFT',
          currency: updatedFields.currency || 'INR',
          expiryDate: updatedFields.expiryDate,
          notes: updatedFields.notes,
          termsAndConditions: updatedFields.termsAndConditions,
          discountPercentage: updatedFields.discountPercentage || 0,
          items: updatedFields.items || [],
        };
        updated = await quotationService.update(Number(id), apiRequest);
      }
      
      setQuotations((prev) =>
        prev.map((q) => (q.id === id ? mapAPIQuotationToQuotation(updated) : q))
      );
      toast.success('Quotation updated successfully');
    } catch (error: any) {
      console.error('Failed to update quotation:', error);
      
      // Get detailed error message
      let errorMessage = 'Failed to update quotation';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 400) {
        errorMessage = 'Invalid status transition. Check the valid options.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      throw error;
    }
  };

  const deleteQuotation = async (id: string) => {
    try {
      await quotationService.delete(Number(id));
      setQuotations((prev) => prev.filter((q) => q.id !== id));
      toast.success('Quotation deleted successfully');
    } catch (error) {
      console.error('Failed to delete quotation:', error);
      toast.error('Failed to delete quotation');
      throw error;
    }
  };

  const getQuotationsByUser = (userId: string) => {
    return quotations.filter((q) => q.createdBy === userId);
  };

  const getQuotationById = (id: string) => {
    return quotations.find((q) => q.id === id);
  };

  return (
    <QuotationContext.Provider
      value={{
        quotations,
        loading,
        addQuotation,
        updateQuotation,
        deleteQuotation,
        getQuotationsByUser,
        getQuotationById,
        refreshQuotations,
      }}
    >
      {children}
    </QuotationContext.Provider>
  );
};

export const useQuotations = () => {
  const context = useContext(QuotationContext);
  if (context === undefined) {
    throw new Error('useQuotations must be used within a QuotationProvider');
  }
  return context;
};
