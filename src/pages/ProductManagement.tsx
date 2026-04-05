import React, { useState, useEffect, useMemo } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { productService, Product, ProductRequest } from '@/services/productService';
import { toast } from 'sonner';
import { SearchBar } from '@/components/common/SearchBar';
import { ExportButton } from '@/components/common/ExportButton';
import { exportToExcel } from '@/utils/excelExport';
import { DeleteConfirmModal } from '@/components/common/DeleteConfirmModal';
import { SortableHeader } from '@/components/common/SortableHeader';
import { useSortable } from '@/hooks/useSortable';
import { Pagination } from '@/components/common/Pagination';
import {
  Package, Plus, Edit, Trash2, X, Upload, Tag, Layers, IndianRupee,
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

const UNITS = ['piece', 'kg', 'litre', 'meter', 'box', 'set', 'dozen', 'gram', 'ml'];
const TAX_TYPES = ['GST', 'IGST', 'No Tax'];
const GST_RATES = ['0', '5', '12', '18', '28'];

const EMPTY: ProductRequest = {
  productName: '', productCode: '', brand: '', category: '',
  description: '', price: 0, purchasePrice: 0,
  unit: 'piece', quantity: 0, discountPercentage: 0,
  taxType: 'GST', taxPercentage: 18, expiryDate: '', imagePath: '',
};

const ProductManagement = () => {
  const { user } = useAuth();
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

  useEffect(() => { fetchProducts(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setProducts(await productService.getAll());
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
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
      const payload: ProductRequest = {
        ...formData,
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
    });
    setImagePreview(p.imagePath || '');
    setShowModal(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
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
    exportToExcel(
      filtered.map((p) => ({
        code: p.productCode || '', name: p.productName, brand: p.brand || '',
        category: p.category || '', unit: p.unit, mrp: p.price,
        purchasePrice: p.purchasePrice || 0, taxType: p.taxType,
        gst: p.taxPercentage, qty: p.quantity, discount: p.discountPercentage,
        description: p.description || '',
      })),
      [
        { header: 'Code', key: 'code', width: 12 },
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
      ],
      'products'
    );
    toast.success('Products exported to Excel');
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
        value={formData[key] as string | number}
        onChange={(e) => {
          const val = type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
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
            <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search by name, brand, category..." className="w-72" />
            <ExportButton onClick={handleExport} disabled={!filtered.length} count={filtered.length} />
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
                            <img src={p.imagePath} alt={p.productName} className="w-12 h-12 rounded-lg object-cover border border-border" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Package size={20} className="text-primary" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{p.productName}</p>
                          {p.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.description}</p>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.productCode || '—'}</td>
                        <td className="px-4 py-3">
                          {p.brand && <p className="text-sm text-foreground">{p.brand}</p>}
                          {p.category && (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{p.category}</span>
                          )}
                          {!p.brand && !p.category && <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">₹{Number(p.price).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {p.purchasePrice ? `₹${Number(p.purchasePrice).toFixed(2)}` : '—'}
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
                {field('Brand', 'brand', 'text', false, 'e.g. Samsung')}
                {field('Category', 'category', 'text', false, 'e.g. Electronics')}
              </div>

              {/* Section: Pricing */}
              <div className="space-y-1 pt-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <IndianRupee size={11} /> Pricing
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('MRP / Selling Price (₹)', 'price', 'number', true, '0.00')}
                {field('Purchase Price (₹)', 'purchasePrice', 'number', false, '0.00')}
              </div>
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
                  <p className="text-xs text-muted-foreground mt-2">JPG, PNG or GIF · Max 5MB · Recommended 500×500px</p>
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
