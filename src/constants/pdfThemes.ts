// PDF Theme definitions — company-level branding for quotation & invoice PDFs

export interface PdfTheme {
  name: string;
  label: string;
  emoji: string;
  primaryColor: string;   // header bg, borders, footer bg
  accentColor: string;    // totals row, amount text, links
  lightBg: string;        // alternating row bg, subtotal bg
}

export const PDF_THEMES: PdfTheme[] = [
  {
    name: 'navy',
    label: 'Navy Blue',
    emoji: '🔵',
    primaryColor: '#1e3a8a',
    accentColor: '#1e3a8a',
    lightBg: '#f9fafb',
  },
  {
    name: 'forest',
    label: 'Forest Green',
    emoji: '🌿',
    primaryColor: '#14532d',
    accentColor: '#16a34a',
    lightBg: '#f0fdf4',
  },
  {
    name: 'charcoal',
    label: 'Charcoal',
    emoji: '🖤',
    primaryColor: '#1f2937',
    accentColor: '#374151',
    lightBg: '#f9fafb',
  },
  {
    name: 'purple',
    label: 'Royal Purple',
    emoji: '💜',
    primaryColor: '#4c1d95',
    accentColor: '#7c3aed',
    lightBg: '#faf5ff',
  },
  {
    name: 'burgundy',
    label: 'Burgundy',
    emoji: '🍷',
    primaryColor: '#7f1d1d',
    accentColor: '#b91c1c',
    lightBg: '#fff5f5',
  },
  {
    name: 'teal',
    label: 'Teal',
    emoji: '🩵',
    primaryColor: '#134e4a',
    accentColor: '#0d9488',
    lightBg: '#f0fdfa',
  },
];

export const DEFAULT_THEME = PDF_THEMES[0];

/** Resolve a theme by name, falling back to default */
export function getPdfTheme(themeName?: string, customAccentColor?: string): PdfTheme {
  const base = PDF_THEMES.find((t) => t.name === themeName) ?? DEFAULT_THEME;
  // Allow a custom accent color override while keeping the theme's primary
  if (customAccentColor && /^#[0-9a-fA-F]{6}$/.test(customAccentColor)) {
    return { ...base, accentColor: customAccentColor, primaryColor: customAccentColor };
  }
  return base;
}
