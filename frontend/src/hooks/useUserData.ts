import { useQuery } from '@tanstack/react-query';
import type { User, PaginatedUserResponse } from '../api/user';
import { fetchWithAccessToken } from '@/lib/fetchWithAccessToken';

interface UseUsersOptions {
  skip?: number;
  limit?: number;
  role?: string;
}

/**
 * Hook for fetching users list with pagination
 */
export function useUsers(options: UseUsersOptions = {}) {
  const { skip = 0, limit = 100, role } = options;

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery<PaginatedUserResponse>({
    queryKey: ['users', skip, limit, role],
    queryFn: async () => {
      const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
      if (role) params.append('role', role);
      const response = await fetchWithAccessToken(`/api/settings/users?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    users: data?.items || [],
    total: data?.total || 0,
    isLoading,
    error,
    refetch
  };
}

/**
 * Hook for fetching a single user by ID
 */
export function useUser(userId: string | undefined) {
  const {
    data: user,
    isLoading,
    error,
    refetch
  } = useQuery<User>({
    queryKey: ['user', userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }
      const response = await fetchWithAccessToken(`/api/settings/users/${userId}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }
      return response.json();
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    user,
    isLoading,
    error,
    refetch
  };
}
