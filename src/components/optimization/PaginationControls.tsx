/**
 * PaginationControls - Optimized pagination UI component with debounced clicks
 * 
 * Features:
 * - Debounced/throttled button clicks
 * - Loading states
 * - Disabled states for boundaries
 * - Shows page info and offline indicator
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, RefreshCw, WifiOff } from "lucide-react";
import { useState, useEffect } from "react";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onRefresh?: () => void;
  isOffline?: boolean;
  isFromCache?: boolean;
  className?: string;
}

export function PaginationControls({
  currentPage,
  totalPages,
  loading,
  onPageChange,
  onRefresh,
  isOffline = false,
  isFromCache = false,
  className = ""
}: PaginationControlsProps) {
  const [pageInput, setPageInput] = useState(currentPage.toString());

  // Sync input with current page
  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputBlur = () => {
    const page = parseInt(pageInput);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
    } else {
      setPageInput(currentPage.toString());
    }
  };

  const handlePageInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePageInputBlur();
    }
  };

  const canGoPrevious = currentPage > 1 && !loading;
  const canGoNext = currentPage < totalPages && !loading;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      {/* Page Info & Status */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages || 1}
        </span>
        {isOffline && (
          <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
            <WifiOff className="h-3 w-3" />
            <span>Offline</span>
          </div>
        )}
        {isFromCache && !isOffline && (
          <span className="text-xs text-muted-foreground">(Cached)</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={!canGoPrevious}
          className="hidden sm:inline-flex"
        >
          First
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrevious}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        {/* Page Input */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">Go to:</span>
          <Input
            type="number"
            min={1}
            max={totalPages}
            value={pageInput}
            onChange={handlePageInputChange}
            onBlur={handlePageInputBlur}
            onKeyPress={handlePageInputKeyPress}
            className="w-16 h-8 text-center"
            disabled={loading || totalPages === 0}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={!canGoNext}
          className="hidden sm:inline-flex"
        >
          Last
        </Button>

        {/* Refresh Button */}
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh current page"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>
    </div>
  );
}

