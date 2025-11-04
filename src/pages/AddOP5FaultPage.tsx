import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import OP5FaultForm from '@/components/faults/OP5FaultForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OP5Fault } from '@/lib/types';

const AddOP5FaultPage: React.FC = () => {
  const navigate = useNavigate();
  const { addOP5Fault } = useData();

  const handleSubmit = async (formData: Partial<OP5Fault>) => {
    try {
      // Ensure all required fields are present
      const completeFault: Omit<OP5Fault, 'id' | 'status'> = {
        regionId: formData.regionId || '',
        districtId: formData.districtId || '',
        occurrenceDate: formData.occurrenceDate || '',
        restorationDate: formData.restorationDate || '',
        repairDate: formData.repairDate || '',
        faultType: formData.faultType || 'Unplanned',
        specificFaultType: formData.specificFaultType || '',
        faultLocation: formData.faultLocation || '',
        affectedPopulation: formData.affectedPopulation || {
          rural: 0,
          urban: 0,
          metro: 0
        },
        mttr: formData.mttr || 0,
        reliabilityIndices: formData.reliabilityIndices || {
          saidi: 0,
          saifi: 0,
          caidi: 0
        },
        materialsUsed: formData.materialsUsed || [],
        outageDescription: formData.outageDescription || '',
        createdAt: new Date().toISOString(),
        createdBy: 'current-user' // TODO: Replace with actual user ID
      };

      await addOP5Fault(completeFault);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error adding OP5 fault:', error);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Add New OP5 Fault</CardTitle>
        </CardHeader>
        <CardContent>
          <OP5FaultForm onSubmit={handleSubmit} />
          <div className="mt-6 flex justify-end">
            <Button onClick={() => navigate('/dashboard')} variant="outline" className="mr-2">
              Cancel
            </Button>
            <Button type="submit" onClick={() => handleSubmit(formData)}>
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddOP5FaultPage; 