import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useData } from '@/contexts/DataContext';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { Pencil, Trash2, Plus, Loader2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Admin Target Manager Component
 * 
 * Allows system admins to:
 * - Set targets for load monitoring, substation inspections, and overhead line feeder length
 * - Set targets per region (and optionally by district)
 * - Edit and delete existing targets
 * - View all targets in a table
 */
export function AdminTargetManager() {
  const { user, users } = useAzureADAuth();
  const { regions, districts } = useData();
  const [targets, setTargets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<any>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalTargets, setTotalTargets] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    regionId: '',
    districtId: '',
    month: '',
    targetType: 'loadMonitoring',
    targetValue: '',
  });

  // Fetch total count
  const fetchTotalCount = async () => {
    try {
      const countData = await apiRequest('/api/targets?countOnly=true');
      const total = countData?.total || 0;
      setTotalTargets(total);
      return total;
    } catch (error) {
      console.error('[AdminTargetManager] Error fetching count:', error);
      return 0;
    }
  };

  // Fetch targets with pagination
  const fetchTargets = async (page: number = currentPage, size: number = pageSize) => {
    try {
      setIsLoading(true);
      console.log('[AdminTargetManager] Fetching targets...', { page, size });
      
      // Calculate offset
      const offset = (page - 1) * size;
      
      // Fetch targets with pagination
      const data = await apiRequest(`/api/targets?limit=${size}&offset=${offset}`);
      console.log('[AdminTargetManager] Targets data received:', data);
      console.log('[AdminTargetManager] Is array?', Array.isArray(data));
      console.log('[AdminTargetManager] Data length:', Array.isArray(data) ? data.length : 'not an array');
      
      const targetsArray = Array.isArray(data) ? data : (data?.data ? (Array.isArray(data.data) ? data.data : []) : []);
      console.log('[AdminTargetManager] Setting targets:', targetsArray.length);
      setTargets(targetsArray);
      
      // Fetch total count if not already set or if page changed
      if (totalTargets === 0 || page === 1) {
        await fetchTotalCount();
      }
    } catch (error: any) {
      console.error('[AdminTargetManager] Error fetching targets:', error);
      toast.error('Failed to load targets');
      setTargets([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'system_admin' || user?.role === 'global_engineer') {
      fetchTargets(currentPage, pageSize);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [user, currentPage, pageSize]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.regionId || !formData.month || !formData.targetValue) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const payload = {
        regionId: formData.regionId,
        districtId: formData.districtId || null,
        month: formData.month,
        targetType: formData.targetType,
        targetValue: Number(formData.targetValue),
        createdBy: user?.id || user?.uid || 'system',
      };

      if (editingTarget) {
        // Update existing target
        await apiRequest(`/api/targets/${editingTarget.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success('Target updated successfully');
      } else {
        // Create new target
        await apiRequest('/api/targets', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Target created successfully');
      }

      setIsDialogOpen(false);
      setEditingTarget(null);
      resetForm();
      // Refresh targets list after successful creation/update
      setTimeout(() => {
        fetchTargets(currentPage, pageSize);
        fetchTotalCount(); // Refresh count
      }, 100); // Small delay to ensure backend has processed the request
    } catch (error: any) {
      console.error('[AdminTargetManager] Error saving target:', error);
      toast.error(error.message || 'Failed to save target');
    }
  };

  // Handle edit
  const handleEdit = (target: any) => {
    setEditingTarget(target);
    setFormData({
      regionId: target.regionId,
      districtId: target.districtId || '',
      month: target.month,
      targetType: target.targetType,
      targetValue: target.targetValue.toString(),
    });
    setIsDialogOpen(true);
  };

  // Handle delete
  const handleDelete = async (targetId: string) => {
    if (!confirm('Are you sure you want to delete this target?')) {
      return;
    }

    try {
      await apiRequest(`/api/targets/${targetId}`, {
        method: 'DELETE',
      });
      toast.success('Target deleted successfully');
      fetchTargets(currentPage, pageSize);
      fetchTotalCount(); // Refresh count
    } catch (error: any) {
      console.error('[AdminTargetManager] Error deleting target:', error);
      toast.error('Failed to delete target');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      regionId: '',
      districtId: '',
      month: '',
      targetType: 'loadMonitoring',
      targetValue: '',
    });
  };

  // Get region name by ID
  const getRegionName = (regionId: string) => {
    return regions.find(r => r.id === regionId)?.name || regionId;
  };

  // Get district name by ID
  const getDistrictName = (districtId: string) => {
    return districts.find(d => d.id === districtId)?.name || districtId;
  };

  // Get target type label
  const getTargetTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      loadMonitoring: 'Load Monitoring',
      substationInspection: 'Substation Inspection',
      overheadLine: 'Overhead Line (km)',
    };
    return labels[type] || type;
  };

  // Get user name by ID
  const getUserNameById = (userId: string | undefined): string => {
    if (!userId || userId === 'system' || userId === 'unknown') {
      return userId === 'system' ? 'System' : userId || 'Unknown';
    }

    // Try to find user by exact ID match
    let foundUser = (users || []).find(u => u.id === userId);
    
    // If not found by ID, try to find by UID (Azure AD localAccountId)
    if (!foundUser) {
      foundUser = (users || []).find(u => u.uid === userId);
    }
    
    // If still not found, try to find by email (in case userId is an email)
    if (!foundUser && userId.includes('@')) {
      foundUser = (users || []).find(u => u.email === userId);
    }
    
    if (foundUser) {
      return foundUser.name || foundUser.displayName || foundUser.email || userId;
    }
    
    // Return the original value if not found (could be email or other identifier)
    return userId;
  };

  // Generate current month in YYYY-MM format
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Get filtered districts for selected region
  const filteredDistricts = formData.regionId
    ? districts.filter(d => d.regionId === formData.regionId)
    : districts;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg sm:text-xl">Target Management</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Set performance targets for load monitoring, substation inspections, and overhead line feeder length
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => fetchTargets()}
                disabled={isLoading}
                className="flex-1 sm:flex-none"
              >
                <RefreshCw className={`h-4 w-4 sm:mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button 
                onClick={() => {
                  resetForm();
                  setEditingTarget(null);
                  setIsDialogOpen(true);
                }}
                className="flex-1 sm:flex-none"
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Target</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">Region</TableHead>
                    <TableHead className="text-xs sm:text-sm">District</TableHead>
                    <TableHead className="text-xs sm:text-sm">Month</TableHead>
                    <TableHead className="text-xs sm:text-sm">Target Type</TableHead>
                    <TableHead className="text-xs sm:text-sm">Target Value</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden md:table-cell">Created By</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Date Created</TableHead>
                    <TableHead className="text-xs sm:text-sm">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <span>No targets found.</span>
                          <span className="text-xs">Click "Add Target" to create one, or "Refresh" to reload.</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchTargets()}
                            className="mt-2"
                            disabled={isLoading}
                          >
                            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh List
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    targets.map((target) => (
                      <TableRow key={target.id}>
                        <TableCell className="text-xs sm:text-sm font-medium">{getRegionName(target.regionId)}</TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          {target.districtId ? getDistrictName(target.districtId) : <Badge variant="outline" className="text-xs">All Districts</Badge>}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">{target.month}</TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <Badge variant="secondary" className="text-xs">{getTargetTypeLabel(target.targetType)}</Badge>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm font-medium">
                          {target.targetType === 'overheadLine' 
                            ? `${target.targetValue} km`
                            : target.targetValue.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm text-muted-foreground hidden md:table-cell">
                          <span className="truncate block max-w-[120px]">{getUserNameById(target.createdBy)}</span>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm text-muted-foreground hidden lg:table-cell">
                          {target.createdAt 
                            ? (() => {
                                try {
                                  const date = new Date(target.createdAt);
                                  if (isNaN(date.getTime())) return 'N/A';
                                  return format(date, 'MMM dd, yyyy');
                                } catch (error) {
                                  return target.createdAt || 'N/A';
                                }
                              })()
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(target)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(target.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Pagination Controls */}
          {!isLoading && targets.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalTargets)} of {totalTargets} targets
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="pageSize" className="text-sm whitespace-nowrap">Per page:</Label>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setCurrentPage(1); // Reset to first page when changing page size
                    }}
                  >
                    <SelectTrigger id="pageSize" className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || isLoading}
                    className="h-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Previous</span>
                  </Button>
                  
                  <div className="flex items-center gap-1 px-2">
                    <span className="text-sm">
                      Page {currentPage} of {Math.ceil(totalTargets / pageSize) || 1}
                    </span>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage >= Math.ceil(totalTargets / pageSize) || isLoading}
                    className="h-8"
                  >
                    <span className="hidden sm:inline mr-1">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">{editingTarget ? 'Edit Target' : 'Create New Target'}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Set performance targets for regions. Targets can be set per region or per district.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="regionId" className="text-sm">Region *</Label>
                  <Select
                    value={formData.regionId}
                    onValueChange={(value) => {
                      setFormData({ ...formData, regionId: value, districtId: '' });
                    }}
                    required
                  >
                    <SelectTrigger id="regionId" className="text-sm">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map((region) => (
                        <SelectItem key={region.id} value={region.id}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="districtId" className="text-sm">District (Optional)</Label>
                  <Select
                    value={formData.districtId || '__all__'}
                    onValueChange={(value) => setFormData({ ...formData, districtId: value === '__all__' ? '' : value })}
                    disabled={!formData.regionId}
                  >
                    <SelectTrigger id="districtId" className="text-sm">
                      <SelectValue placeholder="All districts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Districts</SelectItem>
                      {filteredDistricts.map((district) => (
                        <SelectItem key={district.id} value={district.id}>
                          {district.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="month" className="text-sm">Month *</Label>
                  <Input
                    id="month"
                    type="month"
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    required
                    min="2020-01"
                    max="2099-12"
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Format: YYYY-MM</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetType" className="text-sm">Target Type *</Label>
                  <Select
                    value={formData.targetType}
                    onValueChange={(value) => setFormData({ ...formData, targetType: value })}
                    required
                  >
                    <SelectTrigger id="targetType" className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="loadMonitoring">Load Monitoring (Count)</SelectItem>
                      <SelectItem value="substationInspection">Substation Inspection (Count)</SelectItem>
                      <SelectItem value="overheadLine">Overhead Line (Feeder Length in km)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetValue" className="text-sm">
                  Target Value * 
                  {formData.targetType === 'overheadLine' && ' (in km)'}
                </Label>
                <Input
                  id="targetValue"
                  type="number"
                  step={formData.targetType === 'overheadLine' ? '0.01' : '1'}
                  min="0"
                  value={formData.targetValue}
                  onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
                  placeholder={formData.targetType === 'overheadLine' ? 'e.g., 150.5' : 'e.g., 100'}
                  required
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {formData.targetType === 'overheadLine' 
                    ? 'Total feeder length target in kilometers'
                    : 'Target count for this metric'}
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingTarget(null);
                  resetForm();
                }}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto">
                {editingTarget ? 'Update Target' : 'Create Target'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

