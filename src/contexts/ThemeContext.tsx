import React, { createContext, useContext, useEffect, useState } from 'react';

export interface ThemeColors {
  primary: string;
  background: string;
  sidebarBg: string;
  sidebarText: string;
  cardBg: string;
  tableHeader: string;
  tableRowHover: string;
  buttonPrimary: string;
  buttonText: string;
  textPrimary: string;
  textMuted: string;
  borderColor: string;
}

export const defaultColors: ThemeColors = {
  primary: '#2a9d8f',
  background: '#f8fafc',
  sidebarBg: '#0f172a',
  sidebarText: '#f8fafc',
  cardBg: '#ffffff',
  tableHeader: '#f1f5f9',
  tableRowHover: '#f8fafc',
  buttonPrimary: '#2a9d8f',
  buttonText: '#ffffff',
  textPrimary: '#0f172a',
  textMuted: '#64748b',
  borderColor: '#e2e8f0',
};

const STORAGE_KEY = 'quotation_theme_colors';

interface ThemeContextType {
  colors: ThemeColors;
  setColors: (colors: ThemeColors) => void;
  resetColors: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Convert hex to HSL string for CSS variables
function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyColors(colors: ThemeColors) {
  const root = document.documentElement;
  root.style.setProperty('--primary', hexToHsl(colors.primary));
  root.style.setProperty('--accent', hexToHsl(colors.primary));
  root.style.setProperty('--ring', hexToHsl(colors.primary));
  root.style.setProperty('--background', hexToHsl(colors.background));
  root.style.setProperty('--sidebar-bg', hexToHsl(colors.sidebarBg));
  root.style.setProperty('--sidebar-foreground', hexToHsl(colors.sidebarText));
  root.style.setProperty('--card', hexToHsl(colors.cardBg));
  root.style.setProperty('--card-foreground', hexToHsl(colors.textPrimary));
  root.style.setProperty('--muted', hexToHsl(colors.tableHeader));
  root.style.setProperty('--foreground', hexToHsl(colors.textPrimary));
  root.style.setProperty('--muted-foreground', hexToHsl(colors.textMuted));
  root.style.setProperty('--border', hexToHsl(colors.borderColor));
  root.style.setProperty('--input', hexToHsl(colors.borderColor));
  root.style.setProperty('--primary-foreground', hexToHsl(colors.buttonText));
  // Sidebar gradient uses the sidebar bg
  root.style.setProperty('--gradient-sidebar', `linear-gradient(180deg, ${colors.sidebarBg} 0%, ${colors.sidebarBg}cc 100%)`);
  root.style.setProperty('--gradient-primary', `linear-gradient(135deg, ${colors.primary} 0%, ${colors.buttonPrimary} 100%)`);
  root.style.setProperty('--shadow-glow', `0 0 20px ${colors.primary}4d`);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colors, setColorsState] = useState<ThemeColors>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaultColors, ...JSON.parse(saved) } : defaultColors;
    } catch {
      return defaultColors;
    }
  });

  // Apply on mount and whenever colors change
  useEffect(() => {
    applyColors(colors);
  }, [colors]);

  const setColors = (newColors: ThemeColors) => {
    setColorsState(newColors);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newColors));
  };

  const resetColors = () => {
    setColorsState(defaultColors);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <ThemeContext.Provider value={{ colors, setColors, resetColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
