import React from 'react';

/**
 * Token usage data from API response
 */
export interface TokenUsage {
  input: number;
  output: number;
  total?: number;
}

/**
 * Token usage display component props
 */
interface TokenUsageDisplayProps {
  usage: TokenUsage;
  showBreakdown?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'compact' | 'minimal';
  location?: 'message' | 'footer' | 'sidebar';
}

/**
 * Get color based on token count (relative to typical usage)
 */
function getTokenColor(count: number): string {
  if (count > 10000) return 'text-red-500';
  if (count > 5000) return 'text-yellow-500';
  if (count > 1000) return 'text-blue-500';
  return 'text-green-500';
}

/**
 * Format token count with appropriate unit
 */
function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

/**
 * TokenUsageDisplay component - Shows token usage breakdown
 */
export function TokenUsageDisplay({
  usage,
  showBreakdown = true,
  size = 'medium',
  variant = 'default',
  location = 'message',
}: TokenUsageDisplayProps) {
  const total = usage.total ?? usage.input + usage.output;
  
  const sizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };

  const iconSizeClasses = {
    small: 'w-3 h-3',
    medium: 'w-4 h-4',
    large: 'w-5 h-5',
  };

  const containerClasses = {
    message: 'mt-2 pt-2 border-t border-gray-100',
    footer: 'p-2',
    sidebar: 'p-2',
  };

  const containerPadding = {
    message: '',
    footer: 'bg-gray-50 rounded-lg',
    sidebar: 'bg-gray-50 rounded-lg',
  };

  if (variant === 'minimal') {
    return (
      <span className={`${sizeClasses[size]} text-gray-400`}>
        {formatTokenCount(total)} tokens
      </span>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${containerClasses[location]}`}>
        <span className={`${sizeClasses[size]} text-gray-500`}>
          Tokens:
        </span>
        <span className={`${sizeClasses[size]} ${getTokenColor(usage.input)} font-medium`}>
          {formatTokenCount(usage.input)}
        </span>
        <span className="text-gray-400">→</span>
        <span className={`${sizeClasses[size]} ${getTokenColor(usage.output)} font-medium`}>
          {formatTokenCount(usage.output)}
        </span>
        <span className={`${sizeClasses[size]} text-gray-400`}>
          ({formatTokenCount(total)})
        </span>
      </div>
    );
  }

  return (
    <div className={`${containerClasses[location]} ${containerPadding[location]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Token icon */}
          <svg 
            className={`${iconSizeClasses[size]} text-gray-400`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M13 10V3L4 14h7v7l9-11h-7z" 
            />
          </svg>
          
          <span className={`${sizeClasses[size]} text-gray-500`}>
            Tokens used
          </span>
        </div>
        
        <span className={`${sizeClasses[size]} font-semibold ${getTokenColor(total)}`}>
          {formatTokenCount(total)}
        </span>
      </div>

      {showBreakdown && (
        <div className="mt-2 space-y-1">
          {/* Input tokens */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className={`${sizeClasses[size]} text-gray-500`}>
                Input
              </span>
            </div>
            <span className={`${sizeClasses[size]} ${getTokenColor(usage.input)}`}>
              {formatTokenCount(usage.input)}
            </span>
          </div>

          {/* Output tokens */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className={`${sizeClasses[size]} text-gray-500`}>
                Output
              </span>
            </div>
            <span className={`${sizeClasses[size]} ${getTokenColor(usage.output)}`}>
              {formatTokenCount(usage.output)}
            </span>
          </div>
        </div>
      )}

      {/* Visual bar representation */}
      {showBreakdown && (
        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden flex">
          <div 
            className="bg-blue-400" 
            style={{ width: `${(usage.input / total) * 100}%` }}
          />
          <div 
            className="bg-green-400" 
            style={{ width: `${(usage.output / total) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Loading token display component
 */
interface LoadingTokenDisplayProps {
  size?: 'small' | 'medium' | 'large';
}

export function LoadingTokenDisplay({ size = 'medium' }: LoadingTokenDisplayProps) {
  const sizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };

  const iconSizeClasses = {
    small: 'w-3 h-3',
    medium: 'w-4 h-4',
    large: 'w-5 h-5',
  };

  return (
    <div className="flex items-center gap-2 text-gray-400">
      <svg 
        className={`${iconSizeClasses[size]} animate-spin`} 
        fill="none" 
        viewBox="0 0 24 24"
      >
        <circle 
          className="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4" 
        />
        <path 
          className="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
        />
      </svg>
      <span className={`${sizeClasses[size]}`}>
        Counting tokens...
      </span>
    </div>
  );
}

/**
 * Helper function to extract token usage from response headers
 */
export function extractTokenUsage(headers: Headers): TokenUsage | null {
  const input = headers.get('x-token-input');
  const context = headers.get('x-token-context');
  const response = headers.get('x-token-reserved');
  const total = headers.get('x-token-total');

  if (!input || !context || !response) {
    return null;
  }

  const inputTokens = parseInt(input, 10) + parseInt(context, 10);
  const outputTokens = parseInt(response, 10);

  return {
    input: inputTokens,
    output: outputTokens,
    total: total ? parseInt(total, 10) : undefined,
  };
}

/**
 * Helper function to format tokens for display
 */
export function formatTokensForDisplay(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}
