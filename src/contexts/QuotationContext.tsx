import React, { createContext, useContext, useState, useRef, ReactNode, useEffect } from 'react';
import { quotationService, Quotation as APIQuotation } from '@/services/quotationService';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface QuotationItem {
  productId: string;
  productName: string;
  productNameSnapshot?: string;
  productDescription?: string;
  productDescriptionSnapshot?: string;
  imagePath?: string;
  imagePathSnapshot?: string;
  price: number;
  quantity: number;
  discount: number;
  gst: number;
  subtotal: number;
}

interface QuotationService {
  serviceName: string;
  servicePrice: number;
  serviceTax: number;
}

interface Quotation {
  id: string;
  clientId: string;
  clientName: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  quotationNumber?: string;
  quotationDate?: string;
  deliveryDate?: string;
  executiveName?: string;
  quotationCode?: string;
  notes?: string;
  termsAndConditions?: string;
  items: QuotationItem[];
  services?: QuotationService[];
  subtotal: number;
  totalDiscount: number;
  totalGst: number;
  grandTotal: number;
  createdAt: string;
  status: string;
  createdBy: string;
  hideServiceChargesOnPdf?: boolean;
}

interface QuotationContextType {
  quotations: Quotation[];
  loading: boolean;
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  fetchPage: (page: number) => Promise<void>;
  addQuotation: (quotation: Omit<Quotation, 'id'>) => Promise<string>;
  updateQuotation: (id: string, quotation: Partial<Quotation> & { status?: string }) => Promise<void>;
  deleteQuotation: (id: string) => Promise<void>;
  getQuotationsByUser: (userId: string) => Quotation[];
  getQuotationById: (id: string) => Quotation | undefined;
  refreshQuotations: (force?: boolean) => Promise<void>;
}

const QuotationContext = createContext<QuotationContextType | undefined>(undefined);

// Helper function to map API quotation to frontend quotation
const mapAPIQuotationToQuotation = (apiQuotation: APIQuotation): Quotation => ({
  id: apiQuotation.id.toString(),
  clientId: apiQuotation.customerId.toString(),
  clientName: apiQuotation.customerName || '',
  customerName: apiQuotation.customerName || '',
  customerPhone: (apiQuotation as any).customerPhone || '',
  customerAddress: (apiQuotation as any).customerAddress || '',
  quotationNumber: (apiQuotation as any).quotationNumber || '',
  quotationDate: (apiQuotation as any).quotationDate || '',
  deliveryDate: (apiQuotation as any).deliveryDate || '',
  executiveName: (apiQuotation as any).executiveName || '',
  quotationCode: (apiQuotation as any).quotationCode || '',
  notes: (apiQuotation as any).notes || '',
  termsAndConditions: (apiQuotation as any).termsAndConditions || '',
  items: apiQuotation.items.map(item => ({
    productId: item.productId.toString(),
    productName: item.productName || '',
    productNameSnapshot: item.productNameSnapshot,
    productDescription: item.productDescription,
    productDescriptionSnapshot: item.productDescriptionSnapshot,
    imagePath: item.imagePath,
    imagePathSnapshot: item.imagePathSnapshot,
    price: Number(item.unitPrice),
    unitPrice: Number(item.unitPrice),
    quantity: item.quantity,
    discount: Number(item.discountPercentage),
    discountPercentage: Number(item.discountPercentage),
    gst: Number(item.taxPercentage),
    taxPercentage: Number(item.taxPercentage),
    subtotal: Number(item.itemTotal),
  })),
  services: ((apiQuotation as any).services || []).map((s: any) => ({
    serviceName: s.serviceName || '',
    servicePrice: Number(s.servicePrice) || 0,
    serviceTax: Number(s.serviceTax) || 0,
  })),
  subtotal: Number(apiQuotation.subtotal),
  totalDiscount: Number(apiQuotation.totalDiscount),
  totalGst: Number(apiQuotation.totalGst),
  grandTotal: Number(apiQuotation.totalAmount),
  createdAt: apiQuotation.createdAt,
  status: apiQuotation.status.toLowerCase(),
  createdBy: apiQuotation.createdBy?.toString() || '',
  hideServiceChargesOnPdf: (apiQuotation as any).hideServiceChargesOnPdf === true,
});

export const QuotationProvider = ({ children }: { children: ReactNode }) => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(10);
  const { isAuthenticated, loading: authLoading } = useAuth();

  const lastFetchedPage = useRef<number | null>(null);
  const lastFetchedAt = useRef<number | null>(null);
  const STALE_AFTER_MS = 60_000;

  /** Fetch a specific page from the server. */
  const fetchPage = async (page: number) => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await quotationService.getPaged(page, pageSize);
      const mapped = res.content.map(mapAPIQuotationToQuotation);
      setQuotations(mapped);
      setTotalElements(res.totalElements);
      setTotalPages(res.totalPages);
      setCurrentPage(res.currentPage);
      lastFetchedPage.current = page;
      lastFetchedAt.current = Date.now();
    } catch (error: any) {
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        console.error('Failed to fetch quotations:', error);
      }
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  /** Refresh current page (or page 0 if none loaded). Respects stale check unless forced. */
  const refreshQuotations = async (force = false) => {
    if (!isAuthenticated) { setQuotations([]); setLoading(false); return; }
    const now = Date.now();
    if (!force && lastFetchedAt.current && (now - lastFetchedAt.current) < STALE_AFTER_MS) {
      return; // still fresh
    }
    await fetchPage(lastFetchedPage.current ?? 0);
  };

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) {
      fetchPage(0); // always fetch on login — stale timer resets on logout
    } else {
      setQuotations([]);
      lastFetchedAt.current = null; // reset stale timer on logout
      lastFetchedPage.current = null;
      setLoading(false);
    }
  }, [isAuthenticated, authLoading]);

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
      lastFetchedAt.current = null; // force fresh fetch next time
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
        
        if (response && response.quotation) {
          updated = response.quotation;
        } else if (response) {
          // refresh from server if quotation not in response
          await refreshQuotations(true);
          toast.success('Quotation updated successfully');
          return;
        } else {
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
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
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
      lastFetchedAt.current = null; // force fresh fetch next time
      await fetchPage(lastFetchedPage.current ?? 0); // refresh current page
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
        totalElements,
        totalPages,
        currentPage,
        pageSize,
        fetchPage,
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
