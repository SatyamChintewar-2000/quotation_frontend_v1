import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface DateRangePickerProps {
  fromDate: string;
  toDate: string;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  label?: string;
}

const today = new Date().toISOString().split('T')[0];

const diffDays = (from: string, to: string): number => {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  label = 'Date Range'
}) => {
  const [error, setError] = useState('');

  const validate = (from: string, to: string): string => {
    if (!from) return 'From date is required';
    if (!to) return 'To date is required';
    if (from > to) return '"From" date cannot be after "To" date';
    if (diffDays(from, to) > 30) return 'Date range cannot exceed 30 days';
    return '';
  };


  const handleFromChange = (val: string) => {
    const err = validate(val, toDate);
    if (err) {
      toast.error(err);
    } else {
      setError('');
      onFromDateChange(val);
    }
  };

  const handleToChange = (val: string) => {
    const err = validate(fromDate, val);
    if (err) {
      toast.error(err);
    } else {
      setError('');
      onToDateChange(val);
    }
  };


  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 flex-nowrap">
        <div className="flex items-center gap-2 text-white">
          <Calendar size={20} />
          <span className="font-medium">{label}:</span>
        </div>
        <div className="flex items-center gap-2">
          <div>
            <label className="text-xs text-white/70 block mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => handleFromChange(e.target.value)}
              className="bg-white/20 border border-white/30 text-white rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
          <span className="text-white/70 mt-4">-</span>
          <div>
            <label className="text-xs text-white/70 block mb-1">To</label>
            <input
              type="date"
              value={toDate}
              min={fromDate || today}
              onChange={(e) => handleToChange(e.target.value)}
              className="bg-white/20 border border-white/30 text-white rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
