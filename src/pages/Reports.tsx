import React from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { BarChart3 } from 'lucide-react';

const Reports = () => {
  return (
    <div className="min-h-screen">
      <TopBar title="Reports" />
      <div className="p-6">
        <div className="bg-card rounded-xl shadow-md border border-border p-8 text-center">
          <BarChart3 size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Reports & Analytics
          </h2>
          <p className="text-muted-foreground">
            View detailed reports and analytics for your business.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Reports;
