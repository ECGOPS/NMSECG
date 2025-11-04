import React, { useState } from 'react';
import { useFormValidation } from '@/hooks/useFormValidation';
import { op5FormSchema, type OP5FormData } from '@/lib/validation-schemas';
import { ValidatedInput, ValidatedSelect, ValidatedTextarea } from '@/components/ui/validated-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';

export function ValidatedFormExample() {
  const [formData, setFormData] = useState<Partial<OP5FormData>>({
    regionId: '',
    districtId: '',
    outageType: '',
    outageDescription: '',
    areasAffected: '',
    substationNo: '',
    occurrenceDate: '',
    ruralAffected: null,
    urbanAffected: null,
    metroAffected: null,
  });

  const { errors, isValid, validateForm, clearErrors } = useFormValidation(
    op5FormSchema, 
    formData
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateForm(formData);
    if (validationErrors.length > 0) {
      toast.error(`Form has ${validationErrors.length} validation errors`);
      return;
    }
    
    // Simulate form submission
    toast.success('Form submitted successfully!');
    console.log('Valid form data:', formData);
  };

  const handleReset = () => {
    setFormData({
      regionId: '',
      districtId: '',
      outageType: '',
      outageDescription: '',
      areasAffected: '',
      substationNo: '',
      occurrenceDate: '',
      ruralAffected: null,
      urbanAffected: null,
      metroAffected: null,
    });
    clearErrors();
  };

  const updateField = (field: keyof OP5FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>OP5 Fault Report Form</CardTitle>
          <CardDescription>
            Example form demonstrating real-time validation with Zod schemas
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ValidatedInput
                label="Region ID"
                schema={op5FormSchema}
                field="regionId"
                value={formData.regionId}
                onValueChange={(value) => updateField('regionId', value)}
                placeholder="Enter region ID"
                required
              />
              
              <ValidatedInput
                label="District ID"
                schema={op5FormSchema}
                field="districtId"
                value={formData.districtId}
                onValueChange={(value) => updateField('districtId', value)}
                placeholder="Enter district ID"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ValidatedInput
                label="Outage Type"
                schema={op5FormSchema}
                field="outageType"
                value={formData.outageType}
                onValueChange={(value) => updateField('outageType', value)}
                placeholder="Enter outage type"
                required
              />
              
              <ValidatedInput
                label="Substation Number"
                schema={op5FormSchema}
                field="substationNo"
                value={formData.substationNo}
                onValueChange={(value) => updateField('substationNo', value)}
                placeholder="Enter substation number"
                required
              />
            </div>

            <ValidatedTextarea
              label="Outage Description"
              schema={op5FormSchema}
              field="outageDescription"
              value={formData.outageDescription}
              onValueChange={(value) => updateField('outageDescription', value)}
              placeholder="Describe the outage in detail"
              required
              rows={3}
            />

            <ValidatedTextarea
              label="Areas Affected"
              schema={op5FormSchema}
              field="areasAffected"
              value={formData.areasAffected}
              onValueChange={(value) => updateField('areasAffected', value)}
              placeholder="Describe the areas affected by the outage"
              required
              rows={2}
            />

            <ValidatedInput
              label="Occurrence Date"
              schema={op5FormSchema}
              field="occurrenceDate"
              value={formData.occurrenceDate}
              onValueChange={(value) => updateField('occurrenceDate', value)}
              type="date"
              required
            />

            {/* Affected Population */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Affected Population</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ValidatedInput
                  label="Rural Affected"
                  schema={op5FormSchema}
                  field="ruralAffected"
                  value={formData.ruralAffected || ''}
                  onValueChange={(value) => updateField('ruralAffected', value ? Number(value) : null)}
                  type="number"
                  min="0"
                  placeholder="0"
                />
                
                <ValidatedInput
                  label="Urban Affected"
                  schema={op5FormSchema}
                  field="urbanAffected"
                  value={formData.urbanAffected || ''}
                  onValueChange={(value) => updateField('urbanAffected', value ? Number(value) : null)}
                  type="number"
                  min="0"
                  placeholder="0"
                />
                
                <ValidatedInput
                  label="Metro Affected"
                  schema={op5FormSchema}
                  field="metroAffected"
                  value={formData.metroAffected || ''}
                  onValueChange={(value) => updateField('metroAffected', value ? Number(value) : null)}
                  type="number"
                  min="0"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-between items-center pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                {isValid ? (
                  <span className="text-green-600">✓ Form is valid and ready to submit</span>
                ) : (
                  <span className="text-red-600">
                    ✗ Form has {errors.length} validation error{errors.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={handleReset}>
                  Reset Form
                </Button>
                <Button type="submit" disabled={!isValid}>
                  Submit Report
                </Button>
              </div>
            </div>

            {/* Validation Errors Summary */}
            {errors.length > 0 && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <h4 className="font-medium text-red-800 mb-2">Validation Errors:</h4>
                <ul className="space-y-1">
                  {errors.map((error, index) => (
                    <li key={index} className="text-sm text-red-700">
                      <strong>{error.field}:</strong> {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
