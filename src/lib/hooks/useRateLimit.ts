import { useState, useEffect, useCallback } from 'react';

/**
 * Rate limit status from API response
 */
export interface RateLimitStatus {
  limited: boolean;
  remaining: number;
  limit: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Hook for managing rate limit state and UI feedback
 */
export function useRateLimit() {
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>({
    limited: false,
    remaining: 50,
    limit: 50,
    reset: Date.now() / 1000 + 3600,
  });
  const [showWarning, setShowWarning] = useState(false);
  const [showError, setShowError] = useState(false);

  // Update rate limit status from response headers
  const updateFromHeaders = useCallback((headers: Headers) => {
    const remaining = parseInt(headers.get('x-ratelimit-remaining') || '50', 10);
    const limit = parseInt(headers.get('x-ratelimit-limit') || '50', 10);
    const reset = parseInt(headers.get('x-ratelimit-reset') || '0', 10);
    const retryAfter = headers.get('retry-after');

    const status: RateLimitStatus = {
      limited: remaining <= 0,
      remaining: Math.max(0, remaining),
      limit,
      reset,
      retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
    };

    setRateLimitStatus(status);
    setShowWarning(remaining > 0 && remaining <= 10);
    setShowError(remaining <= 0);

    return status;
  }, []);

  // Reset rate limit status (e.g., on new conversation)
  const resetStatus = useCallback(() => {
    setRateLimitStatus({
      limited: false,
      remaining: 50,
      limit: 50,
      reset: Date.now() / 1000 + 3600,
    });
    setShowWarning(false);
    setShowError(false);
  }, []);

  // Get formatted time until reset
  const getTimeUntilReset = useCallback(() => {
    const now = Date.now() / 1000;
    const diff = Math.ceil(rateLimitStatus.reset - now);
    
    if (diff <= 0) return 'now';
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.ceil(diff / 60)}m`;
    return `${Math.ceil(diff / 3600)}h`;
  }, [rateLimitStatus.reset]);

  // Check if approaching limit
  const isApproachingLimit = rateLimitStatus.remaining > 0 && rateLimitStatus.remaining <= 10;

  // Check if at limit
  const isAtLimit = rateLimitStatus.remaining <= 0;

  return {
    rateLimitStatus,
    updateFromHeaders,
    resetStatus,
    getTimeUntilReset,
    showWarning,
    showError,
    isApproachingLimit,
    isAtLimit,
    // Convenience properties
    remaining: rateLimitStatus.remaining,
    limit: rateLimitStatus.limit,
    percentage: (rateLimitStatus.remaining / rateLimitStatus.limit) * 100,
  };
}

/**
 * Component props for RateLimitDisplay
 */
interface RateLimitDisplayProps {
  usage: number;
  limit: number;
  showLabels?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'compact' | 'minimal';
}

/**
 * Get color based on usage percentage
 */
function getUsageColor(percentage: number): string {
  if (percentage > 90) return 'text-red-500';
  if (percentage > 75) return 'text-yellow-500';
  if (percentage > 50) return 'text-blue-500';
  return 'text-green-500';
}

/**
 * Get background color based on usage percentage
 */
function getUsageBgColor(percentage: number): string {
  if (percentage > 90) return 'bg-red-500';
  if (percentage > 75) return 'bg-yellow-500';
  if (percentage > 50) return 'bg-blue-500';
  return 'bg-green-500';
}

/**
 * Rate limit display component
 */
export function RateLimitDisplay({
  usage,
  limit,
  showLabels = true,
  size = 'medium',
  variant = 'default',
}: RateLimitDisplayProps) {
  const percentage = Math.min(100, Math.max(0, (usage / limit) * 100));
  const remaining = Math.max(0, limit - usage);

  const sizeClasses = {
    small: 'h-1',
    medium: 'h-2',
    large: 'h-3',
  };

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };

  if (variant === 'minimal') {
    return (
      <span className={`${textSizeClasses[size]} ${getUsageColor(percentage)}`}>
        {remaining}/{limit}
      </span>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-16 ${sizeClasses[size]} bg-gray-200 rounded-full overflow-hidden`}>
          <div
            className={`h-full ${getUsageBgColor(percentage)} rounded-full transition-all`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={`${textSizeClasses[size]} text-gray-600`}>
          {remaining} left
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {showLabels && (
        <div className="flex justify-between items-center">
          <span className={`${textSizeClasses[size]} text-gray-500`}>Rate Limit</span>
          <span className={`${textSizeClasses[size]} ${getUsageColor(percentage)} font-medium`}>
            {remaining} / {limit}
          </span>
        </div>
      )}
      <div className={`w-full ${sizeClasses[size]} bg-gray-200 rounded-full overflow-hidden`}>
        <div
          className={`h-full ${getUsageBgColor(percentage)} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabels && (
        <p className={`${textSizeClasses[size]} text-gray-400 text-right`}>
          {percentage < 100 ? `${Math.round(percentage)}% used` : 'Limit reached'}
        </p>
      )}
    </div>
  );
}

/**
 * Rate limit warning banner component
 */
interface RateLimitWarningProps {
  remaining: number;
  limit: number;
  resetTime: string;
  onDismiss?: () => void;
}

export function RateLimitWarning({
  remaining,
  limit,
  resetTime,
  onDismiss,
}: RateLimitWarningProps) {
  const percentage = (remaining / limit) * 100;
  const isCritical = remaining <= 0;

  return (
    <div
      className={`p-4 rounded-lg border ${
        isCritical
          ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-yellow-50 border-yellow-200 text-yellow-800'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${isCritical ? 'bg-red-100' : 'bg-yellow-100'}`}>
            {isCritical ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <div>
            <h3 className="font-medium">
              {isCritical ? 'Rate limit reached' : 'Approaching rate limit'}
            </h3>
            <p className="text-sm mt-1">
              {isCritical
                ? `You've used all ${limit} messages. Rate limit resets in ${resetTime}.`
                : `${remaining} messages remaining (${Math.round(percentage)}%). Resets in ${resetTime}.`}
            </p>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`p-1 rounded hover:bg-opacity-20 ${
              isCritical ? 'hover:bg-red-200' : 'hover:bg-yellow-200'
            }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
