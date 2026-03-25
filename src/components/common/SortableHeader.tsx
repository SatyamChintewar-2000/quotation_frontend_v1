import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { SortState } from '@/hooks/useSortable';

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  className?: string;
}

export const SortableHeader: React.FC<SortableHeaderProps> = ({
  label,
  sortKey,
  sort,
  onSort,
  className = 'px-6 py-4 text-left',
}) => {
  const isActive = sort.key === sortKey;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 font-semibold transition-colors hover:text-primary ${
          isActive ? 'text-primary' : ''
        }`}
      >
        {label}
        {isActive && sort.direction === 'asc' ? (
          <ArrowUp size={14} />
        ) : isActive && sort.direction === 'desc' ? (
          <ArrowDown size={14} />
        ) : (
          <ArrowUpDown size={14} className="text-muted-foreground/50" />
        )}
      </button>
    </th>
  );
};
