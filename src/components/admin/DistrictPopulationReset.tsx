import React, { useState } from 'react';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/components/ui/sonner';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { RegionPopulation } from '../../lib/types';

export function DistrictPopulationReset() {
  const { user } = useAzureADAuth();
  const { regions, districts, updateDistrict } = useData();
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentDistrict, setCurrentDistrict] = useState<string>('');

  const resetAllDistrictPopulations = async () => {
    if (!selectedRegion) {
      toast.error('Please select a region first');
      return;
    }
    
    setIsLoading(true);
    setProgress(0);
    setCurrentDistrict('');
    
    try {
      // Filter districts by selected region from the existing districts array
      const filteredDistricts = districts.filter(d => d.regionId === selectedRegion);
      
      if (filteredDistricts.length === 0) {
        toast.error('No districts found for the selected region');
        return;
      }
      
      // Reset population data for each district sequentially to avoid overwhelming the backend
      let successCount = 0;
      let errorCount = 0;
      
      toast.info(`Starting reset for ${filteredDistricts.length} districts...`);
      
      for (let i = 0; i < filteredDistricts.length; i++) {
        const district = filteredDistricts[i];
        setCurrentDistrict(district.name);
        
        // Update progress
        const progressPercent = Math.round(((i + 1) / filteredDistricts.length) * 100);
        setProgress(progressPercent);
        
        try {
          // Only update the population field - don't add new fields that might not be expected
          const resetData = {
            population: {
              rural: null,
              urban: null,
              metro: null
            }
          };
          
          console.log(`Resetting district ${district.name} (${district.id}) with data:`, resetData);
          
          await updateDistrict(district.id, resetData);
          
          successCount++;
          console.log(`Successfully reset district: ${district.name}`);
          
          // Add a small delay between requests to reduce backend load
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          errorCount++;
          console.error(`Failed to reset district ${district.name}:`, error);
        }
      }
      
      if (errorCount === 0) {
        toast.success(`Successfully reset population data for ${successCount} districts in the selected region`);
      } else if (successCount > 0) {
        toast.warning(`Reset completed with some errors: ${successCount} successful, ${errorCount} failed`);
      } else {
        toast.error('Failed to reset any districts. Please try again.');
      }
      
    } catch (error) {
      console.error('Error resetting district populations:', error);
      toast.error('Failed to reset district populations');
    } finally {
      setIsLoading(false);
      setProgress(0);
      setCurrentDistrict('');
    }
  };

  // Filter regions based on user role
  const filteredRegions = (user?.role === "system_admin" || user?.role === "global_engineer") 
    ? regions 
    : regions.filter(r => user?.region ? r.name === user.region : true);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Reset District Populations
        </CardTitle>
        <CardDescription>
          Reset population data for districts. This action cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="region">Select Region</Label>
            <Select 
              value={selectedRegion} 
              onValueChange={setSelectedRegion}
              disabled={user?.role === "regional_engineer" || user?.role === "district_engineer" || user?.role === "district_manager"}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a region" />
              </SelectTrigger>
              <SelectContent>
                {filteredRegions.map(region => (
                  <SelectItem key={region.id} value={region.id}>
                    {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={() => resetAllDistrictPopulations()} 
              disabled={isLoading || !selectedRegion}
              variant="destructive"
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Reset Populations
            </Button>
          </div>
          
          {/* Progress Bar */}
          {isLoading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {currentDistrict ? `Resetting ${currentDistrict}...` : 'Preparing reset...'}
                </span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}