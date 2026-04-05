import React, { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { ClipboardList, Plus, Edit, Trash2, Phone, Mail, MapPin, Calendar, UserCheck } from 'lucide-react';
import { enquiryService, Enquiry, EnquiryRequest, ENQUIRY_RATINGS, ENQUIRY_STATUSES, REFER_TYPES } from '@/services/enquiryService';
import { toast } from 'sonner';
import { SearchBar } from '@/components/common/SearchBar';
import { Pagination } from '@/components/common/Pagination';
import { DeleteConfirmModal } from '@/components/common/DeleteConfirmModal';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ExportButton } from '@/components/common/ExportButton';
import { exportToExcel } from '@/utils/excelExport';

const ITEMS_PER_PAGE = 9;

const EMPTY_FORM: EnquiryRequest = {
  enquiryDate: new Date().toISOString().split('T')[0],
  name: '',
  contact: '',
  email: '',
  gender: 'Male',
  birthDate: '',
  budget: 0,
  address: '',
  enquiryFor: '',
  rating: '',
  status: 'open',
  city: '',
  referType: '',
  referBy: '',
  nextFollowupDate: '',
  comment: '',
};

const statusLabel = (s: string) =>
  s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);

const EnquiryManagement = () => {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Enquiry | null>(null);
  const [deleting, setDeleting] = useState<Enquiry | null>(null);
  const [formData, setFormData] = useState<EnquiryRequest>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { fetchEnquiries(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const fetchEnquiries = async () => {
    try {
      setLoading(true);
      setEnquiries(await enquiryService.getAll());
    } catch {
      toast.error('Failed to load enquiries');
    } finally {
      setLoading(false);
    }
  };

  const filtered = enquiries.filter((e) =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.contact.includes(searchTerm) ||
    (e.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.city || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.name.trim()) e.name = 'Name is required';
    else if (!/^[a-zA-Z\s'-]+$/.test(formData.name.trim())) e.name = 'Name can only contain letters, spaces, hyphens or apostrophes';
    if (!formData.contact.trim()) e.contact = 'Contact is required';
    else if (!/^[6-9][0-9]{9}$/.test(formData.contact)) e.contact = 'Enter a valid 10-digit Indian mobile number';
    if (!formData.status) e.status = 'Status is required';
    if (!formData.enquiryDate) e.enquiryDate = 'Enquiry date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    try {
      const payload: EnquiryRequest = {
        ...formData,
        budget: formData.budget || 0,
        birthDate: formData.birthDate || undefined,
        nextFollowupDate: formData.nextFollowupDate || undefined,
      };
      if (editing) {
        await enquiryService.update(editing.id, payload);
        toast.success('Enquiry updated');
      } else {
        await enquiryService.create(payload);
        toast.success('Enquiry created');
      }
      // Show extra toast if converted
      if (formData.status === 'converted') {
        toast.success('Customer automatically created from this enquiry');
      }
      setShowModal(false);
      resetForm();
      fetchEnquiries();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save enquiry');
    }
  };

  const handleEdit = (e: Enquiry) => {
    setEditing(e);
    setFormData({
      enquiryDate: e.enquiryDate,
      name: e.name,
      contact: e.contact,
      email: e.email || '',
      gender: e.gender || 'Male',
      birthDate: e.birthDate || '',
      budget: e.budget || 0,
      address: e.address || '',
      enquiryFor: e.enquiryFor || '',
      rating: e.rating || '',
      status: e.status,
      city: e.city || '',
      referType: e.referType || '',
      referBy: e.referBy || '',
      nextFollowupDate: e.nextFollowupDate || '',
      comment: e.comment || '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setErrors({});
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await enquiryService.delete(deleting.id);
      toast.success('Enquiry deleted');
      fetchEnquiries();
    } catch {
      toast.error('Failed to delete enquiry');
    }
  };

  const handleExport = () => {
    if (!enquiries.length) { toast.error('No enquiries to export'); return; }
    exportToExcel(
      enquiries.map((e) => ({
        date: e.enquiryDate, name: e.name, contact: e.contact,
        email: e.email || '', city: e.city || '', status: e.status,
        rating: e.rating || '', enquiryFor: e.enquiryFor || '',
        budget: e.budget || 0, comment: e.comment || '',
      })),
      [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Contact', key: 'contact', width: 15 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'City', key: 'city', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Rating', key: 'rating', width: 15 },
        { header: 'Enquiry For', key: 'enquiryFor', width: 20 },
        { header: 'Budget', key: 'budget', width: 15 },
        { header: 'Comment', key: 'comment', width: 30 },
      ],
      'enquiries'
    );
    toast.success('Exported to Excel');
  };

  const field = (label: string, key: keyof EnquiryRequest, type = 'text', required = false) => (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label}{required && ' *'}
      </label>
      <input
        type={type}
        value={formData[key] as string}
        onChange={(e) => {
          let val = e.target.value;
          if (key === 'contact') val = val.replace(/\D/g, '').slice(0, 10);
          setFormData((p) => ({ ...p, [key]: val }));
          if (errors[key]) setErrors((p) => ({ ...p, [key]: '' }));
        }}
        className={`input-field ${errors[key] ? 'border-destructive' : ''}`}
        placeholder={label}
      />
      {errors[key] && <p className="text-xs text-destructive mt-1">{errors[key]}</p>}
    </div>
  );

  const select = (label: string, key: keyof EnquiryRequest, options: string[], required = false) => (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label}{required && ' *'}
      </label>
      <select
        value={formData[key] as string}
        onChange={(e) => { setFormData((p) => ({ ...p, [key]: e.target.value })); if (errors[key]) setErrors((p) => ({ ...p, [key]: '' })); }}
        className={`input-field ${errors[key] ? 'border-destructive' : ''}`}
      >
        <option value="">Select {label}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {errors[key] && <p className="text-xs text-destructive mt-1">{errors[key]}</p>}
    </div>
  );

  if (loading) return (
    <div className="min-h-screen">
      <TopBar title="Enquiry Management" />
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading enquiries...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <TopBar title="Enquiry Management" />
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Enquiries</h2>
            <p className="text-muted-foreground">Track leads and convert them to customers</p>
          </div>
          <div className="flex items-center gap-3">
            <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search enquiries..." className="w-64" />
            <ExportButton onClick={handleExport} disabled={!enquiries.length} count={enquiries.length} />
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Add Enquiry
            </button>
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <ClipboardList size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{searchTerm ? 'No enquiries match your search' : 'No enquiries yet'}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {paginated.map((e, i) => (
                <div
                  key={e.id}
                  className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-200 flex flex-col animate-slide-in-up"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  {/* Card header */}
                  <div className="p-5 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                          {e.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{e.name}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <StatusBadge status={e.status} />
                            {e.rating && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                e.rating === 'Hot' ? 'bg-red-100 text-red-700' :
                                e.rating === 'Warm' ? 'bg-orange-100 text-orange-700' :
                                e.rating === 'Cold' ? 'bg-blue-100 text-blue-700' :
                                'bg-muted text-muted-foreground'
                              }`}>{e.rating}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <button onClick={() => handleEdit(e)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Edit">
                          <Edit size={15} />
                        </button>
                        <button onClick={() => setDeleting(e)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-border mx-5" />

                  {/* Card body */}
                  <div className="p-5 pt-4 space-y-2.5 flex-1">
                    <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <Phone size={13} className="text-primary/60 flex-shrink-0" />
                      <span>{e.contact}</span>
                    </div>
                    {e.email && (
                      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                        <Mail size={13} className="text-primary/60 flex-shrink-0" />
                        <span className="truncate">{e.email}</span>
                      </div>
                    )}
                    {e.city && (
                      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                        <MapPin size={13} className="text-primary/60 flex-shrink-0" />
                        <span>{e.city}</span>
                      </div>
                    )}
                    {e.nextFollowupDate && (
                      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                        <Calendar size={13} className="text-primary/60 flex-shrink-0" />
                        <span>Follow-up: {e.nextFollowupDate}</span>
                      </div>
                    )}
                    {e.enquiryFor && (
                      <div className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md inline-block">
                        {e.enquiryFor}
                      </div>
                    )}
                    {e.convertedCustomerId && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                        <UserCheck size={13} /> Converted to Customer
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border sticky top-0 bg-card z-10">
              <h3 className="text-xl font-semibold text-foreground">
                {editing ? 'Edit Enquiry' : 'New Enquiry'}
              </h3>
              {formData.status === 'converted' && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                  <UserCheck size={12} /> Saving as Converted will automatically create a Customer
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Section: Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Enquiry Date *</label>
                  <input type="date" value={formData.enquiryDate}
                    onChange={(e) => setFormData((p) => ({ ...p, enquiryDate: e.target.value }))}
                    className={`input-field ${errors.enquiryDate ? 'border-destructive' : ''}`} />
                  {errors.enquiryDate && <p className="text-xs text-destructive mt-1">{errors.enquiryDate}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Status *</label>
                  <select value={formData.status}
                    onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                    className="input-field">
                    {ENQUIRY_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('Name', 'name', 'text', true)}
                {field('Contact (Mobile)', 'contact', 'tel', true)}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('Email', 'email', 'email')}
                {select('Gender', 'gender', ['Male', 'Female', 'Other'])}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Birth Date</label>
                  <input type="date" value={formData.birthDate || ''}
                    onChange={(e) => setFormData((p) => ({ ...p, birthDate: e.target.value }))}
                    className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Budget (₹)</label>
                  <input type="number" value={formData.budget || 0} min={0}
                    onChange={(e) => setFormData((p) => ({ ...p, budget: parseFloat(e.target.value) || 0 }))}
                    className="input-field" />
                </div>
              </div>

              {field('Address', 'address')}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('Enquiry For', 'enquiryFor')}
                {field('City', 'city')}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {select('Rating', 'rating', ENQUIRY_RATINGS)}
                {select('Refer Type', 'referType', REFER_TYPES)}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('Refer By', 'referBy')}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Next Follow-up Date</label>
                  <input type="date" value={formData.nextFollowupDate || ''}
                    onChange={(e) => setFormData((p) => ({ ...p, nextFollowupDate: e.target.value }))}
                    className="input-field" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Comment</label>
                <textarea value={formData.comment || ''} rows={3}
                  onChange={(e) => setFormData((p) => ({ ...p, comment: e.target.value }))}
                  placeholder="Notes from the conversation..."
                  className="input-field resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 btn-secondary">Cancel</button>
                <button type="submit" className="flex-1 btn-primary">
                  {editing ? 'Update' : 'Create'} Enquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete Enquiry"
        itemName={deleting?.name}
      />
    </div>
  );
};

export default EnquiryManagement;
