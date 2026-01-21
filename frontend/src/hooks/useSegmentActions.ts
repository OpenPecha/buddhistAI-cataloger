import { useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import type { Document, Segment } from '../components/admin/shared/types';


interface UseSegmentActionsProps {
  selectedDocument: Document | null;
  loadSegments: (documentId: string) => Promise<void>;
  loadDocuments: () => Promise<void>;
  loadStats: () => Promise<void>;
}

export function useSegmentActions({
  selectedDocument,
  loadSegments,
  loadDocuments,
  loadStats
}: UseSegmentActionsProps) {
  const { getAccessTokenSilently } = useAuth0();

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
        // Reload segments for the current document
        if (selectedDocument) {
          await loadSegments(selectedDocument.id);
        }
        // Reload documents to update progress
        await loadDocuments();
        await loadStats();
      } else {
        console.error('Failed to update segment');
      }
    } catch (error) {
      console.error('Error updating segment:', error);
    }
  }, [getAccessTokenSilently, selectedDocument, loadSegments, loadDocuments, loadStats]);

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
        // Reload segments for the current document
        if (selectedDocument) {
          await loadSegments(selectedDocument.id);
        }
        // Reload documents to update progress
        await loadDocuments();
        await loadStats();
      } else {
        console.error('Failed to delete segment');
      }
    } catch (error) {
      console.error('Error deleting segment:', error);
    }
  }, [getAccessTokenSilently, selectedDocument, loadSegments, loadDocuments, loadStats]);

  return {
    updateSegment,
    deleteSegment
  };
}