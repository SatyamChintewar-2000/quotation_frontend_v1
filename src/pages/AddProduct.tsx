import React, { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/contexts/ProductContext';
import { toast } from 'sonner';
import { SearchBar } from '@/components/common/SearchBar';
import { ExportButton } from '@/components/common/ExportButton';
import { exportToExcel, formatDateForExcel, formatCurrencyForExcel } from '@/utils/excelExport';
import {
  Package,
  Upload,
  X,
  DollarSign,
  Percent,
  Calendar,
  FileText,
  Hash,
  Scale,
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

const AddProduct = () => {
  const { user } = useAuth();
  const { addProduct, products } = useProducts();
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<ProductFormData>>({});
  const [imagePreview, setImagePreview] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const units = ['piece', 'kg', 'litre', 'meter', 'box', 'set', 'dozen'];
  const taxTypes = ['GST', 'IGST', 'No Tax'];
  const gstRates = ['0', '5', '12', '18', '28'];

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
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image must be under 2MB');
        e.target.value = '';
        setImagePreview('');
        setFormData((prev) => ({ ...prev, image: '' }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    if (formData.image) {
      // base64 size check: approx original bytes = length * 0.75
      const approxBytes = formData.image.length * 0.75;
      if (approxBytes > 2 * 1024 * 1024) {
        toast.error('Image must be under 2MB');
        setImagePreview('');
        setFormData((prev) => ({ ...prev, image: '' }));
        return;
      }
    }

    try {
      await addProduct({
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
      });
      handleClear();
    } catch {
      // error handled in context
    }
  };

  const handleClear = () => {
    setFormData(initialFormData);
    setImagePreview('');
    setErrors({});
  };

  // Get user's products
  const userProducts = products.filter((p) => p.createdBy === user?.id);

  // Filter products by search term
  const filteredProducts = userProducts.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

    const exportData = filteredProducts.map(product => ({
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
      <TopBar title="Add Product" />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Section */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-xl shadow-md border border-border p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                  <Package size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Product Details
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Add a new product to your catalog
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Product Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Product Name *
                  </label>
                  <div className="relative">
                    <Package
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Enter product name"
                      className={`input-field pl-11 ${
                        errors.name ? 'border-destructive focus:ring-destructive' : ''
                      }`}
                    />
                  </div>
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name}</p>
                  )}
                </div>

                {/* Price and Unit Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Price *
                    </label>
                    <div className="relative">
                      <DollarSign
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <input
                        type="number"
                        name="price"
                        value={formData.price}
                        onChange={handleInputChange}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className={`input-field pl-11 ${
                          errors.price ? 'border-destructive focus:ring-destructive' : ''
                        }`}
                      />
                    </div>
                    {errors.price && (
                      <p className="text-sm text-destructive">{errors.price}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Unit
                    </label>
                    <div className="relative">
                      <Scale
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <select
                        name="unit"
                        value={formData.unit}
                        onChange={handleInputChange}
                        className="input-field pl-11 appearance-none cursor-pointer"
                      >
                        {units.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit.charAt(0).toUpperCase() + unit.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Quantity and Discount Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Quantity *
                    </label>
                    <div className="relative">
                      <Hash
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <input
                        type="number"
                        name="quantity"
                        value={formData.quantity}
                        onChange={handleInputChange}
                        placeholder="0"
                        min="0"
                        className={`input-field pl-11 ${
                          errors.quantity ? 'border-destructive focus:ring-destructive' : ''
                        }`}
                      />
                    </div>
                    {errors.quantity && (
                      <p className="text-sm text-destructive">{errors.quantity}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Discount (%)
                    </label>
                    <div className="relative">
                      <Percent
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <input
                        type="number"
                        name="discount"
                        value={formData.discount}
                        onChange={handleInputChange}
                        placeholder="0"
                        min="0"
                        max="100"
                        className="input-field pl-11"
                      />
                    </div>
                  </div>
                </div>

                {/* Tax Type and GST Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Tax Type
                    </label>
                    <select
                      name="taxType"
                      value={formData.taxType}
                      onChange={handleInputChange}
                      className="input-field appearance-none cursor-pointer"
                    >
                      {taxTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      GST Rate (%)
                    </label>
                    <select
                      name="gst"
                      value={formData.gst}
                      onChange={handleInputChange}
                      className="input-field appearance-none cursor-pointer"
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
                  <label className="text-sm font-medium text-foreground">
                    Expiry Date *
                  </label>
                  <div className="relative">
                    <Calendar
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      type="date"
                      name="expiryDate"
                      value={formData.expiryDate}
                      onChange={handleInputChange}
                      className={`input-field pl-11 ${
                        errors.expiryDate ? 'border-destructive focus:ring-destructive' : ''
                      }`}
                    />
                  </div>
                  {errors.expiryDate && (
                    <p className="text-sm text-destructive">{errors.expiryDate}</p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Product Description
                  </label>
                  <div className="relative">
                    <FileText
                      size={18}
                      className="absolute left-4 top-4 text-muted-foreground"
                    />
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Enter product description..."
                      rows={4}
                      className="input-field pl-11 resize-none"
                    />
                  </div>
                </div>

                {/* Image Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Product Image
                  </label>
                  <div className="flex items-start gap-4">
                    {imagePreview ? (
                      <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground hover:opacity-90"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="w-32 h-32 rounded-lg border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center cursor-pointer transition-colors">
                        <Upload size={24} className="text-muted-foreground mb-2" />
                        <span className="text-xs text-muted-foreground">Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Max file size: 2MB. Supported: JPG, PNG, WEBP</p>
                </div>

                {/* Buttons */}
                <div className="flex gap-4 pt-4">
                  <button type="submit" className="btn-primary flex-1">
                    Submit Product
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="btn-secondary flex-1"
                  >
                    Clear
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Product List Section */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-xl shadow-md border border-border p-6 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Your Products ({filteredProducts.length})
                </h3>
                <ExportButton
                  onClick={handleExportToExcel}
                  label="Export"
                  disabled={filteredProducts.length === 0}
                  count={filteredProducts.length}
                />
              </div>
              
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search products..."
                className="mb-4"
              />

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {searchTerm ? 'No products found' : 'No products added yet'}
                  </p>
                ) : (
                  filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="p-4 rounded-lg bg-muted/50 border border-border hover:bg-muted transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Package size={20} className="text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {product.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            ${product.price.toFixed(2)} / {product.unit}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Qty: {product.quantity} | GST: {product.gst}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddProduct;
