import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { securityMonitoringService, EVENT_TYPES } from '@/services/SecurityMonitoringService';
import { toast } from '@/components/ui/sonner';

export function SecurityEventTest() {
  const testLoginAttempt = async () => {
    try {
      const eventId = await securityMonitoringService.logEvent({
        eventType: EVENT_TYPES.LOGIN_ATTEMPT,
        userId: 'test@example.com',
        timestamp: new Date().toISOString(),
        details: 'Test login attempt',
        severity: 'low',
        status: 'new',
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: navigator.userAgent
        }
      });
      
      if (eventId) {
        toast.success('Login attempt event logged successfully');
      } else {
        toast.error('Failed to log login attempt event');
      }
    } catch (error) {
      console.error('Error logging login attempt:', error);
      toast.error('Error logging login attempt event');
    }
  };

  const testLoginSuccess = async () => {
    try {
      const eventId = await securityMonitoringService.logEvent({
        eventType: EVENT_TYPES.LOGIN_SUCCESS,
        userId: 'test@example.com',
        timestamp: new Date().toISOString(),
        details: 'Test successful login',
        severity: 'low',
        status: 'new',
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: navigator.userAgent,
          role: 'system_admin'
        }
      });
      
      if (eventId) {
        toast.success('Login success event logged successfully');
      } else {
        toast.error('Failed to log login success event');
      }
    } catch (error) {
      console.error('Error logging login success:', error);
      toast.error('Error logging login success event');
    }
  };

  const testLoginFailure = async () => {
    try {
      const eventId = await securityMonitoringService.logEvent({
        eventType: EVENT_TYPES.LOGIN_FAILURE,
        userId: 'test@example.com',
        timestamp: new Date().toISOString(),
        details: 'Test failed login',
        severity: 'high',
        status: 'new',
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: navigator.userAgent,
          reason: 'invalid_password'
        }
      });
      
      if (eventId) {
        toast.success('Login failure event logged successfully');
      } else {
        toast.error('Failed to log login failure event');
      }
    } catch (error) {
      console.error('Error logging login failure:', error);
      toast.error('Error logging login failure event');
    }
  };

  const testSuspiciousActivity = async () => {
    try {
      const eventId = await securityMonitoringService.logEvent({
        eventType: EVENT_TYPES.SUSPICIOUS_ACTIVITY,
        userId: 'test@example.com',
        timestamp: new Date().toISOString(),
        details: 'Test suspicious activity',
        severity: 'medium',
        status: 'new',
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: navigator.userAgent,
          activityType: 'multiple_failed_attempts'
        }
      });
      
      if (eventId) {
        toast.success('Suspicious activity event logged successfully');
      } else {
        toast.error('Failed to log suspicious activity event');
      }
    } catch (error) {
      console.error('Error logging suspicious activity:', error);
      toast.error('Error logging suspicious activity event');
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto my-8">
      <CardHeader>
        <CardTitle>Security Event Testing</CardTitle>
        <CardDescription>
          Test different types of security event logging. Note that non-login events require system admin privileges.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Button onClick={testLoginAttempt} variant="outline">
            Test Login Attempt
          </Button>
          <Button onClick={testLoginSuccess} variant="outline">
            Test Login Success
          </Button>
          <Button onClick={testLoginFailure} variant="outline">
            Test Login Failure
          </Button>
          <Button onClick={testSuspiciousActivity} variant="outline">
            Test Suspicious Activity
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 