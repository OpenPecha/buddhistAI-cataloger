import { useNavigate } from 'react-router-dom';
import { DocumentsTab } from '../components/admin';
import type { Document } from '../components/admin/shared/types';
import {
  useDocuments,
  useDocumentActions,
} from '../hooks';

function OutlinerAdminDocument() {
  const navigate = useNavigate();
  const { documents, isLoading } = useDocuments();
  const { updateDocumentStatus, deleteDocument } = useDocumentActions();

  const handleDocumentSelectAction = (document: Document) => {
    navigate(`/outliner-admin/documents/${document.id}`);
  };

  const handleDocumentDelete = (documentId: string) => {
    deleteDocument(documentId);
  };

  if (isLoading) {
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
          onDocumentStatusChange={updateDocumentStatus}
          onDocumentSelect={handleDocumentSelectAction}
          onDocumentDelete={handleDocumentDelete}
        />
      </div>
    </div>
  );
}

export default OutlinerAdminDocument;
