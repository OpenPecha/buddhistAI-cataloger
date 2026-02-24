import { useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import type { Document, Segment, DocumentStats } from '../components/admin/shared/types';

/**
 * Calculate stats from documents array
 */
function calculateStats(documents: Document[]): DocumentStats {
  return documents.reduce((acc: DocumentStats, doc: Document) => {
    acc.total++;
    switch (doc.status) {
      case 'active':
        acc.active++;
        break;
      case 'completed':
        acc.completed++;
        break;
      case 'approved':
        acc.approved++;
        break;
      case 'rejected':
        acc.rejected++;
        break;
      default:
        acc.active++; // Default to active if no status
    }
    return acc;
  }, { total: 0, active: 0, completed: 0, approved: 0, rejected: 0 });
}

/**
 * Hook for fetching documents list
 */
export function useDocuments() {
  const { getAccessTokenSilently } = useAuth0();

  const {
    data: documents = [],
    isLoading,
    error,
    refetch
  } = useQuery<Document[]>({
    queryKey: ['outliner-admin-documents'],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      const response = await fetch('/api/outliner/documents', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const stats = useMemo(() => calculateStats(documents), [documents]);

  return {
    documents,
    stats,
    isLoading,
    error,
    refetch
  };
}

/**
 * Hook for fetching segments for a specific document
 */
export function useSegments(documentId: string | undefined) {
  const { getAccessTokenSilently } = useAuth0();

  const {
    data: segments = [],
    isLoading,
    error,
    refetch
  } = useQuery<Segment[]>({
    queryKey: ['outliner-admin-segments', documentId],
    queryFn: async () => {
      if (!documentId) {
        throw new Error('Document ID is required');
      }
      const token = await getAccessTokenSilently();
      const response = await fetch(`/api/outliner/documents/${documentId}/segments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch segments');
      }
      return response.json();
    },
    enabled: !!documentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    segments,
    isLoading,
    error,
    refetch
  };
}

/**
 * Hook for fetching a single document by ID
 */
export function useDocument(documentId: string | undefined) {
  const { getAccessTokenSilently } = useAuth0();

  const {
    data: document,
    isLoading,
    error,
    refetch
  } = useQuery<Document>({
    queryKey: ['outliner-admin-document', documentId],
    queryFn: async () => {
      if (!documentId) {
        throw new Error('Document ID is required');
      }
      const token = await getAccessTokenSilently();
      const response = await fetch(`/api/outliner/documents/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }
      return response.json();
    },
    enabled: !!documentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    document,
    isLoading,
    error,
    refetch
  };
}

/**
 * Legacy hook - kept for backward compatibility
 * Use useDocuments, useSegments, or useDocument instead
 * @deprecated Use individual hooks instead
 */
export function useOutlinerData() {
  const { documentId } = useParams<{ documentId?: string }>();
  const { documents, stats, isLoading: loadingDocuments } = useDocuments();
  const { segments, isLoading: loadingSegments } = useSegments(documentId);
  const { document: selectedDocument } = useDocument(documentId);

  return {
    documents,
    segments,
    selectedDocument: selectedDocument || null,
    stats,
    loading: loadingDocuments,
    loadingSegments,
    loadInitialData: async () => {}, // No-op for backward compatibility
    loadDocuments: async () => {}, // No-op for backward compatibility
    loadSegments: async () => {}, // No-op for backward compatibility
    loadStats: async () => {}, // No-op for backward compatibility
    handleDocumentSelect: () => {}, // No-op for backward compatibility
    setSelectedDocument: () => {}, // No-op for backward compatibility
    setSegments: () => {} // No-op for backward compatibility
  };
}
