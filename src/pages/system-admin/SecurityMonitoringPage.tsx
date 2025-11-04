import React, { useState, useEffect } from 'react';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { SecurityEvent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import { apiRequest } from '@/lib/api';
import { Shield, AlertTriangle, Eye, Trash2, Activity, Bell, Users } from 'lucide-react';
import { Layout } from "@/components/layout/Layout";
import { Separator } from "@/components/ui/separator";

interface UserStatus {
  online: number;
  idle: number;
  offline: number;
}

export default function SecurityMonitoringPage() {
  const [userStatus, setUserStatus] = useState<UserStatus>({ online: 0, idle: 0, offline: 0 });
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const { user } = useAzureADAuth();

  useEffect(() => {
    // Query users who have been active in the last 15 minutes
    const fifteenMinutesAgo = new Date();
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);

    const fetchUserStatus = async () => {
      try {
        const online = await apiRequest('/api/users/status/online');
        const idle = await apiRequest('/api/users/status/idle');
        const offline = await apiRequest('/api/users/status/offline');
        setUserStatus({ online, idle, offline });
      } catch (error) {
        console.error('Error fetching user status:', error);
        toast.error('Failed to fetch user status');
      }
    };

    fetchUserStatus();

    const interval = setInterval(fetchUserStatus, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadSecurityEvents();
    const interval = setInterval(loadSecurityEvents, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadSecurityEvents = async () => {
    try {
      const params = new URLSearchParams();
      params.append('sort', 'timestamp');
      params.append('order', 'desc');
      params.append('limit', '100');
      
      const events = await apiRequest(`/api/securityEvents?${params.toString()}`);
      
      // Validate and sanitize the events data
      const sanitizedEvents = Array.isArray(events) ? events.map(event => ({
        ...event,
        id: event.id || 'unknown',
        eventType: event.eventType || 'unknown',
        details: event.details || 'No details available',
        severity: event.severity || 'low',
        status: event.status || 'active'
      })) : [];
      
      setSecurityEvents(sanitizedEvents);
    } catch (error) {
      console.error('Error loading security events:', error);
      toast.error('Failed to load security events');
      setSecurityEvents([]);
    }
  };

  const deleteSecurityEvent = async (eventId: string) => {
    try {
      await apiRequest(`/api/securityEvents/${eventId}`, {
        method: 'DELETE',
      });
      toast.success('Security event deleted successfully');
      loadSecurityEvents(); // Reload events
    } catch (error) {
      console.error('Error deleting security event:', error);
      toast.error('Failed to delete security event');
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
        <div className="container mx-auto px-4 py-8">
          {/* Enhanced Page Header with Stats */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Security Monitoring
              </h1>
            </div>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Monitor and manage security events across the system with real-time updates and comprehensive filtering.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Quick Stats Cards */}
            <Card className="bg-gradient-to-br from-blue-500/20 via-blue-600/20 to-blue-700/20 border-blue-500/20 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/10 transition-all">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-blue-500">Active Monitoring</CardTitle>
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Activity className="h-4 w-4 text-blue-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-blue-600">Real-time</p>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/20 via-purple-600/20 to-purple-700/20 border-purple-500/20 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/10 transition-all">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-purple-500">Event Notifications</CardTitle>
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Bell className="h-4 w-4 text-purple-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-purple-600">Instant</p>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-500/20 via-indigo-600/20 to-indigo-700/20 border-indigo-500/20 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10 transition-all">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-indigo-500">Security Status</CardTitle>
                  <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <Shield className="h-4 w-4 text-indigo-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-indigo-600">Protected</p>
              </CardHeader>
            </Card>
          </div>

          {/* User Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-emerald-500/20 via-emerald-600/20 to-emerald-700/20 border-emerald-500/20 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10 transition-all">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-emerald-500">Online Users</CardTitle>
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Users className="h-4 w-4 text-emerald-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{userStatus.online}</p>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/20 via-amber-600/20 to-amber-700/20 border-amber-500/20 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/10 transition-all">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-amber-500">Idle Users</CardTitle>
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Users className="h-4 w-4 text-amber-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-amber-600">{userStatus.idle}</p>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-slate-500/20 via-slate-600/20 to-slate-700/20 border-slate-500/20 hover:border-slate-500/30 hover:shadow-lg hover:shadow-slate-500/10 transition-all">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-slate-500">Offline Users</CardTitle>
                  <div className="p-2 bg-slate-500/10 rounded-lg">
                    <Users className="h-4 w-4 text-slate-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-600">{userStatus.offline}</p>
              </CardHeader>
            </Card>
          </div>

          <Separator className="my-8 bg-border/40" />

          {/* Main Content with enhanced styling */}
          <Card className="bg-gradient-to-br from-slate-800/10 via-slate-900/10 to-slate-950/10 border-slate-700/20 hover:border-slate-700/30 shadow-xl">
            <CardHeader className="border-b border-slate-700/20 bg-slate-900/5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold">Security Events</CardTitle>
                <div className="p-2 bg-slate-500/10 rounded-lg">
                  <Activity className="h-5 w-5 text-slate-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-700">
                  <thead className="bg-slate-900/5">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Event ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Details
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-900/5 divide-y divide-slate-700">
                    {securityEvents.map((event) => (
                      <tr key={event.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-200">
                          {event.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                          <Badge variant="secondary">{event.eventType}</Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                          {(() => {
                            try {
                              const timestamp = event.timestamp;
                              if (timestamp && typeof timestamp === 'object' && '_seconds' in timestamp && timestamp._seconds !== null && timestamp._seconds !== undefined) {
                                return format(new Date(timestamp._seconds * 1000), 'MM/dd HH:mm:ss');
                              } else if (timestamp && typeof timestamp === 'string') {
                                return format(new Date(timestamp), 'MM/dd HH:mm:ss');
                              } else {
                                return 'Invalid timestamp';
                              }
                            } catch (error) {
                              console.error('Error formatting timestamp:', error);
                              return 'Invalid timestamp';
                            }
                          })()}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300">
                          <div className="flex items-center">
                            <Eye className="h-4 w-4 text-slate-400 mr-2" />
                            <span>{event.details}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteSecurityEvent(event.id)}
                            className="text-red-500 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
} 