import React, { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { clients } from '@/data/mockData';
import { Users, Mail, Phone, MapPin, Building2, Plus, User, Briefcase, Shield, Send } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

interface StaffMember {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  countryCode: string;
  role: string;
  department: string;
  status: boolean;
  createdBy: string;
}

const countryCodes = [
  { code: '+91', country: 'India' },
  { code: '+1', country: 'USA' },
  { code: '+44', country: 'UK' },
  { code: '+971', country: 'UAE' },
  { code: '+65', country: 'Singapore' },
  { code: '+61', country: 'Australia' },
];

const roles = [
  { value: 'admin', label: 'Admin' },
  { value: 'sales_executive', label: 'Sales Executive' },
  { value: 'manager', label: 'Manager' },
  { value: 'viewer', label: 'Viewer' },
];

const departments = [
  { value: 'sales', label: 'Sales' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'operations', label: 'Operations' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'Human Resources' },
];

const ClientDetails = () => {
  const { user } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    countryCode: '+91',
    role: '',
    department: '',
    status: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter clients based on user role
  const isSuperAdmin = user?.role === 'superadmin';
  const userClients = isSuperAdmin
    ? clients
    : clients.filter((c) => c.createdBy === user?.id);

  const userStaff = isSuperAdmin
    ? staffList
    : staffList.filter((s) => s.createdBy === user?.id);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Please enter a valid 10-digit phone number';
    }
    
    if (!formData.role) {
      newErrors.role = 'Please select a role';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newStaff: StaffMember = {
      id: `staff_${Date.now()}`,
      ...formData,
      createdBy: user?.id || '',
    };
    
    setStaffList(prev => [...prev, newStaff]);
    
    toast({
      title: "Staff member added successfully",
      description: `Invitation email sent to ${formData.email}`,
    });
    
    // Reset form
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      countryCode: '+91',
      role: '',
      department: '',
      status: true,
    });
    setErrors({});
    setIsDrawerOpen(false);
    setIsSubmitting(false);
  };

  const handleCancel = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      countryCode: '+91',
      role: '',
      department: '',
      status: true,
    });
    setErrors({});
    setIsDrawerOpen(false);
  };

  const isFormValid = formData.fullName && formData.email && formData.phone && formData.role;

  const getRolePermissions = (role: string) => {
    switch (role) {
      case 'admin':
        return ['Full access', 'User management', 'Reports', 'Settings'];
      case 'sales_executive':
        return ['Create quotations', 'View clients', 'Manage products'];
      case 'manager':
        return ['View reports', 'Manage team', 'Approve quotations'];
      case 'viewer':
        return ['View only access', 'No edit permissions'];
      default:
        return [];
    }
  };

  return (
    <div className="min-h-screen">
      <TopBar title="Staff Details" />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {isSuperAdmin ? 'All Staff Members' : 'My Team'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Manage your team members and their access
              </p>
            </div>
          </div>
          <Button 
            onClick={() => setIsDrawerOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <Plus size={18} />
            Add New Staff
          </Button>
        </div>

        {userStaff.length === 0 && userClients.length === 0 ? (
          <div className="bg-card rounded-xl shadow-md border border-border p-12 text-center">
            <Users size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No staff members yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first staff member to get started
            </p>
            <Button 
              onClick={() => setIsDrawerOpen(true)}
              className="mt-4 bg-primary hover:bg-primary/90"
            >
              <Plus size={18} className="mr-2" />
              Add New Staff
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Display added staff members */}
            {userStaff.map((staff, index) => (
              <div
                key={staff.id}
                className="bg-card rounded-xl shadow-md border border-border p-6 hover:shadow-lg transition-all duration-300 animate-slide-in-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                    {staff.fullName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {staff.fullName}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate capitalize">
                      {staff.role.replace('_', ' ')}
                    </p>
                    <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium ${
                      staff.status ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {staff.status ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground truncate">
                      {staff.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={16} className="text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">
                      {staff.countryCode} {staff.phone}
                    </span>
                  </div>
                  {staff.department && (
                    <div className="flex items-center gap-3 text-sm">
                      <Briefcase size={16} className="text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground capitalize">
                        {staff.department}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <button className="btn-outline text-sm py-2 flex-1">
                    View
                  </button>
                  <button className="btn-secondary text-sm py-2 flex-1">
                    Edit
                  </button>
                </div>
              </div>
            ))}

            {/* Display existing clients as staff cards for demo */}
            {userClients.map((client, index) => (
              <div
                key={client.id}
                className="bg-card rounded-xl shadow-md border border-border p-6 hover:shadow-lg transition-all duration-300 animate-slide-in-up"
                style={{ animationDelay: `${(userStaff.length + index) * 100}ms` }}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                    {client.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {client.name}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {client.company}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground truncate">
                      {client.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={16} className="text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{client.phone}</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin size={16} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground line-clamp-2">
                      {client.address}
                    </span>
                  </div>
                  {client.gstNumber && (
                    <div className="flex items-center gap-3 text-sm">
                      <Building2 size={16} className="text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">
                        GST: {client.gstNumber}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <button className="btn-outline text-sm py-2 flex-1">
                    View
                  </button>
                  <button className="btn-secondary text-sm py-2 flex-1">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Staff Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-background">
          <SheetHeader className="pb-6 border-b border-border">
            <SheetTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
              <User size={22} className="text-primary" />
              Add New Staff
            </SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Enter staff details to add them to your team
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-6 py-6">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-foreground font-medium">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fullName"
                  placeholder="Enter full name"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className={`pl-10 ${errors.fullName ? 'border-destructive' : ''}`}
                />
              </div>
              {errors.fullName && (
                <p className="text-sm text-destructive">{errors.fullName}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground font-medium">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`pl-10 ${errors.email ? 'border-destructive' : ''}`}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-foreground font-medium">
                Phone Number <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Select
                  value={formData.countryCode}
                  onValueChange={(value) => setFormData({ ...formData, countryCode: value })}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border">
                    {countryCodes.map((cc) => (
                      <SelectItem key={cc.code} value={cc.code}>
                        {cc.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`pl-10 ${errors.phone ? 'border-destructive' : ''}`}
                  />
                </div>
              </div>
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone}</p>
              )}
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role" className="text-foreground font-medium">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger className={errors.role ? 'border-destructive' : ''}>
                  <div className="flex items-center gap-2">
                    <Shield size={18} className="text-muted-foreground" />
                    <SelectValue placeholder="Select role" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  {roles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-sm text-destructive">{errors.role}</p>
              )}
              
              {/* Permission Preview */}
              {formData.role && (
                <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Permissions for {roles.find(r => r.value === formData.role)?.label}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {getRolePermissions(formData.role).map((perm, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department" className="text-foreground font-medium">
                Department
              </Label>
              <Select
                value={formData.department}
                onValueChange={(value) => setFormData({ ...formData, department: value })}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Briefcase size={18} className="text-muted-foreground" />
                    <SelectValue placeholder="Select department" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  {departments.map((dept) => (
                    <SelectItem key={dept.value} value={dept.value}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
              <div>
                <Label htmlFor="status" className="text-foreground font-medium">
                  Status
                </Label>
                <p className="text-sm text-muted-foreground">
                  {formData.status ? 'Staff member is active' : 'Staff member is inactive'}
                </p>
              </div>
              <Switch
                id="status"
                checked={formData.status}
                onCheckedChange={(checked) => setFormData({ ...formData, status: checked })}
              />
            </div>

            {/* Password Setup Info */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-3">
                <Send size={20} className="text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-foreground text-sm">
                    Send Invitation Email
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    An invitation email will be sent to the staff member to set their own password and complete registration.
                  </p>
                </div>
              </div>
            </div>

            {/* Form Buttons */}
            <div className="flex gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Adding...
                  </span>
                ) : (
                  'Add Staff'
                )}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ClientDetails;
