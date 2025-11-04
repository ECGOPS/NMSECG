import React, { useState, useEffect } from 'react';
import { useData } from "@/contexts/DataContext";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Loader2, History } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

export function DistrictPopulationForm() {
  const { regions, districts, updateDistrict } = useData();
  const { user } = useAzureADAuth();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [ruralPopulation, setRuralPopulation] = useState<number | null>(null);
  const [urbanPopulation, setUrbanPopulation] = useState<number | null>(null);
  const [metroPopulation, setMetroPopulation] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  // Set initial values based on user role
  useEffect(() => {
    console.log("User role:", user?.role);
    console.log("User region:", user?.region);
    console.log("User district:", user?.district);
    console.log("Available regions:", regions);
    console.log("Filtered regions:", filteredRegions);
    
    // For system admins, don't auto-select a region - let them choose
    if (user?.role === "system_admin") {
      console.log("System admin detected - not auto-selecting region");
      return;
    }
    
    if ((user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "district_manager") && user.region) {
      const userRegion = regions.find(r => r.name === user.region);
      console.log("Found user region:", userRegion);
      
      if (userRegion) {
        setSelectedRegion(userRegion.id);
        
        // For district engineer and district manager, also set the district
        if ((user.role === "district_engineer" || user?.role === "district_manager") && user.district) {
          const userDistrict = districts.find(d => d.name === user.district);
          console.log("Found user district:", userDistrict);
          
          if (userDistrict) {
            setSelectedDistrict(userDistrict.id);
            // Add null checks and default values for population data
            setRuralPopulation(userDistrict.population?.rural ?? null);
            setUrbanPopulation(userDistrict.population?.urban ?? null);
            setMetroPopulation(userDistrict.population?.metro ?? null);
          }
        }
      }
    }
  }, [user, regions, districts]);
  
  // Ensure district is set for district engineers and district managers
  useEffect(() => {
    if ((user?.role === "district_engineer" || user?.role === "district_manager") && user.district && selectedRegion && !selectedDistrict) {
      const userDistrict = districts.find(d => d.name === user.district);
      if (userDistrict) {
        setSelectedDistrict(userDistrict.id);
        // Add null checks and default values for population data
        setRuralPopulation(userDistrict.population?.rural ?? null);
        setUrbanPopulation(userDistrict.population?.urban ?? null);
        setMetroPopulation(userDistrict.population?.metro ?? null);
      }
    }
  }, [user, selectedRegion, selectedDistrict, districts]);
  
  // Update population fields when district changes
  useEffect(() => {
    if (selectedDistrict) {
      const district = districts.find(d => d.id === selectedDistrict);
      if (district) {
        // Add null checks and default values for population data
        setRuralPopulation(district.population?.rural ?? null);
        setUrbanPopulation(district.population?.urban ?? null);
        setMetroPopulation(district.population?.metro ?? null);
      } else {
        setRuralPopulation(null);
        setUrbanPopulation(null);
        setMetroPopulation(null);
      }
    } else {
      setRuralPopulation(null);
      setUrbanPopulation(null);
      setMetroPopulation(null);
    }
  }, [selectedDistrict, districts]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDistrict) {
      toast.error("Please select a district");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const district = districts.find(d => d.id === selectedDistrict);
      if (!district) {
        throw new Error("District not found");
      }

      const currentPopulation = {
        rural: ruralPopulation ?? 0,
        urban: urbanPopulation ?? 0,
        metro: metroPopulation ?? 0
      };

      // Create new history entry
      const newHistoryEntry = {
        ...currentPopulation,
        updatedBy: user?.name || "Unknown",
        updatedAt: new Date().toISOString()
      };

      // Get existing history or create new array
      const existingHistory = district.populationHistory || [];
      
      await updateDistrict(selectedDistrict, {
        population: currentPopulation,
        populationHistory: [...existingHistory, newHistoryEntry]
      });
      
      toast.success("District population updated successfully");
    } catch (error) {
      console.error("Error updating district population:", error);
      toast.error("Failed to update district population");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Filter regions based on user role
  const filteredRegions = (() => {
    if (!user) return regions;
    
    // Global engineers and system admins can see all regions
    if (user.role === "global_engineer" || user.role === "system_admin") {
      return regions;
    }
    
    // Regional engineers, regional general managers, and project engineers can only see their assigned region
    if (user.role === "regional_engineer" || user.role === "regional_general_manager" || user.role === "project_engineer") {
      return regions.filter(r => r.name === user.region);
    }
    
    // Ashsubt users can see all Ashanti regions
    if (user.role === "ashsubt") {
      return regions.filter(r => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(r.id));
    }
    
    // Accsubt users can see all Accra regions
    if (user.role === "accsubt") {
      return regions.filter(r => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(r.id));
    }
    
    // District engineers, district managers and technicians can only see their assigned region
    if (user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") {
      const userDistrict = districts.find(d => d.name === user.district);
      return userDistrict ? regions.filter(r => r.id === userDistrict.regionId) : [];
    }
    
    // Default: filter by user region
    return regions.filter(r => user.region ? r.name === user.region : true);
  })();
  
  // Filter districts for district engineers and district managers
  const filteredDistricts = selectedRegion
    ? districts.filter(d => {
        return d.regionId === selectedRegion && (
          (user?.role === "district_engineer" || user?.role === "district_manager")
            ? d.name === user.district 
            : true
        );
      })
    : [];
  
  const selectedDistrictData = districts.find(d => d.id === selectedDistrict);
  const populationHistory = selectedDistrictData?.populationHistory || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update District Population</CardTitle>
        <CardDescription>
          Set population figures for district segmentation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Select 
                value={selectedRegion} 
                onValueChange={setSelectedRegion}
                disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "district_manager"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
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
            
            <div className="space-y-2">
                              <Label htmlFor="district">District/Section</Label>
              <Select 
                value={selectedDistrict} 
                onValueChange={setSelectedDistrict}
                disabled={!selectedRegion || user?.role === "district_engineer" || user?.role === "district_manager"}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedRegion ? "Select district" : "Select region first"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredDistricts.map(district => (
                    <SelectItem key={district.id} value={district.id}>
                      {district.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="ruralPopulation">Rural Population</Label>
              <Input
                id="ruralPopulation"
                type="number"
                min="0"
                value={ruralPopulation ?? ""}
                onChange={(e) => setRuralPopulation(e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="urbanPopulation">Urban Population</Label>
              <Input
                id="urbanPopulation"
                type="number"
                min="0"
                value={urbanPopulation ?? ""}
                onChange={(e) => setUrbanPopulation(e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="metroPopulation">Metro Population</Label>
              <Input
                id="metroPopulation"
                type="number"
                min="0"
                value={metroPopulation ?? ""}
                onChange={(e) => setMetroPopulation(e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>
          </div>
          
          <div className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              {showHistory ? "Hide History" : "Show History"}
            </Button>
            
            {showHistory && populationHistory.length > 0 && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold mb-2">Population History</h3>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Updated By</TableHead>
                        <TableHead>Rural</TableHead>
                        <TableHead>Urban</TableHead>
                        <TableHead>Metro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {populationHistory
                        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                        .map((entry, index) => (
                          <TableRow key={index}>
                            <TableCell>{format(new Date(entry.updatedAt), 'MMM d, yyyy HH:mm')}</TableCell>
                            <TableCell>{entry.updatedBy}</TableCell>
                            <TableCell>{entry.rural.toLocaleString()}</TableCell>
                            <TableCell>{entry.urban.toLocaleString()}</TableCell>
                            <TableCell>{entry.metro.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating...
            </>
          ) : (
            "Update Population Data"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
