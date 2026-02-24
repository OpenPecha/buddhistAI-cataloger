import { useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useQueryClient } from '@tanstack/react-query';
import type { Segment } from '../components/admin/shared/types';

interface UseSegmentActionsProps {
  documentId?: string | null;
}

export function useSegmentActions({
  documentId
}: UseSegmentActionsProps = {}) {
  const { getAccessTokenSilently } = useAuth0();
  const queryClient = useQueryClient();

  const updateSegment = useCallback(async (segmentId: string, updates: Partial<Segment>) => {
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`/api/outliner/segments/${segmentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        // Invalidate segments query to refetch updated data
        if (documentId) {
          queryClient.invalidateQueries({ queryKey: ['outliner-admin-segments', documentId] });
        }
        // Also invalidate documents to update progress
        queryClient.invalidateQueries({ queryKey: ['outliner-admin-documents'] });
      } else {
        console.error('Failed to update segment');
      }
    } catch (error) {
      console.error('Error updating segment:', error);
    }
  }, [getAccessTokenSilently, queryClient, documentId]);

  const deleteSegment = useCallback(async (segmentId: string) => {
    if (!confirm('Are you sure you want to delete this segment? This action cannot be undone.')) {
      return;
    }

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`/api/outliner/segments/${segmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Invalidate segments query to refetch updated data
        if (documentId) {
          queryClient.invalidateQueries({ queryKey: ['outliner-admin-segments', documentId] });
        }
        // Also invalidate documents to update progress
        queryClient.invalidateQueries({ queryKey: ['outliner-admin-documents'] });
      } else {
        console.error('Failed to delete segment');
      }
    } catch (error) {
      console.error('Error deleting segment:', error);
    }
  }, [getAccessTokenSilently, queryClient, documentId]);

  return {
    updateSegment,
    deleteSegment
  };
}
