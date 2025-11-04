import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { VITAsset } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, MapPin, Info, Eye, EyeOff, Layers, RefreshCw } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { PhotoService } from '@/services/PhotoService';
import { format } from 'date-fns';
import { SafeText } from '@/components/ui/safe-display';

interface VITAssetListProps {
  assets: VITAsset[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export function VITAssetList({ 
  assets, 
  onLoadMore, 
  hasMore, 
  isLoading,
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange
}: VITAssetListProps) {
  if (!assets || assets.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No switchgear assets found. Add some to get started!</p>
      </div>
    );
  }

  const handlePageChange = (page: number) => {
    if (onPageChange && page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  const handlePageSizeChange = (newPageSize: string) => {
    if (onPageSizeChange) {
      onPageSizeChange(parseInt(newPageSize));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map((asset) => (
          <Link to={`/asset-management/vit-inspection-details/${asset.id}`} key={asset.id}>
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <span><SafeText content={asset.typeOfUnit} /></span>
                    <Badge variant={asset.status === 'Operational' ? 'default' : 'secondary'}>
                      <SafeText content={asset.status} />
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <p><strong>Voltage Level:</strong> <SafeText content={asset.voltageLevel} /></p>
                  <p><strong>Serial Number:</strong> <SafeText content={asset.serialNumber} /></p>
                  <p><strong>Region:</strong> <SafeText content={asset.region} /></p>
                  <p><strong>District/Section:</strong> <SafeText content={asset.location || "Not specified"} /></p>
                  <p><strong>GPS:</strong> <SafeText content={asset.gpsCoordinates} /></p>
                  <p><strong>Protection:</strong> <SafeText content={asset.protection} /></p>
                </div>
                <div className="mt-4">
                  {asset.photoUrl && (
                    <img
                      className="w-full h-32 object-cover rounded"
                      src={PhotoService.getInstance().convertToProxyUrl(asset.photoUrl)}
                      alt={`${asset.typeOfUnit} - ${asset.serialNumber}`}
                    />
                  )}
                </div>
                <div className="mt-4 text-xs text-muted-foreground">
                  <p><strong>Last Updated:</strong> <SafeText content={format(new Date(asset.updatedAt), 'MMM d, yyyy')} /></p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center space-x-2">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} assets
          </p>
          <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            First
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              if (page > totalPages) return null;
              
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(page)}
                  className="w-8 h-8"
                >
                  {page}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4 ml-1" />
            Last
          </Button>
        </div>
      </div>

      {/* Legacy Load More Button (for backward compatibility) */}
      {hasMore && onLoadMore && (
        <div className="flex justify-center mt-4">
          <Button
            onClick={onLoadMore}
            disabled={isLoading}
            className="w-48"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  );
} 