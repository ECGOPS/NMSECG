import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, WifiOff, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isOffline: boolean;
}

class ErrorBoundaryClass extends Component<Props & { navigate: (path: string) => void }, State> {
  constructor(props: Props & { navigate: (path: string) => void }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isOffline: !navigator.onLine
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      isOffline: !navigator.onLine
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
      isOffline: !navigator.onLine
    });

    // Listen for online/offline changes
    const handleOnline = () => this.setState({ isOffline: false });
    const handleOffline = () => this.setState({ isOffline: true });
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  private handleOnline = () => {
    this.setState({ isOffline: false });
  };

  private handleOffline = () => {
    this.setState({ isOffline: true });
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  private handleGoHome = () => {
    this.props.navigate('/');
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  private isModuleLoadError(): boolean {
    const { error } = this.state;
    if (!error) return false;
    
    return (
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Loading CSS chunk') ||
      error.message.includes('ChunkLoadError')
    );
  }

  private isNetworkError(): boolean {
    const { error } = this.state;
    if (!error) return false;
    
    return (
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('ERR_NETWORK') ||
      error.message.includes('ERR_INTERNET_DISCONNECTED')
    );
  }

  render() {
    if (this.state.hasError) {
      const { error, isOffline } = this.state;
      const isModuleError = this.isModuleLoadError();
      const isNetworkError = this.isNetworkError();

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="mb-6">
              {isOffline ? (
                <WifiOff className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              ) : isModuleError ? (
                <AlertTriangle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
              ) : (
                <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              )}
            </div>

            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {isOffline 
                ? 'You\'re Offline' 
                : isModuleError 
                  ? 'Module Loading Error'
                  : 'Something Went Wrong'
              }
            </h1>

            <p className="text-gray-600 mb-6">
              {isOffline 
                ? 'Please check your internet connection and try again.'
                : isModuleError
                  ? 'There was an issue loading this page. This often happens when offline or with poor connectivity.'
                  : 'An unexpected error occurred. Please try again or contact support if the problem persists.'
              }
            </p>

            {error && !isOffline && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Error Details
                </summary>
                <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-700 overflow-auto">
                  <div className="mb-2">
                    <strong>Message:</strong> {error.message}
                  </div>
                  {error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className="whitespace-pre-wrap mt-1">{error.stack}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={this.handleRetry}
                className="flex-1"
                variant={isOffline ? "outline" : "default"}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {isOffline ? 'Check Connection' : 'Try Again'}
              </Button>
              
              <Button 
                onClick={this.handleGoHome} 
                variant="outline"
                className="flex-1"
              >
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </div>

            {isOffline && (
              <p className="text-xs text-gray-500 mt-4">
                The app will automatically retry when you're back online.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component to provide navigation
export function ErrorBoundary({ children }: Props) {
  const navigate = useNavigate();
  
  return (
    <ErrorBoundaryClass navigate={navigate}>
      {children}
    </ErrorBoundaryClass>
  );
} 