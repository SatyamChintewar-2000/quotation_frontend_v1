import React, { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Mail, MessageCircle, Save, Loader2, Bell, Shield, Zap, Palette, RotateCcw, Check, Building2, Upload, X as XIcon, Landmark, Lock, FileText } from "lucide-react";
import { settingsService, AppSettings } from "@/services/settingsService";
import { useTheme, ThemeColors, defaultColors } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { companyService, Company } from "@/services/companyService";
import { toast } from "sonner";
import { PDF_THEMES } from "@/constants/pdfThemes";

const defaultSettings: AppSettings = {
  email_notifications_enabled: "true",
  whatsapp_notifications_enabled: "false",
  mobile_otp_login_enabled: "false",
  whatsapp_api_url: "",
  whatsapp_api_token: "",
  whatsapp_phone_number_id: "",
  superadmin_logo: "",
};

// ── Preset palettes ──────────────────────────────────────────────────────────
const presets: { name: string; emoji: string; colors: Partial<ThemeColors> }[] = [
  {
    name: "Ocean Teal",
    emoji: "🌊",
    colors: { primary: "#2a9d8f", sidebarBg: "#0f172a", buttonPrimary: "#2a9d8f" },
  },
  {
    name: "Royal Purple",
    emoji: "💜",
    colors: { primary: "#7c3aed", sidebarBg: "#1e1b4b", buttonPrimary: "#7c3aed" },
  },
  {
    name: "Sunset Orange",
    emoji: "🌅",
    colors: { primary: "#ea580c", sidebarBg: "#1c0a00", buttonPrimary: "#ea580c" },
  },
  {
    name: "Rose Pink",
    emoji: "🌸",
    colors: { primary: "#e11d48", sidebarBg: "#1f0010", buttonPrimary: "#e11d48" },
  },
  {
    name: "Forest Green",
    emoji: "🌿",
    colors: { primary: "#16a34a", sidebarBg: "#052e16", buttonPrimary: "#16a34a" },
  },
  {
    name: "Sky Blue",
    emoji: "☁️",
    colors: { primary: "#0284c7", sidebarBg: "#0c1a2e", buttonPrimary: "#0284c7" },
  },
  {
    name: "Midnight",
    emoji: "🌙",
    colors: { primary: "#6366f1", sidebarBg: "#0f0f23", buttonPrimary: "#6366f1" },
  },
  {
    name: "Golden",
    emoji: "✨",
    colors: { primary: "#d97706", sidebarBg: "#1c1400", buttonPrimary: "#d97706" },
  },
];

const colorFields: { key: keyof ThemeColors; label: string; desc: string; group: string }[] = [
  { key: "primary", label: "Primary / Accent", desc: "Buttons, links, highlights", group: "Brand" },
  { key: "buttonPrimary", label: "Button Color", desc: "Primary action buttons", group: "Brand" },
  { key: "buttonText", label: "Button Text", desc: "Text inside buttons", group: "Brand" },
  { key: "sidebarBg", label: "Sidebar Background", desc: "Left navigation panel", group: "Layout" },
  { key: "sidebarText", label: "Sidebar Text", desc: "Icons and text in sidebar", group: "Layout" },
  { key: "background", label: "Page Background", desc: "Main content area", group: "Layout" },
  { key: "cardBg", label: "Card Background", desc: "Cards, modals, panels", group: "Layout" },
  { key: "tableHeader", label: "Table Header", desc: "Header row background", group: "Table" },
  { key: "tableRowHover", label: "Row Hover", desc: "Row highlight on hover", group: "Table" },
  { key: "textPrimary", label: "Primary Text", desc: "Main body text", group: "Text" },
  { key: "textMuted", label: "Muted Text", desc: "Labels, hints, secondary", group: "Text" },
  { key: "borderColor", label: "Border Color", desc: "Inputs, dividers, cards", group: "Text" },
];

