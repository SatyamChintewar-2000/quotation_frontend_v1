import React, { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Users, Plus, Edit, Trash2, Mail, Phone, MapPin } from 'lucide-react';
import { customerService, Customer, CustomerRequest } from '@/services/customerService';
import { toast } from 'sonner';
import { ExportButton } from '@/components/common/ExportButton';
import { SearchBar } from '@/components/common/SearchBar';
import { Pagination } from '@/components/common/Pagination';
import { DeleteConfirmModal } from '@/components/common/DeleteConfirmModal';
import { exportToExcel } from '@/utils/excelExport';

// Module-level stale cache — survives page navigation, invalidated on every write
let _customerCache: Customer[] | null = null;
let _customerCacheTime = 0;
const STALE_MS = 60_000;

const ITEMS_PER_PAGE = 9; // 3x3 grid

const CustomerManagement = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerRequest>({
    customerName: '',
    email: '',
    phone: '',
    address: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);

  const filteredCustomers = customers.filter((c) =>
    c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  React.useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async (force = false) => {
    const now = Date.now();
    if (!force && _customerCache && (now - _customerCacheTime) < STALE_MS) {
      setCustomers(_customerCache);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await customerService.getAll();
      _customerCache = data;
      _customerCacheTime = Date.now();
      setCustomers(data);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const PHONE_REGEX = /^[6-9][0-9]{9}$/;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Customer name is required';
    } else if (!/^[a-zA-Z\s'-]+$/.test(formData.customerName.trim())) {
      newErrors.customerName = 'Name can only contain letters, spaces, hyphens, or apostrophes';
    }

    if (formData.email.trim() && !EMAIL_REGEX.test(formData.email)) {
      newErrors.email = 'Enter a valid email address';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!PHONE_REGEX.test(formData.phone)) {
      newErrors.phone = 'Enter a valid 10-digit Indian mobile number (starts with 6–9)';
    } else {
      const isDuplicate = customers.some(
        (c) => c.phone === formData.phone && (!editingCustomer || c.id !== editingCustomer.id)
      );
      if (isDuplicate) {
        newErrors.phone = 'This phone number is already registered with another customer';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (editingCustomer) {
        await customerService.update(editingCustomer.id, formData);
        toast.success('Customer updated successfully');
      } else {
        await customerService.create(formData);
        toast.success('Customer created successfully');
      }
      setShowModal(false);
      resetForm();
      _customerCache = null;
      fetchCustomers(true);
    } catch (error: any) {
      console.error('Failed to save customer:', error);
      const errorMessage = error.response?.data?.message || 'Failed to save customer';
      if (errorMessage.toLowerCase().includes('phone')) {
        setErrors((prev) => ({ ...prev, phone: errorMessage }));
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleDelete = (customer: Customer) => {
    setDeletingCustomer(customer);
  };

  const confirmDelete = async () => {
    if (!deletingCustomer) return;
    try {
      await customerService.delete(deletingCustomer.id);
      toast.success('Customer deleted successfully');
      _customerCache = null;
      fetchCustomers(true);
    } catch (error) {
      console.error('Failed to delete customer:', error);
      toast.error('Failed to delete customer');
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      customerName: customer.customerName,
      email: customer.email,
      phone: customer.phone,
      address: customer.address || '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setFormData({
      customerName: '',
      email: '',
      phone: '',
      address: '',
    });
    setErrors({});
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  // Export customers to Excel
  const handleExportToExcel = () => {
    if (customers.length === 0) {
      toast.error('No customers to export');
      return;
    }

    const columns = [
      { header: 'Customer Name', key: 'customerName', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Address', key: 'address', width: 35 },
      { header: 'Company', key: 'companyName', width: 20 },
      { header: 'GST Number', key: 'gstNumber', width: 20 },
    ];

    const exportData = customers.map(customer => ({
      customerName: customer.customerName,
      email: customer.email,
      phone: customer.phone,
      address: customer.address || '',
      companyName: customer.companyName || '',
      gstNumber: customer.gstNumber || '',
    }));

    exportToExcel(exportData, columns, 'customers');
    toast.success('Customers exported to Excel');
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <TopBar title="Customer Management" />
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading customers...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar title="Customer Management" />
      
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Customers</h2>
            <p className="text-muted-foreground">Manage visiting customers and their information</p>
          </div>
          <div className="flex items-center gap-4">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search customers..."
              className="w-64"
            />
            <ExportButton
              onClick={handleExportToExcel}
              disabled={customers.length === 0}
              count={customers.length}
            />
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={20} />
              Add Customer
            </button>
          </div>
        </div>

        {/* Customers Grid */}
        {filteredCustomers.length === 0 ? (
          <div className="bg-card rounded-xl shadow-md border border-border p-12 text-center">
            <Users size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{searchTerm ? 'No customers match your search' : 'No customers yet'}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedCustomers.map((customer, index) => (
              <div
                key={customer.id}
                className="bg-card rounded-xl shadow-md border border-border hover:shadow-lg transition-all duration-300 animate-slide-in-up overflow-hidden flex flex-col"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Card Header */}
                <div className="p-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                        {customer.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground truncate leading-tight">
                          {customer.customerName}
                        </h3>
                        {customer.companyName && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {customer.companyName}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Action buttons top-right */}
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(customer)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Edit"
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(customer)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-border mx-5" />

                {/* Card Body */}
                <div className="p-5 pt-4 space-y-2.5 flex-1">
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Mail size={14} className="flex-shrink-0 text-primary/60" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Phone size={14} className="flex-shrink-0 text-primary/60" />
                    <span>{customer.phone}</span>
                  </div>
                  {customer.address && (
                    <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <MapPin size={14} className="flex-shrink-0 mt-0.5 text-primary/60" />
                      <span className="line-clamp-2">{customer.address}</span>
                    </div>
                  )}
                  {customer.gstNumber && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded">GST</span>
                      <span className="text-muted-foreground font-mono text-xs">{customer.gstNumber}</span>
                    </div>
                  )}
                </div>
              </div>
              ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredCustomers.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h3 className="text-xl font-semibold text-foreground">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => {
                    setFormData({ ...formData, customerName: e.target.value });
                    if (errors.customerName) setErrors((prev) => ({ ...prev, customerName: '' }));
                  }}
                  className={`input-field ${errors.customerName ? 'border-destructive' : ''}`}
                  placeholder="Enter customer name"
                />
                {errors.customerName && (
                  <p className="text-sm text-destructive mt-1">{errors.customerName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email
                  <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                  }}
                  className={`input-field ${errors.email ? 'border-destructive' : ''}`}
                  placeholder="customer@example.com"
                />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({ ...formData, phone: digits });
                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                  }}
                  className={`input-field ${errors.phone ? 'border-destructive' : ''}`}
                  placeholder="10-digit mobile number (e.g. 9876543210)"
                  maxLength={10}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="Enter customer address"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingCustomer ? 'Update' : 'Create'} Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingCustomer}
        onClose={() => setDeletingCustomer(null)}
        onConfirm={confirmDelete}
        title="Delete Customer"
        itemName={deletingCustomer?.customerName}
      />
    </div>
  );
};

export default CustomerManagement;
