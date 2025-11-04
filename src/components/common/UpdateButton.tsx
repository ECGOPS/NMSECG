import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download } from 'lucide-react';
import { swUpdateHandler } from '@/utils/serviceWorkerUpdate';
import { toast } from '@/components/ui/sonner';

export const UpdateButton: React.FC = () => {
  const handleForceUpdate = () => {
    toast.info('Checking for updates...');
    swUpdateHandler.forceUpdate();
  };

  const handleClearCache = () => {
    toast.info('Clearing cache...');
    swUpdateHandler.clearCache();
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleForceUpdate}
        className="flex items-center gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        Check for Updates
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClearCache}
        className="flex items-center gap-2"
      >
        <Download className="h-4 w-4" />
        Clear Cache & Reload
      </Button>
    </div>
  );
};
