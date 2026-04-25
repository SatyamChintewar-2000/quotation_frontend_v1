import React, { useState, useEffect } from 'react';

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onChange: (value: number) => void;
}

/**
 * A number input that allows clearing the field (removes the stuck "0" problem).
 * Stores raw string internally while editing, emits numeric value on change.
 */
const NumericInput = ({ value, onChange, ...props }: NumericInputProps) => {
  const [raw, setRaw] = useState(value === 0 ? '' : String(value));

  // Sync when external value changes (e.g. form reset)
  useEffect(() => {
    setRaw(value === 0 ? '' : String(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const str = e.target.value;
    setRaw(str);
    const num = str === '' ? 0 : parseFloat(str);
    if (!isNaN(num)) onChange(num);
  };

  const handleBlur = () => {
    // On blur, if empty show empty (placeholder shows), keep value as 0
    if (raw === '' || raw === '-') setRaw('');
  };

  return (
    <input
      type="number"
      value={raw}
      onChange={handleChange}
      onBlur={handleBlur}
      {...props}
    />
  );
};

export default NumericInput;
