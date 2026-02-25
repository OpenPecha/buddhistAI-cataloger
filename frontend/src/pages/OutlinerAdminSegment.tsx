import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SegmentsTab } from '../components/admin';
import {
  useDocument,
} from '../hooks';

function OutlinerAdminSegment() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());

  const { document: selectedDocument, isLoading: isLoadingDocument } = useDocument(documentId);
  const segments=selectedDocument?.segments;

  // Redirect if no documentId is provided
  if (!documentId) {
    navigate('/outliner-admin/documents');
    return null;
  }

  const toggleSegmentExpansion = (segmentId: string) => {
    setExpandedSegments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(segmentId)) {
        newSet.delete(segmentId);
      } else {
        newSet.add(segmentId);
      }
      return newSet;
    });
  };

  if (isLoadingDocument) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render if document is not found
  if (!selectedDocument) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Document not found</h2>
          <p className="text-gray-600 mb-4">The document you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/outliner-admin/documents')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Documents
          </button>
        </div>
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

        <SegmentsTab
          selectedDocument={selectedDocument}
          segments={segments}
          loadingSegments={isLoadingDocument}
          expandedSegments={expandedSegments}
          onToggleExpansion={toggleSegmentExpansion}
        />
      </div>
    </div>
  );
}

export default OutlinerAdminSegment;
