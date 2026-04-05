import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { menuPermissions } from '@/data/mockData';
import {
  LayoutDashboard,
  Settings,
  Building2,
  MessageSquare,
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

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'master_settings', label: 'Master Settings', icon: Settings, path: '/master-settings' },
  { id: 'company_master', label: 'Company Master', icon: Building2, path: '/company-master' },
  { id: 'sms_template', label: 'SMS Template', icon: MessageSquare, path: '/sms-template' },
  { id: 'add_product', label: 'Add Product', icon: Package, path: '/add-product' },
  { id: 'enquiry_management', label: 'Enquiry Management', icon: ClipboardList, path: '/enquiries' },
  { id: 'client_details', label: 'Customer Management', icon: Users, path: '/client-details' },
  { id: 'new_quotation', label: 'New Quotation', icon: FileText, path: '/new-quotation' },
  { id: 'quotation_history', label: 'Quotation History', icon: History, path: '/quotation-history' },
  { id: 'new_invoice', label: 'New Invoice', icon: Receipt, path: '/new-invoice' },
  { id: 'invoice_management', label: 'Invoice Management', icon: Receipt, path: '/invoices' },
  { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
  { id: 'user_management', label: 'User Management', icon: UserCog, path: '/user-management' },
];

export const Sidebar = ({ isOpen, onToggle }: SidebarProps) => {
  const { user, logout } = useAuth();

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
    >
      {/* Logo Section */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-muted/20">
        <div className={cn('flex items-center gap-3', !isOpen && 'justify-center w-full')}>
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow">
            <span className="text-primary-foreground font-bold text-lg">Q</span>
          </div>
          {isOpen && (
            <span className="text-sidebar-foreground font-semibold text-lg animate-fade-in">
              QuoteFlow
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
          <div className="w-10 h-10 rounded-full bg-sidebar-hover flex items-center justify-center text-sidebar-foreground font-medium">
            {user?.name.charAt(0)}
          </div>
          {isOpen && (
            <div className="flex-1 min-w-0 animate-fade-in">
              <p className="text-sidebar-foreground font-medium text-sm truncate">
                {user?.name}
              </p>
              <p className="text-sidebar-muted text-xs capitalize">
                {user?.role.replace('_', ' ')}
              </p>
            </div>
          )}
          {isOpen && (
            <button
              onClick={logout}
              className="p-2 rounded-lg text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-hover transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
