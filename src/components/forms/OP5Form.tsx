import { useState } from 'react';
import { MaterialUsed } from '@/lib/types';
import { OP5Fault } from '@/types/faults';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface OP5FormProps {
  onSubmit: (data: Partial<OP5Fault>) => void;
  initialData?: Partial<OP5Fault>;
}

export default function OP5Form({ onSubmit, initialData }: OP5FormProps) {
  const [currentMaterialType, setCurrentMaterialType] = useState<string>('');
  const [currentMaterialDetails, setCurrentMaterialDetails] = useState<Partial<MaterialUsed>>({});
  const [materials, setMaterials] = useState<MaterialUsed[]>([]);

  const handleMaterialDetailChange = (field: keyof MaterialUsed, value: string) => {
    // For fuse rating, only allow numbers
    if (field === 'rating' && value !== '' && !/^\d+$/.test(value)) {
      return;
    }
    
    setCurrentMaterialDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // ... rest of the component code ...

  return (
    <div>
      {/* ... existing JSX ... */}

      {currentMaterialType === 'Fuse' && (
        <div className="space-y-2">
          <Label htmlFor="fuse-rating">Fuse Rating</Label>
          <Input
            id="fuse-rating"
            type="number"
            min="0"
            step="1"
            value={currentMaterialDetails.rating || ''}
            onChange={(e) => handleMaterialDetailChange('rating', e.target.value)}
            placeholder="Enter fuse rating"
            className="w-full"
          />
        </div>
      )}
    </div>
  );
} 