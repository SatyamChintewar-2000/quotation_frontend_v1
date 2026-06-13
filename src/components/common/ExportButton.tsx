import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

interface ExportButtonProps {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
  count?: number;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  onClick,
  label = 'Export to Excel',
  disabled = false,
  count,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`
        relative flex items-center gap-2 h-10 px-4 rounded-lg font-medium text-sm
        whitespace-nowrap transition-all duration-200
        bg-emerald-600 hover:bg-emerald-700 active:scale-95
        text-white shadow-md hover:shadow-emerald-500/30 hover:shadow-lg
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100
      `}
    >
      <FileSpreadsheet size={16} className="flex-shrink-0" />
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className="ml-0.5 bg-white/25 text-white text-xs font-bold px-1.5 py-0.5 rounded-md">
          {count}
        </span>
      )}
    </button>
  );
};
