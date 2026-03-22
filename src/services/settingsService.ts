import api from './api';

export interface AppSettings {
  email_notifications_enabled: string;
  whatsapp_notifications_enabled: string;
  whatsapp_api_url: string;
  whatsapp_api_token: string;
  whatsapp_phone_number_id: string;
}

export const settingsService = {
  async getSettings(): Promise<AppSettings> {
    const response = await api.get('/api/settings');
    return response.data;
  },

  async updateSettings(settings: Partial<AppSettings>): Promise<void> {
    await api.put('/api/settings', settings);
  },
};
