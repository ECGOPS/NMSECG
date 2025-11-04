import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAzureADAuth } from '../contexts/AzureADAuthContext';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { toast } from 'react-hot-toast';
import { DistrictPopulationReset } from '../components/admin/DistrictPopulationReset';
import { RegionPopulation } from '../lib/types';

export function DistrictPopulationManagement() {
  // ... existing code ...

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <h1 className="text-3xl font-bold">District Population Management</h1>
        
        {/* Add the reset component at the top */}
        <DistrictPopulationReset />

        <Card>
          <CardHeader>
            <CardTitle>Update District Population</CardTitle>
          </CardHeader>
          <CardContent>
            {/* ... rest of the existing form ... */}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
} 