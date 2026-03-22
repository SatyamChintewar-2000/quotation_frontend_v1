import * as XLSX from 'xlsx';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export const exportToExcel = (
  data: any[],
  columns: ExportColumn[],
  filename: string
) => {
  // Create worksheet data
  const wsData = [
    // Header row
    columns.map(col => col.header),
    // Data rows
    ...data.map(row => 
      columns.map(col => {
        const value = row[col.key];
        // Handle different data types
        if (value === null || value === undefined) return '';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'number') return value;
        return String(value);
      })
    )
  ];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }));

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename}_${timestamp}.xlsx`;

  // Save file
  XLSX.writeFile(wb, fullFilename);
};

export const formatDateForExcel = (date: string | Date): string => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
};

export const formatCurrencyForExcel = (amount: number): string => {
  return `₹${amount.toFixed(2)}`;
};
