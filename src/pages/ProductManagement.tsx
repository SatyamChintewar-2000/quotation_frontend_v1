import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/contexts/ProductContext';
import { productService, Product, ProductRequest } from '@/services/productService';
import { companyService } from '@/services/companyService';
import { toast } from 'sonner';
import { SearchBar } from '@/components/common/SearchBar';
import { ExportButton } from '@/components/common/ExportButton';
import { exportToExcel } from '@/utils/excelExport';
import { DeleteConfirmModal } from '@/components/common/DeleteConfirmModal';
import { SortableHeader } from '@/components/common/SortableHeader';
import { useSortable } from '@/hooks/useSortable';
import { Pagination } from '@/components/common/Pagination';
import {
  Package, Plus, Edit, Trash2, X, Upload, Tag, Layers, IndianRupee, FileSpreadsheet, Download,
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

const UNITS = ['piece', 'kg', 'litre', 'meter', 'box', 'set', 'dozen', 'gram', 'ml','Nos'];
const TAX_TYPES = ['GST', 'IGST', 'No Tax'];
const GST_RATES = ['0', '5', '12', '18', '28'];

const EMPTY: ProductRequest = {
  productName: '', productCode: '', hsnSacCode: '', brand: '', category: '',
  description: '', price: 0, purchasePrice: 0,
  unit: 'piece', quantity: 0, discountPercentage: 0,
  taxType: 'GST', taxPercentage: 18, expiryDate: '', imagePath: '', hsnCode: '',
  netWeight: undefined, cbm: undefined,
  // USD fields
  purchasePriceCurrency: 'INR',
  purchasePriceUsd: undefined, shippingCostUsd: undefined,
  dutyGstPercent: 31, clearanceCost: undefined,
};

const ProductManagement = () => {
  const { user } = useAuth();
  // Use ProductContext — already cached, won't re-fetch on every page visit
  const { products: contextProducts, loading: contextLoading, refreshProducts } = useProducts();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ProductRequest>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imagePreview, setImagePreview] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  // Company CBM advanced mode toggle — controls CBM field in the modal
  const [showCbmField, setShowCbmField] = useState(false);
  // USD purchase tab — shown when company has cbmAdvancedMode / showUsdColumn enabled
  const [showUsdPurchase, setShowUsdPurchase] = useState(false);
  const [usdExchangeRate, setUsdExchangeRate] = useState(83);
  // Which purchase tab is active in the modal
  const [purchaseTab, setPurchaseTab] = useState<'local' | 'international'>('local');

  useEffect(() => {
    if (!user) return;
    const isSuperAdmin = user.role === 'superadmin' || user.role === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      // Retry once on failure — handles token expiry race condition on page load
      const fetchCompanySettings = (retryCount = 0) => {
        companyService.getMyCompany()
          .then((c) => {
            const cbmOn = Boolean(c.cbmAdvancedMode ?? c.showCbmColumn ?? c.showUsdColumn);
            setShowCbmField(cbmOn);
            setShowUsdPurchase(Boolean(c.cbmAdvancedMode ?? c.showUsdColumn));
            setUsdExchangeRate(c.usdExchangeRate ?? 83);
          })
          .catch((err) => {
            if (retryCount === 0) {
              // Wait 800ms for token refresh to complete, then retry once
              setTimeout(() => fetchCompanySettings(1), 800);
            }
          });
      };
      fetchCompanySettings();
    }
  }, [user]);

  // Sync local products state from context
  useEffect(() => {
    // Map context product format back to the Product type this page uses
    const mapped = contextProducts.map((p: any) => ({
      id: Number(p.id),
      productName: p.name,
      productCode: p.productCode || '',
      brand: p.brand || '',
      category: p.category || '',
      description: p.description || '',
      price: p.price,
      purchasePrice: p.purchasePrice || 0,
      unit: p.unit,
      quantity: p.quantity,
      discountPercentage: p.discount,
      taxType: p.taxType,
      taxPercentage: p.gst,
      expiryDate: p.expiryDate || '',
      imagePath: p.image || '',
      createdBy: Number(p.createdBy) || 0,
      active: true,
      netWeight: p.netWeight,
      cbm: p.cbm,
      hsnSacCode: p.hsnSacCode || '',
      // USD fields
      purchasePriceCurrency: p.purchasePriceCurrency || 'INR',
      purchasePriceUsd: p.purchasePriceUsd,
      shippingCostUsd: p.shippingCostUsd,
      dutyGstPercent: p.dutyGstPercent ?? 31,
      clearanceCost: p.clearanceCost,
    } as Product));
    setProducts(mapped);
    setLoading(contextLoading);
  }, [contextProducts, contextLoading]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const fetchProducts = async () => {
    await refreshProducts(true); // force fresh fetch
  };

  const filtered = useMemo(() =>
    products.filter((p) =>
      p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.productCode || '').toLowerCase().includes(searchTerm.toLowerCase())
    ), [products, searchTerm]);

  const { sortedData, sort, handleSort } = useSortable(filtered);
  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
  const paginated = sortedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.productName.trim()) e.productName = 'Product name is required';
    if (!formData.price || formData.price <= 0) e.price = 'Valid selling price is required';
    if (formData.quantity === undefined || formData.quantity < 0) e.quantity = 'Valid quantity is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    try {
      // When international tab: auto-calculate purchasePrice in INR from USD fields
      let finalPurchasePrice = formData.purchasePrice ?? 0;
      let currency = formData.purchasePriceCurrency ?? 'INR';
      if (purchaseTab === 'international' && showUsdPurchase) {
        currency = 'USD';
        const itemUsd = formData.purchasePriceUsd ?? 0;
        const shipUsd = formData.shippingCostUsd ?? 0;
        const dutyPct = formData.dutyGstPercent ?? 31;
        const clearance = formData.clearanceCost ?? 0;
        const totalUsd = itemUsd + shipUsd;
        finalPurchasePrice = Math.round(totalUsd * (1 + dutyPct / 100) * usdExchangeRate * 100 + clearance * 100) / 100;
      } else {
        currency = 'INR';
      }
      const payload: ProductRequest = {
        ...formData,
        purchasePriceCurrency: currency,
        purchasePrice: finalPurchasePrice,
        // Clear USD fields when local tab is used
        purchasePriceUsd: purchaseTab === 'international' ? formData.purchasePriceUsd : undefined,
        shippingCostUsd: purchaseTab === 'international' ? formData.shippingCostUsd : undefined,
        dutyGstPercent: purchaseTab === 'international' ? (formData.dutyGstPercent ?? 31) : undefined,
        clearanceCost: purchaseTab === 'international' ? formData.clearanceCost : undefined,
        expiryDate: formData.expiryDate || undefined,
      };
      if (editingId) {
        await productService.update(editingId, payload);
        toast.success('Product updated');
      } else {
        await productService.create(payload);
        toast.success('Product added');
      }
      closeModal();
      fetchProducts();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save product');
    }
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setFormData({
      productName: p.productName,
      productCode: p.productCode || '',
      hsnSacCode: p.hsnSacCode || '',
      brand: p.brand || '',
      category: p.category || '',
      description: p.description || '',
      price: p.price,
      purchasePrice: p.purchasePrice || 0,
      unit: p.unit,
      quantity: p.quantity,
      discountPercentage: p.discountPercentage,
      taxType: p.taxType,
      taxPercentage: p.taxPercentage,
      expiryDate: p.expiryDate || '',
      imagePath: p.imagePath || '',
      netWeight: p.netWeight ?? undefined,
      cbm: p.cbm ?? undefined,
      hsnCode: p.hsnCode || '',
      // USD fields
      purchasePriceCurrency: p.purchasePriceCurrency || 'INR',
      purchasePriceUsd: p.purchasePriceUsd ?? undefined,
      shippingCostUsd: p.shippingCostUsd ?? undefined,
      dutyGstPercent: p.dutyGstPercent ?? 31,
      clearanceCost: p.clearanceCost ?? undefined,
    });
    setPurchaseTab((p.purchasePriceCurrency === 'USD') ? 'international' : 'local');
    setImagePreview(p.imagePath || '');
    setShowModal(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      e.target.value = '';
      setImagePreview('');
      setFormData((p) => ({ ...p, imagePath: '' }));
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setFormData((p) => ({ ...p, imagePath: result }));
    };
    reader.readAsDataURL(file);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData(EMPTY);
    setImagePreview('');
    setErrors({});
    setPurchaseTab('local');
  };

  const confirmDelete = async () => {
    if (!deletingProduct) return;
    try {
      await productService.delete(deletingProduct.id);
      toast.success('Product deleted');
      fetchProducts();
    } catch { toast.error('Failed to delete product'); }
  };

  const handleExport = () => {
    if (!filtered.length) { toast.error('No products to export'); return; }
    const baseColumns = [
      { header: 'Code', key: 'code', width: 12 },
      { header: 'HSN/SAC Code', key: 'hsn', width: 14 },
      { header: 'Product Name', key: 'name', width: 25 },
      { header: 'Brand', key: 'brand', width: 15 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'MRP (₹)', key: 'mrp', width: 12 },
      { header: 'Purchase Price (₹)', key: 'purchasePrice', width: 18 },
      { header: 'Tax Type', key: 'taxType', width: 12 },
      { header: 'GST (%)', key: 'gst', width: 10 },
      { header: 'Quantity', key: 'qty', width: 10 },
      { header: 'Discount (%)', key: 'discount', width: 12 },
      { header: 'Description', key: 'description', width: 30 },
    ];
    const usdColumns = [
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Purchase Price (USD)', key: 'purchasePriceUsd', width: 20 },
      { header: 'Shipping Cost (USD)', key: 'shippingCostUsd', width: 18 },
      { header: 'Duty GST (%)', key: 'dutyGstPercent', width: 14 },
      { header: 'Clearance Cost (₹)', key: 'clearanceCost', width: 18 },
    ];
    const columns = showUsdPurchase ? [...baseColumns, ...usdColumns] : baseColumns;
    const exportData = filtered.map((p) => {
      const row: any = {
        code: p.productCode || '',
        hsn: p.hsnSacCode || '',
        name: p.productName,
        brand: p.brand || '',
        category: p.category || '',
        unit: p.unit,
        mrp: p.price,
        purchasePrice: p.purchasePrice || 0,
        taxType: p.taxType,
        gst: p.taxPercentage,
        qty: p.quantity,
        discount: p.discountPercentage,
        description: p.description || '',
      };
      if (showUsdPurchase) {
        row.currency = p.purchasePriceCurrency || 'INR';
        row.purchasePriceUsd = p.purchasePriceUsd ?? '';
        row.shippingCostUsd = p.shippingCostUsd ?? '';
        row.dutyGstPercent = p.dutyGstPercent ?? '';
        row.clearanceCost = p.clearanceCost ?? '';
      }
      return row;
    });
    exportToExcel(exportData, columns, 'products');
    toast.success('Products exported to Excel');
  };

  // Download a blank template so users know the column format
  const handleDownloadTemplate = () => {
    const baseColumns = [
      { header: 'Code', key: 'code', width: 12 },
      { header: 'HSN/SAC Code', key: 'hsn', width: 14 },
      { header: 'Product Name *', key: 'name', width: 25 },
      { header: 'Brand', key: 'brand', width: 15 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'MRP (₹) *', key: 'mrp', width: 12 },
      { header: 'Purchase Price (₹)', key: 'purchasePrice', width: 18 },
      { header: 'Tax Type (GST/IGST/No Tax)', key: 'taxType', width: 22 },
      { header: 'GST (%)', key: 'gst', width: 10 },
      { header: 'Quantity *', key: 'qty', width: 10 },
      { header: 'Discount (%)', key: 'discount', width: 12 },
      { header: 'Description', key: 'description', width: 30 },
    ];
    const usdColumns = [
      { header: 'Purchase Price (USD)', key: 'purchasePriceUsd', width: 20 },
      { header: 'Shipping Cost (USD)', key: 'shippingCostUsd', width: 18 },
      { header: 'Duty GST (%)', key: 'dutyGstPercent', width: 14 },
      { header: 'Clearance Cost (₹)', key: 'clearanceCost', width: 18 },
    ];
    const columns = showUsdPurchase ? [...baseColumns, ...usdColumns] : baseColumns;
    const sampleRow: any = {
      code: 'SKU-001', hsn: '95069100', name: 'Sample Product', brand: 'Brand',
      category: 'Category', unit: 'piece', mrp: 100, purchasePrice: 0,
      taxType: 'GST', gst: 18, qty: 10, discount: 0, description: 'Product description',
    };
    if (showUsdPurchase) {
      sampleRow.purchasePriceUsd = 10;
      sampleRow.shippingCostUsd = 2;
      sampleRow.dutyGstPercent = 31;
      sampleRow.clearanceCost = 500;
    }
    exportToExcel([sampleRow], columns, 'product_import_template');
    toast.success('Template downloaded — fill it and import');
  };

  // Parse uploaded Excel/CSV and send to bulk API
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so same file can be re-uploaded

    try {
      setBulkUploading(true);
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows.length) { toast.error('File is empty'); return; }

      // Map Excel columns → ProductRequest — column headers match the template
      const products: ProductRequest[] = rows.map((row) => {
        const purchasePriceUsdVal = row['Purchase Price (USD)'] !== '' && row['Purchase Price (USD)'] !== undefined
          ? Number(row['Purchase Price (USD)'])
          : undefined;
        const shippingCostUsdVal = row['Shipping Cost (USD)'] !== '' && row['Shipping Cost (USD)'] !== undefined
          ? Number(row['Shipping Cost (USD)'])
          : undefined;
        const dutyGstVal = row['Duty GST (%)'] !== '' && row['Duty GST (%)'] !== undefined
          ? Number(row['Duty GST (%)'])
          : 31;
        const clearanceCostVal = row['Clearance Cost (₹)'] !== '' && row['Clearance Cost (₹)'] !== undefined
          ? Number(row['Clearance Cost (₹)'])
          : undefined;

        // If USD purchase price is given, derive purchasePrice in INR automatically
        let purchasePriceInr = Number(row['Purchase Price (₹)'] ?? row['purchasePrice'] ?? 0);
        let currency = 'INR';
        if (purchasePriceUsdVal && purchasePriceUsdVal > 0) {
          currency = 'USD';
          const itemUsd = purchasePriceUsdVal;
          const shipUsd = shippingCostUsdVal ?? 0;
          const duty = dutyGstVal / 100;
          const clearance = clearanceCostVal ?? 0;
          // Total cost per unit in INR
          const totalUsd = itemUsd + shipUsd;
          purchasePriceInr = Math.round((totalUsd * (1 + duty) * usdExchangeRate + clearance) * 100) / 100;
        }

        return {
          productCode:        String(row['Code'] || ''),
          hsnSacCode:         String(row['HSN/SAC Code'] || row['HSN'] || row['SAC'] || ''),
          productName:        String(row['Product Name *'] || row['Product Name'] || ''),
          brand:              String(row['Brand'] || ''),
          category:           String(row['Category'] || ''),
          unit:               String(row['Unit'] || 'piece'),
          price:              Number(row['MRP (₹) *'] ?? row['MRP (₹)'] ?? row['price'] ?? 0),
          purchasePrice:      purchasePriceInr,
          taxType:            String(row['Tax Type (GST/IGST/No Tax)'] || row['Tax Type'] || row['taxType'] || 'GST'),
          taxPercentage:      Number(row['GST (%)'] ?? row['gst'] ?? 0),
          quantity:           Number(row['Quantity *'] ?? row['Quantity'] ?? row['qty'] ?? 0),
          discountPercentage: Number(row['Discount (%)'] ?? row['discount'] ?? 0),
          description:        String(row['Description'] || row['description'] || ''),
          imagePath:          '',  // images not supported in bulk upload
          // USD fields
          purchasePriceCurrency: currency,
          purchasePriceUsd:   purchasePriceUsdVal,
          shippingCostUsd:    shippingCostUsdVal,
          dutyGstPercent:     dutyGstVal,
          clearanceCost:      clearanceCostVal,
        };
      });

      const result = await productService.bulkCreate(products);
      if (result.created > 0) {
        toast.success(`✅ ${result.created} product${result.created > 1 ? 's' : ''} imported successfully`);
        fetchProducts();
      }
      if (result.failed > 0) {
        toast.error(`❌ ${result.failed} row${result.failed > 1 ? 's' : ''} failed — check format`);
        console.warn('Bulk upload errors:', result.errors);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to import products');
    } finally {
      setBulkUploading(false);
    }
  };

  const field = (
    label: string, key: keyof ProductRequest, type = 'text',
    required = false, placeholder = ''
  ) => (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label}{required && ' *'}
      </label>
      <input
        type={type}
        value={type === 'number' && (formData[key] as number) === 0 ? '' : formData[key] as string | number}
        onChange={(e) => {
          const val = type === 'number'
            ? (e.target.value === '' ? 0 : parseFloat(e.target.value))
            : e.target.value;
          setFormData((p) => ({ ...p, [key]: val }));
          if (errors[key]) setErrors((p) => ({ ...p, [key]: '' }));
        }}
        className={`input-field ${errors[key] ? 'border-destructive' : ''}`}
        placeholder={placeholder || label}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? 'any' : undefined}
      />
      {errors[key] && <p className="text-xs text-destructive mt-1">{errors[key]}</p>}
    </div>
  );

  if (loading) return (
    <div className="min-h-screen">
      <TopBar title="Product Management" />
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading products...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <TopBar title="Product Management" />
      <div className="p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Products</h2>
            <p className="text-muted-foreground">Manage your product catalog</p>
          </div>
          <div className="flex items-center gap-3">
            <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search I Num or Cust Name" className="w-72" />
            <ExportButton onClick={handleExport} disabled={!filtered.length} count={filtered.length} />
            {/* Bulk upload template download */}
            <button
              onClick={handleDownloadTemplate}
              className="btn-secondary flex items-center gap-2 text-sm"
              title="Download blank Excel template for bulk import"
            >
              <Download size={16} /> Template
            </button>
            {/* Bulk import button */}
            <label className={`btn-secondary flex items-center gap-2 text-sm cursor-pointer ${bulkUploading ? 'opacity-60 pointer-events-none' : ''}`} title="Import products from Excel (no images)">
              <FileSpreadsheet size={16} />
              {bulkUploading ? 'Importing...' : 'Import Excel'}
              <input
                ref={bulkInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleBulkUpload}
                className="hidden"
              />
            </label>
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Add Product
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          {paginated.length === 0 ? (
            <div className="p-12 text-center">
              <Package size={48} className="mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? 'No products match your search' : 'No products yet. Add your first product!'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-3 text-left">Image</th>
                      <SortableHeader label="Product Name" sortKey="productName" sort={sort} onSort={handleSort} />
                      <th className="px-4 py-3 text-left">Code</th>
                      <th className="px-4 py-3 text-left">HSN/SAC</th>
                      <th className="px-4 py-3 text-left">Brand / Category</th>
                      <th className="px-4 py-3 text-right">MRP</th>
                      <th className="px-4 py-3 text-right">Purchase</th>
                      <th className="px-4 py-3 text-center">Unit</th>
                      <th className="px-4 py-3 text-center">Qty</th>
                      <th className="px-4 py-3 text-center">GST</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((p, i) => (
                      <tr key={p.id} className="table-row animate-slide-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                        <td className="px-4 py-3">
                          {p.imagePath ? (
                            <img src={p.imagePath} alt={p.productName} className="w-20 h-20 rounded-lg object-cover border border-border" />
                          ) : (
                            <div className="w-20 h-20 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Package size={28} className="text-primary" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{p.productName}</p>
                          {p.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.description}</p>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {p.productCode || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-foreground">
                          {p.hsnSacCode || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {p.brand && <p className="text-sm text-foreground">{p.brand}</p>}
                          {p.category && (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{p.category}</span>
                          )}
                          {!p.brand && !p.category && <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">₹{Number(p.price).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {p.purchasePriceCurrency === 'USD' && p.purchasePriceUsd ? (
                            <div>
                              <span className="font-medium text-blue-600 dark:text-blue-400 font-mono">${Number(p.purchasePriceUsd).toFixed(2)}</span>
                              <br />
                              <span className="text-xs">₹{Number(p.purchasePrice).toFixed(2)}</span>
                            </div>
                          ) : (
                            p.purchasePrice ? `₹${Number(p.purchasePrice).toFixed(2)}` : '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{p.unit}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            p.quantity > 10 ? 'bg-green-100 text-green-700' :
                            p.quantity > 0 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>{p.quantity}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{p.taxPercentage}%</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleEdit(p)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Edit">
                              <Edit size={15} />
                            </button>
                            <button onClick={() => setDeletingProduct(p)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={sortedData.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Package size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
                  <p className="text-xs text-muted-foreground">Fill in the product details</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Section: Identity */}
              <div className="space-y-1 mb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Tag size={11} /> Product Identity
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('Product Name', 'productName', 'text', true, 'e.g. Samsung Galaxy S24')}
                {field('Product Code', 'productCode', 'text', false, 'e.g. SKU-001')}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">HSN/SAC Code</label>
                  <input
                    type="text"
                    value={formData.hsnSacCode || ''}
                    onChange={(e) => { setFormData((p) => ({ ...p, hsnSacCode: e.target.value })); }}
                    className="input-field font-mono"
                    placeholder="e.g. 95069100"
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground mt-1">HSN for goods · SAC for services (GST compliance)</p>
                </div>
                {field('Brand', 'brand', 'text', false, 'e.g. Samsung')}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('Category', 'category', 'text', false, 'e.g. Electronics')}
              </div>

              {/* Section: Pricing */}
              <div className="space-y-1 pt-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <IndianRupee size={11} /> Pricing
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('Unit Price (₹)', 'price', 'number', true, '0.00')}
                {/* Purchase price — tabbed when USD mode is on */}
                {!showUsdPurchase && field('Purchase Price (₹)', 'purchasePrice', 'number', false, '0.00')}
              </div>

              {/* Purchase Price tabs — International (USD) / Local (INR) */}
              {showUsdPurchase && (() => {
                const itemUsd = formData.purchasePriceUsd ?? 0;
                const shipUsd = formData.shippingCostUsd ?? 0;
                const dutyPct = formData.dutyGstPercent ?? 31;
                const clearance = formData.clearanceCost ?? 0;
                const totalUsd = itemUsd + shipUsd;
                const gstDutyUsd = totalUsd * (dutyPct / 100);
                const totalCostInr = (totalUsd + gstDutyUsd) * usdExchangeRate + clearance;
                const profit = (formData.price ?? 0) - totalCostInr;
                return (
                  <div className="rounded-xl border border-border overflow-hidden">
                    {/* Tab bar */}
                    <div className="flex border-b border-border">
                      <button
                        type="button"
                        onClick={() => { setPurchaseTab('local'); setFormData(p => ({ ...p, purchasePriceCurrency: 'INR' })); }}
                        className={`flex-1 py-2 text-xs font-semibold transition-colors ${purchaseTab === 'local' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                      >
                        🇮🇳 Local Purchase (₹ INR)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPurchaseTab('international'); setFormData(p => ({ ...p, purchasePriceCurrency: 'USD' })); }}
                        className={`flex-1 py-2 text-xs font-semibold transition-colors ${purchaseTab === 'international' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                      >
                        🌐 International Purchase ($ USD)
                      </button>
                    </div>

                    <div className="p-4 space-y-4">
                      {purchaseTab === 'local' && (
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">Purchase Price (₹)</label>
                          <input
                            type="number" min={0} step="any"
                            value={formData.purchasePrice === 0 ? '' : formData.purchasePrice}
                            onChange={(e) => setFormData(p => ({ ...p, purchasePrice: e.target.value === '' ? 0 : parseFloat(e.target.value) }))}
                            className="input-field" placeholder="0.00"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Local purchase / cost price in Indian Rupees</p>
                        </div>
                      )}

                      {purchaseTab === 'international' && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-1.5">
                                Item Value (USD) <span className="text-muted-foreground font-normal">per unit</span>
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">$</span>
                                <input type="number" min={0} step="any"
                                  value={formData.purchasePriceUsd ?? ''}
                                  onChange={(e) => setFormData(p => ({ ...p, purchasePriceUsd: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                                  className="input-field pl-7" placeholder="0.00" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-1.5">
                                Shipping Cost (USD) <span className="text-muted-foreground font-normal">per unit</span>
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">$</span>
                                <input type="number" min={0} step="any"
                                  value={formData.shippingCostUsd ?? ''}
                                  onChange={(e) => setFormData(p => ({ ...p, shippingCostUsd: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                                  className="input-field pl-7" placeholder="0.00" />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">Based on CBM × rate</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-1.5">
                                GST + Duty (%)
                              </label>
                              <input type="number" min={0} max={100} step="0.5"
                                value={formData.dutyGstPercent ?? 31}
                                onChange={(e) => setFormData(p => ({ ...p, dutyGstPercent: e.target.value === '' ? 31 : parseFloat(e.target.value) }))}
                                className="input-field" placeholder="31" />
                              <p className="text-xs text-muted-foreground mt-1">Applied on item + shipping</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-1.5">
                                Clearance Cost (₹) <span className="text-muted-foreground font-normal">per unit</span>
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                                <input type="number" min={0} step="any"
                                  value={formData.clearanceCost ?? ''}
                                  onChange={(e) => setFormData(p => ({ ...p, clearanceCost: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                                  className="input-field pl-7" placeholder="0.00" />
                              </div>
                            </div>
                          </div>

                          {/* Cost breakdown card */}
                          {(itemUsd > 0 || shipUsd > 0) && (
                            <div className="bg-muted/40 rounded-lg p-3 space-y-1.5 text-xs">
                              <p className="font-semibold text-foreground text-xs mb-2">📊 Total Purchase Cost (per unit @ ₹{usdExchangeRate}/$)</p>
                              <div className="flex justify-between text-muted-foreground">
                                <span>① Item value</span>
                                <span className="font-mono">${itemUsd.toFixed(2)} = ₹{(itemUsd * usdExchangeRate).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-muted-foreground">
                                <span>② Shipping</span>
                                <span className="font-mono">${shipUsd.toFixed(2)} = ₹{(shipUsd * usdExchangeRate).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-muted-foreground">
                                <span>③ GST + Duty ({dutyPct}%)</span>
                                <span className="font-mono">${gstDutyUsd.toFixed(2)} = ₹{(gstDutyUsd * usdExchangeRate).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-muted-foreground">
                                <span>④ Clearance</span>
                                <span className="font-mono">₹{clearance.toFixed(2)}</span>
                              </div>
                              <div className="border-t border-border pt-1.5 flex justify-between font-semibold text-foreground">
                                <span>Total Cost (INR)</span>
                                <span className="font-mono text-orange-600 dark:text-orange-400">₹{totalCostInr.toFixed(2)}</span>
                              </div>
                              {(formData.price ?? 0) > 0 && (
                                <div className={`flex justify-between font-semibold pt-0.5 ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  <span>Profit / unit</span>
                                  <span className="font-mono">{profit >= 0 ? '+' : ''}₹{profit.toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Unit</label>
                  <select value={formData.unit} onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))} className="input-field">
                    {UNITS.map((u) => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
                  </select>
                </div>
                {field('Quantity', 'quantity', 'number', true, '0')}
                {field('Discount (%)', 'discountPercentage', 'number', false, '0')}
              </div>

              {/* Section: Tax */}
              <div className="space-y-1 pt-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Layers size={11} /> Tax & Expiry
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Tax Type</label>
                  <select value={formData.taxType} onChange={(e) => setFormData((p) => ({ ...p, taxType: e.target.value }))} className="input-field">
                    {TAX_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">GST Rate (%)</label>
                  <select
                    value={formData.taxPercentage?.toString()}
                    onChange={(e) => setFormData((p) => ({ ...p, taxPercentage: parseFloat(e.target.value) }))}
                    className="input-field"
                    disabled={formData.taxType === 'No Tax'}
                  >
                    {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Expiry Date</label>
                  <input type="date" value={formData.expiryDate || ''} onChange={(e) => setFormData((p) => ({ ...p, expiryDate: e.target.value }))} className="input-field" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Product Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  rows={3} placeholder="Enter product description..."
                  className="input-field resize-none"
                />
              </div>

              {/* CBM — shown only when company has Advanced Options (CBM) enabled */}
              {showCbmField && (
                <div className="space-y-3 pt-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/></svg>
                    Advanced Options (CBM)
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">CBM (m³/unit)</label>
                    <input
                      type="number"
                      value={formData.cbm ?? ''}
                      onChange={(e) => setFormData((p) => ({ ...p, cbm: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                      placeholder="e.g. 0.6750"
                      step="0.0001"
                      min="0"
                      className="input-field"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Volume per unit in cubic metres (L × W × H)</p>
                  </div>
                </div>
              )}

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Product Image</label>
                <div className="flex items-start gap-4">
                  {imagePreview ? (
                    <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-border flex-shrink-0">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => { setImagePreview(''); setFormData((p) => ({ ...p, imagePath: '' })); }}
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-destructive text-white shadow">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="w-28 h-28 rounded-xl border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center cursor-pointer transition-colors bg-muted/20 flex-shrink-0">
                      <Upload size={24} className="text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground text-center px-2">Upload Image</span>
                      <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    </label>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">JPG, PNG or GIF · Max 2MB · Recommended 500×500px</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2 border-t border-border">
                <button type="button" onClick={closeModal} className="flex-1 btn-secondary">Cancel</button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingId ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onConfirm={confirmDelete}
        title="Delete Product"
        itemName={deletingProduct?.productName}
      />
    </div>
  );
};

export default ProductManagement;
