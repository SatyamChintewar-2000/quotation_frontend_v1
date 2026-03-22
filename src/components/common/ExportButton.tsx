import React from 'react';
import { Download } from 'lucide-react';

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
  count
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      title={label}
    >
      <Download size={18} />
      {label}
      {count !== undefined && count > 0 && (
        <span className="badge-primary ml-1">{count}</span>
      )}
    </button>
  );
};
