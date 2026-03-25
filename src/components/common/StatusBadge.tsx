import React from 'react';

/**
 * Unified status badge used across all pages.
 * Automatically capitalizes the label.
 *
 * Supported status values (case-insensitive):
 *  Quotation:  draft | generated | sent | approved | rejected
 *  Invoice:    DRAFT | SENT | PAID | PARTIAL | OVERDUE | CANCELLED
 *  Payment:    PENDING | PARTIAL | PAID
 *  User/Company: active | inactive
 */

type StatusBadgeProps = {
  status: string;
};

const colorMap: Record<string, string> = {
  // Quotation statuses
  draft:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  generated: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  sent:      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  approved:  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  rejected:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',

  // Invoice statuses (uppercase keys)
  paid:      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  partial:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  overdue:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  cancelled: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  pending:   'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',

  // User / Company
  active:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  inactive:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const key = status.toLowerCase();
  const classes = colorMap[key] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  const label = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
};
