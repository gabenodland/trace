/**
 * useApiKeys Hook - React Query hook for API key management
 *
 * Provides CRUD operations for API keys:
 * - List keys (from api_keys_safe view - doesn't expose key_hash)
 * - Create key (generates random key, calls RPC to hash and store)
 * - Revoke key (sets revoked_at)
 * - Delete key (permanent removal)
 *
 * NOTE: This hook requires the api_keys table, api_keys_safe view, and create_api_key RPC
 * to exist in the database. These will be created by the migration agent.
 *
 * @example
 * function ApiKeysSection() {
 *   const { apiKeys, isLoading, createApiKey, revokeApiKey } = useApiKeys();
 *
 *   const handleCreate = async () => {
 *     const { fullKey } = await createApiKey({ name: 'My Key', scope: 'read' });
 *     // Show fullKey to user - it won't be shown again!
 *   };
 * }
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '@trace/core';
import * as Crypto from 'expo-crypto';
import { createScopedLogger, LogScopes } from '../../../shared/utils/logger';

const log = createScopedLogger(LogScopes.Settings);

// ============================================================================
// TYPES
// ============================================================================

export type ApiKeyScope = 'read' | 'full';

export interface ApiKey {
  api_key_id: string;
  key_prefix: string;
  name: string;
  scope: ApiKeyScope;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface CreateApiKeyParams {
  name: string;
  scope: ApiKeyScope;
}

export interface CreateApiKeyResult {
  apiKey: ApiKey;
  fullKey: string; // Only returned once at creation!
}

// RPC response type for create_api_key
interface CreateApiKeyRpcResponse {
  api_key_id: string;
  key_prefix: string;
  name: string;
  scope: ApiKeyScope;
  created_at: string;
}

// ============================================================================
// KEY GENERATION
// ============================================================================

/**
 * Generate a random API key with tr_live_ prefix
 * Uses expo-crypto for secure randomness (React Native compatible)
 */
async function generateApiKey(): Promise<string> {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const random = Array.from(randomBytes)
    .map(b => chars[b % chars.length])
    .join('');
  return `tr_live_${random}`;
}

// ============================================================================
// API FUNCTIONS (internal - not exported)
// ============================================================================

async function fetchApiKeys(): Promise<ApiKey[]> {
  const supabase = getSupabase();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Not authenticated');
  }

  // Fetch from api_keys_safe view (doesn't expose key_hash)
  // NOTE: Using 'any' cast because the view is not in database.types.ts yet
  // The migration agent will create the view and types
  const { data, error } = await (supabase as any)
    .from('api_keys_safe')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    log.error('Failed to fetch API keys', error);
    throw error;
  }

  return (data || []) as ApiKey[];
}

async function createApiKeyInDb(params: CreateApiKeyParams): Promise<CreateApiKeyResult> {
  const supabase = getSupabase();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Not authenticated');
  }

  // Generate the full key client-side
  const fullKey = await generateApiKey();
  log.debug('Creating API key', { name: params.name, scope: params.scope });

  // Call RPC function that hashes and stores the key server-side
  // NOTE: Using 'any' cast because the RPC is not in database.types.ts yet
  const { data, error } = await (supabase as any).rpc('create_api_key', {
    p_name: params.name,
    p_scope: params.scope,
    p_full_key: fullKey,
  });

  if (error) {
    log.error('Failed to create API key', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  if (!data) {
    throw new Error('RPC returned no data');
  }

  log.debug('API key created successfully');

  const rpcResponse = data as CreateApiKeyRpcResponse;

  // RPC returns the created key info (without hash)
  const apiKey: ApiKey = {
    api_key_id: rpcResponse.api_key_id,
    key_prefix: rpcResponse.key_prefix,
    name: rpcResponse.name,
    scope: rpcResponse.scope,
    last_used_at: null,
    created_at: rpcResponse.created_at,
    revoked_at: null,
  };

  return { apiKey, fullKey };
}

async function revokeApiKeyInDb(apiKeyId: string): Promise<void> {
  const supabase = getSupabase();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Not authenticated');
  }

  // NOTE: Using 'any' cast because the table is not in database.types.ts yet
  // The migration agent will create the table and types
  const { error } = await (supabase as any)
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('api_key_id', apiKeyId)
    .eq('user_id', user.id);

  if (error) {
    log.error('Failed to revoke API key', error);
    throw error;
  }
}

