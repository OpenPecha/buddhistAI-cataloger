import { useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useQueryClient } from '@tanstack/react-query';
import type { Document } from '../components/admin/shared/types';

interface UseDocumentActionsProps {
  selectedDocument?: Document | null;
  onDocumentDeleted?: (documentId: string) => void;
}

export function useDocumentActions({
  selectedDocument,
  onDocumentDeleted
}: UseDocumentActionsProps = {}) {
  const { getAccessTokenSilently } = useAuth0();
  const queryClient = useQueryClient();

  const updateDocumentStatus = useCallback(async (documentId: string, newStatus: string) => {
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`/api/outliner/documents/${documentId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        // Invalidate documents query to refetch updated data
        queryClient.invalidateQueries({ queryKey: ['outliner-admin-documents'] });
        // Also invalidate the specific document if it exists
        queryClient.invalidateQueries({ queryKey: ['outliner-admin-document', documentId] });
      } else {
        console.error('Failed to update document status');
      }
    } catch (error) {
      console.error('Error updating document status:', error);
    }
  }, [getAccessTokenSilently, queryClient]);

  const deleteDocument = useCallback(async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`/api/outliner/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Invalidate documents query to refetch updated data
        queryClient.invalidateQueries({ queryKey: ['outliner-admin-documents'] });
        // Invalidate segments if this was the selected document
        if (selectedDocument?.id === documentId) {
          queryClient.invalidateQueries({ queryKey: ['outliner-admin-segments', documentId] });
          onDocumentDeleted?.(documentId);
        }
      } else {
        console.error('Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  }, [getAccessTokenSilently, queryClient, selectedDocument, onDocumentDeleted]);

  return {
    updateDocumentStatus,
    deleteDocument
  };
}
