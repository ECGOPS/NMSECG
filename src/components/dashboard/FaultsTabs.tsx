import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { OP5Fault, ControlSystemOutage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Zap, Activity, Users } from "lucide-react";

interface FaultsTabsProps {
  op5Faults: OP5Fault[];
  controlOutages: ControlSystemOutage[];
}

export function FaultsTabs({ op5Faults, controlOutages }: FaultsTabsProps) {
  const [activeTab, setActiveTab] = useState("all");

  const allFaults = [...op5Faults, ...controlOutages].sort((a, b) => 
    new Date(b.occurrenceDate).getTime() - new Date(a.occurrenceDate).getTime()
  );

  const getStatusColor = (status: "active" | "resolved") => {
    return status === "active" 
      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
      : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  };

  return (
    <Tabs 
      defaultValue="all" 
      className="w-full"
      onValueChange={setActiveTab}
    >
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger 
          value="all" 
          className={cn(
            "transition-all duration-200",
            activeTab === "all" && "bg-gradient-to-r from-purple-500 to-indigo-500 text-white"
          )}
        >
          All Faults ({allFaults.length})
        </TabsTrigger>
        <TabsTrigger 
          value="op5" 
          className={cn(
            "transition-all duration-200",
            activeTab === "op5" && "bg-gradient-to-r from-orange-500 to-red-500 text-white"
          )}
        >
          OP5 Faults ({op5Faults.length})
        </TabsTrigger>
        <TabsTrigger 
          value="control" 
          className={cn(
            "transition-all duration-200",
            activeTab === "control" && "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
          )}
        >
          Control System ({controlOutages.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-0">
        <Card className="border-t-4 border-t-indigo-500">
          <CardContent className="p-4">
            <div className="space-y-4">
              {allFaults.map((fault, index) => (
                <div 
                  key={index}
                  className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <h3 className="font-semibold">
                        {'description' in fault ? fault.description : fault.outageDescription}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        {new Date(fault.occurrenceDate).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <MapPin className="h-4 w-4" />
                        {'faultLocation' in fault ? fault.faultLocation : fault.system}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Badge className={cn(
                        "px-3 py-1 rounded-full",
                        getStatusColor(fault.status)
                      )}>
                        {fault.status}
                      </Badge>
                      <Badge className={cn(
                        "px-3 py-1 rounded-full",
                        'description' in fault 
                          ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                      )}>
                        {'description' in fault ? 'OP5' : 'Control'}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="op5" className="mt-0">
        <Card className="border-t-4 border-t-red-500">
          <CardContent className="p-4">
            <div className="space-y-4">
              {op5Faults.map((fault, index) => (
                <div 
                  key={index}
                  className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <h3 className="font-semibold">{fault.description}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        {new Date(fault.occurrenceDate).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <MapPin className="h-4 w-4" />
                        {fault.faultLocation}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Zap className="h-4 w-4" />
                        {fault.faultType} - {fault.specificFaultType}
                      </div>
                      {fault.affectedPopulation && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Users className="h-4 w-4" />
                          Population Affected: {(
                            fault.affectedPopulation.rural + 
                            fault.affectedPopulation.urban + 
                            fault.affectedPopulation.metro
                          ).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <Badge className={cn(
                      "px-3 py-1 rounded-full",
                      getStatusColor(fault.status)
                    )}>
                      {fault.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="control" className="mt-0">
        <Card className="border-t-4 border-t-teal-500">
          <CardContent className="p-4">
            <div className="space-y-4">
              {controlOutages.map((outage, index) => (
                <div 
                  key={index}
                  className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <h3 className="font-semibold">{outage.outageDescription}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        {new Date(outage.occurrenceDate).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <MapPin className="h-4 w-4" />
                        System: {outage.system}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Activity className="h-4 w-4" />
                        Load: {outage.loadMW} MW | Unserved Energy: {outage.unservedEnergyMWh} MWh
                      </div>
                    </div>
                    <Badge className={cn(
                      "px-3 py-1 rounded-full",
                      getStatusColor(outage.status)
                    )}>
                      {outage.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
} 