const groupColors: Record<string, string> = {
  Brand: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Layout: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Table: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Text: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

// ── Toggle ───────────────────────────────────────────────────────────────────
const Toggle: React.FC<{ enabled: boolean; onToggle: () => void; color: string }> = ({ enabled, onToggle, color }) => (
  <button
    onClick={onToggle}
    style={{ width: "52px" }}
    className={`relative inline-flex h-7 items-center rounded-full transition-all duration-300 focus:outline-none ${enabled ? color : "bg-muted-foreground/25"}`}
  >
    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${enabled ? "translate-x-7" : "translate-x-1"}`} />
  </button>
);

// ── Component ────────────────────────────────────────────────────────────────
const MasterSettings: React.FC = () => {
  const { user } = useAuth();
  const isStaff = user?.role?.toLowerCase() === 'staff';
  const isClient = user?.role?.toLowerCase() === 'client';
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { colors, setColors, resetColors } = useTheme();
  const [draft, setDraft] = useState<ThemeColors>({ ...colors });
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Company profile state (CLIENT only)
  const [company, setCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({
    companyName: '', phone: '', email: '', address: '',
    state: '', city: '', gstNumber: '', termsAndConditions: '', logo: '',
    // Bank details
    bankName: '', accountNumber: '', ifscCode: '', branchName: '', upiId: '',
    // Feature 1: PDF Theme
    pdfThemeName: 'navy', pdfAccentColor: '', pdfWatermarkEnabled: false, pdfWatermarkOpacity: 0.07,
    // Feature V28: Export / Logistics columns
    showWeightColumn: false, showCbmColumn: false, showUsdColumn: false,
    ratePerCbm: 0, usdExchangeRate: 83,
    // Advanced Options CBM — V30
    cbmAdvancedMode: false, shippingCostUsd: 0, clearancePerCbm: 1667, installationCost: 0,
  });
  const [logoPreview, setLogoPreview] = useState('');
  const [companySaving, setCompanySaving] = useState(false);
  const [companyDirty, setCompanyDirty] = useState(false);

  // Super Admin Logo state
  const [adminLogoPreview, setAdminLogoPreview] = useState('');
  const [adminLogoSaving, setAdminLogoSaving] = useState(false);

  // Active tab state
  type TabId = 'notifications' | 'company' | 'appearance' | 'admin';
  const isSuperAdmin = user?.role?.toLowerCase() === 'superadmin' || user?.role?.toLowerCase() === 'super_admin';
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (isSuperAdmin) return 'admin';
    if (isClient) return 'company';
    return 'appearance';
  });

  useEffect(() => {
    const loads: Promise<any>[] = [
      settingsService.getSettings().then((s) => {
        setSettings(s);
        if (isSuperAdmin && s.superadmin_logo) {
          setAdminLogoPreview(s.superadmin_logo);
        }
      }).catch(() => toast.error("Failed to load settings")),
    ];
    if (isClient) {
      loads.push(
        companyService.getMyCompany().then((c) => {
          setCompany(c);
          setCompanyForm({
            companyName: c.companyName || '',
            phone: c.phone || '',
            email: c.email || '',
            address: c.address || '',
            state: c.state || '',
            city: c.city || '',
            gstNumber: c.gstNumber || '',
            termsAndConditions: c.termsAndConditions || '',
            logo: c.logo || '',
            // Bank details
            bankName: c.bankName || '',
            accountNumber: c.accountNumber || '',
            ifscCode: c.ifscCode || '',
            branchName: c.branchName || '',
            upiId: c.upiId || '',
            // Feature 1: PDF Theme
            pdfThemeName: c.pdfThemeName || 'navy',
            pdfAccentColor: c.pdfAccentColor || '',
            pdfWatermarkEnabled: c.pdfWatermarkEnabled ?? false,
            pdfWatermarkOpacity: c.pdfWatermarkOpacity ?? 0.07,
            // Feature V28: Export / Logistics columns
            showWeightColumn: c.showWeightColumn ?? false,
            showCbmColumn: c.showCbmColumn ?? false,
            showUsdColumn: c.showUsdColumn ?? false,
            ratePerCbm: c.ratePerCbm ?? 0,
            usdExchangeRate: c.usdExchangeRate ?? 83,
            // Advanced Options CBM — V30
            cbmAdvancedMode: c.cbmAdvancedMode ?? false,
            shippingCostUsd: c.shippingCostUsd ?? 0,
            clearancePerCbm: c.clearancePerCbm ?? 1667,
            installationCost: c.installationCost ?? 0,
          });
          setLogoPreview(c.logo || '');
        }).catch(() => { })
      );
    }
    Promise.all(loads).finally(() => setLoading(false));
  }, [isClient, isSuperAdmin]);

  const toggle = (key: keyof AppSettings) =>
    setSettings((p) => ({ ...p, [key]: p[key] === "true" ? "false" : "true" }));

  const change = (key: keyof AppSettings, value: string) =>
    setSettings((p) => ({ ...p, [key]: value }));

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await settingsService.updateSettings(settings);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    const updated = { ...draft, [key]: value };
    setDraft(updated);
    setColors(updated);
    setActivePreset(null);
  };

  const applyPreset = (preset: typeof presets[0]) => {
    const updated = { ...draft, ...preset.colors };
    setDraft(updated);
    setColors(updated);
    setActivePreset(preset.name);
    toast.success(`${preset.emoji} ${preset.name} theme applied`);
  };

  const handleResetColors = () => {
    setDraft({ ...defaultColors });
    resetColors();
    setActivePreset(null);
    toast.success("Theme reset to default");
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2MB'); return; }
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setLogoPreview(result);
      setCompanyForm((p) => ({ ...p, logo: result }));
      setCompanyDirty(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCompany = async () => {
    if (!companyForm.companyName.trim()) { toast.error('Company name is required'); return; }
    try {
      setCompanySaving(true);
      await companyService.updateMyCompany(companyForm);
      toast.success('Company profile saved');
      setCompanyDirty(false);
    } catch {
      toast.error('Failed to save company profile');
    } finally {
      setCompanySaving(false);
    }
  };

  // Super Admin Logo Handlers
  const handleAdminLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2MB'); return; }
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAdminLogoPreview(result);
      setSettings((p) => ({ ...p, superadmin_logo: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAdminLogo = () => {
    setAdminLogoPreview('');
    setSettings((p) => ({ ...p, superadmin_logo: '' }));
  };

  const handleSaveAdminLogo = async () => {
    try {
      setAdminLogoSaving(true);
      await settingsService.updateSettings({ superadmin_logo: settings.superadmin_logo });
      toast.success('Admin logo saved');
    } catch {
      toast.error('Failed to save admin logo');
    } finally {
      setAdminLogoSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen">
      <TopBar title="System setting" />
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    </div>
  );

  const emailOn = settings.email_notifications_enabled === "true";
  const waOn = settings.whatsapp_notifications_enabled === "true";
  const otpOn = settings.mobile_otp_login_enabled === "true";

  // Build tab list based on role — Notifications hidden (feature not active)
  const tabs: { id: TabId; label: string; icon: React.ReactNode; hidden?: boolean }[] = [
    {
      id: 'admin' as TabId,
      label: 'Admin Logo',
      icon: <Building2 size={18} />,
      hidden: !isSuperAdmin,
    },
    {
      id: 'notifications' as TabId,
      label: 'Notifications',
      icon: <Bell size={18} />,
      hidden: true,  // Notifications feature not active — hidden for all roles
    },
    {
      id: 'company' as TabId,
      label: 'Company',
      icon: <Building2 size={18} />,
      hidden: !isClient,
    },
    {
      id: 'appearance' as TabId,
      label: 'Appearance',
      icon: <Palette size={18} />,
    },
  ].filter((t) => !t.hidden);

  return (
    <div className="min-h-screen bg-background">
      <TopBar title="System setting" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* ── Page Header ── */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {isStaff ? 'Customize your app appearance and theme.' : 'Manage notifications, company profile, and appearance.'}
          </p>
        </div>

        {/* ── Two-column layout ── */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── Left: Vertical Tab Nav ── */}
          <nav className="w-full lg:w-56 flex-shrink-0">
            <div className="bg-card border border-border rounded-2xl p-2 flex flex-row lg:flex-col gap-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left ${isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      }`}
                  >
                    <span className={isActive ? 'text-white' : 'text-muted-foreground'}>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* ── Right: Content Panel ── */}
          <div className="flex-1 min-w-0">

            {/* ══════════════════════════════════════════
                ADMIN LOGO TAB (Super Admin only)
            ══════════════════════════════════════════ */}
            {activeTab === 'admin' && isSuperAdmin && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Admin Logo</h2>
                  <p className="text-sm text-muted-foreground mt-1">This logo appears in the left sidebar when you login. It's your organization's branding.</p>
                </div>

                {/* Logo upload area */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Organization Logo</p>
                  <div className="flex flex-col sm:flex-row items-start gap-6">
                    {/* Logo Preview Box */}
                    <div className="w-36 h-36 rounded-2xl border-2 border-dashed border-border bg-muted/20 flex items-center justify-center overflow-hidden flex-shrink-0 transition-colors hover:border-primary/50">
                      {adminLogoPreview ? (
                        <img src={adminLogoPreview} alt="Admin Logo" className="w-full h-full object-contain p-2" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
                          <Building2 size={36} />
                          <span className="text-xs">No logo</span>
                        </div>
                      )}
                    </div>
                    {/* Upload controls */}
                    <div className="flex flex-col gap-3 justify-center">
                      <p className="text-sm font-medium text-foreground">Upload your organization logo</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        PNG or JPG format, max 2MB.<br />Recommended size: 200×200px (square).
                      </p>
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted transition-colors text-sm font-medium text-foreground w-fit">
                        <Upload size={15} />
                        Upload Logo
                        <input type="file" accept="image/*" onChange={handleAdminLogoChange} className="hidden" />
                      </label>
                      {adminLogoPreview && (
                        <button
                          onClick={handleRemoveAdminLogo}
                          className="inline-flex items-center gap-1.5 text-xs text-destructive hover:underline w-fit"
                        >
                          <XIcon size={12} /> Remove logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info callout */}
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Shield size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-blue-900 dark:text-blue-100">Where your logo appears</p>
                      <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                        Your admin logo displays in the top-left corner of the left sidebar when you login. It appears as a 40x40px icon when the sidebar is collapsed, and with the icon when expanded. This helps you brand your admin interface.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Save button */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveAdminLogo}
                    disabled={adminLogoSaving}
                    className="btn-primary flex items-center gap-2 px-8 disabled:opacity-50"
                  >
                    {adminLogoSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {adminLogoSaving ? "Saving..." : "Save Admin Logo"}
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════
                NOTIFICATIONS TAB
            ══════════════════════════════════════════ */}
            {activeTab === 'notifications' && !isStaff && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Notifications</h2>
                  <p className="text-sm text-muted-foreground mt-1">Control how and when your customers receive updates.</p>
                </div>

                {/* Email + WhatsApp cards side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Email card */}
                  <div className={`rounded-2xl border-2 overflow-hidden transition-all duration-300 relative ${emailOn ? 'border-blue-300 dark:border-blue-700 shadow-md shadow-blue-100 dark:shadow-blue-900/20' : 'border-border'}`}>
                    {/* Coming Soon Badge */}
                    <div className="absolute top-3 right-3 z-10">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md">
                        <Zap size={12} />
                        Coming Soon
                      </span>
                    </div>
                    <div className="p-5 bg-card opacity-60 pointer-events-none">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-4">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${emailOn ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-muted'}`}>
                            <Mail size={20} className={emailOn ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'} />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm">Email Notifications</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                              Send quotation updates via email
                            </p>
                          </div>
                        </div>
                        <Toggle enabled={false} onToggle={() => { }} color="bg-blue-500" />
                      </div>
                      <div className={`mt-4 pt-4 border-t border-border flex items-center gap-2 text-xs text-muted-foreground`}>
                        <Bell size={12} />
                        <span>Feature under development</span>
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp card */}
                  <div className={`rounded-2xl border-2 overflow-hidden transition-all duration-300 relative ${waOn ? 'border-green-300 dark:border-green-700 shadow-md shadow-green-100 dark:shadow-green-900/20' : 'border-border'}`}>
                    {/* Coming Soon Badge */}
                    <div className="absolute top-3 right-3 z-10">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md">
                        <Zap size={12} />
                        Coming Soon
                      </span>
                    </div>
                    <div className="p-5 bg-card opacity-60 pointer-events-none">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-4">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${waOn ? 'bg-green-100 dark:bg-green-900/40' : 'bg-muted'}`}>
                            <MessageCircle size={20} className={waOn ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'} />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm">WhatsApp Notifications</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                              Send instant updates via WhatsApp
                            </p>
                          </div>
                        </div>
                        <Toggle enabled={false} onToggle={() => { }} color="bg-green-500" />
                      </div>
                      <div className={`mt-4 pt-4 border-t border-border flex items-center gap-2 text-xs text-muted-foreground`}>
                        <Zap size={12} />
                        <span>Feature under development</span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile OTP card */}
                  <div className={`rounded-2xl border-2 overflow-hidden transition-all duration-300 relative ${otpOn ? 'border-sky-300 dark:border-sky-700 shadow-md shadow-sky-100 dark:shadow-sky-900/20' : 'border-border'}`}>
                    <div className={`p-5 bg-card ${!otpOn ? 'opacity-60 pointer-events-none' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-4">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${otpOn ? 'bg-sky-100 dark:bg-sky-900/40' : 'bg-muted'}`}>
                            <Shield size={20} className={otpOn ? 'text-sky-600 dark:text-sky-400' : 'text-muted-foreground'} />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm">Mobile OTP Login</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                              Enable or disable login with mobile OTP from the public login page.
                            </p>
                          </div>
                        </div>
                        <Toggle enabled={otpOn} onToggle={() => toggle("mobile_otp_login_enabled")} color="bg-sky-500" />
                      </div>
                      <div className={`mt-4 pt-4 border-t border-border flex items-center gap-2 text-xs text-muted-foreground`}>
                        <Shield size={12} />
                        <span>When disabled, users must use standard email/password login.</span>
                      </div>
                    </div>
                    {!otpOn && (
                      <div className="absolute inset-0 bg-black/5 rounded-2xl flex items-center justify-center pointer-events-none">
                        <span className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-lg">Disabled</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info message about upcoming features */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <Bell size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm mb-1">Notification Features Coming Soon!</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        We're working on Email and WhatsApp notification features. These will allow you to automatically send quotation updates,
                        invoices, and reminders to your customers. Stay tuned for updates!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2 px-8 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? "Saving..." : "Save Notification Settings"}
                  </button>
                </div>

                {/* WhatsApp API fields - Hidden since feature is coming soon */}
                {false && waOn && (
                  <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <MessageCircle size={14} className="text-green-600 dark:text-green-400" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">WhatsApp API Configuration</p>
                    </div>
                    <p className="text-xs text-muted-foreground -mt-1">Requires a Meta WhatsApp Business API account.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">API URL</label>
                        <input
                          type="text"
                          value={settings.whatsapp_api_url}
                          onChange={(e) => change("whatsapp_api_url", e.target.value)}
                          placeholder="https://graph.facebook.com/v18.0/..."
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Phone Number ID</label>
                        <input
                          type="text"
                          value={settings.whatsapp_phone_number_id}
                          onChange={(e) => change("whatsapp_phone_number_id", e.target.value)}
                          placeholder="Your WhatsApp Business phone number ID"
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">API Token</label>
                        <div className="relative">
                          <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="password"
                            value={settings.whatsapp_api_token}
                            onChange={(e) => change("whatsapp_api_token", e.target.value)}
                            placeholder="Bearer token from Meta Developer Console"
                            className="input-field text-sm pl-9"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Save button - Hidden since features are coming soon */}
                {false && (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSaveSettings}
                      disabled={saving}
                      className="btn-primary flex items-center gap-2 px-8 disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      {saving ? "Saving..." : "Save Settings"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════
                COMPANY TAB
            ══════════════════════════════════════════ */}
            {activeTab === 'company' && isClient && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Company Profile</h2>
                  <p className="text-sm text-muted-foreground mt-1">Your company details appear on all quotations and invoices.</p>
                </div>

                {/* Logo upload area */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Company Logo</p>
                  <div className="flex flex-col sm:flex-row items-start gap-6">
                    {/* Dashed upload box */}
                    <div className="w-36 h-36 rounded-2xl border-2 border-dashed border-border bg-muted/20 flex items-center justify-center overflow-hidden flex-shrink-0 transition-colors hover:border-primary/50">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Company Logo" className="w-full h-full object-contain" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
                          <Building2 size={36} />
                          <span className="text-xs">No logo</span>
                        </div>
                      )}
                    </div>
                    {/* Upload controls */}
                    <div className="flex flex-col gap-3 justify-center">
                      <p className="text-sm font-medium text-foreground">Upload your logo</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        PNG or JPG format, max 2MB.<br />Recommended size: 200×200px.
                      </p>
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted transition-colors text-sm font-medium text-foreground w-fit">
                        <Upload size={15} />
                        Upload Logo
                        <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                      </label>
                      {logoPreview && (
                        <button
                          onClick={() => { setLogoPreview(''); setCompanyForm((p) => ({ ...p, logo: '' })); setCompanyDirty(true); }}
                          className="inline-flex items-center gap-1.5 text-xs text-destructive hover:underline w-fit"
                        >
                          <XIcon size={12} /> Remove logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form fields */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-5">Business Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Company Name
                        <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          <Lock size={10} /> Managed by Admin
                        </span>
                      </label>
                      {/* Company name is always read-only for clients — only Super Admin can change it */}
                      <div className="input-field bg-muted/40 text-foreground flex items-center gap-2 cursor-not-allowed select-none">
                        <Lock size={14} className="text-muted-foreground flex-shrink-0" />
                        <span className="font-semibold">{companyForm.companyName || '—'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        To change your company name, contact support with your License ID.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Contact Number</label>
                      <input
                        type="tel"
                        value={companyForm.phone}
                        onChange={(e) => { setCompanyForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })); setCompanyDirty(true); }}
                        className="input-field"
                        placeholder="10-digit mobile number"
                        maxLength={10}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                      <input
                        type="email"
                        value={companyForm.email}
                        onChange={(e) => { setCompanyForm((p) => ({ ...p, email: e.target.value })); setCompanyDirty(true); }}
                        className="input-field"
                        placeholder="company@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">State</label>
                      <input
                        type="text"
                        value={companyForm.state}
                        onChange={(e) => { setCompanyForm((p) => ({ ...p, state: e.target.value })); setCompanyDirty(true); }}
                        className="input-field"
                        placeholder="e.g. Maharashtra"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">City</label>
                      <input
                        type="text"
                        value={companyForm.city}
                        onChange={(e) => { setCompanyForm((p) => ({ ...p, city: e.target.value })); setCompanyDirty(true); }}
                        className="input-field"
                        placeholder="e.g. Mumbai"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-foreground mb-1.5">Address</label>
                      <textarea
                        value={companyForm.address}
                        rows={2}
                        onChange={(e) => { setCompanyForm((p) => ({ ...p, address: e.target.value })); setCompanyDirty(true); }}
                        className="input-field resize-none"
                        placeholder="Full company address"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        GST Number
                        <span className="ml-2 text-xs font-normal text-muted-foreground">(optional · 15 chars)</span>
                      </label>
                      <input
                        type="text"
                        value={companyForm.gstNumber}
                        maxLength={15}
                        onChange={(e) => { setCompanyForm((p) => ({ ...p, gstNumber: e.target.value.toUpperCase() })); setCompanyDirty(true); }}
                        className="input-field font-mono"
                        placeholder="22AAAAA0000A1Z5"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Default Terms &amp; Conditions
                        <span className="ml-2 text-xs font-normal text-muted-foreground">Auto-filled on new quotations</span>
                      </label>
                      <textarea
                        value={companyForm.termsAndConditions}
                        rows={4}
                        onChange={(e) => { setCompanyForm((p) => ({ ...p, termsAndConditions: e.target.value })); setCompanyDirty(true); }}
                        className="input-field resize-none"
                        placeholder="Payment terms, delivery conditions, warranty, etc..."
                      />
                    </div>
                  </div>
                </div>

                {/* Bank & Payment Details Section */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 size={14} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bank & Payment Details</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Appears in quotation and invoice PDFs</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Bank Name</label>
                      <input
                        type="text"
                        value={companyForm.bankName}
                        onChange={(e) => { setCompanyForm((p) => ({ ...p, bankName: e.target.value })); setCompanyDirty(true); }}
                        className="input-field"
                        placeholder="e.g., State Bank of India"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Account Number</label>
                      <input
                        type="text"
                        value={companyForm.accountNumber}
                        onChange={(e) => { setCompanyForm((p) => ({ ...p, accountNumber: e.target.value })); setCompanyDirty(true); }}
                        className="input-field font-mono"
                        placeholder="e.g., 1234567890123456"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">IFSC Code</label>
                      <input
                        type="text"
                        value={companyForm.ifscCode}
                        onChange={(e) => { setCompanyForm((p) => ({ ...p, ifscCode: e.target.value.toUpperCase() })); setCompanyDirty(true); }}
                        className="input-field font-mono"
                        placeholder="e.g., SBIN0001234"
                        maxLength={11}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Branch Name</label>
                      <input
                        type="text"
                        value={companyForm.branchName}
                        onChange={(e) => { setCompanyForm((p) => ({ ...p, branchName: e.target.value })); setCompanyDirty(true); }}
                        className="input-field"
                        placeholder="e.g., Main Branch"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        UPI ID
                        <span className="ml-2 text-xs font-normal text-muted-foreground">For QR code generation in quotations</span>
                      </label>
                      <input
                        type="text"
                        value={companyForm.upiId}
                        onChange={(e) => { setCompanyForm((p) => ({ ...p, upiId: e.target.value })); setCompanyDirty(true); }}
                        className="input-field font-mono"
                        placeholder="e.g., company@paytm or 9876543210@ybl"
                      />
                      {companyForm.upiId && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                          <span className="text-base">💡</span>
                          This will generate a payment QR code in quotation PDFs
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* PDF Theme Section — Feature 1 */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText size={14} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">PDF Theme</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Choose a color theme for your quotation & invoice PDFs</p>
                    </div>
                  </div>

                  {/* Theme grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                    {PDF_THEMES.map((t) => (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => { setCompanyForm((p) => ({ ...p, pdfThemeName: t.name, pdfAccentColor: '' })); setCompanyDirty(true); }}
                        className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 text-left ${
                          companyForm.pdfThemeName === t.name && !companyForm.pdfAccentColor
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:border-primary/40 bg-background'
                        }`}
                      >
                        <div className="flex gap-1 flex-shrink-0">
                          <div className="w-5 h-5 rounded-full shadow border border-white/30" style={{ backgroundColor: t.primaryColor }} />
                          <div className="w-5 h-5 rounded-full shadow border border-white/30" style={{ backgroundColor: t.lightBg, border: '1px solid #d1d5db' }} />
                        </div>
                        <span className="text-xs font-medium text-foreground leading-tight">{t.emoji} {t.label}</span>
                        {companyForm.pdfThemeName === t.name && !companyForm.pdfAccentColor && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                            <Check size={9} className="text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Custom color override */}
                  <div className="border-t border-border pt-4">
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Custom Accent Color
                      <span className="ml-2 text-xs font-normal text-muted-foreground">Overrides the theme color</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={companyForm.pdfAccentColor}
                        placeholder="#1e3a8a"
                        maxLength={7}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (/^#?[0-9a-fA-F]{0,6}$/.test(val)) {
                            setCompanyForm((p) => ({ ...p, pdfAccentColor: val }));
                            setCompanyDirty(true);
                          }
                        }}
                        className="input-field w-32 font-mono text-sm"
                      />
                      <label className="cursor-pointer">
                        <div
                          className="w-9 h-9 rounded-xl border-2 border-border shadow-sm hover:scale-110 transition-transform"
                          style={{ backgroundColor: companyForm.pdfAccentColor || '#1e3a8a' }}
                        />
                        <input
                          type="color"
                          value={companyForm.pdfAccentColor || '#1e3a8a'}
                          onChange={(e) => { setCompanyForm((p) => ({ ...p, pdfAccentColor: e.target.value })); setCompanyDirty(true); }}
                          className="sr-only"
                        />
                      </label>
                      {companyForm.pdfAccentColor && (
                        <button
                          type="button"
                          onClick={() => { setCompanyForm((p) => ({ ...p, pdfAccentColor: '' })); setCompanyDirty(true); }}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Advanced Options (CBM) — V30: single toggle replaces old 3 toggles */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  {/* Header with toggle */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-600 dark:text-orange-400"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/></svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Advanced Options (CBM)</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Enable CBM on products, USD pricing & export cost analysis panel</p>
                      </div>
                    </div>
                    <Toggle
                      enabled={companyForm.cbmAdvancedMode ?? false}
                      onToggle={() => { setCompanyForm((p) => ({ ...p, cbmAdvancedMode: !p.cbmAdvancedMode })); setCompanyDirty(true); }}
                      color="bg-orange-500"
                    />
                  </div>

                  {/* Expanded settings — only when enabled */}
                  {companyForm.cbmAdvancedMode && (
                    <div className="mt-5 space-y-4 border-t border-border pt-4">
                      <p className="text-xs text-muted-foreground">
                        When enabled: CBM field appears on products · USD column in export PDF · Cost analysis panel shows in New Quotation
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* USD Exchange Rate */}
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">USD Exchange Rate (₹ per $1)</label>
                          <input type="number" value={companyForm.usdExchangeRate ?? 83} min="1" step="0.01"
                            onChange={(e) => { setCompanyForm((p) => ({ ...p, usdExchangeRate: parseFloat(e.target.value) || 83 })); setCompanyDirty(true); }}
                            className="input-field" placeholder="e.g. 83" />
                          <p className="text-xs text-muted-foreground mt-1">₹ per $1 — used to convert USD prices</p>
                        </div>

                        {/* Rate per CBM */}
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">Rate per CBM (USD / m³)</label>
                          <input type="number" value={companyForm.ratePerCbm ?? 0} min="0" step="0.01"
                            onChange={(e) => { setCompanyForm((p) => ({ ...p, ratePerCbm: parseFloat(e.target.value) || 0 })); setCompanyDirty(true); }}
                            className="input-field" placeholder="e.g. 25" />
                          <p className="text-xs text-muted-foreground mt-1">USD freight charged per cubic metre</p>
                        </div>

                        {/* Clearance per CBM */}
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">Clearance per CBM (₹ / m³)</label>
                          <input type="number" value={companyForm.clearancePerCbm ?? 1667} min="0" step="1"
                            onChange={(e) => { setCompanyForm((p) => ({ ...p, clearancePerCbm: parseFloat(e.target.value) || 1667 })); setCompanyDirty(true); }}
                            className="input-field" placeholder="e.g. 1667" />
                          <p className="text-xs text-muted-foreground mt-1">Customs clearance cost per m³ in INR</p>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground pt-1">
                        💡 Installation and Shipping charges are added per quotation via the <strong>Add Service</strong> section in New Quotation.
                      </p>
                    </div>
                  )}
                </div>

                {/* License ID Card — shown to client so they can reference it when contacting support */}
                {company?.licenseId && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Shield size={18} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-blue-900 dark:text-blue-100 mb-1">Your License ID</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-lg font-bold text-blue-800 dark:text-blue-200 tracking-wider bg-white dark:bg-blue-950/40 px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-700">
                            {company.licenseId}
                          </span>
                          <button
                            type="button"
                            onClick={() => { navigator.clipboard.writeText(company.licenseId!); toast.success('License ID copied!'); }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            Copy
                          </button>
                        </div>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-2 leading-relaxed">
                          This is your unique subscription identifier. Share it with support when requesting any changes to your registered company name.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Floating save button */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveCompany}
                    disabled={companySaving || !companyDirty}
                    className="btn-primary flex items-center gap-2 px-8 disabled:opacity-50"
                  >
                    {companySaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {companySaving ? "Saving..." : "Save Company Profile"}
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════
                APPEARANCE TAB
            ══════════════════════════════════════════ */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Appearance</h2>
                    <p className="text-sm text-muted-foreground mt-1">Customize your app's color theme — changes apply instantly.</p>
                  </div>
                  <button
                    onClick={handleResetColors}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 bg-card px-3 py-2 rounded-xl transition-colors flex-shrink-0"
                  >
                    <RotateCcw size={13} /> Reset to default
                  </button>
                </div>

                {/* Preset grid */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Quick Presets</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {presets.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => applyPreset(preset)}
                        className={`relative group flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 hover:scale-105 ${activePreset === preset.name
                            ? 'border-primary shadow-md bg-primary/5'
                            : 'border-border hover:border-primary/40 bg-background'
                          }`}
                      >
                        {/* Two color circles */}
                        <div className="flex gap-1.5">
                          <div
                            className="w-6 h-6 rounded-full shadow border-2 border-white/30"
                            style={{ backgroundColor: preset.colors.primary as string }}
                          />
                          <div
                            className="w-6 h-6 rounded-full shadow border-2 border-white/30"
                            style={{ backgroundColor: preset.colors.sidebarBg as string }}
                          />
                        </div>
                        <span className="text-xs font-medium text-foreground text-center leading-tight">
                          {preset.emoji} {preset.name}
                        </span>
                        {activePreset === preset.name && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow">
                            <Check size={11} className="text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom colors — accordion-style groups */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custom Colors</p>
                  </div>
                  <div className="divide-y divide-border">
                    {["Brand", "Layout", "Table", "Text"].map((group) => (
                      <div key={group}>
                        {/* Group header */}
                        <div className={`px-6 py-2.5 flex items-center gap-2 ${groupColors[group]}`}>
                          <span className="text-xs font-bold uppercase tracking-widest">{group}</span>
                        </div>
                        {/* Color rows */}
                        {colorFields.filter((f) => f.group === group).map((field, idx, arr) => (
                          <div
                            key={field.key}
                            className={`flex items-center justify-between px-6 py-3.5 hover:bg-muted/30 transition-colors ${idx < arr.length - 1 ? 'border-b border-border/50' : ''}`}
                          >
                            <div className="flex-1 min-w-0 pr-4">
                              <p className="text-sm font-medium text-foreground">{field.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{field.desc}</p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {/* Hex input */}
                              <input
                                type="text"
                                value={draft[field.key]}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (/^#[0-9a-fA-F]{0,6}$/.test(val)) handleColorChange(field.key, val);
                                }}
                                className="w-24 text-xs font-mono input-field py-1.5 text-center"
                                maxLength={7}
                              />
                              {/* Color swatch picker */}
                              <label className="cursor-pointer">
                                <div
                                  className="w-9 h-9 rounded-xl border-2 border-border shadow-sm hover:scale-110 transition-transform"
                                  style={{ backgroundColor: draft[field.key] }}
                                />
                                <input
                                  type="color"
                                  value={draft[field.key]}
                                  onChange={(e) => handleColorChange(field.key, e.target.value)}
                                  className="sr-only"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live preview */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-6 py-3.5 border-b border-border bg-muted/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live Preview</p>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex gap-2 flex-wrap">
                      <button className="btn-primary text-xs px-4 py-2">Primary Button</button>
                      <button className="btn-secondary text-xs px-4 py-2">Secondary</button>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">Active</span>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">Pending</span>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">Rejected</span>
                    </div>
                    <div className="p-4 rounded-xl border border-border bg-muted/20">
                      <p className="text-sm font-semibold text-foreground">Sample Card Title</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        This is how muted text looks with your current theme. The card background and border colors are also reflected here.
                      </p>
                    </div>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <div className="px-4 py-2.5 text-xs font-semibold text-foreground" style={{ backgroundColor: draft.tableHeader }}>
                        Table Header Row
                      </div>
                      <div className="px-4 py-2.5 text-xs text-muted-foreground border-t border-border">
                        Sample row 1
                      </div>
                      <div className="px-4 py-2.5 text-xs text-muted-foreground border-t border-border" style={{ backgroundColor: draft.tableRowHover }}>
                        Sample row 2 (hover)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>{/* end right panel */}
        </div>{/* end two-column */}
      </div>{/* end max-w container */}
    </div>
  );
};

export default MasterSettings;
