import React, { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useTheme, ThemeColors, defaultColors } from '@/contexts/ThemeContext';
import { Palette, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';

interface ColorField {
  key: keyof ThemeColors;
  label: string;
  description: string;
}

const colorFields: ColorField[] = [
  { key: 'primary',       label: 'Primary / Accent Color',    description: 'Buttons, active links, highlights' },
  { key: 'background',    label: 'Page Background',           description: 'Main page background color' },
  { key: 'sidebarBg',     label: 'Sidebar Background',        description: 'Left navigation sidebar' },
  { key: 'sidebarText',   label: 'Sidebar Text',              description: 'Text and icons in sidebar' },
  { key: 'cardBg',        label: 'Card / Panel Background',   description: 'Cards, modals, table backgrounds' },
  { key: 'tableHeader',   label: 'Table Header Background',   description: 'Header row of all tables' },
  { key: 'tableRowHover', label: 'Table Row Hover',           description: 'Row highlight on mouse hover' },
  { key: 'buttonPrimary', label: 'Button Background',         description: 'Primary action button color' },
  { key: 'buttonText',    label: 'Button Text Color',         description: 'Text color inside primary buttons' },
  { key: 'textPrimary',   label: 'Primary Text',              description: 'Main body text color' },
  { key: 'textMuted',     label: 'Muted / Secondary Text',    description: 'Labels, hints, secondary text' },
  { key: 'borderColor',   label: 'Border Color',              description: 'Input borders, dividers, card borders' },
];

const ColorTheme: React.FC = () => {
  const { colors, setColors, resetColors } = useTheme();
  const [draft, setDraft] = useState<ThemeColors>({ ...colors });

  const handleChange = (key: keyof ThemeColors, value: string) => {
    const updated = { ...draft, [key]: value };
    setDraft(updated);
    // Apply live preview immediately
    setColors(updated);
  };

  const handleSave = () => {
    setColors(draft);
    toast.success('Theme saved successfully');
  };

  const handleReset = () => {
    setDraft({ ...defaultColors });
    resetColors();
    toast.success('Theme reset to default');
  };

  return (
    <div className="min-h-screen">
      <TopBar title="Color Theme" />

      <div className="p-6 space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Palette size={22} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Change Theme</h2>
              <p className="text-sm text-muted-foreground">
                Customize colors — changes apply instantly as you pick
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RotateCcw size={15} />
            Reset
          </button>
        </div>

        {/* Color Table */}
        <div className="bg-card rounded-xl shadow-md border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-6 py-3 text-left w-8">Sr.</th>
                <th className="px-6 py-3 text-left">Field Name</th>
                <th className="px-6 py-3 text-center w-28">Select Color</th>
                <th className="px-6 py-3 text-left w-32">Color Code</th>
              </tr>
            </thead>
            <tbody>
              {colorFields.map((field, idx) => (
                <tr key={field.key} className="table-row">
                  <td className="px-6 py-4 text-muted-foreground text-sm">{idx + 1}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-foreground text-sm">{field.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{field.description}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {/* Color swatch that opens native picker */}
                      <label className="cursor-pointer">
                        <div
                          className="w-9 h-9 rounded-lg border-2 border-border shadow-sm hover:scale-110 transition-transform"
                          style={{ backgroundColor: draft[field.key] }}
                        />
                        <input
                          type="color"
                          value={draft[field.key]}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      value={draft[field.key]}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                          handleChange(field.key, val);
                        }
                      }}
                      className="input-field py-1.5 text-sm font-mono w-28"
                      maxLength={7}
                      placeholder="#000000"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Save Button */}
        <div className="flex gap-3">
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            <Save size={16} />
            Save Theme
          </button>
          <button onClick={handleReset} className="btn-secondary flex items-center gap-2">
            <RotateCcw size={16} />
            Reset to Default
          </button>
        </div>

        {/* Live Preview */}
        <div className="bg-card rounded-xl shadow-md border border-border p-6 space-y-4">
          <h3 className="font-semibold text-foreground">Live Preview</h3>
          <div className="flex gap-3 flex-wrap">
            <button className="btn-primary text-sm">Primary Button</button>
            <button className="btn-secondary text-sm">Secondary Button</button>
            <span className="badge-success">Active</span>
            <span className="badge-warning">Pending</span>
          </div>
          <div className="p-4 rounded-lg border border-border bg-muted/30">
            <p className="text-foreground font-medium">Sample Card</p>
            <p className="text-muted-foreground text-sm mt-1">This is how muted text looks with your theme.</p>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="table-row">
                  <td className="px-4 py-2 text-foreground">Sample Row</td>
                  <td className="px-4 py-2"><span className="badge-success">Active</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorTheme;
