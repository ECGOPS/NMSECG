import React from 'react';
import { 
  escapeHtml, 
  escapeHtmlAttribute, 
  escapeJavaScript, 
  escapeCSS, 
  escapeURL,
  useSafeContent,
  analyzeContentSecurity 
} from '@/utils/outputEscaping';
import { AlertTriangle, Shield, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Props for safe display components
interface SafeDisplayProps {
  content: string;
  className?: string;
  showSecurityIndicator?: boolean;
  allowHtml?: boolean;
  maxLength?: number;
  truncateOnOverflow?: boolean;
}

/**
 * Safe Text Display Component
 * Automatically escapes HTML and displays content safely
 */
function SafeText({ 
  content, 
  className, 
  showSecurityIndicator = true,
  maxLength,
  truncateOnOverflow = false 
}: SafeDisplayProps) {
  const safeContent = useSafeContent(content);
  const security = analyzeContentSecurity(content);
  
  let displayContent = safeContent.asText();
  
  if (maxLength && displayContent.length > maxLength) {
    if (truncateOnOverflow) {
      displayContent = displayContent.substring(0, maxLength) + '...';
    }
  }

  return (
    <span className={cn('safe-text', className)}>
      {displayContent}
      {showSecurityIndicator && security.riskLevel !== 'low' && (
        <span className="ml-2 inline-flex items-center text-xs">
          {security.riskLevel === 'high' ? (
            <AlertTriangle className="h-3 w-3 text-red-500" />
          ) : (
            <Shield className="h-3 w-3 text-yellow-500" />
          )}
          <span className="ml-1 text-gray-500">
            {security.riskLevel === 'high' ? 'High Risk' : 'Medium Risk'}
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * Safe HTML Display Component
 * Escapes content and renders as HTML (use with caution)
 */
function SafeHTML({ 
  content, 
  className, 
  showSecurityIndicator = true,
  allowHtml = false 
}: SafeDisplayProps) {
  const safeContent = useSafeContent(content);
  const security = analyzeContentSecurity(content);
  
  if (!allowHtml && security.riskLevel === 'high') {
    return (
      <div className={cn('safe-html-blocked', className)}>
        <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-md">
          <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
          <span className="text-red-700 text-sm">
            Potentially unsafe content blocked for security
          </span>
        </div>
        <SafeText content={content} showSecurityIndicator={false} />
      </div>
    );
  }

  return (
    <div className={cn('safe-html', className)}>
      <div 
        dangerouslySetInnerHTML={safeContent.asHTML()} 
        className="safe-html-content"
      />
      {showSecurityIndicator && (
        <div className="mt-2 text-xs text-gray-500 flex items-center">
          <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
          Content safely escaped and rendered
        </div>
      )}
    </div>
  );
}

/**
 * Safe Attribute Display Component
 * Safely displays content as HTML attributes
 */
function SafeAttribute({ 
  content, 
  className, 
  showSecurityIndicator = true 
}: SafeDisplayProps) {
  const safeContent = useSafeContent(content);
  const security = analyzeContentSecurity(content);
  
  return (
    <span className={cn('safe-attribute', className)}>
      {safeContent.asAttribute()}
      {showSecurityIndicator && security.riskLevel !== 'low' && (
        <span className="ml-2 inline-flex items-center text-xs">
          <Shield className="h-3 w-3 text-yellow-500" />
          <span className="ml-1 text-gray-500">Escaped</span>
        </span>
      )}
    </span>
  );
}

/**
 * Safe URL Display Component
 * Safely displays and validates URLs
 */
function SafeURL({ 
  content, 
  className, 
  showSecurityIndicator = true,
  showAsLink = false 
}: SafeDisplayProps & { showAsLink?: boolean }) {
  const safeContent = useSafeContent(content);
  const security = analyzeContentSecurity(content);
  
  if (showAsLink && security.riskLevel === 'low') {
    return (
      <a 
        href={safeContent.asURL()} 
        target="_blank" 
        rel="noopener noreferrer"
        className={cn('safe-url-link text-blue-600 hover:text-blue-800 underline', className)}
      >
        {safeContent.asText()}
      </a>
    );
  }
  
  return (
    <span className={cn('safe-url', className)}>
      {safeContent.asText()}
      {showSecurityIndicator && security.riskLevel !== 'low' && (
        <span className="ml-2 inline-flex items-center text-xs">
          <Shield className="h-3 w-3 text-yellow-500" />
          <span className="ml-1 text-gray-500">Validated</span>
        </span>
      )}
    </span>
  );
}

/**
 * Safe JSON Display Component
 * Safely displays JSON content
 */
function SafeJSON({ 
  content, 
  className, 
  showSecurityIndicator = true,
  prettyPrint = false 
}: SafeDisplayProps & { prettyPrint?: boolean }) {
  const safeContent = useSafeContent(content);
  const security = analyzeContentSecurity(content);
  
  let displayContent = content;
  if (prettyPrint) {
    try {
      const parsed = JSON.parse(content);
      displayContent = JSON.stringify(parsed, null, 2);
    } catch {
      displayContent = content;
    }
  }
  
  return (
    <pre className={cn('safe-json bg-gray-100 p-3 rounded text-sm overflow-x-auto', className)}>
      <SafeText content={displayContent} showSecurityIndicator={false} />
      {showSecurityIndicator && security.riskLevel !== 'low' && (
        <div className="mt-2 text-xs text-gray-500 flex items-center">
          <Shield className="h-3 w-3 text-yellow-500 mr-1" />
          <span>Content validated</span>
        </div>
      )}
    </pre>
  );
}

/**
 * Safe Code Display Component
 * Safely displays code content
 */
function SafeCode({ 
  content, 
  className, 
  showSecurityIndicator = true,
  language = 'text' 
}: SafeDisplayProps & { language?: string }) {
  const safeContent = useSafeContent(content);
  const security = analyzeContentSecurity(content);
  
  return (
    <div className={cn('safe-code', className)}>
      <div className="bg-gray-800 text-green-400 p-3 rounded-t text-xs font-mono">
        {language}
      </div>
      <pre className="bg-gray-900 text-green-400 p-3 rounded-b overflow-x-auto">
        <SafeText content={safeContent.asText()} showSecurityIndicator={false} />
      </pre>
      {showSecurityIndicator && security.riskLevel !== 'low' && (
        <div className="mt-2 text-xs text-gray-500 flex items-center">
          <Shield className="h-3 w-3 text-yellow-500 mr-1" />
          <span>Code escaped</span>
        </div>
      )}
    </div>
  );
}

/**
 * Safe Table Cell Component
 * Safely displays content in table cells
 */
function SafeTableCell({ 
  content, 
  className, 
  showSecurityIndicator = false 
}: SafeDisplayProps) {
  return (
    <td className={cn('safe-table-cell', className)}>
      <SafeText content={content} showSecurityIndicator={showSecurityIndicator} />
    </td>
  );
}

/**
 * Safe Form Field Component
 * Safely displays form field content
 */
function SafeFormField({ 
  content, 
  className, 
  label,
  showSecurityIndicator = true 
}: SafeDisplayProps & { label?: string }) {
  return (
    <div className={cn('safe-form-field', className)}>
      {label && <label className="block text-sm font-medium mb-1">{label}</label>}
      <SafeText content={content} showSecurityIndicator={showSecurityIndicator} />
    </div>
  );
}

/**
 * Safe List Item Component
 * Safely displays list item content
 */
function SafeListItem({ 
  content, 
  className, 
  showSecurityIndicator = false 
}: SafeDisplayProps) {
  return (
    <li className={cn('safe-list-item', className)}>
      <SafeText content={content} showSecurityIndicator={showSecurityIndicator} />
    </li>
  );
}

/**
 * Safe Paragraph Component
 * Safely displays paragraph content
 */
function SafeParagraph({ 
  content, 
  className, 
  showSecurityIndicator = false 
}: SafeDisplayProps) {
  return (
    <p className={cn('safe-paragraph', className)}>
      <SafeText content={content} showSecurityIndicator={showSecurityIndicator} />
    </p>
  );
}

/**
 * Safe Heading Component
 * Safely displays heading content
 */
function SafeHeading({ 
  content, 
  className, 
  level = 1,
  showSecurityIndicator = false 
}: SafeDisplayProps & { level?: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const safeContent = useSafeContent(content);
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  
  return (
    <Tag className={cn('safe-heading', className)}>
      {safeContent.asText()}
      {showSecurityIndicator && (
        <span className="ml-1 text-xs text-gray-400">✓</span>
      )}
    </Tag>
  );
}

/**
 * Security Status Indicator Component
 * Shows the security status of content
 */
function SecurityStatus({ content }: { content: string }) {
  const security = analyzeContentSecurity(content);
  
  return (
    <div className="security-status p-3 border rounded-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Content Security Analysis</span>
        <span className={cn(
          'px-2 py-1 text-xs rounded-full',
          security.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
          security.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        )}>
          {security.riskLevel.toUpperCase()} RISK
        </span>
      </div>
      
      <div className="space-y-1 text-xs">
        <div className="flex items-center">
          <span className="w-4 h-4 mr-2">
            {security.hasScriptTags ? (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
          </span>
          Script tags: {security.hasScriptTags ? 'Detected' : 'None found'}
        </div>
        
        <div className="flex items-center">
          <span className="w-4 h-4 mr-2">
            {security.hasEventHandlers ? (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
          </span>
          Event handlers: {security.hasEventHandlers ? 'Detected' : 'None found'}
        </div>
        
        <div className="flex items-center">
          <span className="w-4 h-4 mr-2">
            {security.hasDangerousProtocols ? (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
          </span>
          Dangerous protocols: {security.hasDangerousProtocols ? 'Detected' : 'None found'}
        </div>
      </div>
      
      <div className="mt-3 pt-2 border-t text-xs text-gray-600">
        <strong>Recommendation:</strong> {
          security.riskLevel === 'low' ? 'Content is safe to display' :
          security.riskLevel === 'medium' ? 'Content should be reviewed before display' :
          'Content should not be displayed without thorough review'
        }
      </div>
    </div>
  );
}

// Export all components
export {
  SafeText,
  SafeHTML,
  SafeAttribute,
  SafeURL,
  SafeJSON,
  SafeCode,
  SafeTableCell,
  SafeFormField,
  SafeListItem,
  SafeParagraph,
  SafeHeading,
  SecurityStatus
};
