import React, { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Plus, Edit, Trash2, Mail, Phone, Building, Filter, ToggleLeft, ToggleRight, Eye, EyeOff, KeyRound } from 'lucide-react';
import { userService, UserDTO, UserRequest, RoleDTO } from '@/services/userService';
import { companyService, Company } from '@/services/companyService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DeleteConfirmModal } from '@/components/common/DeleteConfirmModal';
import { SortableHeader } from '@/components/common/SortableHeader';
import { useSortable } from '@/hooks/useSortable';
import { StatusBadge } from '@/components/common/StatusBadge';

// Module-level stale cache for users page
let _userCache: UserDTO[] | null = null;
let _userCacheTime = 0;
let _rolesCache: RoleDTO[] | null = null;
let _userCompanyCache: Company[] | null = null;
const STALE_MS = 60_000;

const PHONE_REGEX = /^[6-9][0-9]{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  roleId?: string;
  companyId?: string;
  phone?: string;
}

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [availableRoles, setAvailableRoles] = useState<RoleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDTO | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserDTO | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState<UserRequest>({
    name: '',
    email: '',
    password: '',
    roleId: 0,
    phone: '',
    countryCode: '+91',
    department: '',
    companyId: undefined,
  });
  const [showPassword, setShowPassword] = useState(false);
  // Password reset state
  const [resetPasswordUser, setResetPasswordUser] = useState<UserDTO | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (force = false) => {
    const now = Date.now();
    // Serve from cache if still fresh and not forced
    if (!force && _userCache && _rolesCache && (now - _userCacheTime) < STALE_MS) {
      setUsers(_userCache);
      if (currentUser?.role === 'superadmin' && _userCompanyCache) {
        setCompanies(_userCompanyCache);
      }
      // Re-apply role filtering from cache
      let filtered = _rolesCache;
      if (currentUser?.role === 'client') filtered = _rolesCache.filter(r => r.roleName === 'STAFF');
      else if (currentUser?.role === 'staff') filtered = [];
      setAvailableRoles(filtered);
      if (filtered.length > 0) setFormData(prev => ({ ...prev, roleId: filtered[0].id }));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [usersData, rolesData] = await Promise.all([
        userService.getAll(),
        userService.getRoles(),
      ]);
      _userCache = usersData;
      _rolesCache = rolesData;
      _userCacheTime = Date.now();
      setUsers(usersData);

      if (currentUser?.role === 'superadmin') {
        try {
          const companiesData = await companyService.getAll();
          _userCompanyCache = companiesData;
          setCompanies(companiesData);
        } catch (error) {
          console.error('Failed to fetch companies:', error);
        }
      }

      let filtered = rolesData;
      if (currentUser?.role === 'client') filtered = rolesData.filter(r => r.roleName === 'STAFF');
      else if (currentUser?.role === 'staff') filtered = [];
      setAvailableRoles(filtered);
      if (filtered.length > 0) setFormData(prev => ({ ...prev, roleId: filtered[0].id }));
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const errors: FormErrors = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!EMAIL_REGEX.test(formData.email)) {
      errors.email = 'Enter a valid email address';
    }
    if (!editingUser) {
      if (!formData.password) errors.password = 'Password is required';
      else if (formData.password.length < 6) errors.password = 'Password must be at least 6 characters';
    }
    if (!formData.roleId) errors.roleId = 'Role is required';
    if (needsCompanySelection && !formData.companyId) errors.companyId = 'Company is required';
    if (formData.phone && !PHONE_REGEX.test(formData.phone)) {
      errors.phone = 'Enter a valid 10-digit Indian mobile number (starts with 6, 7, 8 or 9)';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isFormValid = (): boolean => {
    if (!formData.name.trim()) return false;
    if (!formData.email.trim() || !EMAIL_REGEX.test(formData.email)) return false;
    if (!editingUser && (!formData.password || formData.password.length < 6)) return false;
    if (!formData.roleId) return false;
    if (needsCompanySelection && !formData.companyId) return false;
    if (formData.phone && !PHONE_REGEX.test(formData.phone)) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      if (editingUser) {
        await userService.update(editingUser.id, formData);
        toast.success('User updated successfully');
      } else {
        await userService.create(formData);
        toast.success('User created successfully');
      }
      setShowModal(false);
      resetForm();
      _userCache = null;
      fetchData(true);
    } catch (error: any) {
      console.error('Failed to save user:', error);
      const msg = error?.response?.data?.message || error?.response?.data?.error || 'Failed to save user';
      toast.error(msg);
    }
  };

  const handleToggleActive = async (user: UserDTO) => {
    try {
      await userService.update(user.id, {
        name: user.name,
        email: user.email,
        roleId: user.roleId,
        phone: user.phone,
        countryCode: user.countryCode,
        department: user.department,
        companyId: user.companyId,
        active: !user.active,
      });
      toast.success(`User ${user.active ? 'deactivated' : 'activated'} successfully`);
      _userCache = null;
      fetchData(true);
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleDelete = (user: UserDTO) => {
    setDeletingUser(user);
  };

  const confirmDelete = async () => {
    if (!deletingUser) return;
    try {
      await userService.delete(deletingUser.id);
      toast.success('User deleted successfully');
      _userCache = null;
      fetchData(true);
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleEdit = (user: UserDTO) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Don't populate password
      roleId: user.roleId,
      phone: user.phone || '',
      countryCode: user.countryCode || '+91',
      department: user.department || '',
      companyId: user.companyId,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    const defaultRoleId = availableRoles.length > 0 ? availableRoles[0].id : 0;
    setFormData({
      name: '',
      email: '',
      password: '',
      roleId: defaultRoleId,
      phone: '',
      countryCode: '+91',
      department: '',
      companyId: undefined,
    });
    setFormErrors({});
    setShowPassword(false);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      setResettingPassword(true);
      await userService.resetPassword(resetPasswordUser.id, newPassword);
      toast.success(`Password reset successfully for ${resetPasswordUser.name}`);
      setResetPasswordUser(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  // Get selected role name
  const getSelectedRoleName = () => {
    const role = availableRoles.find(r => r.id === formData.roleId);
    return role?.roleName || '';
  };

  const isSuperAdmin = currentUser?.role === 'superadmin';
  const isCreatingClient = !editingUser && getSelectedRoleName() === 'CLIENT';
  // SUPER_ADMIN creating STAFF also needs company selection
  const isCreatingStaff = !editingUser && getSelectedRoleName() === 'STAFF';
  const needsCompanySelection = isSuperAdmin && (isCreatingClient || isCreatingStaff);

  const canAddUsers = currentUser?.role === 'superadmin' ||
    currentUser?.role === 'client';

  // Button label: client sees "Add Staff", superadmin sees "Add User"
  const addButtonLabel = currentUser?.role === 'client' ? 'Add Staff' : 'Add User';

  // User limit for CLIENT role
  const USER_LIMIT = 5;
  const isClient = currentUser?.role === 'client';
  const activeUserCount = users.filter(u => u.active).length;
  const atUserLimit = isClient && activeUserCount >= USER_LIMIT;

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  // Filter users by selected company (for SUPER_ADMIN)
  const filteredUsers = selectedCompanyId
    ? users.filter(u => u.companyId === selectedCompanyId)
    : users;

  const { sortedData: sortedUsers, sort, handleSort } = useSortable(filteredUsers);

  if (loading) {
    return (
      <div className="min-h-screen">
        <TopBar title="User Management" />
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar title="User Management" />

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Users</h2>
            <p className="text-muted-foreground">
              {isSuperAdmin ? 'Manage system users and their roles' : 'Manage your company users'}
            </p>
          </div>
          {canAddUsers && (
            <button
              onClick={() => {
                if (atUserLimit) {
                  toast.error('User limit reached. Please contact support to add more users.');
                  return;
                }
                setShowModal(true);
              }}
              className={`btn-primary flex items-center gap-2 ${atUserLimit ? 'opacity-60' : ''}`}
              title={atUserLimit ? `User limit of ${USER_LIMIT} reached` : addButtonLabel}
            >
              <Plus size={20} />
              {addButtonLabel}
            </button>
          )}
        </div>

        {/* User limit banner — shown to CLIENT only */}
        {isClient && (
          <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${
            atUserLimit
              ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
              : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                atUserLimit ? 'bg-red-500' : 'bg-blue-500'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div>
                <p className={`font-semibold text-sm ${atUserLimit ? 'text-red-900 dark:text-red-100' : 'text-blue-900 dark:text-blue-100'}`}>
                  {atUserLimit ? 'User Limit Reached' : `User Seats: ${activeUserCount} / ${USER_LIMIT} used`}
                </p>
                <p className={`text-xs mt-0.5 ${atUserLimit ? 'text-red-700 dark:text-red-300' : 'text-blue-700 dark:text-blue-300'}`}>
                  {atUserLimit
                    ? 'Your plan allows 5 users. To add more, please contact support to purchase additional licenses.'
                    : `You can add ${USER_LIMIT - activeUserCount} more staff user${USER_LIMIT - activeUserCount !== 1 ? 's' : ''} on your current plan.`
                  }
                </p>
              </div>
            </div>
            {atUserLimit && (
              <a
                href="mailto:support@quoteflow.in?subject=Additional User Licenses&body=Hi, I have reached the 5-user limit and would like to purchase additional user licenses."
                className="flex-shrink-0 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors"
              >
                Contact Support
              </a>
            )}
          </div>
        )}

        {/* Company Filter (SUPER_ADMIN only) */}
        {isSuperAdmin && companies.length > 0 && (
          <div className="bg-card rounded-xl shadow-md border border-border p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter size={20} />
                <label className="font-medium">Filter by Company:</label>
              </div>
              <select
                value={selectedCompanyId || ''}
                onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
                className="input-field max-w-xs"
              >
                <option value="">All Companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.companyName}
                  </option>
                ))}
              </select>
              {selectedCompanyId && (
                <span className="text-sm text-muted-foreground">
                  Showing {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-card rounded-xl shadow-md border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full w-full table-fixed text-sm">
              <thead>
                <tr className="table-header">
                  <SortableHeader
                    label="Name"
                    sortKey="name"
                    sort={sort}
                    onSort={handleSort}
                    className="px-3 py-3 text-left w-32"
                  />
                  <th className="px-3 py-3 text-left w-52">Email</th>
                  <th className="px-3 py-3 text-left w-24">Role</th>
                  {isSuperAdmin && <th className="px-3 py-3 text-left w-44 hidden xl:table-cell">Company</th>}
                  <th className="px-3 py-3 text-left w-32 hidden lg:table-cell">Phone</th>
                  <th className="px-3 py-3 text-left w-32 hidden lg:table-cell">Department</th>
                  <th className="px-3 py-3 text-left w-24">Status</th>
                  <th className="px-3 py-3 text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => (
                  <tr key={user.id} className="table-row">
                    <td className="px-3 py-3 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                          {user.name.charAt(0)}
                        </div>
                        <span className="font-medium text-foreground truncate block">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 min-w-0">
                      <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                        <Mail size={14} className="flex-shrink-0" />
                        <span className="truncate block">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="badge-primary text-xs py-1 px-2">
                        {user.role}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-3 py-3 hidden xl:table-cell min-w-0">
                        {user.companyName ? (
                          <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                            <Building size={14} className="flex-shrink-0" />
                            <span className="truncate block">{user.companyName}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-3 hidden lg:table-cell min-w-0">
                      {user.phone ? (
                        <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                          <Phone size={14} className="flex-shrink-0" />
                          <span className="truncate block">{user.phone}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell min-w-0">
                      {user.department ? (
                        <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                          <Building size={14} className="flex-shrink-0" />
                          <span className="truncate block">{user.department}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={user.active ? 'active' : 'inactive'} />
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        {/* Reset password — shown to SUPER_ADMIN and CLIENT, not for their own account */}
                        {canAddUsers && user.id !== currentUser?.id && (
                          <button
                            onClick={() => { setResetPasswordUser(user); setNewPassword(''); setShowNewPassword(false); }}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                            title="Reset Password"
                          >
                            <KeyRound size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`p-1.5 rounded-lg transition-colors ${user.active ? 'text-green-600 hover:bg-green-50' : 'text-muted-foreground hover:bg-muted'}`}
                          title={user.active ? 'Deactivate' : 'Activate'}
                        >
                          {user.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h3 className="text-xl font-semibold text-foreground">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setFormErrors(p => ({ ...p, name: '' })); }}
                  className={`input-field ${formErrors.name ? 'border-destructive' : ''}`}
                  placeholder="Enter full name"
                />
                {formErrors.name && <p className="text-xs text-destructive mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email *</label>
                <input
                  type="text"
                  value={formData.email}
                  onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setFormErrors(p => ({ ...p, email: '' })); }}
                  className={`input-field ${formErrors.email ? 'border-destructive' : ''}`}
                  placeholder="user@example.com"
                />
                {formErrors.email && <p className="text-xs text-destructive mt-1">{formErrors.email}</p>}
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => { setFormData({ ...formData, password: e.target.value }); setFormErrors(p => ({ ...p, password: '' })); }}
                      className={`input-field pr-10 ${formErrors.password ? 'border-destructive' : ''}`}
                      placeholder="Min. 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {formErrors.password && <p className="text-xs text-destructive mt-1">{formErrors.password}</p>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Role *</label>
                <select
                  value={formData.roleId}
                  onChange={(e) => { setFormData({ ...formData, roleId: Number(e.target.value) }); setFormErrors(p => ({ ...p, roleId: '' })); }}
                  className={`input-field ${formErrors.roleId ? 'border-destructive' : ''}`}
                >
                  {availableRoles.map((role) => (
                    <option key={role.id} value={role.id}>{role.roleName}</option>
                  ))}
                </select>
                {formErrors.roleId && <p className="text-xs text-destructive mt-1">{formErrors.roleId}</p>}
              </div>

              {needsCompanySelection && companies.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Company *</label>
                  <select
                    value={formData.companyId || ''}
                    onChange={(e) => { setFormData({ ...formData, companyId: e.target.value ? Number(e.target.value) : undefined }); setFormErrors(p => ({ ...p, companyId: '' })); }}
                    className={`input-field ${formErrors.companyId ? 'border-destructive' : ''}`}
                  >
                    <option value="">Select Company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.companyName}</option>
                    ))}
                  </select>
                  {formErrors.companyId && <p className="text-xs text-destructive mt-1">{formErrors.companyId}</p>}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Code</label>
                  <input
                    type="text"
                    value="+91"
                    readOnly
                    className="input-field bg-muted cursor-not-allowed"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-2">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    maxLength={10}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData({ ...formData, phone: val });
                      setFormErrors(p => ({ ...p, phone: '' }));
                    }}
                    className={`input-field ${formErrors.phone ? 'border-destructive' : ''}`}
                    placeholder="10-digit mobile number"
                  />
                  {formErrors.phone && <p className="text-xs text-destructive mt-1">{formErrors.phone}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Sales, IT, HR (optional)"
                />
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
                  {editingUser ? 'Update' : 'Create'} User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={confirmDelete}
        title="Delete User"
        itemName={deletingUser?.name}
      />

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
                <KeyRound size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Reset Password</h3>
                <p className="text-xs text-muted-foreground">for {resetPasswordUser.name}</p>
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-foreground mb-1.5">New Password *</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="Min. 6 characters"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {newPassword && newPassword.length < 6 && (
                <p className="text-xs text-destructive mt-1">Must be at least 6 characters</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setResetPasswordUser(null); setNewPassword(''); }}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resettingPassword || !newPassword || newPassword.length < 6}
                className="flex-1 btn-primary disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resettingPassword ? (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                ) : <KeyRound size={15} />}
                {resettingPassword ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
