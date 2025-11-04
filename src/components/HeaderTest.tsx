import React, { useEffect, useState } from 'react';
import { testSecurityHeaders } from '../utils/headerTest';

interface HeaderTestResult {
  header: string;
  expected: string;
  actual: string | null;
  status: string;
  details?: string;
}

export const HeaderTest: React.FC = () => {
  const [results, setResults] = useState<HeaderTestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const testResults = await testSecurityHeaders();
      console.log('Test results:', testResults); // Debug log
      setResults(testResults);
    } catch (err) {
      console.error('Test error:', err); // Debug log
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetTest = () => {
    setResults([]);
    setError(null);
  };

  useEffect(() => {
    runTest();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4 text-foreground">Security Headers Test</h2>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={runTest}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
        >
          {loading ? 'Testing...' : 'Run Test'}
        </button>
        <button
          onClick={resetTest}
          disabled={loading || results.length === 0}
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 disabled:bg-muted disabled:text-muted-foreground"
        >
          Reset
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded">
          Error: {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full border border-border">
          <thead>
            <tr className="bg-muted/80 dark:bg-muted/40">
              <th className="px-4 py-2 border border-border text-foreground">Header</th>
              <th className="px-4 py-2 border border-border text-foreground">Expected</th>
              <th className="px-4 py-2 border border-border text-foreground">Actual</th>
              <th className="px-4 py-2 border border-border text-foreground">Status</th>
              <th className="px-4 py-2 border border-border text-foreground">Details</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-muted/50' : 'bg-background'}>
                <td className="px-4 py-2 border border-border font-mono text-foreground">{result.header}</td>
                <td className="px-4 py-2 border border-border font-mono text-sm text-foreground">{result.expected}</td>
                <td className="px-4 py-2 border border-border font-mono text-sm text-foreground">{result.actual || 'Not Set'}</td>
                <td className="px-4 py-2 border border-border text-center text-foreground">{result.status}</td>
                <td className="px-4 py-2 border border-border text-sm text-destructive whitespace-pre-wrap">
                  {result.details || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Debug information */}
      <div className="mt-4 p-4 bg-muted rounded overflow-x-auto">
        <h3 className="font-bold mb-2 text-foreground">Debug Information:</h3>
        <pre className="text-sm text-muted-foreground">
          {JSON.stringify(results, null, 2)}
        </pre>
      </div>
    </div>
  );
}; 