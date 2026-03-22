import React from 'react';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  fromDate: string;
  toDate: string;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  label?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  label = 'Date Range'
}) => {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Calendar size={20} />
        <span className="font-medium">{label}:</span>
      </div>
      <div className="flex items-center gap-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            className="input-field text-sm py-1.5"
          />
        </div>
        <span className="text-muted-foreground mt-5">to</span>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => onToDateChange(e.target.value)}
            className="input-field text-sm py-1.5"
          />
        </div>
      </div>
    </div>
  );
};
