import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { VITAsset, VITInspection } from '../../lib/types';
import { toast } from 'react-hot-toast';

interface VITInspectionFormProps {
  asset: VITAsset;
  inspection?: VITInspection;
  isEditing?: boolean;
}

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    const inspectionData = {
      vitAssetId: asset.id,
      regionId: asset.regionId,
      districtId: asset.districtId,
      inspectionDate: formData.inspectionDate,
      inspectedBy: formData.inspectedBy,
      rodentTermiteEncroachment: formData.rodentTermiteEncroachment,
      cleanDustFree: formData.cleanDustFree,
      // ... rest of the form data ...
      createdAt: new Date().toISOString(),
    };

    if (isEditing && inspection) {
      await updateVITInspection(inspection.id, inspectionData);
      toast.success('Inspection updated successfully');
    } else {
      await createVITInspection(inspectionData);
      toast.success('Inspection created successfully');
    }
    navigate('/asset-management/vit-inspections');
  } catch (error) {
    console.error('Error saving inspection:', error);
    toast.error('Failed to save inspection');
  }
}; 