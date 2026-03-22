import React, { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Plus, Edit, Trash2, Mail, Phone, Building, Filter, ToggleLeft, ToggleRight } from 'lucide-react';
import { userService, UserDTO, UserRequest, RoleDTO } from '@/services/userService';
import { companyService, Company } from '@/services/companyService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const PHONE_REGEX = /^[0-9]{7,15}$/;

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [availableRoles, setAvailableRoles] = useState<RoleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDTO | null>(null);
  const [phoneError, setPhoneError] = useState('');
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData] = await Promise.all([
        userService.getAll(),
        userService.getRoles(),
      ]);
      setUsers(usersData);
      
      // Fetch companies for SUPER_ADMIN
      if (currentUser?.role === 'superadmin') {
        try {
          const companiesData = await companyService.getAll();
          setCompanies(companiesData);
        } catch (error) {
          console.error('Failed to fetch companies:', error);
        }
      }
      
      // Filter roles based on current user's role
      let filtered = rolesData;
      if (currentUser?.role === 'client') {
        // CLIENT can only add STAFF
        filtered = rolesData.filter(r => r.roleName === 'STAFF');
      } else if (currentUser?.role === 'staff') {
        // STAFF cannot add any users (will be hidden in UI)
        filtered = [];
      }
      // SUPER_ADMIN can add all roles
      
      setAvailableRoles(filtered);
      
      // Set default roleId
      if (filtered.length > 0) {
        setFormData(prev => ({ ...prev, roleId: filtered[0].id }));
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Phone validation
    if (formData.phone && !PHONE_REGEX.test(formData.phone)) {
      setPhoneError('Phone must be 7-15 digits only');
      return;
    }
    setPhoneError('');
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
      fetchData();
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
      fetchData();
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await userService.delete(id);
      toast.success('User deleted successfully');
      fetchData();
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
  };

  // Get selected role name
  const getSelectedRoleName = () => {
    const role = availableRoles.find(r => r.id === formData.roleId);
    return role?.roleName || '';
  };

  const isCreatingClient = !editingUser && getSelectedRoleName() === 'CLIENT';
  // SUPER_ADMIN creating STAFF also needs company selection
  const isCreatingStaff = !editingUser && getSelectedRoleName() === 'STAFF';
  const needsCompanySelection = isSuperAdmin && (isCreatingClient || isCreatingStaff);

  const canAddUsers = currentUser?.role === 'superadmin' || 
                      currentUser?.role === 'client';

  // Button label: client sees "Add Staff", superadmin sees "Add User"
  const addButtonLabel = currentUser?.role === 'client' ? 'Add Staff' : 'Add User';

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  // Filter users by selected company (for SUPER_ADMIN)
  const filteredUsers = selectedCompanyId
    ? users.filter(u => u.companyId === selectedCompanyId)
    : users;

  const isSuperAdmin = currentUser?.role === 'superadmin';

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
              onClick={() => setShowModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={20} />
              {addButtonLabel}
            </button>
          )}
        </div>

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
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-6 py-4 text-left">Name</th>
                  <th className="px-6 py-4 text-left">Email</th>
                  <th className="px-6 py-4 text-left">Role</th>
                  {isSuperAdmin && <th className="px-6 py-4 text-left">Company</th>}
                  <th className="px-6 py-4 text-left">Phone</th>
                  <th className="px-6 py-4 text-left">Department</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="table-row">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                          {user.name.charAt(0)}
                        </div>
                        <span className="font-medium text-foreground">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail size={16} />
                        {user.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="badge-primary">
                        {user.role}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-6 py-4">
                        {user.companyName ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building size={16} />
                            {user.companyName}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      {user.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone size={16} />
                          {user.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.department && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building size={16} />
                          {user.department}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={user.active ? 'badge-success' : 'badge-warning'}>
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`p-2 rounded-lg transition-colors ${user.active ? 'text-green-600 hover:bg-green-50' : 'text-muted-foreground hover:bg-muted'}`}
                          title={user.active ? 'Deactivate' : 'Activate'}
                        >
                          {user.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
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
                <label className="block text-sm font-medium text-foreground mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  required
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
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input-field"
                    required={!editingUser}
                    placeholder="Enter password"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Role *
                </label>
                <select
                  value={formData.roleId}
                  onChange={(e) => setFormData({ ...formData, roleId: Number(e.target.value) })}
                  className="input-field"
                  required
                >
                  {availableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.roleName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Company dropdown - for SUPER_ADMIN creating CLIENT or STAFF users */}
              {needsCompanySelection && companies.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Company *
                  </label>
                  <select
                    value={formData.companyId || ''}
                    onChange={(e) => setFormData({ ...formData, companyId: e.target.value ? Number(e.target.value) : undefined })}
                    className="input-field"
                    required
                  >
                    <option value="">Select Company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.companyName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Code
                  </label>
                  <input
                    type="text"
                    value={formData.countryCode}
                    onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                    className="input-field"
                    placeholder="+91"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => { setFormData({ ...formData, phone: e.target.value }); setPhoneError(''); }}
                    className={`input-field ${phoneError ? 'border-destructive' : ''}`}
                    placeholder="Phone number (digits only)"
                  />
                  {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Department
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Sales, IT, HR"
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
                  {editingUser ? 'Update' : 'Create'} User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
