import React, { useState, useMemo } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/contexts/ProductContext';
import { toast } from 'sonner';
import { SearchBar } from '@/components/common/SearchBar';
import { ExportButton } from '@/components/common/ExportButton';
import { exportToExcel, formatDateForExcel, formatCurrencyForExcel } from '@/utils/excelExport';
import { DeleteConfirmModal } from '@/components/common/DeleteConfirmModal';
import { SortableHeader } from '@/components/common/SortableHeader';
import { useSortable } from '@/hooks/useSortable';
import {
  Package,
  Plus,
  Edit,
  Trash2,
  X,
  Upload,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface ProductFormData {
  name: string;
  price: string;
  unit: string;
  quantity: string;
  discount: string;
  taxType: string;
  gst: string;
  expiryDate: string;
  description: string;
  image: string;
}

const initialFormData: ProductFormData = {
  name: '',
  price: '',
  unit: 'piece',
  quantity: '',
  discount: '0',
  taxType: 'GST',
  gst: '18',
  expiryDate: '',
  description: '',
  image: '',
};

const ITEMS_PER_PAGE = 10;

const ProductManagement = () => {
  const { user } = useAuth();
  const { addProduct, updateProduct, deleteProduct, products } = useProducts();
  const [showModal, setShowModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<ProductFormData>>({});
  const [imagePreview, setImagePreview] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const units = ['piece', 'kg', 'litre', 'meter', 'box', 'set', 'dozen'];
  const taxTypes = ['GST', 'IGST', 'No Tax'];
  const gstRates = ['0', '5', '12', '18', '28'];

  // Get user's products
  const userProducts = products.filter((p) => p.createdBy === user?.id);

  // Filter products by search term
  const filteredProducts = useMemo(() => {
    return userProducts.filter((product) => {
      // Search filter
      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [userProducts, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const { sortedData: sortedProducts, sort, handleSort } = useSortable(filteredProducts);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedProducts, currentPage]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof ProductFormData]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setFormData((prev) => ({ ...prev, image: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview('');
    setFormData((prev) => ({ ...prev, image: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<ProductFormData> = {};

    if (!formData.name.trim()) newErrors.name = 'Product name is required';
    if (!formData.price || parseFloat(formData.price) <= 0)
      newErrors.price = 'Valid price is required';
    if (!formData.quantity || parseInt(formData.quantity) < 0)
      newErrors.quantity = 'Valid quantity is required';
    if (!formData.expiryDate) newErrors.expiryDate = 'Expiry date is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    const productData = {
      name: formData.name,
      price: parseFloat(formData.price),
      unit: formData.unit,
      quantity: parseInt(formData.quantity),
      discount: parseFloat(formData.discount),
      taxType: formData.taxType,
      gst: parseFloat(formData.gst),
      expiryDate: formData.expiryDate,
      description: formData.description,
      image: formData.image,
      createdBy: user?.id || '',
    };

    if (editingProductId) {
      updateProduct(editingProductId, productData);
      toast.success('Product updated successfully!');
    } else {
      addProduct(productData);
      toast.success('Product added successfully!');
    }
    handleCloseModal();
  };

  const handleEdit = (product: typeof products[0]) => {
    setEditingProductId(product.id);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      unit: product.unit,
      quantity: product.quantity.toString(),
      discount: product.discount.toString(),
      taxType: product.taxType,
      gst: product.gst.toString(),
      expiryDate: product.expiryDate,
      description: product.description || '',
      image: product.image || '',
    });
    setImagePreview(product.image || '');
    setShowModal(true);
  };

  const handleDeactivate = (id: string) => {
    setDeletingProductId(id);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProductId(null);
    setFormData(initialFormData);
    setImagePreview('');
    setErrors({});
  };

  // Export products to Excel
  const handleExportToExcel = () => {
    if (filteredProducts.length === 0) {
      toast.error('No products to export');
      return;
    }

    const columns = [
      { header: 'Product Name', key: 'name', width: 25 },
      { header: 'Price', key: 'price', width: 12 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Discount (%)', key: 'discount', width: 12 },
      { header: 'Tax Type', key: 'taxType', width: 12 },
      { header: 'GST (%)', key: 'gst', width: 10 },
      { header: 'Expiry Date', key: 'expiryDate', width: 15 },
      { header: 'Description', key: 'description', width: 30 },
    ];

    const exportData = filteredProducts.map((product) => ({
      name: product.name,
      price: formatCurrencyForExcel(product.price),
      unit: product.unit,
      quantity: product.quantity,
      discount: product.discount,
      taxType: product.taxType,
      gst: product.gst,
      expiryDate: formatDateForExcel(product.expiryDate),
      description: product.description || '',
    }));

    exportToExcel(exportData, columns, 'products');
    toast.success('Products exported to Excel');
  };

  return (
    <div className="min-h-screen">
      <TopBar title="Product Management" />

      <div className="p-6 space-y-6">
        {/* Header with Actions */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Products</h2>
            <p className="text-muted-foreground">
              Manage your product catalog ({filteredProducts.length} products)
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Add Product
          </button>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl shadow-md border border-border p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search products..."
              className="flex-1 min-w-[250px]"
            />
            <ExportButton
              onClick={handleExportToExcel}
              disabled={filteredProducts.length === 0}
              count={filteredProducts.length}
            />
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-card rounded-xl shadow-md border border-border overflow-hidden">
          {paginatedProducts.length === 0 ? (
            <div className="p-12 text-center">
              <Package size={48} className="mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                {searchTerm
                  ? 'No products found matching your search'
                  : 'No products yet. Add your first product!'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="px-6 py-4 text-left">Image</th>
                      <SortableHeader label="Product Name" sortKey="name" sort={sort} onSort={handleSort} />
                      <th className="px-6 py-4 text-right">Price</th>
                      <th className="px-6 py-4 text-center">Unit</th>
                      <th className="px-6 py-4 text-center">Quantity</th>
                      <th className="px-6 py-4 text-center">Discount</th>
                      <th className="px-6 py-4 text-center">GST</th>
                      <th className="px-6 py-4 text-left">Expiry Date</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map((product, index) => (
                      <tr
                        key={product.id}
                        className="table-row animate-slide-in-up"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <td className="px-6 py-4">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-16 h-16 rounded-lg object-cover border border-border"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center border border-border">
                              <Package size={24} className="text-primary" />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-foreground">{product.name}</p>
                            {product.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-foreground">
                          ₹{product.price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center text-muted-foreground">
                          {product.unit}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={
                              product.quantity > 10
                                ? 'badge-success'
                                : product.quantity > 0
                                ? 'badge-warning'
                                : 'badge-destructive'
                            }
                          >
                            {product.quantity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-muted-foreground">
                          {product.discount}%
                        </td>
                        <td className="px-6 py-4 text-center text-muted-foreground">
                          {product.gst}%
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(product.expiryDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(product)}
                              className="p-2 rounded-lg hover:bg-muted transition-colors"
                              title="Edit"
                            >
                              <Edit size={16} className="text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => handleDeactivate(product.id)}
                              className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                              title="Deactivate"
                            >
                              <Trash2 size={16} className="text-destructive" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-border flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, sortedProducts.length)} of{' '}
                    {sortedProducts.length} products
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1 rounded-lg transition-colors ${
                            currentPage === page
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Package size={24} />
                </div>
                <div>
                <h3 className="text-xl font-semibold text-foreground">{editingProductId ? 'Edit Product' : 'Add New Product'}</h3>
                  <p className="text-sm text-muted-foreground">
                    Fill in the product details below
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Product Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Product Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter product name"
                  className={`input-field ${
                    errors.name ? 'border-destructive focus:ring-destructive' : ''
                  }`}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              {/* Price and Unit Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Price (₹) *</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={`input-field ${
                      errors.price ? 'border-destructive focus:ring-destructive' : ''
                    }`}
                  />
                  {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Unit</label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    className="input-field"
                  >
                    {units.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit.charAt(0).toUpperCase() + unit.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantity and Discount Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Quantity *</label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    placeholder="0"
                    min="0"
                    className={`input-field ${
                      errors.quantity ? 'border-destructive focus:ring-destructive' : ''
                    }`}
                  />
                  {errors.quantity && (
                    <p className="text-sm text-destructive">{errors.quantity}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Discount (%)</label>
                  <input
                    type="number"
                    name="discount"
                    value={formData.discount}
                    onChange={handleInputChange}
                    placeholder="0"
                    min="0"
                    max="100"
                    className="input-field"
                  />
                </div>
              </div>

              {/* Tax Type and GST Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Tax Type</label>
                  <select
                    name="taxType"
                    value={formData.taxType}
                    onChange={handleInputChange}
                    className="input-field"
                  >
                    {taxTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">GST Rate (%)</label>
                  <select
                    name="gst"
                    value={formData.gst}
                    onChange={handleInputChange}
                    className="input-field"
                    disabled={formData.taxType === 'No Tax'}
                  >
                    {gstRates.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}%
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Expiry Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Expiry Date *</label>
                <input
                  type="date"
                  name="expiryDate"
                  value={formData.expiryDate}
                  onChange={handleInputChange}
                  className={`input-field ${
                    errors.expiryDate ? 'border-destructive focus:ring-destructive' : ''
                  }`}
                />
                {errors.expiryDate && (
                  <p className="text-sm text-destructive">{errors.expiryDate}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter product description..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Product Image</label>
                <div className="flex items-start gap-4">
                  {imagePreview ? (
                    <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-border">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-2 right-2 p-1 rounded-full bg-destructive text-destructive-foreground hover:opacity-90 shadow-lg"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="w-32 h-32 rounded-lg border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center cursor-pointer transition-colors bg-muted/30">
                      <Upload size={32} className="text-muted-foreground mb-2" />
                      <span className="text-xs text-muted-foreground text-center px-2">
                        Click to upload
                        <br />
                        (Max 5MB)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Upload a product image (JPG, PNG, GIF)
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Recommended size: 500x500px, Max size: 5MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-4 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingProductId ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingProductId}
        onClose={() => setDeletingProductId(null)}
        onConfirm={async () => { if (deletingProductId) await deleteProduct(deletingProductId); }}
        title="Deactivate Product"
        message="Deactivate this product? It will no longer appear in new quotations."
      />
    </div>
  );
};

export default ProductManagement;
