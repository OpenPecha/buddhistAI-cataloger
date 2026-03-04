import { useQuery } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import type { PaginatedUserResponse } from '../api/user';

export interface Annotator {
  id: string;
  name: string | null;
}

/**
 * Hook for fetching users with the annotator role and outliner permission
 */
export function useAnnotators() {
  const { getAccessTokenSilently } = useAuth0();

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery<PaginatedUserResponse>({
    queryKey: ['outliner-annotators'],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      const params = new URLSearchParams({
        role: 'annotator',
        permission: 'outliner',
        limit: '200'
      });
      const response = await fetch(`/api/settings/users?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch annotators');
      }
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const annotators: Annotator[] = (data?.items || []).map((u) => ({
    id: u.id,
    name: u.name ?? null
  }));

  return {
    annotators,
    isLoading,
    error,
    refetch
  };
}
