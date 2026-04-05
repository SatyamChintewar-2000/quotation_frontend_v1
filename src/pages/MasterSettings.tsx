import React, { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Mail, MessageCircle, Save, Loader2, Bell, Shield, Zap, Palette, RotateCcw, Check, Building2, Upload, X as XIcon } from "lucide-react";
import { settingsService, AppSettings } from "@/services/settingsService";
import { useTheme, ThemeColors, defaultColors } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { companyService, Company } from "@/services/companyService";
import { toast } from "sonner";

const defaultSettings: AppSettings = {
  email_notifications_enabled: "true",
  whatsapp_notifications_enabled: "false",
  whatsapp_api_url: "",
  whatsapp_api_token: "",
  whatsapp_phone_number_id: "",
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
  { key: "primary",       label: "Primary / Accent",    desc: "Buttons, links, highlights",    group: "Brand" },
  { key: "buttonPrimary", label: "Button Color",         desc: "Primary action buttons",        group: "Brand" },
  { key: "buttonText",    label: "Button Text",          desc: "Text inside buttons",           group: "Brand" },
  { key: "sidebarBg",     label: "Sidebar Background",   desc: "Left navigation panel",         group: "Layout" },
  { key: "sidebarText",   label: "Sidebar Text",         desc: "Icons and text in sidebar",     group: "Layout" },
  { key: "background",    label: "Page Background",      desc: "Main content area",             group: "Layout" },
  { key: "cardBg",        label: "Card Background",      desc: "Cards, modals, panels",         group: "Layout" },
  { key: "tableHeader",   label: "Table Header",         desc: "Header row background",         group: "Table" },
  { key: "tableRowHover", label: "Row Hover",            desc: "Row highlight on hover",        group: "Table" },
  { key: "textPrimary",   label: "Primary Text",         desc: "Main body text",                group: "Text" },
  { key: "textMuted",     label: "Muted Text",           desc: "Labels, hints, secondary",      group: "Text" },
  { key: "borderColor",   label: "Border Color",         desc: "Inputs, dividers, cards",       group: "Text" },
];

