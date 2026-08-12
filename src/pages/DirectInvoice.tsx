import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/contexts/ProductContext';
import { customerService, Customer } from '@/services/customerService';
import { productService, Product } from '@/services/productService';
import invoiceService from '@/services/invoiceService';
import { toast } from 'sonner';
import {
  FileText, Users, Package, Plus, Minus, Trash2, Save,
  Calculator, AlertTriangle, ChevronDown, Search, X, Calendar, ArrowLeft, FileCheck, FileBadge,
} from 'lucide-react';

// Module-level stale cache for customers — avoids re-fetch on every visit
let _diCustomerCache: Customer[] | null = null;
let _diCustomerCacheTime = 0;
const STALE_MS = 60_000;

interface InvoiceItemForm {
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

const DirectInvoice = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

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
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [documentType, setDocumentType] = useState<'INVOICE' | 'PROFORMA_INVOICE'>('INVOICE');
  const [gstType, setGstType] = useState<'IGST' | 'SGST_CGST'>('SGST_CGST');
  const [shippingAddress, setShippingAddress] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [invoiceDiscountPercentage, setInvoiceDiscountPercentage] = useState(0);
  const [discountInput, setDiscountInput] = useState('0');
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemForm[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Customer dropdown
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
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
    c.customerName.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );
  const filteredProducts = products.filter(
    (p) =>
      p.productName.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !invoiceItems.find((ii) => ii.productId === p.id)
  );

  // Product item handlers
  const addProduct = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setInvoiceItems((prev) => [...prev, {
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
    setInvoiceItems((prev) => prev.map((i) => i.productId === id
      ? { ...i, discountInput: val, discountPercentage: isNaN(num) ? 0 : Math.min(100, Math.max(0, num)) }
      : i));
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
    const grandTotal = subtotal - totalDiscount + totalTax;
    return { subtotal, totalDiscount, totalTax, grandTotal };
  }, [invoiceItems, invoiceDiscountPercentage]);

  const saveInvoice = async () => {
    if (!selectedCustomerId) { toast.error('Please select a customer'); return; }
    if (invoiceItems.length === 0) {
      toast.error('Please add at least one product'); return;
    }
    try {
      setSaving(true);
      const result = await invoiceService.createDirectInvoice({
        customerId: selectedCustomerId,
        invoiceDate,
        dueDate,
        notes,
        termsAndConditions,
        documentType,
        gstType,
        shippingAddress: shippingAddress || undefined,
        deliveryDate: deliveryDate || undefined,
        expiryDate: expiryDate || undefined,
        discountPercentage: invoiceDiscountPercentage,
        items: invoiceItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountPercentage: i.discountPercentage,
          taxPercentage: i.taxPercentage,
        })),
      });
      toast.success(`Invoice ${result.invoiceNumber} created!`);
      setTimeout(() => navigate('/invoices'), 1200);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  if (loading || productsLoading) return (
    <div className="min-h-screen">
      <TopBar title="Direct Invoice" />
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
      <TopBar title="Direct Invoice" />
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
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDocumentType('INVOICE')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all ${documentType === 'INVOICE' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                      <FileCheck size={13} /> Invoice
                    </button>
                    <button type="button" onClick={() => setDocumentType('PROFORMA_INVOICE')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all ${documentType === 'PROFORMA_INVOICE' ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' : 'border-border text-muted-foreground hover:border-amber-300'}`}>
                      <FileBadge size={13} /> Proforma Invoice
                    </button>
                  </div>
                  {documentType === 'PROFORMA_INVOICE' && (
                    <p className="text-xs text-amber-600 mt-1 dark:text-amber-400">This is a Proforma Invoice and is not a Tax Invoice.</p>
                  )}
                </div>

                {/* GST Type — only relevant for Proforma Invoice */}
                {documentType === 'PROFORMA_INVOICE' && (
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
                  <label className="block text-xs font-medium text-foreground mb-1 flex items-center gap-1"><Calendar size={11} />Due Date *</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1 flex items-center gap-1"><Calendar size={11} />Delivery Date</label>
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
                  <label className="block text-xs font-medium text-foreground mb-1">Invoice Discount (%)</label>
                  <input type="number" value={discountInput}
                    onChange={(e) => {
                      setDiscountInput(e.target.value);
                      setInvoiceDiscountPercentage(e.target.value === '' ? 0 : Number(e.target.value));
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
                          <th className="px-4 py-3 text-left">Product</th>
                          <th className="px-3 py-3 text-right">Price</th>
                          <th className="px-3 py-3 text-center">Qty</th>
                          <th className="px-3 py-3 text-center">Disc%</th>
                          <th className="px-3 py-3 text-center">Tax%</th>
                          <th className="px-3 py-3 text-right">Total</th>
                          <th className="px-3 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceItems.map((item) => {
                          const base = item.unitPrice * item.quantity;
                          const afterDisc = base - base * item.discountPercentage / 100;
                          const total = afterDisc + afterDisc * item.taxPercentage / 100;
                          const prod = products.find((p) => p.id === item.productId);
                          return (
                            <tr key={item.productId} className="table-row">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {prod?.imagePath
                                    ? <img src={prod.imagePath} alt={item.productName} className="w-9 h-9 rounded-lg object-cover border border-border flex-shrink-0" />
                                    : <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><Package size={14} className="text-primary" /></div>
                                  }
                                  <span className="font-medium text-foreground">{item.productName}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <input type="number" value={item.priceInput} onChange={(e) => updatePrice(item.productId, e.target.value)}
                                  className="w-20 text-right input-field py-1 px-1 text-xs mx-auto block" min="0" step="0.01" />
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="p-1 rounded bg-muted hover:bg-muted/80"><Minus size={12} /></button>
                                  <input type="number" value={item.quantity} onChange={(e) => updateQty(item.productId, parseInt(e.target.value) || 1)}
                                    className="w-12 text-center input-field py-1 px-1 text-xs" min="1" />
                                  <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="p-1 rounded bg-muted hover:bg-muted/80"><Plus size={12} /></button>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <input type="number" value={item.discountInput} onChange={(e) => updateDiscount(item.productId, e.target.value)}
                                  className="w-16 text-center input-field py-1 px-1 text-xs mx-auto block" min="0" max="100" />
                              </td>
                              <td className="px-3 py-3">
                                {prod?.taxType === 'No Tax'
                                  ? <span className="text-xs text-muted-foreground block text-center">No Tax</span>
                                  : <input type="number" value={item.taxInput} onChange={(e) => updateTax(item.productId, e.target.value)}
                                    className="w-16 text-center input-field py-1 px-1 text-xs mx-auto block" min="0" max="100" />
                                }
                              </td>
                              <td className="px-3 py-3 text-right font-semibold text-foreground">₹{total.toFixed(2)}</td>
                              <td className="px-3 py-3">
                                <button onClick={() => removeItem(item.productId)} className="p-1.5 rounded text-destructive hover:bg-destructive/10"><Trash2 size={14} /></button>
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
            {invoiceItems.length > 0 && (
              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calculator size={16} className="text-warning" />
                  <h3 className="font-semibold text-foreground text-sm">Invoice Summary</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{totals.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Discount</span><span className="text-destructive">-₹{totals.totalDiscount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Tax (GST)</span><span>₹{totals.totalTax.toFixed(2)}</span></div>
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
              <button onClick={() => navigate('/invoices')} className="flex-1 btn-secondary flex items-center justify-center gap-2">
                <X size={16} /> Cancel
              </button>
              <button onClick={saveInvoice} disabled={saving}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                <Save size={16} /> {saving ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DirectInvoice;
