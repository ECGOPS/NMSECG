import React, { useState, useEffect } from 'react';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import { apiRequest } from '@/lib/api';
import { Edit, Trash2, Eye, User as UserIcon } from 'lucide-react';
import { Table, TableHeader, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/table';
import { SafeText } from '@/components/ui/safe-display';

interface ActiveUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  lastActive: string; // Changed from Timestamp to string
  ipAddress?: string;
  status: 'online' | 'idle' | 'offline';
}

export function ActiveUsers() {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);

  useEffect(() => {
    loadActiveUsers();
    const interval = setInterval(loadActiveUsers, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Replace Firebase operations with API calls
  const loadActiveUsers = async () => {
    try {
      const params = new URLSearchParams();
      params.append('sort', 'lastLogin');
      params.append('order', 'desc');
      params.append('limit', '100');
      params.append('disabled', 'false'); // Only get active users
      
      const users = await apiRequest(`/api/users?${params.toString()}`);
      setActiveUsers(users);
    } catch (error) {
      console.error('Error loading active users:', error);
      toast.error('Failed to load active users');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Users ({activeUsers.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Last Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      <SafeText content={user.name || 'N/A'} />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <SafeText content={user.email} />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    <SafeText content={user.role.replace('_', ' ')} />
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={
                    user.status === 'online' ? 'default' :
                    user.status === 'idle' ? 'secondary' :
                    'outline'
                  }>
                    <SafeText content={user.status} />
                  </Badge>
                </TableCell>
                <TableCell>
                  <SafeText content={user.ipAddress || 'unknown'} />
                </TableCell>
                <TableCell>
                  <SafeText content={new Date(user.lastActive).toLocaleString()} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
} 