const groupColors: Record<string, string> = {
  Brand:  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Layout: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Table:  "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Text:   "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
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
  });
  const [logoPreview, setLogoPreview] = useState('');
  const [companySaving, setCompanySaving] = useState(false);
  const [companyDirty, setCompanyDirty] = useState(false);

  useEffect(() => {
    const loads: Promise<any>[] = [
      settingsService.getSettings().then(setSettings).catch(() => toast.error("Failed to load settings")),
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
          });
          setLogoPreview(c.logo || '');
        }).catch(() => {})
      );
    }
    Promise.all(loads).finally(() => setLoading(false));
  }, [isClient]);

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

  if (loading) return (
    <div className="min-h-screen">
      <TopBar title="Master Settings" />
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    </div>
  );

  const emailOn = settings.email_notifications_enabled === "true";
  const waOn = settings.whatsapp_notifications_enabled === "true";

  return (
    <div className="min-h-screen">
      <TopBar title="Master Settings" />
      <div className="p-6 max-w-4xl space-y-8">

        <div>
          <h2 className="text-2xl font-bold text-foreground">Master Settings</h2>
          <p className="text-muted-foreground mt-1">{isStaff ? 'Customize your app appearance' : 'Configure notifications, integrations and appearance'}</p>
        </div>

        {/* ── Company Information (CLIENT only) ── */}
        {isClient && (
          <div className="rounded-2xl border-2 border-border overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between bg-gradient-to-r from-indigo-500 to-blue-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Building2 size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Company Information</h3>
                  <p className="text-xs text-indigo-100 mt-0.5">Your company profile used on quotations and invoices</p>
                </div>
              </div>
            </div>

            <div className="bg-card p-6 space-y-5">
              {/* Logo upload */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Company Logo</p>
                <div className="flex items-center gap-5">
                  <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-border bg-muted/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <Building2 size={32} className="text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium text-foreground">
                      <Upload size={15} /> Upload Logo
                      <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                    </label>
                    {logoPreview && (
                      <button onClick={() => { setLogoPreview(''); setCompanyForm((p) => ({ ...p, logo: '' })); setCompanyDirty(true); }}
                        className="flex items-center gap-1.5 text-xs text-destructive hover:underline">
                        <XIcon size={12} /> Remove logo
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">PNG, JPG · Max 2MB · Recommended 200×200px</p>
                  </div>
                </div>
              </div>

              {/* Fields grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1.5">Company Name *</label>
                  <input type="text" value={companyForm.companyName}
                    onChange={(e) => { setCompanyForm((p) => ({ ...p, companyName: e.target.value })); setCompanyDirty(true); }}
                    className="input-field" placeholder="Your company name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Contact Number</label>
                  <input type="tel" value={companyForm.phone}
                    onChange={(e) => { setCompanyForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })); setCompanyDirty(true); }}
                    className="input-field" placeholder="10-digit mobile number" maxLength={10} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                  <input type="email" value={companyForm.email}
                    onChange={(e) => { setCompanyForm((p) => ({ ...p, email: e.target.value })); setCompanyDirty(true); }}
                    className="input-field" placeholder="company@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">State</label>
                  <input type="text" value={companyForm.state}
                    onChange={(e) => { setCompanyForm((p) => ({ ...p, state: e.target.value })); setCompanyDirty(true); }}
                    className="input-field" placeholder="e.g. Maharashtra" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">City</label>
                  <input type="text" value={companyForm.city}
                    onChange={(e) => { setCompanyForm((p) => ({ ...p, city: e.target.value })); setCompanyDirty(true); }}
                    className="input-field" placeholder="e.g. Mumbai" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1.5">Address</label>
                  <textarea value={companyForm.address} rows={2}
                    onChange={(e) => { setCompanyForm((p) => ({ ...p, address: e.target.value })); setCompanyDirty(true); }}
                    className="input-field resize-none" placeholder="Full company address" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    GST Number
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(optional — 15 chars)</span>
                  </label>
                  <input type="text" value={companyForm.gstNumber} maxLength={15}
                    onChange={(e) => { setCompanyForm((p) => ({ ...p, gstNumber: e.target.value.toUpperCase() })); setCompanyDirty(true); }}
                    className="input-field font-mono" placeholder="22AAAAA0000A1Z5" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Default Terms & Conditions
                    <span className="ml-2 text-xs font-normal text-muted-foreground">Auto-filled on new quotations</span>
                  </label>
                  <textarea value={companyForm.termsAndConditions} rows={4}
                    onChange={(e) => { setCompanyForm((p) => ({ ...p, termsAndConditions: e.target.value })); setCompanyDirty(true); }}
                    className="input-field resize-none" placeholder="Payment terms, delivery conditions, warranty, etc..." />
                </div>
              </div>

              <button onClick={handleSaveCompany} disabled={companySaving || !companyDirty}
                className="btn-primary flex items-center gap-2 px-8 disabled:opacity-50">
                {companySaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {companySaving ? "Saving..." : "Save Company Profile"}
              </button>
            </div>
          </div>
        )}

        {/* ── Email ── */}
        {!isStaff && (<>
        <div className={`rounded-2xl border-2 overflow-hidden transition-all duration-300 ${emailOn ? "border-blue-200 dark:border-blue-800 shadow-lg shadow-blue-100 dark:shadow-blue-900/20" : "border-border"}`}>
          <div className={`px-6 py-4 flex items-center justify-between ${emailOn ? "bg-gradient-to-r from-blue-500 to-blue-600" : "bg-muted/50"}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${emailOn ? "bg-white/20" : "bg-muted"}`}>
                <Mail size={20} className={emailOn ? "text-white" : "text-muted-foreground"} />
              </div>
              <div>
                <h3 className={`font-semibold ${emailOn ? "text-white" : "text-foreground"}`}>Email Notifications</h3>
                <p className={`text-xs mt-0.5 ${emailOn ? "text-blue-100" : "text-muted-foreground"}`}>
                  {emailOn ? "Active — emails sent for quotation events" : "Inactive — no emails will be sent"}
                </p>
              </div>
            </div>
            <Toggle enabled={emailOn} onToggle={() => toggle("email_notifications_enabled")} color="bg-blue-400" />
          </div>
          <div className="px-6 py-5 bg-card">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                <Bell size={15} className="text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Quotation Status Alerts</p>
                <p className="text-xs text-muted-foreground mt-0.5">Customers receive emails when quotations are generated, approved, or rejected.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── WhatsApp ── */}
        <div className={`rounded-2xl border-2 overflow-hidden transition-all duration-300 ${waOn ? "border-green-200 dark:border-green-800 shadow-lg shadow-green-100 dark:shadow-green-900/20" : "border-border"}`}>
          <div className={`px-6 py-4 flex items-center justify-between ${waOn ? "bg-gradient-to-r from-green-500 to-emerald-600" : "bg-muted/50"}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${waOn ? "bg-white/20" : "bg-muted"}`}>
                <MessageCircle size={20} className={waOn ? "text-white" : "text-muted-foreground"} />
              </div>
              <div>
                <h3 className={`font-semibold ${waOn ? "text-white" : "text-foreground"}`}>WhatsApp Notifications</h3>
                <p className={`text-xs mt-0.5 ${waOn ? "text-green-100" : "text-muted-foreground"}`}>
                  {waOn ? "Active — WhatsApp messages will be sent" : "Inactive — configure API credentials to enable"}
                </p>
              </div>
            </div>
            <Toggle enabled={waOn} onToggle={() => toggle("whatsapp_notifications_enabled")} color="bg-green-400" />
          </div>
          <div className="px-6 py-5 bg-card space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                <Zap size={15} className="text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">WhatsApp Business API</p>
                <p className="text-xs text-muted-foreground mt-0.5">Requires a Meta WhatsApp Business API account.</p>
              </div>
            </div>
            {waOn && (
              <div className="space-y-3 pt-3 border-t border-border">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">API URL</label>
                  <input type="text" value={settings.whatsapp_api_url} onChange={(e) => change("whatsapp_api_url", e.target.value)} placeholder="https://graph.facebook.com/v18.0/..." className="input-field text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Phone Number ID</label>
                  <input type="text" value={settings.whatsapp_phone_number_id} onChange={(e) => change("whatsapp_phone_number_id", e.target.value)} placeholder="Your WhatsApp Business phone number ID" className="input-field text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">API Token</label>
                  <div className="relative">
                    <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="password" value={settings.whatsapp_api_token} onChange={(e) => change("whatsapp_api_token", e.target.value)} placeholder="Bearer token from Meta Developer Console" className="input-field text-sm pl-9" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <button onClick={handleSaveSettings} disabled={saving} className="btn-primary flex items-center gap-2 px-8 disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Saving..." : "Save Settings"}
        </button>
        </>)}
        <div className="rounded-2xl border-2 border-border overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Palette size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Color Theme</h3>
                <p className="text-xs text-purple-100 mt-0.5">Customize your app's look — changes apply instantly</p>
              </div>
            </div>
            <button onClick={handleResetColors} className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
              <RotateCcw size={12} /> Reset
            </button>
          </div>

          <div className="bg-card p-6 space-y-6">
            {/* Preset palettes */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Presets</p>
              <div className="grid grid-cols-4 gap-3">
                {presets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className={`relative group flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 hover:scale-105 ${activePreset === preset.name ? "border-primary shadow-md" : "border-border hover:border-primary/50"}`}
                  >
                    {/* Color swatch row */}
                    <div className="flex gap-1">
                      <div className="w-5 h-5 rounded-full shadow-sm border border-white/20" style={{ backgroundColor: preset.colors.primary as string }} />
                      <div className="w-5 h-5 rounded-full shadow-sm border border-white/20" style={{ backgroundColor: preset.colors.sidebarBg as string }} />
                    </div>
                    <span className="text-xs font-medium text-foreground text-center leading-tight">{preset.emoji} {preset.name}</span>
                    {activePreset === preset.name && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom color pickers */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Custom Colors</p>
              <div className="space-y-1">
                {["Brand", "Layout", "Table", "Text"].map((group) => (
                  <div key={group} className="rounded-xl overflow-hidden border border-border">
                    <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide ${groupColors[group]}`}>
                      {group}
                    </div>
                    {colorFields.filter((f) => f.group === group).map((field, idx, arr) => (
                      <div key={field.key} className={`flex items-center justify-between px-4 py-3 ${idx < arr.length - 1 ? "border-b border-border" : ""} hover:bg-muted/30 transition-colors`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{field.label}</p>
                          <p className="text-xs text-muted-foreground">{field.desc}</p>
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

            {/* Live mini preview */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live Preview</p>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <button className="btn-primary text-xs px-3 py-1.5">Primary Button</button>
                  <button className="btn-secondary text-xs px-3 py-1.5">Secondary</button>
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">Active</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">Pending</span>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <p className="text-sm font-medium text-foreground">Sample Card</p>
                  <p className="text-xs text-muted-foreground mt-0.5">This is how muted text looks with your theme.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MasterSettings;
