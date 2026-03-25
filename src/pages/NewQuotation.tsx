import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { customerService, Customer } from '@/services/customerService';
import { productService, Product } from '@/services/productService';
import { quotationService } from '@/services/quotationService';
import { toast } from 'sonner';
import {
  FileText,
  Users,
  Package,
  Plus,
  Minus,
  Trash2,
  Save,
  Send,
  Calculator,
  AlertTriangle,
  Calendar,
  FileSignature,
  ChevronDown,
  Search,
  X,
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
}

const NewQuotation = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(0);
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [quotationDiscountPercentage, setQuotationDiscountPercentage] = useState(0);
  const [quotationItems, setQuotationItems] = useState<QuotationItemForm[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [customersData, productsData] = await Promise.all([
        customerService.getAll(),
        productService.getAll(),
      ]);
      setCustomers(customersData);
      setProducts(productsData.filter(p => p.active)); // Only active products
      
      // Set default expiry date (30 days from now)
      const defaultExpiry = new Date();
      defaultExpiry.setDate(defaultExpiry.getDate() + 30);
      setExpiryDate(defaultExpiry.toISOString().split('T')[0]);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load customers and products');
    } finally {
      setLoading(false);
    }
  };

  // Customer dropdown state
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const filteredCustomers = customers.filter(c =>
    c.customerName.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const filteredProducts = products.filter(
    (p) =>
      p.productName.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !quotationItems.find((qi) => qi.productId === p.id)
  );

  const addProductToQuotation = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const newItem: QuotationItemForm = {
      productId: product.id,
      productName: product.productName,
      quantity: 1,
      unitPrice: Number(product.price),
      discountPercentage: Number(product.discountPercentage || 0),
      taxPercentage: product.taxType === 'No Tax' ? 0 : Number(product.taxPercentage || 0),
      discountInput: String(Number(product.discountPercentage || 0)),
      taxInput: product.taxType === 'No Tax' ? '0' : String(Number(product.taxPercentage || 0)),
    };

    setQuotationItems((prev) => [...prev, newItem]);
    toast.success(`${product.productName} added to quotation`);
  };

  const updateItemQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity < 1) return;

    setQuotationItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const updateItemDiscount = (productId: number, inputVal: string) => {
    const num = parseFloat(inputVal);
    setQuotationItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, discountInput: inputVal, discountPercentage: isNaN(num) ? 0 : Math.min(100, Math.max(0, num)) }
          : item
      )
    );
  };

  const updateItemTax = (productId: number, inputVal: string) => {
    const num = parseFloat(inputVal);
    setQuotationItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, taxInput: inputVal, taxPercentage: isNaN(num) ? 0 : Math.min(100, Math.max(0, num)) }
          : item
      )
    );
  };

  const removeItem = (productId: number) => {
    setQuotationItems((prev) => prev.filter((item) => item.productId !== productId));
    toast.info('Item removed from quotation');
  };

  // Calculate totals (matches backend calculation logic)
  const totals = useMemo(() => {
    // Calculate subtotal (sum of all unitPrice × quantity)
    const subtotal = quotationItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );

    // Calculate item-level discounts
    const itemDiscounts = quotationItems.reduce(
      (sum, item) => sum + (item.unitPrice * item.quantity * item.discountPercentage / 100),
      0
    );

    // Calculate quotation-level discount
    const quotationDiscount = subtotal * (quotationDiscountPercentage / 100);

    // Total discount
    const totalDiscount = itemDiscounts + quotationDiscount;

    // Calculate tax on discounted amounts
    const totalTax = quotationItems.reduce((sum, item) => {
      const itemSubtotal = item.unitPrice * item.quantity;
      const itemDiscount = itemSubtotal * (item.discountPercentage / 100);
      const afterDiscount = itemSubtotal - itemDiscount;
      return sum + (afterDiscount * item.taxPercentage / 100);
    }, 0);

    // Grand total = subtotal - total discount + total tax
    const grandTotal = subtotal - totalDiscount + totalTax;

    return { subtotal, totalDiscount, totalTax, grandTotal };
  }, [quotationItems, quotationDiscountPercentage]);

  const validateForm = () => {
    if (!selectedCustomerId) {
      toast.error('Please select a customer');
      return false;
    }
    if (quotationItems.length === 0) {
      toast.error('Please add at least one product');
      return false;
    }
    if (!expiryDate) {
      toast.error('Please set an expiry date');
      return false;
    }
    return true;
  };

  const saveQuotation = async (status: 'DRAFT' | 'GENERATED' = 'DRAFT') => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      const quotationData = {
        customerId: selectedCustomerId,
        expiryDate,
        currency: 'INR',
        status: status, // Send the status to backend
        notes,
        termsAndConditions,
        discountPercentage: quotationDiscountPercentage,
        items: quotationItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercentage: item.discountPercentage,
          taxPercentage: item.taxPercentage,
        })),
      };

      const result = await quotationService.create(quotationData);

      toast.success(`Quotation ${result.quotationNumber} created successfully!`);
      
      // Reset form
      setSelectedCustomerId(0);
      setQuotationItems([]);
      setNotes('');
      setTermsAndConditions('');
      setQuotationDiscountPercentage(0);
      
      // Set new expiry date
      const defaultExpiry = new Date();
      defaultExpiry.setDate(defaultExpiry.getDate() + 30);
      setExpiryDate(defaultExpiry.toISOString().split('T')[0]);

      // Navigate to quotation history
      setTimeout(() => {
        navigate('/quotation-history');
      }, 1500);

    } catch (error: any) {
      console.error('Failed to create quotation:', error);
      toast.error(error.response?.data?.message || 'Failed to create quotation');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <TopBar title="New Quotation" />
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar title="New Quotation" />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Customer & Product Selection */}
          <div className="lg:col-span-1 space-y-6">
            {/* Customer Selection */}
            <div className="bg-card rounded-xl shadow-md border border-border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Users size={20} />
                </div>
                <h3 className="font-semibold text-foreground">Select Customer</h3>
              </div>

              {/* Custom Customer Dropdown */}
              <div className="relative" ref={customerDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowCustomerDropdown(p => !p)}
                  className="input-field w-full flex items-center justify-between text-left"
                >
                  <span className={selectedCustomer ? 'text-foreground' : 'text-muted-foreground'}>
                    {selectedCustomer ? selectedCustomer.customerName : 'Choose a customer...'}
                  </span>
                  <ChevronDown size={16} className={`text-muted-foreground transition-transform flex-shrink-0 ${showCustomerDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showCustomerDropdown && (
                  <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                    {/* Search inside dropdown */}
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          placeholder="Search customer..."
                          className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted rounded border-0 outline-none focus:ring-1 focus:ring-ring"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {filteredCustomers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No customers found</p>
                      ) : (
                        filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomerId(customer.id);
                              setShowCustomerDropdown(false);
                              setCustomerSearch('');
                            }}
                            className={`w-full text-left px-4 py-2.5 transition-colors hover:bg-muted ${selectedCustomerId === customer.id ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                          >
                            <p className="text-sm font-medium">{customer.customerName}</p>
                            <p className="text-xs text-muted-foreground">{customer.email}</p>
                          </button>
                        ))
                      )}
                    </div>
                    {selectedCustomerId > 0 && (
                      <div className="p-2 border-t border-border">
                        <button
                          type="button"
                          onClick={() => { setSelectedCustomerId(0); setShowCustomerDropdown(false); }}
                          className="w-full flex items-center justify-center gap-1 text-xs text-destructive hover:bg-destructive/10 py-1.5 rounded transition-colors"
                        >
                          <X size={12} /> Clear selection
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {customers.length === 0 && (
                <div className="mt-4 p-4 rounded-lg bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-2 text-warning">
                    <AlertTriangle size={16} />
                    <span className="text-sm font-medium">No customers available</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add customers first from Customer Management page.
                  </p>
                </div>
              )}

              {selectedCustomer && (
                <div className="mt-4 p-4 rounded-lg bg-muted">
                  <p className="font-medium text-foreground">{selectedCustomer.customerName}</p>
                  <p className="text-sm text-muted-foreground">{selectedCustomer.email}</p>
                  <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
                  {selectedCustomer.address && (
                    <p className="text-sm text-muted-foreground mt-1">{selectedCustomer.address}</p>
                  )}
                </div>
              )}
            </div>

            {/* Quotation Details */}
            <div className="bg-card rounded-xl shadow-md border border-border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-accent/10 text-accent">
                  <FileSignature size={20} />
                </div>
                <h3 className="font-semibold text-foreground">Quotation Details</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    <Calendar size={16} className="inline mr-2" />
                    Expiry Date *
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="input-field"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Quotation Discount (%)
                  </label>
                  <input
                    type="number"
                    value={quotationDiscountPercentage}
                    onChange={(e) => setQuotationDiscountPercentage(Number(e.target.value))}
                    className="input-field"
                    min="0"
                    max="100"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="input-field"
                    rows={3}
                    placeholder="Additional notes..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Terms & Conditions
                  </label>
                  <textarea
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    className="input-field"
                    rows={3}
                    placeholder="Payment terms, delivery terms, etc..."
                  />
                </div>
              </div>
            </div>

            {/* Product Selection */}
            <div className="bg-card rounded-xl shadow-md border border-border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-success/10 text-success">
                  <Package size={20} />
                </div>
                <h3 className="font-semibold text-foreground">Add Products</h3>
              </div>

              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products..."
                className="input-field mb-4"
              />

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      {searchTerm ? 'No products found' : 'No products available'}
                    </p>
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="p-3 rounded-lg bg-muted/50 border border-border hover:bg-muted flex items-center gap-3 transition-colors"
                    >
                      {product.imagePath ? (
                        <img
                          src={product.imagePath}
                          alt={product.productName}
                          className="w-12 h-12 rounded-lg object-cover border border-border flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center border border-border flex-shrink-0">
                          <Package size={20} className="text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">
                          {product.productName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ₹{Number(product.price).toFixed(2)}
                          {product.taxType !== 'No Tax' && ` | Tax: ${Number(product.taxPercentage)}%`}
                        </p>
                      </div>
                      <button
                        onClick={() => addProductToQuotation(product.id)}
                        className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex-shrink-0"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Side - Quotation Items */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quotation Items Table */}
            <div className="bg-card rounded-xl shadow-md border border-border overflow-hidden">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10 text-accent">
                    <FileText size={20} />
                  </div>
                  <h3 className="font-semibold text-foreground">Quotation Items</h3>
                </div>
                <span className="text-sm text-muted-foreground">
                  {quotationItems.length} item(s)
                </span>
              </div>

              {quotationItems.length === 0 ? (
                <div className="p-12 text-center">
                  <Package size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">
                    No products added yet. Select products from the left panel.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="table-header">
                        <th className="px-4 py-4 text-left">Image</th>
                        <th className="px-6 py-4 text-left">Product</th>
                        <th className="px-4 py-4 text-right">Price (₹)</th>
                        <th className="px-4 py-4 text-center">Quantity</th>
                        <th className="px-4 py-4 text-center">Discount %</th>
                        <th className="px-4 py-4 text-center">Tax %</th>
                        <th className="px-4 py-4 text-right">Total (₹)</th>
                        <th className="px-4 py-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotationItems.map((item) => {
                        const product = products.find(p => p.id === item.productId);
                        const baseAmount = item.unitPrice * item.quantity;
                        const discountAmount = baseAmount * (item.discountPercentage / 100);
                        const afterDiscount = baseAmount - discountAmount;
                        const taxAmount = afterDiscount * (item.taxPercentage / 100);
                        const itemTotal = afterDiscount + taxAmount;

                        return (
                          <tr key={item.productId} className="table-row">
                            <td className="px-4 py-4">
                              {product?.imagePath ? (
                                <img
                                  src={product.imagePath}
                                  alt={item.productName}
                                  className="w-12 h-12 rounded-lg object-cover border border-border"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center border border-border">
                                  <Package size={20} className="text-primary" />
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 font-medium text-foreground">
                              {item.productName}
                            </td>
                            <td className="px-4 py-4 text-right text-muted-foreground">
                              ₹{item.unitPrice.toFixed(2)}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() =>
                                    updateItemQuantity(item.productId, item.quantity - 1)
                                  }
                                  className="p-1 rounded bg-muted hover:bg-muted/80"
                                >
                                  <Minus size={14} />
                                </button>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateItemQuantity(
                                      item.productId,
                                      parseInt(e.target.value) || 1
                                    )
                                  }
                                  className="w-16 text-center input-field py-1 px-2"
                                  min="1"
                                />
                                <button
                                  onClick={() =>
                                    updateItemQuantity(item.productId, item.quantity + 1)
                                  }
                                  className="p-1 rounded bg-muted hover:bg-muted/80"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <input
                                type="number"
                                value={item.discountInput}
                                onChange={(e) =>
                                  updateItemDiscount(item.productId, e.target.value)
                                }
                                className="w-20 text-center input-field py-1 px-2 mx-auto block"
                                min="0"
                                max="100"
                                step="0.01"
                              />
                            </td>
                            <td className="px-4 py-4">
                              {product?.taxType === 'No Tax' ? (
                                <span className="text-sm text-muted-foreground block text-center">No Tax</span>
                              ) : (
                                <input
                                  type="number"
                                  value={item.taxInput}
                                  onChange={(e) =>
                                    updateItemTax(item.productId, e.target.value)
                                  }
                                  className="w-20 text-center input-field py-1 px-2 mx-auto block"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                />
                              )}
                            </td>
                            <td className="px-4 py-4 text-right font-medium text-foreground">
                              ₹{itemTotal.toFixed(2)}
                            </td>
                            <td className="px-4 py-4">
                              <button
                                onClick={() => removeItem(item.productId)}
                                className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Totals Section */}
            {quotationItems.length > 0 && (
              <div className="bg-card rounded-xl shadow-md border border-border p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-warning/10 text-warning">
                    <Calculator size={20} />
                  </div>
                  <h3 className="font-semibold text-foreground">Order Summary</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">
                      ₹{totals.subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Discount</span>
                    <span className="text-destructive">
                      -₹{totals.totalDiscount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Tax</span>
                    <span className="text-foreground">
                      ₹{totals.totalTax.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-px bg-border my-4"></div>
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-foreground">
                      Grand Total
                    </span>
                    <span className="text-2xl font-bold text-primary">
                      ₹{totals.grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={() => saveQuotation('DRAFT')}
                    disabled={saving}
                    className="flex-1 btn-secondary flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Save size={20} />
                    {saving ? 'Saving...' : 'Save as Draft'}
                  </button>
                  <button
                    onClick={() => saveQuotation('GENERATED')}
                    disabled={saving}
                    className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send size={20} />
                    {saving ? 'Creating...' : 'Create Quotation'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewQuotation;
