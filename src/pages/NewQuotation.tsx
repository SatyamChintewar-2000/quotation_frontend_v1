import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/contexts/ProductContext';
import { useQuotations } from '@/contexts/QuotationContext';
import { customerService, Customer } from '@/services/customerService';
import { quotationService, QuotationServiceItem } from '@/services/quotationService';
import { toast } from 'sonner';

// Module-level customer cache for NewQuotation — avoids re-fetch on every visit
let _nqCustomerCache: Customer[] | null = null;
let _nqCustomerCacheTime = 0;
const CUSTOMER_STALE_MS = 60_000;
import {
  FileText, Users, Package, Plus, Minus, Trash2, Save,
  Calculator, AlertTriangle, FileSignature, ChevronDown,
  Search, X, Wrench, Calendar, User,
} from 'lucide-react';

interface QuotationItemForm {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  taxPercentage: number;
  discountInput: string;
  taxInput: string;
  priceInput: string;
}

interface ServiceForm {
  serviceName: string;
  servicePrice: number;
  serviceTax: number;
  servicePriceInput: string;
  serviceTaxInput: string;
}

const NewQuotation = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get('mode') === 'edit';
  const editingId = searchParams.get('id');

  // Use ProductContext — already cached, no extra API call on each visit
  const { products: contextProducts, loading: productsLoading } = useProducts();
  // Use QuotationContext to invalidate cache after save
  const { refreshQuotations } = useQuotations();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(0);
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [quotationCode, setQuotationCode] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [executiveName, setExecutiveName] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [quotationDiscountPercentage, setQuotationDiscountPercentage] = useState(0);
  const [discountInput, setDiscountInput] = useState('0');
  const [quotationItems, setQuotationItems] = useState<QuotationItemForm[]>([]);
  const [services, setServices] = useState<ServiceForm[]>([]);
  const [hideServiceChargesOnPdf, setHideServiceChargesOnPdf] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Customer dropdown
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    // Pre-fill executive name from logged-in user
    if (user?.name) setExecutiveName(user.name);
    
    // Load quotation data if in edit mode
    if (isEditMode) {
      const storedData = sessionStorage.getItem('editingQuotation');
      if (storedData) {
        try {
          const quotation = JSON.parse(storedData);
          loadQuotationForEdit(quotation);
          sessionStorage.removeItem('editingQuotation'); // Clear after loading
        } catch (err) {
          console.error('Failed to load quotation for editing:', err);
          toast.error('Failed to load quotation data');
        }
      }
    }
  }, []);

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
      // Use cached customers if still fresh
      if (_nqCustomerCache && (now - _nqCustomerCacheTime) < CUSTOMER_STALE_MS) {
        setCustomers(_nqCustomerCache);
        setLoading(false);
        return;
      }
      const customersData = await customerService.getAll();
      _nqCustomerCache = customersData;
      _nqCustomerCacheTime = Date.now();
      setCustomers(customersData);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  // Sync products from context whenever context updates
  useEffect(() => {
    const active = contextProducts
      .filter((p) => p.id)
      .map((p) => ({
        id: Number(p.id),
        productName: p.name,
        price: p.price,
        unit: p.unit,
        discountPercentage: p.discount,
        taxPercentage: p.gst,
        taxType: p.taxType,
        imagePath: p.image,
        active: true,
      }));
    setProducts(active);
  }, [contextProducts]);

  const loadQuotationForEdit = (quotation: any) => {
    // Set customer
    setSelectedCustomerId(quotation.customerId || 0);
    
    // Set dates
    if (quotation.quotationDate) {
      setQuotationDate(new Date(quotation.quotationDate).toISOString().split('T')[0]);
    }
    if (quotation.deliveryDate) {
      setDeliveryDate(new Date(quotation.deliveryDate).toISOString().split('T')[0]);
    }
    
    // Set other fields
    setQuotationCode(quotation.quotationCode || '');
    setExecutiveName(quotation.executiveName || user?.name || '');
    setNotes(quotation.notes || '');
    setTermsAndConditions(quotation.termsAndConditions || '');
    setQuotationDiscountPercentage(quotation.discountPercentage || 0);
    setDiscountInput(String(quotation.discountPercentage || 0));
    
    // Load items
    if (quotation.items && quotation.items.length > 0) {
      const items = quotation.items.map((item: any) => ({
        productId: item.productId,
        productName: item.productName || item.productNameSnapshot || '',
        quantity: item.quantity || 1,
        unitPrice: Number(item.unitPrice || item.price || 0),
        discountPercentage: Number(item.discountPercentage || item.discount || 0),
        taxPercentage: Number(item.taxPercentage || item.gst || 0),
        discountInput: String(Number(item.discountPercentage || item.discount || 0)),
        taxInput: String(Number(item.taxPercentage || item.gst || 0)),
        priceInput: String(Number(item.unitPrice || item.price || 0)),
      }));
      setQuotationItems(items);
    }
    
    // Load services
    if (quotation.services && quotation.services.length > 0) {
      const svcs = quotation.services.map((svc: any) => ({
        serviceName: svc.serviceName || '',
        servicePrice: Number(svc.servicePrice || 0),
        serviceTax: Number(svc.serviceTax || 0),
        servicePriceInput: String(Number(svc.servicePrice || 0)),
        serviceTaxInput: String(Number(svc.serviceTax || 0)),
      }));
      setServices(svcs);
    }

    // Load hide service charges flag
    setHideServiceChargesOnPdf(quotation.hideServiceChargesOnPdf === true);

    toast.success('Quotation loaded for editing');
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const filteredCustomers = customers.filter((c) =>
    c.customerName.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );
  const filteredProducts = products.filter(
    (p) =>
      p.productName.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !quotationItems.find((qi) => qi.productId === p.id)
  );

  // Product item handlers
  const addProduct = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setQuotationItems((prev) => [...prev, {
      productId: product.id,
      productName: product.productName,
      quantity: 1,
      unitPrice: Number(product.price),
      discountPercentage: Number(product.discountPercentage || 0),
      taxPercentage: product.taxType === 'No Tax' ? 0 : Number(product.taxPercentage || 0),
      discountInput: String(Number(product.discountPercentage || 0)),
      taxInput: product.taxType === 'No Tax' ? '0' : String(Number(product.taxPercentage || 0)),
      priceInput: String(Number(product.price)),
    }]);
    toast.success(`${product.productName} added`);
  };

  const updateQty = (id: number, qty: number) => {
    if (qty < 1) return;
    setQuotationItems((prev) => prev.map((i) => i.productId === id ? { ...i, quantity: qty } : i));
  };

  const updatePrice = (id: number, val: string) => {
    const num = parseFloat(val);
    setQuotationItems((prev) => prev.map((i) => i.productId === id
      ? { ...i, priceInput: val, unitPrice: isNaN(num) ? 0 : Math.max(0, num) }
      : i));
  };

  const updateDiscount = (id: number, val: string) => {
    const num = parseFloat(val);
    setQuotationItems((prev) => prev.map((i) => i.productId === id
      ? { ...i, discountInput: val, discountPercentage: isNaN(num) ? 0 : Math.min(100, Math.max(0, num)) }
      : i));
  };

  const updateTax = (id: number, val: string) => {
    const num = parseFloat(val);
    setQuotationItems((prev) => prev.map((i) => i.productId === id
      ? { ...i, taxInput: val, taxPercentage: isNaN(num) ? 0 : Math.min(100, Math.max(0, num)) }
      : i));
  };

  const removeItem = (id: number) => setQuotationItems((prev) => prev.filter((i) => i.productId !== id));

  // Service handlers
  const addService = () => setServices((prev) => [...prev, {
    serviceName: '', servicePrice: 0, serviceTax: 0,
    servicePriceInput: '0', serviceTaxInput: '0',
  }]);

  const updateService = (idx: number, field: keyof ServiceForm, val: string) => {
    setServices((prev) => prev.map((s, i) => {
      if (i !== idx) return s;
      if (field === 'servicePrice') {
        const num = parseFloat(val) || 0;
        return { ...s, servicePriceInput: val, servicePrice: Math.max(0, num) };
      }
      if (field === 'serviceTax') {
        const num = parseFloat(val) || 0;
        // Cap tax at 100% — it's a percentage, not an absolute value
        const capped = Math.min(100, Math.max(0, num));
        return { ...s, serviceTaxInput: val, serviceTax: capped };
      }
      return { ...s, [field]: val };
    }));
  };

  const removeService = (idx: number) => setServices((prev) => prev.filter((_, i) => i !== idx));

  // Totals
  const totals = useMemo(() => {
    const subtotal = quotationItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const itemDiscounts = quotationItems.reduce((sum, i) => sum + i.unitPrice * i.quantity * i.discountPercentage / 100, 0);
    const quotationDiscount = subtotal * (quotationDiscountPercentage / 100);
    const totalDiscount = itemDiscounts + quotationDiscount;
    const totalTax = quotationItems.reduce((sum, i) => {
      const base = i.unitPrice * i.quantity;
      const afterDisc = base - base * i.discountPercentage / 100;
      return sum + afterDisc * i.taxPercentage / 100;
    }, 0);
    const serviceTotals = services.reduce((sum, s) => {
      const tax = s.servicePrice * s.serviceTax / 100;
      return sum + s.servicePrice + tax;
    }, 0);
    const grandTotal = subtotal - totalDiscount + totalTax + serviceTotals;
    return { subtotal, totalDiscount, totalTax, serviceTotals, grandTotal };
  }, [quotationItems, quotationDiscountPercentage, services]);

  const saveQuotation = async (status: 'DRAFT' | 'GENERATED' = 'DRAFT') => {
    if (!selectedCustomerId) { toast.error('Please select a customer'); return; }
    if (quotationItems.length === 0 && services.length === 0) {
      toast.error('Please add at least one product or service'); return;
    }
    try {
      setSaving(true);
      const quotationData = {
        customerId: selectedCustomerId,
        quotationDate,
        quotationCode: quotationCode || undefined,
        deliveryDate: deliveryDate || undefined,
        executiveName: executiveName || undefined,
        status,
        notes,
        termsAndConditions,
        discountPercentage: quotationDiscountPercentage,
        items: quotationItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountPercentage: i.discountPercentage,
          taxPercentage: i.taxPercentage,
        })),
        services: services.map((s) => ({
          serviceName: s.serviceName,
          servicePrice: s.servicePrice,
          serviceTax: s.serviceTax,
        })),
        hideServiceChargesOnPdf,
      };

      if (isEditMode && editingId) {
        // Update existing quotation
        const result = await quotationService.update(Number(editingId), quotationData);
        toast.success(`Quotation ${result.quotationNumber} updated!`);
      } else {
        // Create new quotation
        const result = await quotationService.create(quotationData);
        toast.success(`Quotation ${result.quotationNumber} created!`);
      }

      // Force-refresh the quotation cache so the new record shows immediately on the history page
      refreshQuotations(true);
      
      setTimeout(() => navigate('/quotation-history'), 1200);
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} quotation`);
    } finally {
      setSaving(false);
    }
  };

  if (loading || productsLoading) return (
    <div className="min-h-screen">
      <TopBar title={isEditMode ? "Edit Quotation" : "New Quotation"} />
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
      <TopBar title={isEditMode ? "Edit Quotation" : "New Quotation"} />
      <div className="p-6 space-y-6">
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

            {/* Quotation Details */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent"><FileSignature size={16} /></div>
                <h3 className="font-semibold text-foreground text-sm">Quotation Details</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Quotation Date *</label>
                  <input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Quotation Code / Ref</label>
                  <input type="text" value={quotationCode} onChange={(e) => setQuotationCode(e.target.value)} placeholder="e.g. QT-2026-001" className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1 flex items-center gap-1"><Calendar size={11} />Delivery Date</label>
                  <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1 flex items-center gap-1"><User size={11} />Executive Name</label>
                  <input type="text" value={executiveName} onChange={(e) => setExecutiveName(e.target.value)} placeholder="Sales executive name" className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Quotation Discount (%)</label>
                  <input type="number" value={discountInput}
                    onChange={(e) => {
                      setDiscountInput(e.target.value);
                      setQuotationDiscountPercentage(e.target.value === '' ? 0 : Number(e.target.value));
                    }}
                    placeholder="0"
                    className="input-field" min="0" max="100" step="0.01" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Note</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Additional notes..." className="input-field resize-none" />
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
                  <h3 className="font-semibold text-foreground text-sm">Quotation Items</h3>
                </div>
                <span className="text-xs text-muted-foreground">{quotationItems.length} item(s)</span>
              </div>
              {quotationItems.length === 0
                ? <div className="p-10 text-center"><Package size={40} className="mx-auto text-muted-foreground/30 mb-3" /><p className="text-sm text-muted-foreground">No products added yet</p></div>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="table-header">
                          <th className="px-3 py-3 text-left font-semibold">Product</th>
                          <th className="px-3 py-3 text-center font-semibold w-32">Price (₹)</th>
                          <th className="px-3 py-3 text-center font-semibold w-28">Qty</th>
                          <th className="px-3 py-3 text-center font-semibold w-24">Disc%</th>
                          <th className="px-3 py-3 text-center font-semibold w-24">Tax%</th>
                          <th className="px-3 py-3 text-right font-semibold w-28">Total</th>
                          <th className="px-3 py-3 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {quotationItems.map((item) => {
                          const base = item.unitPrice * item.quantity;
                          const afterDisc = base - base * item.discountPercentage / 100;
                          const total = afterDisc + afterDisc * item.taxPercentage / 100;
                          const prod = products.find((p) => p.id === item.productId);
                          const inputClass = "h-10 border border-input rounded-md bg-background text-foreground font-medium text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all";
                          return (
                            <tr key={item.productId} className="table-row hover:bg-muted/50">
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  {prod?.imagePath
                                    ? <img src={prod.imagePath} alt={item.productName} className="w-8 h-8 rounded-md object-cover border border-border flex-shrink-0" />
                                    : <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0"><Package size={14} className="text-primary" /></div>
                                  }
                                  <span className="font-medium text-foreground truncate">{item.productName}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <input type="number" value={item.priceInput} onChange={(e) => updatePrice(item.productId, e.target.value)}
                                  className={`w-full text-center ${inputClass}`} min="0" step="0.01" />
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="p-1 rounded-md bg-muted hover:bg-muted/80 transition-colors" title="Decrease"><Minus size={14} /></button>
                                  <input type="number" value={item.quantity} onChange={(e) => updateQty(item.productId, parseInt(e.target.value) || 1)}
                                    className={`text-center flex-1 ${inputClass}`} min="1" />
                                  <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="p-1 rounded-md bg-muted hover:bg-muted/80 transition-colors" title="Increase"><Plus size={14} /></button>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <input type="number" value={item.discountInput} onChange={(e) => updateDiscount(item.productId, e.target.value)}
                                  className={`w-full text-center ${inputClass}`} min="0" max="100" step="0.01" />
                              </td>
                              <td className="px-3 py-3 text-center">
                                {prod?.taxType === 'No Tax'
                                  ? <div className="flex justify-center"><span className="text-xs text-muted-foreground font-medium px-2 py-2 bg-muted/50 rounded-md">No Tax</span></div>
                                  : <input type="number" value={item.taxInput} onChange={(e) => updateTax(item.productId, e.target.value)}
                                      className={`w-full text-center ${inputClass}`} min="0" max="100" step="0.01" />
                                }
                              </td>
                              <td className="px-3 py-3 text-right">
                                <span className="font-bold text-base text-primary">₹{total.toFixed(2)}</span>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex justify-center">
                                  <button onClick={() => removeItem(item.productId)} className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors" title="Remove"><Trash2 size={16} /></button>
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

            {/* Services Section */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench size={16} className="text-orange-500" />
                  <h3 className="font-semibold text-foreground text-sm">Service Details</h3>
                </div>
                <div className="flex items-center gap-3">
                  {/* Feature 2: Hide service charges on PDF toggle */}
                  {services.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setHideServiceChargesOnPdf((p) => !p)}
                      title={hideServiceChargesOnPdf ? 'Click to show service charges on PDF' : 'Click to hide service charges on PDF'}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        hideServiceChargesOnPdf
                          ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400'
                          : 'bg-green-50 border-green-300 text-green-700 dark:bg-green-950/30 dark:border-green-700 dark:text-green-400'
                      }`}
                    >
                      {hideServiceChargesOnPdf ? '🙈 Hidden on PDF' : '👁 Visible on PDF'}
                    </button>
                  )}
                  <button onClick={addService} className="flex items-center gap-1.5 text-xs btn-secondary py-1.5 px-3">
                    <Plus size={13} /> Add Service
                  </button>
                </div>
              </div>
              {services.length === 0
                ? <div className="p-8 text-center"><Wrench size={32} className="mx-auto text-muted-foreground/30 mb-2" /><p className="text-xs text-muted-foreground">No services added. Click "Add Service" to include service charges.</p></div>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="table-header">
                          <th className="px-3 py-3 text-left font-semibold">Service Name</th>
                          <th className="px-3 py-3 text-center font-semibold w-32">Price (₹)</th>
                          <th className="px-3 py-3 text-center font-semibold w-24">Tax (%)</th>
                          <th className="px-3 py-3 text-right font-semibold w-28">Total</th>
                          <th className="px-3 py-3 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((s, idx) => {
                          const serviceTotal = s.servicePrice + (s.servicePrice * s.serviceTax / 100);
                          const inputClass = "h-10 border border-input rounded-md bg-background text-foreground font-medium text-sm px-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all";
                          return (
                            <tr key={idx} className="table-row hover:bg-muted/50">
                              <td className="px-3 py-3">
                                <input type="text" value={s.serviceName} onChange={(e) => updateService(idx, 'serviceName', e.target.value)}
                                  placeholder="e.g. Installation, Setup" className={`w-full ${inputClass}`} />
                              </td>
                              <td className="px-3 py-3">
                                <input type="number" value={s.servicePriceInput} onChange={(e) => updateService(idx, 'servicePrice', e.target.value)}
                                  placeholder="0" className={`w-full text-center ${inputClass}`} min="0" step="0.01" />
                              </td>
                              <td className="px-3 py-3">
                                <input type="number" value={s.serviceTaxInput} onChange={(e) => updateService(idx, 'serviceTax', e.target.value)}
                                  placeholder="0" className={`w-full text-center ${inputClass}`} min="0" max="100" step="0.01" />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <span className="font-bold text-base text-primary">₹{serviceTotal.toFixed(2)}</span>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex justify-center">
                                  <button onClick={() => removeService(idx)} className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors" title="Remove"><Trash2 size={16} /></button>
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

            {/* Order Summary */}
            {(quotationItems.length > 0 || services.length > 0) && (
              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calculator size={16} className="text-warning" />
                  <h3 className="font-semibold text-foreground text-sm">Order Summary</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{totals.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Discount</span><span className="text-destructive">-₹{totals.totalDiscount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Tax (GST)</span><span>₹{totals.totalTax.toFixed(2)}</span></div>
                  {services.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Services Total</span><span>₹{totals.serviceTotals.toFixed(2)}</span></div>}
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
              <button onClick={() => saveQuotation('DRAFT')} disabled={saving}
                className="flex-1 btn-secondary flex items-center justify-center gap-2 disabled:opacity-50">
                <Save size={16} /> {saving ? 'Saving...' : 'Save as Draft'}
              </button>
              <button onClick={() => saveQuotation('GENERATED')} disabled={saving}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                <FileText size={16} /> {saving ? 'Generating...' : 'Generate Quotation'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewQuotation;
