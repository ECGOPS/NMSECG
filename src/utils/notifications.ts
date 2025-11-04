import { toast } from "sonner";

export async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      toast.success('Notifications enabled');
      return true;
    } else {
      toast.error('Notifications permission denied');
      return false;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    toast.error('Failed to request notification permission');
    return false;
  }
}

export function showNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      ...options
    });
  } else if (Notification.permission !== 'denied') {
    requestNotificationPermission();
  }
}

export function showServiceWorkerNotification(title: string, options?: NotificationOptions) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      options
    });
  }
} 