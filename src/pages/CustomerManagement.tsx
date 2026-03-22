import React, { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Users, Plus, Edit, Trash2, Mail, Phone, MapPin, Building2 } from 'lucide-react';
import { customerService, Customer, CustomerRequest } from '@/services/customerService';
import { toast } from 'sonner';
import { ExportButton } from '@/components/common/ExportButton';
import { exportToExcel } from '@/utils/excelExport';

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
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const data = await customerService.getAll();
      setCustomers(data);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number is unique
    setPhoneError(null);
    const isDuplicatePhone = customers.some(c => 
      c.phone === formData.phone && 
      (!editingCustomer || c.id !== editingCustomer.id)
    );
    
    if (isDuplicatePhone) {
      setPhoneError('This phone number is already registered with another customer');
      return;
    }
    
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
      fetchCustomers();
    } catch (error: any) {
      console.error('Failed to save customer:', error);
      const errorMessage = error.response?.data?.message || 'Failed to save customer';
      if (errorMessage.includes('phone')) {
        setPhoneError(errorMessage);
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    
    try {
      await customerService.delete(id);
      toast.success('Customer deleted successfully');
      fetchCustomers();
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
    setPhoneError(null);
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
        {customers.length === 0 ? (
          <div className="bg-card rounded-xl shadow-md border border-border p-12 text-center">
            <Users size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No customers yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first customer to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customers.map((customer, index) => (
              <div
                key={customer.id}
                className="bg-card rounded-xl shadow-md border border-border p-6 hover:shadow-lg transition-all duration-300 animate-slide-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                    {customer.customerName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {customer.customerName}
                    </h3>
                    {customer.companyName && (
                      <p className="text-sm text-muted-foreground truncate">
                        {customer.companyName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground truncate">
                      {customer.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={16} className="text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{customer.phone}</span>
                  </div>
                  {customer.address && (
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin size={16} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground line-clamp-2">
                        {customer.address}
                      </span>
                    </div>
                  )}
                  {customer.gstNumber && (
                    <div className="flex items-center gap-3 text-sm">
                      <Building2 size={16} className="text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">
                        GST: {customer.gstNumber}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <button
                    onClick={() => handleEdit(customer)}
                    className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                    title="Edit"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(customer.id)}
                    className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
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
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="input-field"
                  required
                  placeholder="Enter customer name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                  required
                  placeholder="customer@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    setPhoneError(null);
                  }}
                  className={`input-field ${phoneError ? 'border-destructive' : ''}`}
                  required
                  placeholder="+91 1234567890"
                />
                {phoneError && (
                  <p className="text-sm text-destructive mt-1">{phoneError}</p>
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
    </div>
  );
};

export default CustomerManagement;
