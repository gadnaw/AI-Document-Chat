import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { RetrievalOptions } from './types';
import { classifyError, createError, RetrievalError } from './errors';

/**
 * Zod schema for search API request validation
 */
export const searchRequestSchema = z.object({
  query: z
    .string()
    .min(1, 'Query cannot be empty')
    .max(1000, 'Query too long (max 1000 characters)'),
  topK: z
    .number()
    .int()
    .min(1, 'topK must be at least 1')
    .max(20, 'topK cannot exceed 20')
    .optional()
    .default(5),
  threshold: z
    .number()
    .min(0, 'threshold must be between 0 and 1')
    .max(1, 'threshold must be between 0 and 1')
    .optional()
    .default(0.7),
  documentIds: z
    .array(z.string().uuid('Invalid document ID format'))
    .optional(),
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;

/**
 * Zod schema for retrieve API request validation
 */
export const retrieveRequestSchema = z.object({
  query: z
    .string()
    .min(1, 'Query cannot be empty')
    .max(1000, 'Query too long (max 1000 characters)'),
  topK: z
    .number()
    .int()
    .min(1, 'topK must be at least 1')
    .max(20, 'topK cannot exceed 20')
    .optional()
    .default(5),
  threshold: z
    .number()
    .min(0, 'threshold must be between 0 and 1')
    .max(1, 'threshold must be between 0 and 1')
    .optional()
    .default(0.7),
  documentIds: z
    .array(z.string().uuid('Invalid document ID format'))
    .optional(),
});

/**
 * Validates search request and returns typed object or error
 */
export function validateSearchRequest(data: unknown): {
  success: boolean;
  data?: SearchRequest;
  error?: RetrievalError;
} {
  const result = searchRequestSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    error: classifyError(result.error),
  };
}

/**
 * Validates retrieve request
 */
export function validateRetrieveRequest(data: unknown): {
  success: boolean;
  data?: SearchRequest;
  error?: RetrievalError;
} {
  const result = retrieveRequestSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    error: classifyError(result.error),
  };
}

/**
 * Extracts and validates user from Supabase auth session
 * Enforces RLS by ensuring user is authenticated
 */
export async function getUserFromAuth(): Promise<{
  success: boolean;
  userId?: string;
  error?: RetrievalError;
}> {
  const supabase = await createServerClient(false);
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return {
      success: false,
      error: classifyError(new Error('Authentication required')),
    };
  }
  
  return {
    success: true,
    userId: user.id,
  };
}

/**
 * Converts API request to RetrievalOptions for retrieval function
 */
export function toRetrievalOptions(
  request: SearchRequest,
  userId: string
): RetrievalOptions {
  return {
    topK: request.topK,
    threshold: request.threshold,
    userId,
    documentIds: request.documentIds,
  };
}
