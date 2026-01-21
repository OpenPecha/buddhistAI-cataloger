import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import { getUserByEmail, getUser, updateUser, type UserUpdate } from '../api/settings';

export function useUser() {
  const { user: auth0User } = useAuth0();
  const queryClient = useQueryClient();

  // Fetch user by email from Auth0
  const {
    data: user,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['user', auth0User?.email],
    queryFn: () => {
      if (!auth0User?.email) {
        throw new Error('User email is required');
      }
      return getUserByEmail(auth0User.email);
    },
    enabled: !!auth0User?.email,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ userId, userData }: { userId: string; userData: UserUpdate }) => {
      return updateUser(userId, userData);
    },
    onSuccess: (updatedUser) => {
      // Invalidate and refetch user queries
      queryClient.invalidateQueries({ queryKey: ['user'] });
      
      // Update the specific user cache
      if (updatedUser) {
        queryClient.setQueryData(['user', updatedUser.email], updatedUser);
        queryClient.setQueryData(['user', updatedUser.id], updatedUser);
      }
    },
  });

  return {
    user,
    isLoading,
    error,
    refetch,
    updateUser: updateUserMutation.mutate,
    updateUserAsync: updateUserMutation.mutateAsync,
    isUpdating: updateUserMutation.isPending,
    updateError: updateUserMutation.error,
  };
}

// Separate hook for fetching user by ID
export function useUserById(userId: string | null) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => {
      if (!userId) {
        throw new Error('User ID is required');
      }
      return getUser(userId);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