async function deleteApiKeyInDb(apiKeyId: string): Promise<void> {
  const supabase = getSupabase();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Not authenticated');
  }

  // NOTE: Using 'any' cast because the table is not in database.types.ts yet
  // The migration agent will create the table and types
  const { error } = await (supabase as any)
    .from('api_keys')
    .delete()
    .eq('api_key_id', apiKeyId)
    .eq('user_id', user.id);

  if (error) {
    log.error('Failed to delete API key', error);
    throw error;
  }
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Hook for managing API keys - THE SINGLE SOURCE OF TRUTH
 *
 * Follows the four-layer architecture pattern:
 * - Internal API functions (not exported)
 * - React Query for caching and mutations
 * - Single unified hook export
 */
export function useApiKeys() {
  const queryClient = useQueryClient();

  // Query for fetching API keys
  const keysQuery = useQuery<ApiKey[]>({
    queryKey: ['apiKeys'],
    queryFn: fetchApiKeys,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Mutation for creating a new key
  const createMutation = useMutation<CreateApiKeyResult, Error, CreateApiKeyParams>({
    mutationFn: createApiKeyInDb,
    onSuccess: () => {
      // Invalidate to refresh the list
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });

  // Mutation for revoking a key
  const revokeMutation = useMutation<void, Error, string>({
    mutationFn: revokeApiKeyInDb,
    onMutate: async (apiKeyId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['apiKeys'] });
      const previous = queryClient.getQueryData<ApiKey[]>(['apiKeys']);
      queryClient.setQueryData<ApiKey[]>(['apiKeys'], (old) =>
        old?.map(key =>
          key.api_key_id === apiKeyId
            ? { ...key, revoked_at: new Date().toISOString() }
            : key
        ) ?? []
      );
      return { previous };
    },
    onError: (_err, _apiKeyId, context) => {
      // Rollback on error
      const ctx = context as { previous?: ApiKey[] } | undefined;
      if (ctx?.previous) {
        queryClient.setQueryData(['apiKeys'], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });

  // Mutation for deleting a key
  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteApiKeyInDb,
    onMutate: async (apiKeyId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['apiKeys'] });
      const previous = queryClient.getQueryData<ApiKey[]>(['apiKeys']);
      queryClient.setQueryData<ApiKey[]>(['apiKeys'], (old) =>
        old?.filter(key => key.api_key_id !== apiKeyId) ?? []
      );
      return { previous };
    },
    onError: (_err, _apiKeyId, context) => {
      // Rollback on error
      const ctx = context as { previous?: ApiKey[] } | undefined;
      if (ctx?.previous) {
        queryClient.setQueryData(['apiKeys'], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });

  // Filter active keys (not revoked)
  const activeKeys = keysQuery.data?.filter(key => !key.revoked_at) ?? [];
  const revokedKeys = keysQuery.data?.filter(key => key.revoked_at) ?? [];

  return {
    // Data
    apiKeys: keysQuery.data ?? [],
    activeKeys,
    revokedKeys,
    isLoading: keysQuery.isLoading,
    error: keysQuery.error,
    refetch: keysQuery.refetch,

    // Mutations
    apiKeyMutations: {
      createApiKey: createMutation.mutateAsync,
      revokeApiKey: revokeMutation.mutateAsync,
      deleteApiKey: deleteMutation.mutateAsync,
      isCreating: createMutation.isPending,
      isRevoking: revokeMutation.isPending,
      isDeleting: deleteMutation.isPending,
    },
  };
}
