import React, { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Mail, MessageCircle, Save, Loader2 } from "lucide-react";
import { settingsService, AppSettings } from "@/services/settingsService";
import { toast } from "sonner";

const defaultSettings: AppSettings = {
  email_notifications_enabled: "true",
  whatsapp_notifications_enabled: "false",
  whatsapp_api_url: "",
  whatsapp_api_token: "",
  whatsapp_phone_number_id: "",
};

interface ToggleProps {
  enabled: boolean;
  onToggle: () => void;
  color?: string;
}

const Toggle: React.FC<ToggleProps> = ({ enabled, onToggle, color = "bg-primary" }) => (
  <button
    onClick={onToggle}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? color : "bg-muted-foreground/30"}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
  </button>
);

const MasterSettings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsService
      .getSettings()
      .then(setSettings)
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: keyof AppSettings) => {
    setSettings((prev) => ({ ...prev, [key]: prev[key] === "true" ? "false" : "true" }));
  };

  const change = (key: keyof AppSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.updateSettings(settings);
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <TopBar title="Master Settings" />
        <div className="p-6 flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </div>
    );
  }

  const emailOn = settings.email_notifications_enabled === "true";
  const waOn = settings.whatsapp_notifications_enabled === "true";

  return (
    <div className="min-h-screen">
      <TopBar title="Master Settings" />
      <div className="p-6 space-y-6 max-w-2xl">
        <div className="bg-card rounded-xl shadow-md border border-border p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Mail size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Email Notifications</h3>
              <p className="text-sm text-muted-foreground">Send email alerts for quotation status changes</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Email Notifications</p>
              <p className="text-xs text-muted-foreground mt-0.5">When off, no emails will be sent for any quotation events</p>
            </div>
            <Toggle enabled={emailOn} onToggle={() => toggle("email_notifications_enabled")} />
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-md border border-border p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <MessageCircle size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">WhatsApp Notifications</h3>
              <p className="text-sm text-muted-foreground">Send WhatsApp messages via WhatsApp Business API</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Enable WhatsApp Notifications</p>
                <p className="text-xs text-muted-foreground mt-0.5">Requires WhatsApp Business API credentials below</p>
              </div>
              <Toggle enabled={waOn} onToggle={() => toggle("whatsapp_notifications_enabled")} color="bg-green-500" />
            </div>
            {waOn && (
              <div className="space-y-3 pt-3 border-t border-border">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">API URL</label>
                  <input type="text" value={settings.whatsapp_api_url} onChange={(e) => change("whatsapp_api_url", e.target.value)} placeholder="https://graph.facebook.com/v18.0/..." className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Phone Number ID</label>
                  <input type="text" value={settings.whatsapp_phone_number_id} onChange={(e) => change("whatsapp_phone_number_id", e.target.value)} placeholder="Your WhatsApp Business phone number ID" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">API Token</label>
                  <input type="password" value={settings.whatsapp_api_token} onChange={(e) => change("whatsapp_api_token", e.target.value)} placeholder="Bearer token from Meta Developer Console" className="input-field" />
                </div>
              </div>
            )}
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 px-6 disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
};

export default MasterSettings;
