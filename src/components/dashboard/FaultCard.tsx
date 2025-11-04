import { useState } from "react";
import { OP5Fault, ControlSystemOutage } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDuration } from "@/utils/calculations";
import { AlertTriangle, BarChart, Clock, MapPin, Users, CheckCircle2, XCircle, Edit, Trash2, FileText, TestTube, Phone } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";
import { PermissionService } from "@/services/PermissionService";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// Type augmentation to fix type errors
interface EnhancedOP5Fault extends OP5Fault {
  mttr?: number;
}

interface EnhancedControlSystemOutage extends ControlSystemOutage {
  unservedEnergyMWh?: number;
}

interface FaultCardProps {
  fault: OP5Fault | ControlSystemOutage;
  type: "op5" | "control";
}

export function FaultCard({ fault, type }: FaultCardProps) {
  const { regions, districts, resolveFault, deleteFault, canEditFault, addOP5Fault, addControlSystemOutage } = useData();
  const { user } = useAzureADAuth();
  const navigate = useNavigate();
  const permissionService = PermissionService.getInstance();
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [restorationDate, setRestorationDate] = useState<string>("");
  const [isTestMode, setIsTestMode] = useState(false);
  const [testFaultId, setTestFaultId] = useState<string | null>(null);
  const [isControlTestMode, setIsControlTestMode] = useState(false);
  const [testControlOutageId, setTestControlOutageId] = useState<string | null>(null);
  
  const region = regions.find(r => r.id === fault.regionId);
  const district = districts.find(d => d.id === fault.districtId);
  
  const isOP5 = type === "op5";
  const op5Fault = isOP5 ? fault as EnhancedOP5Fault : null;
  const controlOutage = !isOP5 ? fault as EnhancedControlSystemOutage : null;
  
  const getTotalAffectedCustomers = () => {
    if (isOP5 && op5Fault?.affectedPopulation) {
      return op5Fault.affectedPopulation.rural + 
             op5Fault.affectedPopulation.urban + 
             op5Fault.affectedPopulation.metro;
    } else if (!isOP5 && controlOutage?.customersAffected) {
      return controlOutage.customersAffected.rural + 
             controlOutage.customersAffected.urban + 
             controlOutage.customersAffected.metro;
    }
    return 'N/A';
  };
  
  const getBadgeColor = (type: string) => {
    switch (type) {
      case "Planned":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "Unplanned":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      case "Emergency":
        return "bg-orange-100 text-orange-800 hover:bg-orange-100";
      case "ECG Load Shedding":
        return "bg-purple-100 text-purple-800 hover:bg-purple-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };
  
  const getCardColors = (faultType: string) => {
    switch (faultType) {
      case "Planned":
        return "border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-800/30";
      case "Unplanned":
        return "border-l-4 border-l-red-500 bg-gradient-to-br from-red-50 to-white dark:from-red-950/30 dark:to-gray-800/30";
      case "Emergency":
        return "border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/30 dark:to-gray-800/30";
      case "ECG Load Shedding":
        return "border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-gray-800/30";
      case "GridCo Outage":
        return "border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-800/30";
      default:
        return "border-l-4 border-l-gray-500 bg-gradient-to-br from-gray-50 to-white dark:from-gray-950/30 dark:to-gray-800/30";
    }
  };
  
  const statusClass = fault.status === "pending" 
    ? "bg-red-100 text-red-800 border border-red-200" 
    : "bg-green-100 text-green-800 border border-green-200";
  
  const durationText = fault.occurrenceDate && fault.restorationDate 
    ? formatDuration((new Date(fault.restorationDate).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60))
    : "Ongoing";
  
  const canResolve = () => {
    if (fault.status === "resolved") return false;
    
    // Check if user has permission to manage faults
    const feature = isOP5 ? 'fault_reporting' : 'fault_reporting';
    if (!user || !permissionService.canAccessFeature(user.role, feature)) {
      return false;
    }
    
    // Technicians can resolve faults in their district
    if (user.role === "technician") {
      return user.district === district?.name;
    }
    
    // District engineers and managers for their district or higher roles can resolve
    if (user.role === "district_engineer" || user.role === "district_manager") {
      return user.district === district?.name;
    }
    
    // Regional engineers and managers can resolve in their region
    if (user.role === "regional_engineer" || user.role === "regional_general_manager") {
      return user.region === region?.name;
    }
    
    // Global engineers and system admins can resolve anywhere
    return user.role === "global_engineer" || user.role === "system_admin";
  };

  const canEdit = () => {
    return canEditFault(fault);
  };

  const canDelete = () => {
    // Check if user has permission to manage faults
    const feature = isOP5 ? 'fault_reporting_delete' : 'fault_reporting_delete';
    if (user && !permissionService.canAccessFeature(user.role, feature)) {
      return false;
    }
    
    // Technicians can delete faults in their district
    if (user.role === "technician") {
      return user.district === district?.name;
    }
    
    // District engineers and managers for their district or higher roles can delete
    if (user.role === "district_engineer" || user.role === "district_manager") {
      return user.district === district?.name;
    }
    
    // Regional engineers and managers can delete in their region
    if (user.role === "regional_engineer" || user.role === "regional_general_manager") {
      return user.region === region?.name;
    }
    
    // Global engineers and system admins can delete anywhere
    return user.role === "global_engineer" || user.role === "system_admin";
  };
  
  const affectedPopulation = op5Fault?.affectedPopulation || { rural: 0, urban: 0, metro: 0 };
  
  // Add validation function
  const validateRestorationDate = (restorationDateStr: string): boolean => {
    if (!restorationDateStr) {
      toast.error("Please select a restoration date");
      return false;
    }

    const restorationDateTime = new Date(restorationDateStr);
    const occurrenceDateTime = new Date(fault.occurrenceDate);

    // Check against occurrence date
    if (restorationDateTime <= occurrenceDateTime) {
      toast.error("Restoration date must be after occurrence date");
      return false;
    }

    // If it's an OP5 fault, check against repair dates
    if (isOP5 && op5Fault) {
      if (!op5Fault.repairDate) {
        toast.error("Repair start date is required before resolving the fault");
        return false;
      }

      if (!op5Fault.repairEndDate) {
        toast.error("Repair end date is required before resolving the fault");
        return false;
      }

      const repairDateTime = new Date(op5Fault.repairDate);
      const repairEndDateTime = new Date(op5Fault.repairEndDate);

      if (restorationDateTime <= repairDateTime) {
        toast.error("Restoration date must be after repair start date");
        return false;
      }

      if (restorationDateTime <= repairEndDateTime) {
        toast.error("Restoration date must be after repair end date");
        return false;
      }
    }

    return true;
  };

  const handleResolve = () => {
    // Check if user has permission to manage faults
    const feature = isOP5 ? 'fault_reporting' : 'fault_reporting';
    if (user && !permissionService.canAccessFeature(user.role, feature)) {
      toast.error("You don't have permission to resolve faults");
      return;
    }

    // Validate restoration date
    if (!validateRestorationDate(restorationDate)) {
      return;
    }
    
    resolveFault(fault.id, isOP5, restorationDate);
    setIsResolveOpen(false);
    setRestorationDate(""); // Reset restoration date
    toast.success("Fault has been marked as resolved");
  };

  const handleDelete = () => {
    // Check if user has permission to manage faults
    const feature = isOP5 ? 'fault_reporting_delete' : 'fault_reporting_delete';
    if (user && !permissionService.canAccessFeature(user.role, feature)) {
      toast.error("You don't have permission to delete faults");
      return;
    }
    
    deleteFault(fault.id, isOP5);
    setIsDeleteOpen(false);
    toast.success("Fault has been deleted");
  };
  
  const handleEdit = () => {
    if (!canEdit()) {
      toast.error("You don't have permission to edit this fault");
      return;
    }
    
    if (isOP5) {
      navigate(`/edit-op5-fault/${fault.id}`);
    } else {
      navigate(`/edit-control-outage/${fault.id}`);
    }
  };
  
  // Add test fault function
  const createTestFault = async () => {
    try {
      const testFault = {
        faultType: "Unplanned" as const,
        specificFaultType: "TEST_FAULT",
        description: "Test fault for SMS notification",
        areasAffected: "Test Area",
        substationName: "Test Substation",
        occurrenceDate: new Date().toISOString(),
        regionId: regions[0]?.id || "",
        districtId: districts[0]?.id || "",
        region: regions[0]?.name || "",
        district: districts[0]?.name || "",
        status: "pending" as const,
        customerPhoneNumber: "+233245003731", // Test phone number
        affectedPopulation: {
          rural: 0,
          urban: 0,
          metro: 0
        },
        voltageLevel: "11kV",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.uid || "",
        updatedBy: user?.uid || "",
        outageType: "Unplanned" as const,
        substationNo: "TEST-001",
        feeder: "TEST-FEEDER",
        estimatedResolutionTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        repairDate: null,
        repairEndDate: null,
        restorationDate: null,
        remarks: "Test fault for SMS notification testing",
        materialsUsed: [] // Empty array for test fault
      };

      const faultId = await addOP5Fault(testFault);
      setTestFaultId(faultId);
      setIsTestMode(true);
      toast.success("Test fault created successfully. You can now resolve it to test SMS notification.");
    } catch (error) {
      console.error("Error creating test fault:", error);
      toast.error("Failed to create test fault");
    }
  };

  // Debug logging
  console.log('[FaultCard] Debug info:', {
    userRole: user?.role,
    isSystemAdmin: user?.role === "system_admin",
    isTestMode,
    isControlTestMode,
    testFaultId,
    testControlOutageId,
    faultId: fault.id
  });

  // Add test control outage function
  const createTestControlOutage = async () => {
    try {
      const testControlOutage = {
        date: new Date().toISOString(),
        region: regions[0]?.name || "",
        district: districts[0]?.name || "",
        description: "Test control outage for SMS notification",
        duration: 0, // Will be calculated when resolved
        regionId: regions[0]?.id || "",
        districtId: districts[0]?.id || "",
        occurrenceDate: new Date().toISOString(),
        restorationDate: null,
        faultType: "Unplanned" as const,
        specificFaultType: "TEST_CONTROL_OUTAGE",
        status: "pending" as const,
        loadMW: 0, // Test load
        unservedEnergyMWh: 0, // Will be calculated when resolved
        reason: "Test control outage for SMS notification testing",
        controlPanelIndications: "Test panel indications",
        areaAffected: "Test Control Area",
        customersAffected: {
          rural: 0,
          urban: 0,
          metro: 0
        },
        estimatedResolutionTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        isOffline: false
      };

      const controlOutageId = await addControlSystemOutage(testControlOutage);
      setTestControlOutageId(controlOutageId);
      setIsControlTestMode(true);
      toast.success("Test control outage created successfully. You can now resolve it to test SMS notification.");
    } catch (error) {
      console.error("Error creating test control outage:", error);
      toast.error("Failed to create test control outage");
    }
  };

  return (
    <Card className={`h-full flex flex-col shadow-md hover:shadow-lg transition-all duration-200 ease-out hover:scale-[1.01] overflow-hidden ${getCardColors(fault.faultType)}`}>
      <CardHeader className="p-4 pb-2 bg-white/80 dark:bg-gray-800/50">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold">
            {isOP5 ? "OP5 Fault" : "Control System Outage"}
            {isTestMode && fault.id === testFaultId && (
              <Badge className="ml-2 bg-purple-100 text-purple-800">Test Mode</Badge>
            )}
          </CardTitle>
          <Badge className={`${statusClass} shadow-sm`}>
            {fault.status === "pending" ? "Pending" : "Resolved"}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-1">
          <MapPin size={14} className="text-muted-foreground" />
          {region?.name}, {district?.name}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4 flex-grow">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className={getBadgeColor(fault.faultType)}>
              {fault.faultType}
            </Badge>
            {(fault as any).specificFaultType && (
              <Badge variant="outline" className="text-xs">
                {(fault as any).specificFaultType}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {isOP5 ? `OP5-${fault.id.slice(0, 8)}` : `CON-${fault.id.slice(0, 8)}`}
            </Badge>
          </div>
          
          <div className="space-y-2">
            {/* Primary Contact Number - only for OP5 faults */}
            {isOP5 && (fault as any).customerPhoneNumber && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone size={14} />
                <span>Primary Contact: {(fault as any).customerPhoneNumber}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock size={14} />
              <span>Duration: {durationText}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users size={14} />
              <span>Affected: {getTotalAffectedCustomers().toLocaleString()} customers</span>
            </div>
            
            {isOP5 && op5Fault?.repairDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock size={14} />
                <span>Repair Started: {formatDate(op5Fault.repairDate, true)}</span>
              </div>
            )}
            
            {isOP5 && op5Fault?.repairEndDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock size={14} />
                <span>Repair Ended: {formatDate(op5Fault.repairEndDate, true)}</span>
              </div>
            )}
            
            {isOP5 && op5Fault?.mttr && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart size={14} />
                <span>MTTR: {formatDuration(op5Fault.mttr)}</span>
              </div>
            )}
            
            {!isOP5 && controlOutage?.unservedEnergyMWh && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart size={14} />
                <span>Unserved Energy: {controlOutage.unservedEnergyMWh.toFixed(2)} MWh</span>
              </div>
            )}
          </div>
          
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="details" className="border-b-0">
              <AccordionTrigger className="text-sm py-2">View Details</AccordionTrigger>
              <AccordionContent className="text-xs space-y-2 bg-white/50 dark:bg-gray-900/30 p-2 rounded-md">
                <div>
                  <div className="font-medium text-muted-foreground">Occurred:</div>
                  <div>{formatDate(fault.occurrenceDate, true)}</div>
                </div>
                
                {fault.restorationDate && (
                  <div>
                    <div className="font-medium text-muted-foreground">Restored:</div>
                    <div>{formatDate(fault.restorationDate, true)}</div>
                  </div>
                )}
                
                {(fault as any).faultLocation && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin size={14} />
                    <span>Location: {(fault as any).faultLocation}</span>
                  </div>
                )}
                
                {isOP5 && (fault as any).areasAffected && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin size={14} />
                    <span>Areas Affected: {(fault as any).areasAffected}</span>
                  </div>
                )}
                
                {!isOP5 && (fault as any).areaAffected && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin size={14} />
                    <span>Area Affected: {(fault as any).areaAffected}</span>
                  </div>
                )}
                
                {(fault as any).outageDescription && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText size={14} />
                    <span>Description: {(fault as any).outageDescription}</span>
                  </div>
                )}
                {isOP5 && op5Fault?.remarks && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText size={14} />
                    <span>Remarks: {op5Fault.remarks}</span>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-4 bg-white/80 dark:bg-gray-800/50 mt-auto">
        <div className="flex flex-col gap-2 w-full sm:flex-row">
          {/* Test buttons */}
          {user?.role === "system_admin" && (
            <>
              {/* Debug info */}
              <div className="text-xs text-gray-500 mb-2">
                Debug: Admin={user?.role === "system_admin"}, TestMode={isTestMode}, ControlTestMode={isControlTestMode}
              </div>
              {!isTestMode && !isControlTestMode && (
                <>
                  <Button 
                    variant="outline" 
                    className="w-full border-purple-200 hover:bg-purple-50 hover:text-purple-700 dark:hover:bg-purple-900/30 bg-purple-100"
                    onClick={createTestFault}
                  >
                    <TestTube className="mr-2 h-4 w-4 text-purple-500" />
                    Create OP5 Test
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 bg-blue-100"
                    onClick={createTestControlOutage}
                  >
                    <TestTube className="mr-2 h-4 w-4 text-blue-500" />
                    Create Control Test
                  </Button>
                </>
              )}
              {isTestMode && fault.id === testFaultId && (
                <Button 
                  variant="outline" 
                  className="flex-1 border-purple-200 hover:bg-purple-50 hover:text-purple-700 dark:hover:bg-purple-900/30"
                  onClick={() => {
                    setIsTestMode(false);
                    setTestFaultId(null);
                  }}
                >
                  <TestTube className="mr-2 h-4 w-4 text-purple-500" />
                  Exit OP5 Test Mode
                </Button>
              )}
              {isControlTestMode && fault.id === testControlOutageId && (
                <Button 
                  variant="outline" 
                  className="flex-1 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30"
                  onClick={() => {
                    setIsControlTestMode(false);
                    setTestControlOutageId(null);
                  }}
                >
                  <TestTube className="mr-2 h-4 w-4 text-blue-500" />
                  Exit Control Test Mode
                </Button>
              )}
            </>
          )}
          
          {canResolve() && (
            <Dialog open={isResolveOpen} onOpenChange={setIsResolveOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1 border-green-200 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-900/30">
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                  Resolve
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Resolve Fault</DialogTitle>
                  <DialogDescription>
                    Please select the restoration date and time to mark this fault as resolved.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="restorationDate">Restoration Date & Time</Label>
                    <Input
                      id="restorationDate"
                      type="datetime-local"
                      value={restorationDate}
                      onChange={(e) => setRestorationDate(e.target.value)}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      The restoration date must be after the occurrence date and any repair dates.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setIsResolveOpen(false);
                    setRestorationDate(""); // Reset restoration date
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleResolve} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirm Resolve
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          
          {canEdit() && (
            <Button 
              variant="outline" 
              className="flex-1 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30"
              onClick={handleEdit}
            >
              <Edit className="mr-2 h-4 w-4 text-blue-500" />
              Edit
            </Button>
          )}
          
          {canDelete() && (
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1 border-red-200 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30">
                  <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Fault</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this fault? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
