import { useQuery } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import type { User, PaginatedUserResponse } from '../api/user';

interface UseUsersOptions {
  skip?: number;
  limit?: number;
}

/**
 * Hook for fetching users list with pagination
 */
export function useUsers(options: UseUsersOptions = {}) {
  const { getAccessTokenSilently } = useAuth0();
  const { skip = 0, limit = 100 } = options;

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery<PaginatedUserResponse>({
    queryKey: ['users', skip, limit],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      const response = await fetch(`/api/settings/users?skip=${skip}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
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
  const { getAccessTokenSilently } = useAuth0();

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
      const token = await getAccessTokenSilently();
      const response = await fetch(`/api/settings/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
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
