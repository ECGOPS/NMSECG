import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Package, Zap, Cable, Box } from 'lucide-react';
import { OP5Fault, Material } from '@/types/faults';

interface MaterialsStats {
  totalMaterials: number;
  byType: Array<{ name: string; value: number }>;
  byMonth: Array<{ name: string; value: number }>;
  topMaterials: Array<{ name: string; value: number }>;
}

interface MaterialsAnalysisProps {
  faults: OP5Fault[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium text-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-muted-foreground" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function MaterialsAnalysis({ faults }: MaterialsAnalysisProps) {
  const [stats, setStats] = useState<MaterialsStats>({
    totalMaterials: 0,
    byType: [
      { name: 'Fuse', value: 0 },
      { name: 'Conductor', value: 0 },
      { name: 'Others', value: 0 }
    ],
    byMonth: [],
    topMaterials: []
  });

  useEffect(() => {
    console.log('[MaterialsAnalysis] Starting analysis with faults:', {
      totalFaults: faults.length,
      faultsWithMaterials: faults.filter(f => f.materialsUsed && f.materialsUsed.length > 0).length,
      sampleFault: faults[0]
    });
    
    // Initialize stats
    const materialsStats: MaterialsStats = {
      totalMaterials: 0,
      byType: [
        { name: 'Fuse', value: 0 },
        { name: 'Conductor', value: 0 },
        { name: 'Others', value: 0 }
      ],
      byMonth: [],
      topMaterials: []
    };

    // Process each fault's materials
    const materialsByMonth = new Map<string, number>();
    const materialsByType = new Map<string, number>();

    faults.forEach(fault => {
      console.log('[MaterialsAnalysis] Processing fault:', {
        id: fault.id,
        materialsUsed: fault.materialsUsed,
        hasMaterials: Boolean(fault.materialsUsed),
        materialsLength: fault.materialsUsed?.length
      });

      if (!fault.materialsUsed || !Array.isArray(fault.materialsUsed)) {
        console.log('[MaterialsAnalysis] No materials found in fault:', fault.id);
        return;
      }

      fault.materialsUsed.forEach(material => {
        console.log('[MaterialsAnalysis] Processing material:', {
          material,
          type: material.type,
          isValid: Boolean(material && material.type)
        });

        if (!material || !material.type) {
          console.log('[MaterialsAnalysis] Invalid material found:', material);
          return;
        }

        // Count total materials
        materialsStats.totalMaterials++;

        // Count by type
        const typeIndex = materialsStats.byType.findIndex(item => item.name === material.type);
        if (typeIndex >= 0) {
          materialsStats.byType[typeIndex].value++;
        }

        // Count by month
        const month = new Date(fault.occurrenceDate).toLocaleString('default', { month: 'short', year: 'numeric' });
        materialsByMonth.set(month, (materialsByMonth.get(month) || 0) + 1);

        // Count specific materials
        const materialKey = getMaterialKey(material);
        materialsByType.set(materialKey, (materialsByType.get(materialKey) || 0) + 1);
      });
    });

    // Convert maps to arrays
    materialsStats.byMonth = Array.from(materialsByMonth.entries())
      .map(([month, count]) => ({ name: month, value: count }))
      .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());

    materialsStats.topMaterials = Array.from(materialsByType.entries())
      .map(([material, count]) => ({ name: material, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    console.log('[MaterialsAnalysis] Final stats:', {
      totalMaterials: materialsStats.totalMaterials,
      byType: materialsStats.byType,
      byMonth: materialsStats.byMonth,
      topMaterials: materialsStats.topMaterials
    });

    setStats(materialsStats);
  }, [faults]);

  const getMaterialKey = (material: Material): string => {
    switch (material.type) {
      case 'Fuse':
        return `Fuse ${material.rating || 'Unknown'}`;
      case 'Conductor':
        return `Conductor ${material.conductorType || 'Unknown'}`;
      case 'Others':
        return `Other ${material.description || 'Unknown'}`;
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Materials Used</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMaterials}</div>
          </CardContent>
        </Card>

        {stats.byType.map((type, index) => (
          <Card key={type.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{type.name}</CardTitle>
              {type.name === 'Fuse' && <Zap className="h-4 w-4 text-muted-foreground" />}
              {type.name === 'Conductor' && <Cable className="h-4 w-4 text-muted-foreground" />}
              {type.name === 'Others' && <Box className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{type.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Materials by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.byType}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {stats.byType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-muted-foreground" />
                  <YAxis className="text-muted-foreground" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Materials Used" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Materials Used</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.topMaterials}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-muted-foreground" />
                <YAxis dataKey="name" type="category" width={150} className="text-muted-foreground" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Usage Count" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 