import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import invoiceService, { Invoice, InvoiceRequest, Payment } from '@/services/invoiceService';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface InvoiceContextType {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  fetchInvoices: () => Promise<void>;
  fetchInvoiceById: (id: number) => Promise<Invoice | null>;
  fetchInvoicesByQuotation: (quotationId: number) => Promise<Invoice[]>;
  fetchInvoicesByStatus: (status: string) => Promise<Invoice[]>;
  fetchInvoicesByPaymentStatus: (paymentStatus: string) => Promise<Invoice[]>;
  fetchOverdueInvoices: () => Promise<Invoice[]>;
  fetchInvoicesByDateRange: (startDate: string, endDate: string) => Promise<Invoice[]>;
  createInvoice: (data: InvoiceRequest) => Promise<Invoice | null>;
  updateInvoice: (id: number, data: InvoiceRequest) => Promise<Invoice | null>;
  deleteInvoice: (id: number) => Promise<boolean>;
  changeStatus: (id: number, status: string) => Promise<Invoice | null>;
  markAsSent: (id: number) => Promise<Invoice | null>;
  markAsPaid: (id: number) => Promise<Invoice | null>;
  recordPayment: (invoiceId: number, payment: Payment) => Promise<Payment | null>;
  deletePayment: (invoiceId: number, paymentId: number) => Promise<boolean>;
}

const InvoiceContext = createContext<InvoiceContextType | undefined>(undefined);

export const InvoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, loading: authLoading } = useAuth();

  // 60-second stale threshold — avoids re-fetch on every page navigation
  const lastFetchedAt = useRef<number | null>(null);
  const STALE_AFTER_MS = 60_000;

  const fetchInvoices = useCallback(async (force = false) => {
    if (!isAuthenticated) { setInvoices([]); return; }

    const now = Date.now();
    if (!force && lastFetchedAt.current && (now - lastFetchedAt.current) < STALE_AFTER_MS) {
      return; // still fresh — serve from memory
    }

    setLoading(true);
    setError(null);
    try {
      const data = await invoiceService.getInvoices();
      setInvoices(data);
      lastFetchedAt.current = Date.now();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch invoices';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchInvoiceById = useCallback(async (id: number) => {
    try {
      return await invoiceService.getInvoiceById(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch invoice';
      setError(message);
      toast.error(message);
      return null;
    }
  }, []);

  const fetchInvoicesByQuotation = useCallback(async (quotationId: number) => {
    try {
      return await invoiceService.getInvoicesByQuotation(quotationId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch invoices';
      setError(message);
      return [];
    }
  }, []);

  const fetchInvoicesByStatus = useCallback(async (status: string) => {
    try {
      return await invoiceService.getInvoicesByStatus(status);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch invoices';
      setError(message);
      return [];
    }
  }, []);

  const fetchInvoicesByPaymentStatus = useCallback(async (paymentStatus: string) => {
    try {
      return await invoiceService.getInvoicesByPaymentStatus(paymentStatus);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch invoices';
      setError(message);
      return [];
    }
  }, []);

  const fetchOverdueInvoices = useCallback(async () => {
    try {
      return await invoiceService.getOverdueInvoices();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch overdue invoices';
      setError(message);
      return [];
    }
  }, []);

  const fetchInvoicesByDateRange = useCallback(async (startDate: string, endDate: string) => {
    try {
      return await invoiceService.getInvoicesByDateRange(startDate, endDate);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch invoices';
      setError(message);
      return [];
    }
  }, []);

  const createInvoice = useCallback(async (data: InvoiceRequest) => {
    try {
      const newInvoice = await invoiceService.createInvoice(data);
      setInvoices(prev => [...prev, newInvoice]);
      lastFetchedAt.current = null;
      toast.success('Invoice created successfully');
      return newInvoice;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create invoice';
      setError(message);
      toast.error(message);
      return null;
    }
  }, []);

  const updateInvoice = useCallback(async (id: number, data: InvoiceRequest) => {
    try {
      const updated = await invoiceService.updateInvoice(id, data);
      setInvoices(prev => prev.map(inv => inv.id === id ? updated : inv));
      lastFetchedAt.current = null;
      toast.success('Invoice updated successfully');
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update invoice';
      setError(message);
      toast.error(message);
      return null;
    }
  }, []);

  const deleteInvoice = useCallback(async (id: number) => {
    try {
      await invoiceService.deleteInvoice(id);
      setInvoices(prev => prev.filter(inv => inv.id !== id));
      lastFetchedAt.current = null;
      toast.success('Invoice deleted successfully');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete invoice';
      setError(message);
      toast.error(message);
      return false;
    }
  }, []);

  const changeStatus = useCallback(async (id: number, status: string) => {
    try {
      const updated = await invoiceService.changeStatus(id, status);
      setInvoices(prev => prev.map(inv => inv.id === id ? updated : inv));
      lastFetchedAt.current = null;
      toast.success(`Invoice status changed to ${status}`);
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change status';
      setError(message);
      toast.error(message);
      return null;
    }
  }, []);

  const markAsSent = useCallback(async (id: number) => {
    try {
      const updated = await invoiceService.markAsSent(id);
      setInvoices(prev => prev.map(inv => inv.id === id ? updated : inv));
      lastFetchedAt.current = null;
      toast.success('Invoice marked as sent');
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark as sent';
      setError(message);
      toast.error(message);
      return null;
    }
  }, []);

  const markAsPaid = useCallback(async (id: number) => {
    try {
      const updated = await invoiceService.markAsPaid(id);
      setInvoices(prev => prev.map(inv => inv.id === id ? updated : inv));
      lastFetchedAt.current = null;
      toast.success('Invoice marked as paid');
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark as paid';
      setError(message);
      toast.error(message);
      return null;
    }
  }, []);

  const recordPayment = useCallback(async (invoiceId: number, payment: Payment) => {
    try {
      const newPayment = await invoiceService.recordPayment(invoiceId, payment);
      // Refresh invoice to get updated payment status
      const updated = await invoiceService.getInvoiceById(invoiceId);
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? updated : inv));
      toast.success('Payment recorded successfully');
      return newPayment;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record payment';
      setError(message);
      toast.error(message);
      return null;
    }
  }, []);

  const deletePayment = useCallback(async (invoiceId: number, paymentId: number) => {
    try {
      await invoiceService.deletePayment(invoiceId, paymentId);
      // Refresh invoice to get updated payment status
      const updated = await invoiceService.getInvoiceById(invoiceId);
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? updated : inv));
      toast.success('Payment deleted successfully');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete payment';
      setError(message);
      toast.error(message);
      return false;
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) {
      fetchInvoices(true); // always force on login
    } else {
      setInvoices([]);
      lastFetchedAt.current = null; // reset on logout
    }
  }, [isAuthenticated, authLoading, fetchInvoices]);

  return (
    <InvoiceContext.Provider
      value={{
        invoices,
        loading,
        error,
        fetchInvoices,
        fetchInvoiceById,
        fetchInvoicesByQuotation,
        fetchInvoicesByStatus,
        fetchInvoicesByPaymentStatus,
        fetchOverdueInvoices,
        fetchInvoicesByDateRange,
        createInvoice,
        updateInvoice,
        deleteInvoice,
        changeStatus,
        markAsSent,
        markAsPaid,
        recordPayment,
        deletePayment,
      }}
    >
      {children}
    </InvoiceContext.Provider>
  );
};

export const useInvoices = () => {
  const context = useContext(InvoiceContext);
  if (!context) {
    throw new Error('useInvoices must be used within InvoiceProvider');
  }
  return context;
};
