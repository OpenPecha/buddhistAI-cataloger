import { useState, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import type { Document, Segment, DocumentStats } from '../components/admin/shared/types';

export function useOutlinerData() {
  const { getAccessTokenSilently } = useAuth0();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [stats, setStats] = useState<DocumentStats>({
    total: 0,
    active: 0,
    completed: 0,
    approved: 0,
    rejected: 0
  });
  const [loading, setLoading] = useState(true);
  const [loadingSegments, setLoadingSegments] = useState(false);

  const loadDocuments = useCallback(async () => {
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch('/api/outliner/documents', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  }, [getAccessTokenSilently]);

  const loadSegments = useCallback(async (documentId: string) => {
    try {
      setLoadingSegments(true);
      const token = await getAccessTokenSilently();
      const response = await fetch(`/api/outliner/documents/${documentId}/segments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSegments(data);
      }
    } catch (error) {
      console.error('Error loading segments:', error);
    } finally {
      setLoadingSegments(false);
    }
  }, [getAccessTokenSilently]);

  const loadStats = useCallback(async () => {
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch('/api/outliner/documents', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const docsData = await response.json();

        const stats = docsData.reduce((acc: DocumentStats, doc: Document) => {
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

        setStats(stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [getAccessTokenSilently]);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadDocuments(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  }, [loadDocuments, loadStats]);

  const handleDocumentSelect = useCallback((document: Document) => {
    setSelectedDocument(document);
    loadSegments(document.id);
  }, [loadSegments]);

  return {
    documents,
    segments,
    selectedDocument,
    stats,
    loading,
    loadingSegments,
    loadInitialData,
    loadDocuments,
    loadSegments,
    loadStats,
    handleDocumentSelect,
    setSelectedDocument,
    setSegments
  };
}