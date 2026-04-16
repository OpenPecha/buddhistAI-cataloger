import { useQuery } from '@tanstack/react-query';
import type { PaginatedUserResponse } from '../api/user';
import { fetchWithAccessToken } from '@/lib/fetchWithAccessToken';

export interface OutlinerUser {
  id: string;
  name: string | null;
  email: string;
  role?: string | null;
}

/**
 * Hook for fetching all users with the outliner permission (any role).
 */
export function useOutlinerUsers() {
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery<PaginatedUserResponse>({
    queryKey: ['outliner-users'],
    queryFn: async () => {
      const params = new URLSearchParams({
        permission: 'outliner',
        limit: '200'
      });
      const response = await fetchWithAccessToken(`/api/settings/users?${params.toString()}`, {
        headers: {
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
    name: u.name ?? null,
    email: u.email ?? '',
    role: u.role ?? null,
  }));

  return {
    users,
    isLoading,
    error,
    refetch
  };
}
