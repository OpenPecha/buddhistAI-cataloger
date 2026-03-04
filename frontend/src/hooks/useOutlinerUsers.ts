import { useQuery } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import type { PaginatedUserResponse } from '../api/user';

export interface OutlinerUser {
  id: string;
  name: string | null;
}

/**
 * Hook for fetching all users with the outliner permission (any role).
 */
export function useOutlinerUsers() {
  const { getAccessTokenSilently } = useAuth0();

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery<PaginatedUserResponse>({
    queryKey: ['outliner-users'],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      const params = new URLSearchParams({
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
        throw new Error('Failed to fetch outliner users');
      }
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const users: OutlinerUser[] = (data?.items || []).map((u) => ({
    id: u.id,
    name: u.name ?? null
  }));

  return {
    users,
    isLoading,
    error,
    refetch
  };
}
