import React, { Suspense } from 'react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface RouteLoadingFallbackProps {
  message?: string;
}

const RouteLoadingFallback: React.FC<RouteLoadingFallbackProps> = ({ 
  message = 'Loading page...' 
}) => {
  // Ensure message is always a string to prevent "Cannot convert object to primitive value" error
  const safeMessage = typeof message === 'string' ? message : 'Loading page...';
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <LoadingSpinner size="large" />
      <p className="mt-4 text-gray-600">{safeMessage}</p>
    </div>
  );
};

// Error boundary for lazy loading failures
class LazyLoadErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
          <div className="text-red-500 text-center">
            <h3 className="text-lg font-semibold mb-2">Failed to load page</h3>
            <p className="text-sm text-gray-600 mb-4">
              This page could not be loaded. Please check your internet connection and try again.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const withRouteSuspense = <P extends object>(
  Component: React.ComponentType<P>,
  loadingMessage?: string
) => {
  const WrappedComponent: React.FC<P> = (props) => {
    // Ensure loadingMessage is always a string
    const safeLoadingMessage = typeof loadingMessage === 'string' ? loadingMessage : 'Loading page...';
    
    return (
      <LazyLoadErrorBoundary>
        <Suspense fallback={<RouteLoadingFallback message={safeLoadingMessage} />}>
          <Component {...props} />
        </Suspense>
      </LazyLoadErrorBoundary>
    );
  };

  return WrappedComponent;
};

export const lazyLoadRoute = <P extends object>(
  importFn: () => Promise<{ default: React.ComponentType<P> }>,
  loadingMessage?: string
) => {
  // Wrap the import function with error handling for offline scenarios
  const safeImportFn = () => {
    return importFn().catch((error) => {
      console.error('Failed to load route component:', error);
      // Return a fallback component for offline scenarios
      return {
        default: () => (
          <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
            <div className="text-orange-500 text-center">
              <h3 className="text-lg font-semibold mb-2">Offline Mode</h3>
              <p className="text-sm text-gray-600 mb-4">
                This page is not available offline. Please check your internet connection.
              </p>
            </div>
          </div>
        )
      };
    });
  };

  const LazyComponent = React.lazy(safeImportFn);
  return withRouteSuspense(LazyComponent, loadingMessage);
}; 