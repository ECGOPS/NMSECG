import { useContext } from 'react';
import { AzureADAuthContext } from '../contexts/AzureADAuthContext';
import { User } from '@/lib/types';
import { 
  hasRoleAccess, 
  hasRegionAccess, 
  hasDistrictAccess, 
  canReadData, 
  canCreateData, 
  canUpdateData, 
  canDeleteData, 
  filterDataByAccess 
} from '../utils/accessControl';

export const useAccessControl = () => {
  const context = useContext(AzureADAuthContext);
  
  if (!context) {
    throw new Error('useAccessControl must be used within an AzureADAuthProvider');
  }
  
  return context;
}; 