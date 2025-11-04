import React, { useState } from 'react';
import { 
  SafeText, 
  SafeHTML, 
  SafeAttribute, 
  SafeURL, 
  SafeJSON, 
  SafeCode,
  SafeFormField,
  SafeHeading,
  SafeParagraph,
  SecurityStatus
} from '@/components/ui/safe-display';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Example component demonstrating safe content display
 * Shows how to properly escape and display user-generated content
 */
export function SafeDisplayExample() {
  const [userInput, setUserInput] = useState('');
  const [displayMode, setDisplayMode] = useState<'safe' | 'unsafe'>('safe');

  // Example malicious content for testing
  const maliciousExamples = {
    xssScript: '<script>alert("XSS Attack!")</script>Hello World',
    eventHandler: 'Click <img src="x" onerror="alert(\'XSS\')">here</img>',
    javascriptProtocol: 'javascript:alert("XSS")',
    sqlInjection: "'; DROP TABLE users; --",
    iframeAttack: '<iframe src="javascript:alert(\'XSS\')"></iframe>',
    cssInjection: '<div style="background:url(javascript:alert(\'XSS\'))">Click me</div>'
  };

  // Example safe content
  const safeExamples = {
    normalText: 'This is normal, safe text content.',
    htmlEntities: 'HTML entities: &lt;script&gt; &amp; &quot;quotes&quot;',
    unicode: 'Unicode content: 🚀⚡💻🎯',
    emojis: 'Emojis: 😀😃😄😁😆😅😂🤣',
    links: 'https://example.com',
    json: '{"name": "John", "age": 30, "city": "New York"}'
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
  };

  const loadExample = (example: string) => {
    setUserInput(example);
  };

  const clearInput = () => {
    setUserInput('');
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <SafeHeading content="Safe Content Display Examples" level={1} />
        <SafeParagraph content="This example demonstrates how to safely display user-generated content to prevent XSS attacks." />
      </div>

      <Tabs defaultValue="input" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="input">Input</TabsTrigger>
          <TabsTrigger value="safe">Safe Display</TabsTrigger>
          <TabsTrigger value="unsafe">Unsafe Display</TabsTrigger>
          <TabsTrigger value="analysis">Security Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="input" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Input</CardTitle>
              <CardDescription>
                Enter content to test safe display. Try some malicious content to see how it's handled.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="userInput">Content to Display:</Label>
                <Textarea
                  id="userInput"
                  value={userInput}
                  onChange={handleInputChange}
                  placeholder="Enter some content here..."
                  className="min-h-[120px]"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => loadExample(maliciousExamples.xssScript)}
                >
                  XSS Script
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => loadExample(maliciousExamples.eventHandler)}
                >
                  Event Handler
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => loadExample(maliciousExamples.javascriptProtocol)}
                >
                  JS Protocol
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => loadExample(maliciousExamples.sqlInjection)}
                >
                  SQL Injection
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => loadExample(maliciousExamples.iframeAttack)}
                >
                  Iframe Attack
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => loadExample(safeExamples.normalText)}
                >
                  Safe Text
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => loadExample(safeExamples.htmlEntities)}
                >
                  HTML Entities
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => loadExample(safeExamples.json)}
                >
                  JSON Data
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={clearInput}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safe" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Safe Display Methods</CardTitle>
              <CardDescription>
                These components automatically escape content to prevent XSS attacks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Safe Text Display:</Label>
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded">
                  <SafeText content={userInput} showSecurityIndicator={true} />
                </div>
              </div>

              <div>
                <Label>Safe HTML Display (Blocked for High Risk):</Label>
                <div className="mt-2">
                  <SafeHTML content={userInput} allowHtml={false} showSecurityIndicator={true} />
                </div>
              </div>

              <div>
                <Label>Safe Attribute Display:</Label>
                <div className="mt-2">
                  <SafeAttribute content={userInput} showSecurityIndicator={true} />
                </div>
              </div>

              <div>
                <Label>Safe URL Display:</Label>
                <div className="mt-2">
                  <SafeURL content={userInput} showAsLink={true} showSecurityIndicator={true} />
                </div>
              </div>

              <div>
                <Label>Safe JSON Display:</Label>
                <div className="mt-2">
                  <SafeJSON content={userInput} prettyPrint={true} showSecurityIndicator={true} />
                </div>
              </div>

              <div>
                <Label>Safe Code Display:</Label>
                <div className="mt-2">
                  <SafeCode content={userInput} language="html" showSecurityIndicator={true} />
                </div>
              </div>

              <div>
                <Label>Safe Form Field Display:</Label>
                <div className="mt-2">
                  <SafeFormField 
                    content={userInput} 
                    label="User Input" 
                    showSecurityIndicator={true} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unsafe" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>⚠️ Unsafe Display (For Comparison)</CardTitle>
              <CardDescription>
                This shows what happens when content is NOT escaped. NEVER use this in production!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded">
                <h4 className="font-medium text-red-800 mb-2">DANGER: Raw HTML Rendering</h4>
                <p className="text-red-700 text-sm mb-3">
                  This demonstrates the security risk of not escaping content. 
                  Malicious scripts could execute here!
                </p>
                
                <div className="space-y-4">
                  <div>
                    <Label>Raw HTML (DANGEROUS):</Label>
                    <div 
                      className="mt-2 p-3 bg-red-100 border border-red-300 rounded"
                      dangerouslySetInnerHTML={{ __html: userInput }}
                    />
                  </div>

                  <div>
                    <Label>Raw Text (Still Dangerous):</Label>
                    <div className="mt-2 p-3 bg-red-100 border border-red-300 rounded">
                      {userInput}
                    </div>
                  </div>

                  <div>
                    <Label>Raw Attribute (DANGEROUS):</Label>
                    <div className="mt-2">
                      <input 
                        type="text" 
                        value={userInput} 
                        readOnly 
                        className="w-full p-2 bg-red-100 border border-red-300 rounded"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Analysis</CardTitle>
              <CardDescription>
                Analyze the security risk level of your content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userInput ? (
                <SecurityStatus content={userInput} />
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Enter some content above to see security analysis
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security Best Practices</CardTitle>
              <CardDescription>
                Always follow these guidelines when displaying user content.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                  ✓
                </div>
                <div>
                  <h4 className="font-medium">Use Safe Components</h4>
                  <p className="text-sm text-gray-600">
                    Always use SafeText, SafeHTML, SafeAttribute, etc. instead of raw HTML rendering.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                  ✓
                </div>
                <div>
                  <h4 className="font-medium">Escape All User Content</h4>
                  <p className="text-sm text-gray-600">
                    Never trust user input. Always escape before display, even if it seems safe.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                  ✓
                </div>
                <div>
                  <h4 className="font-medium">Use Content Security Policy</h4>
                  <p className="text-sm text-gray-600">
                    Implement CSP headers to add an additional layer of protection.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                  ✗
                </div>
                <div>
                  <h4 className="font-medium">Never Use dangerouslySetInnerHTML</h4>
                  <p className="text-sm text-gray-600">
                    This bypasses React's built-in XSS protection and is extremely dangerous.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                  ✗
                </div>
                <div>
                  <h4 className="font-medium">Don't Trust Input Validation Alone</h4>
                  <p className="text-sm text-gray-600">
                    Input validation is not enough. Always escape output as well.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Implementation Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">How to Use Safe Components:</h4>
            <SafeCode 
              content={`// Instead of this (DANGEROUS):
<div>{userContent}</div>
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// Use this (SAFE):
<SafeText content={userContent} />
<SafeHTML content={userContent} allowHtml={false} />
<SafeAttribute content={userContent} />`}
              language="tsx"
              showSecurityIndicator={false}
            />
          </div>

          <div>
            <h4 className="font-medium mb-2">Automatic Escaping:</h4>
            <SafeParagraph content="All safe components automatically escape content based on the context. SafeText escapes HTML, SafeAttribute escapes for attributes, SafeURL validates and escapes URLs, etc." />
          </div>

          <div>
            <h4 className="font-medium mb-2">Security Indicators:</h4>
            <SafeParagraph content="Components can show security indicators to help developers understand when content has been escaped or blocked for security reasons." />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
