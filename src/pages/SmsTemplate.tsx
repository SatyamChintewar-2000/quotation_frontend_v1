import React from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { MessageSquare } from 'lucide-react';

const SmsTemplate = () => {
  return (
    <div className="min-h-screen">
      <TopBar title="SMS Template" />
      <div className="p-6">
        <div className="bg-card rounded-xl shadow-md border border-border p-8 text-center">
          <MessageSquare size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            SMS Templates
          </h2>
          <p className="text-muted-foreground">
            Create and manage SMS notification templates.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SmsTemplate;
