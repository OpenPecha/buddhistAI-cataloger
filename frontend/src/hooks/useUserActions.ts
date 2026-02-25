import { useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useQueryClient } from '@tanstack/react-query';
import type { UserUpdateRequest } from '../api/user';

export function useUserActions() {
  const { getAccessTokenSilently } = useAuth0();
  const queryClient = useQueryClient();

  const updateUser = useCallback(async (userId: string, userData: UserUpdateRequest) => {
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`/api/settings/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      if (response.ok) {
        // Invalidate users queries to refetch updated data
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['user', userId] });
        return await response.json();
      } else {
        const error = await response.json().catch(() => ({ detail: 'Failed to update user' }));
        throw new Error(error.detail || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }, [getAccessTokenSilently, queryClient]);

  const deleteUser = useCallback(async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`/api/settings/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Invalidate users queries to refetch updated data
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['user', userId] });
      } else {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete user' }));
        throw new Error(error.detail || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }, [getAccessTokenSilently, queryClient]);

  return {
    updateUser,
    deleteUser
  };
}
