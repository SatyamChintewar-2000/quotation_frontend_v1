import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { menuPermissions } from '@/data/mockData';
import {
  LayoutDashboard,
  Settings,
  Building2,
  Package,
  Users,
  FileText,
  History,
  BarChart3,
  UserCog,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Receipt,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { companyService, Company } from '@/services/companyService';
import { settingsService } from '@/services/settingsService';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'master_settings', label: 'System setting', icon: Settings, path: '/master-settings' },
  { id: 'company_master', label: 'Company details', icon: Building2, path: '/company-master' },
  { id: 'add_product', label: 'Add Product', icon: Package, path: '/add-product' },
  { id: 'enquiry_management', label: 'Enquiry Management', icon: ClipboardList, path: '/enquiries' },
  { id: 'client_details', label: 'Customer Management', icon: Users, path: '/client-details' },
  { id: 'new_quotation', label: 'New Quotation', icon: FileText, path: '/new-quotation' },
  { id: 'quotation_history', label: 'Quotation record', icon: History, path: '/quotation-history' },
  { id: 'new_invoice', label: 'New Invoice', icon: Receipt, path: '/new-invoice' },
  { id: 'invoice_management', label: 'Invoice Management', icon: Receipt, path: '/invoices' },
  { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
  { id: 'user_management', label: 'User Management', icon: UserCog, path: '/user-management' },
];

export const Sidebar = ({ isOpen, onToggle }: SidebarProps) => {
  const { user, logout } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [adminLogo, setAdminLogo] = useState<string | null>(null);

  // Fetch company data or admin logo
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingCompany(true);
        const isSuperAdmin = user?.role?.toLowerCase() === 'superadmin' || user?.role?.toLowerCase() === 'super_admin';
        
        if (isSuperAdmin) {
          // Fetch admin logo for super admin
          const settings = await settingsService.getSettings();
          if (settings.superadmin_logo) {
            setAdminLogo(settings.superadmin_logo);
          }
        } else if (user?.companyId) {
          const companyData = await companyService.getById(user.companyId);
          setCompany(companyData);
        } else if (user?.role?.toLowerCase() === 'client') {
          const companyData = await companyService.getMyCompany();
          setCompany(companyData);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoadingCompany(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  const allowedMenuIds = user ? menuPermissions[user.role] : [];
  const visibleMenuItems = menuItems.filter((item) =>
    allowedMenuIds.includes(item.id)
  );

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-sidebar flex flex-col transition-all duration-300 ease-in-out z-50',
        isOpen ? 'w-64' : 'w-20'
      )}
      style={{
        width: isOpen ? '256px' : '80px',
      }}
    >
      {/* Logo Section */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-muted/20">
        <div className={cn('flex items-center gap-3', !isOpen && 'justify-center w-full')}>
          {/* Logo - Admin Logo for Super Admin, Company Logo for others */}
          {loadingCompany ? (
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center animate-pulse">
              <span className="text-primary-foreground font-bold text-lg">...</span>
            </div>
          ) : adminLogo ? (
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white shadow-glow flex-shrink-0">
              <img 
                src={adminLogo} 
                alt="Admin Logo" 
                className="w-full h-full object-contain"
              />
            </div>
          ) : company?.logo ? (
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white shadow-glow flex-shrink-0">
              <img 
                src={company.logo} 
                alt={company.companyName || 'Company Logo'} 
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow">
              <span className="text-primary-foreground font-bold text-lg">Q</span>
            </div>
          )}
          
          {/* Company/Organization Name */}
          {isOpen && (
            <span className="text-sidebar-foreground font-semibold text-lg animate-fade-in truncate">
              {adminLogo ? 'Admin Panel' : (company?.companyName || 'QuoteFlow')}
            </span>
          )}
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
      >
        {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 overflow-y-auto">
        <ul className="space-y-1">
          {visibleMenuItems.map((item) => (
            <li key={item.id}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'sidebar-item',
                    isActive && 'sidebar-item-active',
                    !isOpen && 'justify-center px-3'
                  )
                }
              >
                <item.icon size={20} className="flex-shrink-0" />
                {isOpen && (
                  <span className="animate-fade-in whitespace-nowrap">{item.label}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-sidebar-muted/20">
        <div className={cn('flex items-center gap-3', !isOpen && 'justify-center')}>
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          {isOpen && (
            <div className="flex-1 min-w-0 animate-fade-in">
              <p className="text-sidebar-foreground font-semibold text-sm truncate">
                {user?.name}
              </p>
              <p className="text-white text-xs capitalize bg-sidebar-hover px-2 py-0.5 rounded-full inline-block mt-0.5">
                {user?.role.replace('_', ' ').toLowerCase()}
              </p>
            </div>
          )}
          {isOpen && (
            <button
              onClick={logout}
              className="p-2 rounded-lg text-sidebar-muted hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
        {!isOpen && (
          <button
            onClick={logout}
            className="mt-3 w-full flex justify-center p-2 rounded-lg text-sidebar-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  );
};
