import React from 'react';
import { Calendar, X } from 'lucide-react';
import { toast } from 'sonner';

interface DateRangePickerProps {
  fromDate: string;
  toDate: string;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  label?: string;
  /** Use 'light' variant inside dark/colored backgrounds like the Dashboard banner */
  variant?: 'default' | 'light';
}

const diffDays = (from: string, to: string): number => {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
};

const validate = (from: string, to: string): string => {
  if (from && to && from > to) return '"From" date cannot be after "To" date';
  if (from && to && diffDays(from, to) > 30) return 'Date range cannot exceed 30 days';
  return '';
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  label = 'Date Range',
  variant = 'default',
}) => {
  const isLight = variant === 'light';

  const handleFromChange = (val: string) => {
    if (val && toDate) {
      const err = validate(val, toDate);
      if (err) { toast.error(err); return; }
    }
    onFromDateChange(val);
  };

  const handleToChange = (val: string) => {
    if (fromDate && val) {
      const err = validate(fromDate, val);
      if (err) { toast.error(err); return; }
    }
    onToDateChange(val);
  };

  const handleClear = () => {
    onFromDateChange('');
    onToDateChange('');
  };

  const hasValue = fromDate || toDate;

  const containerClass = isLight
    ? 'flex items-center gap-2 bg-white/20 border border-white/30 rounded-xl px-4 py-2.5'
    : 'flex items-center gap-2 h-10 bg-card border border-border rounded-lg px-3 shadow-sm';

  const labelClass = isLight
    ? 'text-sm font-medium text-white whitespace-nowrap'
    : 'text-sm font-medium text-foreground whitespace-nowrap';

  const iconClass = isLight ? 'text-white/80 flex-shrink-0' : 'text-muted-foreground flex-shrink-0';

  const inputClass = isLight
    ? 'w-[120px] text-sm bg-transparent border-0 outline-none text-white cursor-pointer [color-scheme:dark]'
    : 'w-[120px] text-sm bg-transparent border-0 outline-none text-foreground cursor-pointer';

  const separatorClass = isLight ? 'text-white/60 text-sm px-1' : 'text-muted-foreground text-sm px-1';

  return (
    <div className={containerClass}>
      <Calendar size={16} className={iconClass} />
      <span className={labelClass}>{label}:</span>
      <div className="flex items-center">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => handleFromChange(e.target.value)}
          className={inputClass}
          placeholder="From"
        />
        <span className={separatorClass}>–</span>
        <input
          type="date"
          value={toDate}
          min={fromDate || undefined}
          onChange={(e) => handleToChange(e.target.value)}
          className={inputClass}
          placeholder="To"
        />
      </div>
      {hasValue && (
        <button
          onClick={handleClear}
          className={`ml-1 rounded-full p-0.5 transition-colors ${isLight ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          title="Clear dates"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
