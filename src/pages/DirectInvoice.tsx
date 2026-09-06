import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/contexts/ProductContext';
import { useInvoices } from '@/contexts/InvoiceContext';
import { customerService, Customer } from '@/services/customerService';
import { productService, Product } from '@/services/productService';
import invoiceService from '@/services/invoiceService';
import { toast } from 'sonner';
import {
  FileText, Users, Package, Plus, Minus, Trash2, Save, Wrench,
  Calculator, AlertTriangle, ChevronDown, Search, X, Calendar, ArrowLeft, FileCheck, FileBadge,
} from 'lucide-react';

// Module-level stale cache for customers — avoids re-fetch on every visit
let _diCustomerCache: Customer[] | null = null;
let _diCustomerCacheTime = 0;
const STALE_MS = 60_000;

interface InvoiceItemForm {
  uid: number;          // insertion-order key — guarantees stable row order in the table
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  taxPercentage: number;
  discountInput: string;
  taxInput: string;
  priceInput: string;
  discountMode: 'percent' | 'amount';
  discountAmountInput: string;
  discountAmount: number;
}

let _diUidCounter = 0;

const DirectInvoice = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>(); // present when editing
  const isEditMode = !!editId;
  const { fetchInvoices, fetchInvoiceById } = useInvoices();

  // Use ProductContext — already cached, no extra API call on each visit
  const { products: contextProducts, loading: productsLoading } = useProducts();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(0);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [documentType, setDocumentType] = useState<'INVOICE' | 'PROFORMA_INVOICE' | 'TAX_INVOICE'>('INVOICE');
  const [gstType, setGstType] = useState<'IGST' | 'SGST_CGST'>('SGST_CGST');
  const [shippingAddress, setShippingAddress] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [invoiceDiscountPercentage, setInvoiceDiscountPercentage] = useState(0);
  const [discountInput, setDiscountInput] = useState('0');
  const [discountMode, setDiscountMode] = useState<'percent' | 'amount'>('percent');
  const [discountAmountInput, setDiscountAmountInput] = useState('0');
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemForm[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Service charges
  interface ServiceForm { serviceName: string; servicePrice: number; serviceTax: number; servicePriceInput: string; serviceTaxInput: string; }
  const [services, setServices] = useState<ServiceForm[]>([]);

  // Customer dropdown
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Pre-fill form when editing a Proforma Invoice
  useEffect(() => {
    if (!isEditMode || !editId) return;
    (async () => {
      try {
        const inv = await fetchInvoiceById(parseInt(editId));
        if (!inv) { toast.error('Invoice not found'); navigate('/invoices'); return; }
        if (inv.documentType !== 'PROFORMA_INVOICE') {
          toast.error('Only Proforma Invoices can be edited');
          navigate(`/invoice/${editId}`);
          return;
        }
        // Pre-fill header fields
        setSelectedCustomerId((inv as any).customerId || 0);
        setCustomerSearch(inv.customerName || '');
        setInvoiceDate(inv.invoiceDate || new Date().toISOString().split('T')[0]);
        setDueDate(inv.dueDate || '');
        setNotes(inv.notes || '');
        setPaymentTerms((inv as any).paymentTerms || '');
        setTermsAndConditions(inv.termsAndConditions || '');
        setDocumentType(inv.documentType || 'PROFORMA_INVOICE');
        setGstType((inv as any).gstType || 'SGST_CGST');
        setShippingAddress(inv.shippingAddress || '');
        setDeliveryDate(inv.deliveryDate || '');
        setExpiryDate(inv.expiryDate || '');
        // Pre-fill items
        const productRows = (inv.items || []).filter((it: any) => (it.itemType || 'PRODUCT') !== 'SERVICE');
        const serviceRows = (inv.items || []).filter((it: any) => it.itemType === 'SERVICE');
        setInvoiceItems(productRows.map((it: any) => ({
          uid: ++_diUidCounter,
          productId: it.productId || 0,
          productName: it.productName || '',
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          discountPercentage: Number(it.discountPercentage) || 0,
          taxPercentage: Number(it.taxPercentage) || 0,
          discountInput: String(Number(it.discountPercentage) || 0),
          taxInput: String(Number(it.taxPercentage) || 0),
          priceInput: String(Number(it.unitPrice) || 0),
          discountMode: Number(it.discountAmount) > 0 ? 'amount' : 'percent',
          discountAmountInput: String(Number(it.discountAmount) || 0),
          discountAmount: Number(it.discountAmount) || 0,
        })));
        setServices(serviceRows.map((it: any) => ({
          serviceName: it.productName || '',
          servicePrice: Number(it.unitPrice) || 0,
          serviceTax: Number(it.taxPercentage) || 0,
          servicePriceInput: String(Number(it.unitPrice) || 0),
          serviceTaxInput: String(Number(it.taxPercentage) || 0),
        })));
      } catch {
        toast.error('Failed to load invoice for editing');
      }
    })();
  }, [isEditMode, editId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node))
        setShowCustomerDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const now = Date.now();
      if (_diCustomerCache && (now - _diCustomerCacheTime) < STALE_MS) {
        setCustomers(_diCustomerCache);
        setLoading(false);
        return;
      }
      const customersData = await customerService.getAll();
      _diCustomerCache = customersData;
      _diCustomerCacheTime = Date.now();
      setCustomers(customersData);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  // Sync products from ProductContext
  useEffect(() => {
    const mapped = contextProducts
      .filter((p: any) => p.id)
      .map((p: any) => ({
        id: Number(p.id),
        productName: p.name,
        price: p.price,
        unit: p.unit,
        discountPercentage: p.discount,
        taxPercentage: p.gst,
        taxType: p.taxType,
        imagePath: p.image || '',
        active: true,
        quantity: p.quantity,
        description: p.description || '',
      } as Product));
    setProducts(mapped);
  }, [contextProducts]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  // Pre-fill shipping address when customer changes
  React.useEffect(() => {
    if (selectedCustomer) {
      setShippingAddress(selectedCustomer.shippingAddress || '');
    }
  }, [selectedCustomerId]);
  const filteredCustomers = customers.filter((c) =>
    (c.customerName || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(customerSearch.toLowerCase())
  );
  const filteredProducts = products.filter(
    (p) =>
      (p.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) &&
      !invoiceItems.find((ii) => ii.productId === p.id)
  );

  // Product item handlers
  const addProduct = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setInvoiceItems((prev) => [...prev, {
      uid: ++_diUidCounter,
      productId: product.id,
      productName: product.productName,
      quantity: 1,
      unitPrice: Number(product.price),
      discountPercentage: Number(product.discountPercentage || 0),
      taxPercentage: product.taxType === 'No Tax' ? 0 : Number(product.taxPercentage || 0),
      discountInput: String(Number(product.discountPercentage || 0)),
      taxInput: product.taxType === 'No Tax' ? '0' : String(Number(product.taxPercentage || 0)),
      priceInput: String(Number(product.price)),
      discountMode: 'percent',
      discountAmountInput: '0',
      discountAmount: 0,
    }]);
    toast.success(`${product.productName} added`);
  };

  const updateQty = (id: number, qty: number) => {
    if (qty < 1) return;
    setInvoiceItems((prev) => prev.map((i) => i.productId === id ? { ...i, quantity: qty } : i));
  };

  const updatePrice = (id: number, val: string) => {
    const num = parseFloat(val);
    setInvoiceItems((prev) => prev.map((i) => i.productId === id
      ? { ...i, priceInput: val, unitPrice: isNaN(num) ? 0 : Math.max(0, num) }
      : i));
  };

  const updateDiscount = (id: number, val: string) => {
    const num = parseFloat(val);
    setInvoiceItems((prev) => prev.map((i) => {
      if (i.productId !== id) return i;
      if (i.discountMode === 'amount') {
        const amt = isNaN(num) ? 0 : Math.max(0, num);
        const base = i.unitPrice * i.quantity;
        const pct = base > 0 ? Math.min(100, (amt / base) * 100) : 0;
        return { ...i, discountAmountInput: val, discountAmount: amt, discountPercentage: pct };
      }
      return { ...i, discountInput: val, discountPercentage: isNaN(num) ? 0 : Math.min(100, Math.max(0, num)) };
    }));
  };

  const toggleItemDiscountMode = (id: number) => {
    setInvoiceItems((prev) => prev.map((i) => {
      if (i.productId !== id) return i;
      if (i.discountMode === 'percent') {
        const base = i.unitPrice * i.quantity;
        const amt = base * i.discountPercentage / 100;
        return { ...i, discountMode: 'amount', discountAmount: amt, discountAmountInput: amt.toFixed(2) };
      } else {
        const base = i.unitPrice * i.quantity;
        const pct = base > 0 ? Math.min(100, (i.discountAmount / base) * 100) : 0;
        return { ...i, discountMode: 'percent', discountPercentage: pct, discountInput: pct.toFixed(2), discountAmount: 0, discountAmountInput: '0' };
      }
    }));
  };

  const updateTax = (id: number, val: string) => {
    const num = parseFloat(val);
    setInvoiceItems((prev) => prev.map((i) => i.productId === id
      ? { ...i, taxInput: val, taxPercentage: isNaN(num) ? 0 : Math.min(100, Math.max(0, num)) }
      : i));
  };

  const removeItem = (id: number) => setInvoiceItems((prev) => prev.filter((i) => i.productId !== id));

  // Totals
  const totals = useMemo(() => {
    const subtotal = invoiceItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const itemDiscounts = invoiceItems.reduce((sum, i) => sum + i.unitPrice * i.quantity * i.discountPercentage / 100, 0);
    const invoiceDiscount = subtotal * (invoiceDiscountPercentage / 100);
    const totalDiscount = itemDiscounts + invoiceDiscount;
    const totalTax = invoiceItems.reduce((sum, i) => {
      const base = i.unitPrice * i.quantity;
      const afterDisc = base - base * i.discountPercentage / 100;
      return sum + afterDisc * i.taxPercentage / 100;
    }, 0);
    const serviceTotal = services.reduce((sum, s) => {
      const p = s.servicePrice || 0;
      const t = s.serviceTax || 0;
      return sum + p + p * t / 100;
    }, 0);
    const grandTotal = subtotal - totalDiscount + totalTax + serviceTotal;
    return { subtotal, totalDiscount, totalTax, serviceTotal, grandTotal };
  }, [invoiceItems, invoiceDiscountPercentage, services]);

  const saveInvoice = async () => {
    if (!selectedCustomerId) { toast.error('Please select a customer'); return; }
    if (invoiceItems.length === 0) {
      toast.error('Please add at least one product'); return;
    }
    try {
      setSaving(true);
      const payload = {
        customerId: selectedCustomerId,
        invoiceDate,
        dueDate,
        notes,
        paymentTerms: paymentTerms || undefined,
        termsAndConditions,
        documentType,
        gstType,
        shippingAddress: shippingAddress || undefined,
        deliveryDate: deliveryDate || undefined,
        expiryDate: expiryDate || undefined,
        discountPercentage: invoiceDiscountPercentage,
        items: [
          ...invoiceItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discountPercentage: i.discountPercentage,
            discountAmount: i.discountAmount > 0
              ? i.discountAmount
              : i.unitPrice * i.quantity * i.discountPercentage / 100,
            taxPercentage: i.taxPercentage,
          })),
          ...services
            .filter((s) => s.serviceName.trim() && s.servicePrice > 0)
            .map((s) => ({
              productId: null as any,
              itemType: 'SERVICE' as const,
              productName: s.serviceName.trim(),
              quantity: 1,
              unitPrice: s.servicePrice,
              discountPercentage: 0,
              taxPercentage: s.serviceTax,
            })),
        ],
      };

      if (isEditMode && editId) {
        const result = await invoiceService.updateInvoice(parseInt(editId), payload as any);
        toast.success(`Invoice ${result.invoiceNumber} updated!`);
        await fetchInvoices(true);
        setTimeout(() => navigate(`/invoice/${editId}`), 1200);
      } else {
        const result = await invoiceService.createDirectInvoice(payload as any);
        toast.success(`Invoice ${result.invoiceNumber} created!`);
        await fetchInvoices(true);
        setTimeout(() => navigate('/invoices'), 1200);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || (isEditMode ? 'Failed to update invoice' : 'Failed to create invoice'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || productsLoading) return (
    <div className="min-h-screen">
      <TopBar title={isEditMode ? 'Edit Proforma Invoice' : 'Direct Invoice'} />
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <TopBar title={isEditMode ? 'Edit Proforma Invoice' : 'Direct Invoice'} />
      <div className="p-6 space-y-6">
        {/* Back Button */}
        <button
          onClick={() => navigate('/invoices')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Invoices
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT PANEL ── */}
          <div className="lg:col-span-1 space-y-5">

            {/* Customer */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><Users size={16} /></div>
                <h3 className="font-semibold text-foreground text-sm">Select Customer</h3>
              </div>
              <div className="relative" ref={customerDropdownRef}>
                <button type="button" onClick={() => setShowCustomerDropdown((p) => !p)}
                  className="input-field w-full flex items-center justify-between text-left">
                  <span className={selectedCustomer ? 'text-foreground' : 'text-muted-foreground'}>
                    {selectedCustomer ? selectedCustomer.customerName : 'Choose a customer...'}
                  </span>
                  <ChevronDown size={15} className={`text-muted-foreground flex-shrink-0 transition-transform ${showCustomerDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showCustomerDropdown && (
                  <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input type="text" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                          placeholder="Search..." autoFocus
                          className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted rounded border-0 outline-none focus:ring-1 focus:ring-ring" />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {filteredCustomers.length === 0
                        ? <p className="text-sm text-muted-foreground text-center py-4">No customers found</p>
                        : filteredCustomers.map((c) => (
                          <button key={c.id} type="button"
                            onClick={() => { setSelectedCustomerId(c.id); setShowCustomerDropdown(false); setCustomerSearch(''); }}
                            className={`w-full text-left px-4 py-2.5 hover:bg-muted transition-colors ${selectedCustomerId === c.id ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                            <p className="text-sm font-medium">{c.customerName}</p>
                            <p className="text-xs text-muted-foreground">{c.email}</p>
                          </button>
                        ))}
                    </div>
                    {selectedCustomerId > 0 && (
                      <div className="p-2 border-t border-border">
                        <button type="button" onClick={() => { setSelectedCustomerId(0); setShowCustomerDropdown(false); }}
                          className="w-full flex items-center justify-center gap-1 text-xs text-destructive hover:bg-destructive/10 py-1.5 rounded">
                          <X size={11} /> Clear
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {customers.length === 0 && (
                <div className="mt-3 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-2 text-warning text-sm">
                  <AlertTriangle size={14} /> No customers available
                </div>
              )}
              {selectedCustomer && (
                <div className="mt-3 p-3 rounded-lg bg-muted text-sm space-y-0.5">
                  <p className="font-medium text-foreground">{selectedCustomer.customerName}</p>
                  <p className="text-muted-foreground">{selectedCustomer.email}</p>
                  <p className="text-muted-foreground">{selectedCustomer.phone}</p>
                  {selectedCustomer.address && <p className="text-muted-foreground">{selectedCustomer.address}</p>}
                </div>
              )}
            </div>

            {/* Invoice Details */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent"><FileText size={16} /></div>
                <h3 className="font-semibold text-foreground text-sm">Invoice Details</h3>
              </div>
              <div className="space-y-3">
                {/* Document Type */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Document Type</label>
                  <div className="flex gap-2 flex-wrap">
                    <button type="button" onClick={() => setDocumentType('INVOICE')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all ${documentType === 'INVOICE' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                      <FileCheck size={13} /> Invoice
                    </button>
                    <button type="button" onClick={() => setDocumentType('PROFORMA_INVOICE')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all ${documentType === 'PROFORMA_INVOICE' ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' : 'border-border text-muted-foreground hover:border-amber-300'}`}>
                      <FileBadge size={13} /> Proforma Invoice
                    </button>
                    <button type="button" onClick={() => setDocumentType('TAX_INVOICE')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all ${documentType === 'TAX_INVOICE' ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'border-border text-muted-foreground hover:border-green-400'}`}>
                      <FileText size={13} /> Tax Invoice
                    </button>
                  </div>
                  {documentType === 'PROFORMA_INVOICE' && (
                    <p className="text-xs text-amber-600 mt-1 dark:text-amber-400">This is a Proforma Invoice and is not a Tax Invoice.</p>
                  )}
                  {documentType === 'TAX_INVOICE' && (
                    <p className="text-xs text-green-600 mt-1 dark:text-green-400">This is a Tax Invoice with full GST breakdown.</p>
                  )}
                </div>

                {/* GST Type — relevant for Proforma and Tax Invoice */}
                {(documentType === 'PROFORMA_INVOICE' || documentType === 'TAX_INVOICE') && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">GST Type</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setGstType('SGST_CGST')}
                      className={`flex-1 py-2 rounded-lg border-2 text-xs font-semibold transition-all ${gstType === 'SGST_CGST' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                      SGST + CGST<span className="block font-normal opacity-70">Intra-state</span>
                    </button>
                    <button type="button" onClick={() => setGstType('IGST')}
                      className={`flex-1 py-2 rounded-lg border-2 text-xs font-semibold transition-all ${gstType === 'IGST' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                      IGST<span className="block font-normal opacity-70">Inter-state</span>
                    </button>
                  </div>
                </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Invoice Date *</label>
                  <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1 flex items-center gap-1"><Calendar size={11} />Valid Till *</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1 flex items-center gap-1"><Calendar size={11} />Expected Delivery Date</label>
                  <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1 flex items-center gap-1"><Calendar size={11} />Expiry Date</label>
                  <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Shipping Address</label>
                  <textarea value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} rows={2} placeholder="Shipping address (auto-filled from customer)" className="input-field resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Invoice Discount</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={discountMode === 'percent' ? discountInput : discountAmountInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (discountMode === 'percent') {
                          setDiscountInput(val);
                          setInvoiceDiscountPercentage(val === '' ? 0 : Math.min(100, Math.max(0, Number(val))));
                        } else {
                          setDiscountAmountInput(val);
                          const amt = parseFloat(val) || 0;
                          const sub = invoiceItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
                          setInvoiceDiscountPercentage(sub > 0 ? Math.min(100, (amt / sub) * 100) : 0);
                        }
                      }}
                      placeholder="0"
                      className="input-field [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min="0"
                      max={discountMode === 'percent' ? 100 : undefined}
                      step="0.01"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (discountMode === 'percent') {
                          const sub = invoiceItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
                          const amt = sub * invoiceDiscountPercentage / 100;
                          setDiscountAmountInput(amt.toFixed(2));
                          setDiscountMode('amount');
                        } else {
                          const sub = invoiceItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
                          const amt = parseFloat(discountAmountInput) || 0;
                          const pct = sub > 0 ? Math.min(100, (amt / sub) * 100) : 0;
                          setDiscountInput(pct.toFixed(2));
                          setInvoiceDiscountPercentage(pct);
                          setDiscountMode('percent');
                        }
                      }}
                      className="flex-shrink-0 w-9 h-10 rounded-md border border-input bg-muted hover:bg-muted/80 text-xs font-semibold text-muted-foreground transition-colors"
                    >
                      {discountMode === 'percent' ? '%' : '₹'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Note</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Additional notes..." className="input-field resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Payment Terms</label>
                  <input type="text" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. 100% advance, 50% advance + 50% before dispatch" className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Terms & Conditions</label>
                  <textarea value={termsAndConditions} onChange={(e) => setTermsAndConditions(e.target.value)} rows={2} placeholder="Payment terms, delivery terms..." className="input-field resize-none" />
                </div>
              </div>
            </div>

            {/* Add Products */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600"><Package size={16} /></div>
                <h3 className="font-semibold text-foreground text-sm">Add Products</h3>
              </div>
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products..." className="input-field mb-3" />
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {filteredProducts.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-4">{searchTerm ? 'No products found' : 'No products available'}</p>
                  : filteredProducts.map((p) => (
                    <div key={p.id} className="p-2.5 rounded-lg bg-muted/50 border border-border hover:bg-muted flex items-center gap-3 transition-colors">
                      {p.imagePath
                        ? <img src={p.imagePath} alt={p.productName} className="w-10 h-10 rounded-lg object-cover border border-border flex-shrink-0" />
                        : <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><Package size={16} className="text-primary" /></div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{p.productName}</p>
                        <p className="text-xs text-muted-foreground">₹{Number(p.price).toFixed(2)}</p>
                      </div>
                      <button onClick={() => addProduct(p.id)} className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex-shrink-0">
                        <Plus size={14} />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Products Table */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-primary" />
                  <h3 className="font-semibold text-foreground text-sm">Invoice Items</h3>
                </div>
                <span className="text-xs text-muted-foreground">{invoiceItems.length} item(s)</span>
              </div>
              {invoiceItems.length === 0
                ? <div className="p-10 text-center"><Package size={40} className="mx-auto text-muted-foreground/30 mb-3" /><p className="text-sm text-muted-foreground">No products added yet</p></div>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="table-header">
                          <th className="px-3 py-3 text-left font-semibold">Product</th>
                          <th className="px-3 py-3 text-center font-semibold w-32">Price (₹)</th>
                          <th className="px-3 py-3 text-center font-semibold w-24">Qty</th>
                          <th className="px-3 py-3 text-center font-semibold w-28">Disc</th>
                          <th className="px-3 py-3 text-center font-semibold w-20">Tax%</th>
                          <th className="px-3 py-3 text-right font-semibold w-28">Total</th>
                          <th className="px-3 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceItems.map((item) => {
                          const base = item.unitPrice * item.quantity;
                          const afterDisc = base - base * item.discountPercentage / 100;
                          const total = afterDisc + afterDisc * item.taxPercentage / 100;
                          const prod = products.find((p) => p.id === item.productId);
                          const inputClass = "h-10 border border-input rounded-md bg-background text-foreground font-medium text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
                          return (
                            <tr key={item.uid} className="table-row hover:bg-muted/50">
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  {prod?.imagePath
                                    ? <img src={prod.imagePath} alt={item.productName} className="w-8 h-8 rounded-md object-cover border border-border flex-shrink-0" />
                                    : <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0"><Package size={14} className="text-primary" /></div>
                                  }
                                  <span className="font-medium text-foreground truncate">{item.productName}</span>
                                </div>
                              </td>
                              <td className="px-2 py-3 text-center">
                                <input type="number" value={item.priceInput} onChange={(e) => updatePrice(item.productId, e.target.value)}
                                  className={`w-24 text-center ${inputClass}`} min="0" step="0.01" />
                              </td>
                              <td className="px-2 py-3 text-center">
                                <input type="number" value={item.quantity} onChange={(e) => updateQty(item.productId, parseInt(e.target.value) || 1)}
                                  className={`text-center w-20 ${inputClass}`} min="1" />
                              </td>
                              <td className="px-2 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    value={item.discountMode === 'percent' ? item.discountInput : item.discountAmountInput}
                                    onChange={(e) => updateDiscount(item.productId, e.target.value)}
                                    className={`text-center w-20 ${inputClass}`}
                                    min="0"
                                    max={item.discountMode === 'percent' ? 100 : undefined}
                                    step="0.01"
                                    title={item.discountMode === 'percent' ? 'Discount %' : 'Discount Amount (₹)'}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => toggleItemDiscountMode(item.productId)}
                                    className="flex-shrink-0 w-8 h-8 rounded-md border border-input bg-muted hover:bg-muted/80 text-xs font-semibold text-muted-foreground transition-colors"
                                    title={item.discountMode === 'percent' ? 'Switch to flat amount' : 'Switch to percentage'}
                                  >
                                    {item.discountMode === 'percent' ? '%' : '₹'}
                                  </button>
                                </div>
                              </td>
                              <td className="px-2 py-3 text-center">
                                {prod?.taxType === 'No Tax'
                                  ? <div className="flex justify-center"><span className="text-xs text-muted-foreground font-medium px-2 py-2 bg-muted/50 rounded-md">No Tax</span></div>
                                  : <input type="number" value={item.taxInput} onChange={(e) => updateTax(item.productId, e.target.value)}
                                      className={`text-center w-16 ${inputClass}`} min="0" max="100" step="0.01" />
                                }
                              </td>
                              <td className="px-3 py-3 text-right">
                                <span className="font-bold text-base text-primary">₹{total.toFixed(2)}</span>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex justify-center">
                                  <button onClick={() => removeItem(item.productId)} className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"><Trash2 size={16} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>

            {/* Service Charges */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench size={16} className="text-orange-500" />
                  <h3 className="font-semibold text-foreground text-sm">Service Charges</h3>
                </div>
                <button type="button" onClick={() => setServices(prev => [...prev, { serviceName: '', servicePrice: 0, serviceTax: 0, servicePriceInput: '0', serviceTaxInput: '0' }])}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
                  <Plus size={13} /> Add Service
                </button>
              </div>
              {services.length === 0
                ? <div className="px-5 py-6 text-center text-sm text-muted-foreground">No services added</div>
                : (
                  <div className="p-4 space-y-3">
                    {services.map((svc, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input type="text" value={svc.serviceName}
                          onChange={(e) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, serviceName: e.target.value } : s))}
                          placeholder="Service name" className="input-field flex-1 text-sm" />
                        <input type="number" value={svc.servicePriceInput}
                          onChange={(e) => {
                            const p = parseFloat(e.target.value) || 0;
                            setServices(prev => prev.map((s, i) => i === idx ? { ...s, servicePriceInput: e.target.value, servicePrice: p } : s));
                          }}
                          placeholder="Price" className="input-field w-24 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" min="0" />
                        <input type="number" value={svc.serviceTaxInput}
                          onChange={(e) => {
                            const t = Math.min(100, parseFloat(e.target.value) || 0);
                            setServices(prev => prev.map((s, i) => i === idx ? { ...s, serviceTaxInput: e.target.value, serviceTax: t } : s));
                          }}
                          placeholder="GST%" className="input-field w-16 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" min="0" max="100" />
                        <button onClick={() => setServices(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>

            {/* Order Summary */}
            {invoiceItems.length > 0 && (
              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calculator size={16} className="text-warning" />
                  <h3 className="font-semibold text-foreground text-sm">Invoice Summary</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal (Rs.)</span><span>₹{totals.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Discount (Rs.)</span><span className="text-destructive">-₹{totals.totalDiscount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Tax (GST)</span><span>₹{totals.totalTax.toFixed(2)}</span></div>
                  {totals.serviceTotal > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Service Charges (Rs.)</span><span>₹{totals.serviceTotal.toFixed(2)}</span></div>
                  )}
                  <div className="h-px bg-border my-2" />
                  <div className="flex justify-between font-bold text-base">
                    <span className="text-foreground">Grand Total</span>
                    <span className="text-primary">₹{totals.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button onClick={() => navigate(isEditMode ? `/invoice/${editId}` : '/invoices')} className="flex-1 btn-secondary flex items-center justify-center gap-2">
                <X size={16} /> Cancel
              </button>
              <button onClick={saveInvoice} disabled={saving}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                <Save size={16} /> {saving ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Invoice' : 'Create Invoice')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DirectInvoice;
