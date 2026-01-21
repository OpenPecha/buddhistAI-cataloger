import { useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import type { Document } from '../components/admin/shared/types';

interface UseDocumentActionsProps {
  loadDocuments: () => Promise<void>;
  loadStats: () => Promise<void>;
  setSelectedDocument: (doc: Document | null) => void;
  setSegments: (segments: any[]) => void;
}

export function useDocumentActions({
  loadDocuments,
  loadStats,
  setSelectedDocument,
  setSegments
}: UseDocumentActionsProps) {
  const { getAccessTokenSilently } = useAuth0();

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
        await loadDocuments(); // Reload documents
        await loadStats(); // Reload stats
      } else {
        console.error('Failed to update document status');
      }
    } catch (error) {
      console.error('Error updating document status:', error);
    }
  }, [getAccessTokenSilently, loadDocuments, loadStats]);

  const deleteDocument = useCallback(async (documentId: string, selectedDocument: Document | null) => {
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
        await loadDocuments(); // Reload documents
        await loadStats(); // Reload stats
        if (selectedDocument?.id === documentId) {
          setSelectedDocument(null);
          setSegments([]);
        }
      } else {
        console.error('Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  }, [getAccessTokenSilently, loadDocuments, loadStats, setSelectedDocument, setSegments]);

  return {
    updateDocumentStatus,
    deleteDocument
  };
}