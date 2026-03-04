import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DocumentsTab } from '../components/admin';
import type { Document } from '../components/admin/shared/types';
import {
  useDocuments,
  useDocumentActions,
  useOutlinerUsers,
} from '../hooks';
import type { DocumentFilters } from '../hooks';

function OutlinerAdminDocument() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') || undefined;
  const annotator = searchParams.get('annotator') || undefined;

  const filters: DocumentFilters = useMemo(
    () => ({ status, userId: annotator }),
    [status, annotator]
  );

  const { documents, isLoading, isFetching } = useDocuments(filters);
  const { deleteDocument } = useDocumentActions();
  const { users: annotators, isLoading: annotatorsLoading } = useOutlinerUsers();

  const handleFilterChange = useCallback(
    (newStatus?: string, newAnnotator?: string) => {
      const params = new URLSearchParams();
      if (newStatus) params.set('status', newStatus);
      if (newAnnotator) params.set('annotator', newAnnotator);
      setSearchParams(params);
    },
    [setSearchParams]
  );

  const handleDocumentSelectAction = (document: Document) => {
    navigate(`/outliner-admin/documents/${document.id}`);
  };

  const handleDocumentDelete = (documentId: string) => {
    deleteDocument(documentId);
  };

  if (isLoading && !documents.length) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage users, documents, and system settings</p>
        </div>

        <DocumentsTab
          documents={documents}
          isFetching={isFetching}
          onDocumentSelect={handleDocumentSelectAction}
          onDocumentDelete={handleDocumentDelete}
          annotators={annotators}
          annotatorsLoading={annotatorsLoading}
          currentStatus={status}
          currentAnnotator={annotator}
          onFilterChange={handleFilterChange}
        />
      </div>
    </div>
  );
}

export default OutlinerAdminDocument;
