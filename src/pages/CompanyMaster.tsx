import React, { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Plus, Edit, Trash2, Building2, Mail, Phone, MapPin, ToggleLeft, ToggleRight, Landmark, Upload, X, Image as ImageIcon, Shield } from 'lucide-react';
import { companyService, Company } from '@/services/companyService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DeleteConfirmModal } from '@/components/common/DeleteConfirmModal';
import { StatusBadge } from '@/components/common/StatusBadge';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9][0-9]{9}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

interface CompanyFormData {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  gstNumber: string;
  logo: string;
  termsAndConditions: string;
  // Bank details
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  upiId: string;
}

interface FormErrors {
  companyName?: string;
  email?: string;
  phone?: string;
  gstNumber?: string;
}

const CompanyManagement = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'super_admin';
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [originalData, setOriginalData] = useState<CompanyFormData | null>(null);
  const [formData, setFormData] = useState<CompanyFormData>({
    companyName: '',
    address: '',
    phone: '',
    email: '',
    gstNumber: '',
    logo: '',
    termsAndConditions: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    upiId: '',
  });
  const [logoPreview, setLogoPreview] = useState<string>('');

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const data = await companyService.getAll();
      setCompanies(data);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const errors: FormErrors = {};
    if (!formData.companyName.trim()) errors.companyName = 'Company name is required';
    if (formData.email && !EMAIL_REGEX.test(formData.email)) errors.email = 'Enter a valid email address';
    if (formData.phone) {
      if (formData.phone.length !== 10) errors.phone = 'Phone number must be exactly 10 digits';
      else if (!PHONE_REGEX.test(formData.phone)) errors.phone = 'Must start with 6, 7, 8 or 9';
    }
    if (formData.gstNumber && formData.gstNumber.trim()) {
      if (formData.gstNumber.length === 15 && !GST_REGEX.test(formData.gstNumber.toUpperCase())) {
        errors.gstNumber = 'Invalid GST format (e.g. 22AAAAA0000A1Z5)';
      }
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(Object.values(errors)[0]);
    }
    return Object.keys(errors).length === 0;
  };

  const isFormValid = (): boolean => {
    if (!formData.companyName.trim()) return false;
    if (formData.email && !EMAIL_REGEX.test(formData.email)) return false;
    if (formData.phone && formData.phone.length === 10 && !PHONE_REGEX.test(formData.phone)) return false;
    if (formData.gstNumber && formData.gstNumber.length === 15 && !GST_REGEX.test(formData.gstNumber.toUpperCase())) return false;
    // When editing, only enable if something actually changed
    if (editingCompany && originalData) {
      const isDirty = (Object.keys(formData) as (keyof CompanyFormData)[]).some(
        (key) => formData[key] !== originalData[key]
      );
      if (!isDirty) return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      if (editingCompany) {
        await companyService.update(editingCompany.id, formData);
        toast.success('Company updated successfully');
      } else {
        await companyService.create(formData);
        toast.success('Company created successfully');
      }
      setShowModal(false);
      resetForm();
      fetchCompanies();
    } catch (error) {
      console.error('Failed to save company:', error);
      toast.error('Failed to save company');
    }
  };

  const handleDelete = async (company: Company) => {
    setDeletingCompany(company);
  };

  const confirmDelete = async () => {
    if (!deletingCompany) return;
    try {
      await companyService.delete(deletingCompany.id);
      toast.success('Company deleted successfully');
      setDeletingCompany(null);
      fetchCompanies();
    } catch (error) {
      console.error('Failed to delete company:', error);
      toast.error('Failed to delete company');
      setDeletingCompany(null);
    }
  };
  const handleToggleActive = async (company: Company) => {
    try {
      await companyService.toggleActive(company.id);
      toast.success(`Company ${company.active ? 'deactivated' : 'activated'} successfully`);
      fetchCompanies();
    } catch {
      toast.error('Failed to update company status');
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    const data = {
      companyName: company.companyName,
      address: company.address || '',
      phone: company.phone || '',
      email: company.email || '',
      gstNumber: company.gstNumber || '',
      logo: company.logo || '',
      termsAndConditions: company.termsAndConditions || '',
      bankName: company.bankName || '',
      accountNumber: company.accountNumber || '',
      ifscCode: company.ifscCode || '',
      branchName: company.branchName || '',
      upiId: company.upiId || '',
    };
    setFormData(data);
    setOriginalData(data);
    setLogoPreview(company.logo || '');
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingCompany(null);
    setOriginalData(null);
    setFormData({ 
      companyName: '', 
      address: '', 
      phone: '', 
      email: '', 
      gstNumber: '',
      logo: '',
      termsAndConditions: '',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      branchName: '',
      upiId: '',
    });
    setFormErrors({});
    setLogoPreview('');
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Logo size should be less than 2MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setFormData({ ...formData, logo: base64 });
        setLogoPreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setFormData({ ...formData, logo: '' });
    setLogoPreview('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <TopBar title="Company Management" />
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading companies...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar title="Company Management" />
      
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Companies</h2>
            <p className="text-muted-foreground">Manage client companies in the system</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Add Company
          </button>
        </div>

        {/* Companies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <div
              key={company.id}
              className="bg-card rounded-xl shadow-md border border-border hover:shadow-lg transition-all duration-300 overflow-hidden group flex flex-col"
            >
              {/* Card Header */}
              <div className="p-5 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      <Building2 size={22} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate leading-tight">
                        {company.companyName}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <StatusBadge status={company.active ? 'active' : 'inactive'} />
                        {company.licenseId && (
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-blue-700 dark:text-blue-400 tracking-wide bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md">
                            <Shield size={10} />
                            {company.licenseId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Action buttons top-right */}
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(company)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Edit"
                    >
                      <Edit size={15} />
                    </button>
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleToggleActive(company)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          company.active
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                        title={company.active ? 'Deactivate company' : 'Activate company'}
                      >
                        {company.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(company)}
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
                {company.email && (
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Mail size={14} className="flex-shrink-0 text-primary/60" />
                    <span className="truncate">{company.email}</span>
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Phone size={14} className="flex-shrink-0 text-primary/60" />
                    <span>{company.phone}</span>
                  </div>
                )}
                {company.address && (
                  <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <MapPin size={14} className="flex-shrink-0 mt-0.5 text-primary/60" />
                    <span className="line-clamp-2">{company.address}</span>
                  </div>
                )}
                {company.gstNumber && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded">GST</span>
                    <span className="text-muted-foreground font-mono text-xs">{company.gstNumber}</span>
                  </div>
                )}
                {(company.bankName || company.accountNumber) && (
                  <div className="flex items-center gap-2.5 text-sm pt-1">
                    <Landmark size={14} className="flex-shrink-0 text-primary/60" />
                    <span className="text-muted-foreground text-xs">Bank details configured</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {companies.length === 0 && (
          <div className="text-center py-12">
            <Building2 size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No companies yet. Create your first company to get started.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h3 className="text-xl font-semibold text-foreground">
                {editingCompany ? 'Edit Company' : 'Add New Company'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Logo Upload Section */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Company Logo
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(Max 2MB, appears in PDFs)</span>
                </label>
                <div className="flex items-start gap-4">
                  {/* Logo Preview */}
                  <div className="flex-shrink-0">
                    {logoPreview ? (
                      <div className="relative group">
                        <img
                          src={logoPreview}
                          alt="Company Logo"
                          className="w-32 h-32 object-contain border-2 border-border rounded-lg bg-muted p-2"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="absolute -top-2 -right-2 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove logo"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted">
                        <ImageIcon size={32} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  
                  {/* Upload Button */}
                  <div className="flex-1">
                    <label className="btn-secondary cursor-pointer inline-flex items-center gap-2">
                      <Upload size={16} />
                      {logoPreview ? 'Change Logo' : 'Upload Logo'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-muted-foreground mt-2">
                      Recommended: Square image (500x500px) in PNG or JPG format
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Company Name *</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => { setFormData({ ...formData, companyName: e.target.value }); setFormErrors(p => ({ ...p, companyName: '' })); }}
                  className={`input-field ${formErrors.companyName ? 'border-destructive' : ''}`}
                  placeholder="e.g., ABC Technologies Pvt Ltd"
                />
                {formErrors.companyName && <p className="text-xs text-destructive mt-1">{formErrors.companyName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <input
                  type="text"
                  value={formData.email}
                  onChange={(e) => { 
                    setFormData({ ...formData, email: e.target.value }); 
                    if (e.target.value && !EMAIL_REGEX.test(e.target.value)) {
                      setFormErrors(p => ({ ...p, email: 'Enter a valid email address' }));
                    } else {
                      setFormErrors(p => ({ ...p, email: '' }));
                    }
                  }}
                  className={`input-field ${formErrors.email ? 'border-destructive' : ''}`}
                  placeholder="company@example.com"
                />
                {formErrors.email && <p className="text-xs text-destructive mt-1">{formErrors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Phone</label>
                <div className="flex gap-2">
                  <input type="text" value="+91" readOnly className="input-field w-16 bg-muted cursor-not-allowed" />
                  <input
                    type="tel"
                    value={formData.phone}
                    maxLength={10}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({ ...formData, phone: val });
                    if (val.length > 0 && val.length < 10) {
                      setFormErrors(p => ({ ...p, phone: 'Phone number must be exactly 10 digits' }));
                    } else if (val.length === 10 && !PHONE_REGEX.test(val)) {
                      setFormErrors(p => ({ ...p, phone: 'Must start with 6, 7, 8 or 9' }));
                    } else {
                      setFormErrors(p => ({ ...p, phone: '' }));
                    }
                  }}
                    className={`input-field flex-1 ${formErrors.phone ? 'border-destructive' : ''}`}
                    placeholder="10-digit mobile number"
                  />
                </div>
                {formErrors.phone && <p className="text-xs text-destructive mt-1">{formErrors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="Full company address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  GST Number
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(optional — 15 chars, e.g. 22AAAAA0000A1Z5)</span>
                </label>
                <input
                  type="text"
                  value={formData.gstNumber}
                  maxLength={15}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setFormData({ ...formData, gstNumber: val });
                    if (val.length === 0) {
                      setFormErrors(p => ({ ...p, gstNumber: '' }));
                    } else if (val.length === 15 && !GST_REGEX.test(val)) {
                      setFormErrors(p => ({ ...p, gstNumber: 'Invalid GST format (e.g. 22AAAAA0000A1Z5)' }));
                    } else {
                      setFormErrors(p => ({ ...p, gstNumber: '' }));
                    }
                  }}
                  className={`input-field font-mono tracking-wider ${formErrors.gstNumber ? 'border-destructive' : ''}`}
                  placeholder="22AAAAA0000A1Z5"
                />
                {formErrors.gstNumber
                  ? <p className="text-xs text-destructive mt-1">{formErrors.gstNumber}</p>
                  : formData.gstNumber.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{formData.gstNumber.length}/15 characters</p>
                  )
                }
              </div>

              {/* Terms and Conditions */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Terms and Conditions
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(appears in quotation/invoice PDFs)</span>
                </label>
                <textarea
                  value={formData.termsAndConditions}
                  onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                  className="input-field"
                  rows={4}
                  placeholder="Enter terms and conditions for quotations and invoices..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  These terms will appear at the bottom of all quotation and invoice PDFs
                </p>
              </div>

              {/* Bank & Payment Details Section */}
              <div className="pt-4 border-t border-border">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Landmark size={16} className="text-primary" />
                  Bank & Payment Details
                  <span className="text-xs font-normal text-muted-foreground">(for quotation/invoice PDFs)</span>
                </h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Bank Name</label>
                    <input
                      type="text"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      className="input-field"
                      placeholder="e.g., State Bank of India"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Account Number</label>
                    <input
                      type="text"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      className="input-field font-mono"
                      placeholder="e.g., 1234567890123456"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">IFSC Code</label>
                      <input
                        type="text"
                        value={formData.ifscCode}
                        onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                        className="input-field font-mono"
                        placeholder="e.g., SBIN0001234"
                        maxLength={11}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Branch Name</label>
                      <input
                        type="text"
                        value={formData.branchName}
                        onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                        className="input-field"
                        placeholder="e.g., Main Branch"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      UPI ID
                      <span className="ml-2 text-xs font-normal text-muted-foreground">(for QR code generation)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.upiId}
                      onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                      className="input-field font-mono"
                      placeholder="e.g., company@paytm or 9876543210@ybl"
                    />
                    {formData.upiId && (
                      <p className="text-xs text-muted-foreground mt-1">
                        💡 This will be used to generate payment QR codes in quotation PDFs
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={handleCloseModal} className="flex-1 btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid()}
                  className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingCompany ? 'Update' : 'Create'} Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingCompany}
        onClose={() => setDeletingCompany(null)}
        onConfirm={confirmDelete}
        title="Delete Company"
        itemName={deletingCompany?.companyName}
        message={
          deletingCompany
            ? `Are you sure you want to delete ${deletingCompany.companyName}? All users associated with this company will be affected.`
            : undefined
        }
      />
    </div>
  );
};

export default CompanyManagement;
