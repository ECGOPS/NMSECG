// Service Worker Update Handler
export class ServiceWorkerUpdateHandler {
  private static instance: ServiceWorkerUpdateHandler;
  private updateAvailable = false;
  private waitingWorker: ServiceWorker | null = null;

  private constructor() {
    this.registerServiceWorker();
  }

  public static getInstance(): ServiceWorkerUpdateHandler {
    if (!ServiceWorkerUpdateHandler.instance) {
      ServiceWorkerUpdateHandler.instance = new ServiceWorkerUpdateHandler();
    }
    return ServiceWorkerUpdateHandler.instance;
  }

  private registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('[SW Update] Service Worker registered successfully:', registration);

          // Check for updates immediately
          this.checkForUpdates();

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            console.log('[SW Update] New service worker found');
            const newWorker = registration.installing;
            
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New content is available
                    console.log('[SW Update] New content available');
                    this.updateAvailable = true;
                    this.waitingWorker = newWorker;
                    this.showUpdateNotification();
                  } else {
                    // Content is cached for the first time
                    console.log('[SW Update] Content is cached for the first time');
                  }
                }
              });
            }
          });

          // Listen for controller change (when new SW takes control)
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[SW Update] Service worker controller changed');
            window.location.reload();
          });

          // Listen for messages from service worker
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SW_UPDATED') {
              console.log('[SW Update] Service worker updated to version:', event.data.version);
              this.showUpdateNotification();
            }
          });

        })
        .catch((error) => {
          console.error('[SW Update] Service Worker registration failed:', error);
        });
    }
  }

  private checkForUpdates() {
    if ('serviceWorker' in navigator) {
      // Force check for updates every time
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          console.log('[SW Update] Checking for updates...');
          registration.update();
        }
      });
    }
  }

  private showUpdateNotification() {
    // Create a custom update notification
    const updateNotification = document.createElement('div');
    updateNotification.id = 'sw-update-notification';
    updateNotification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 300px;
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    updateNotification.innerHTML = `
      <div style="flex: 1;">
        <div style="font-weight: bold; margin-bottom: 4px;">Update Available</div>
        <div style="font-size: 12px; opacity: 0.9;">A new version of the app is available.</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="sw-update-btn" style="
          background: white;
          color: #4CAF50;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          cursor: pointer;
        ">Update</button>
        <button id="sw-dismiss-btn" style="
          background: transparent;
          color: white;
          border: 1px solid white;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        ">Later</button>
      </div>
    `;

    document.body.appendChild(updateNotification);

    // Add event listeners
    document.getElementById('sw-update-btn')?.addEventListener('click', () => {
      this.applyUpdate();
    });

    document.getElementById('sw-dismiss-btn')?.addEventListener('click', () => {
      this.dismissNotification();
    });

    // Auto-dismiss after 30 seconds
    setTimeout(() => {
      this.dismissNotification();
    }, 30000);
  }

  private applyUpdate() {
    if (this.waitingWorker) {
      console.log('[SW Update] Applying update...');
      this.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      this.dismissNotification();
    }
  }

  private dismissNotification() {
    const notification = document.getElementById('sw-update-notification');
    if (notification) {
      notification.remove();
    }
  }

  public forceUpdate() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          registration.update();
        }
      });
    }
  }

  public clearCache() {
    if ('caches' in window) {
      caches.keys().then((cacheNames) => {
        cacheNames.forEach((cacheName) => {
          caches.delete(cacheName);
          console.log('[SW Update] Cleared cache:', cacheName);
        });
      });
    }
  }
}

// Initialize the update handler
export const swUpdateHandler = ServiceWorkerUpdateHandler.getInstance();
