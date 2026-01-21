import { useState, useEffect } from 'react';

// Components
import { OverviewTab, DocumentsTab, SegmentsTab } from '../components/admin';

// Hooks
import {
  useOutlinerData,
  useDocumentActions,
} from '../hooks';

function OutlinerAdmin() {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'documents', label: 'Documents', icon: '📄' },
    { id: 'segments', label: 'Segments', icon: '📝' }
  ];

  // Custom hooks for data management
  const {
    documents,
    segments,
    selectedDocument,
    stats,
    loading,
    loadingSegments,
    loadInitialData,
    loadDocuments,
    loadStats,
    handleDocumentSelect,
    setSelectedDocument,
    setSegments
  } = useOutlinerData();

  const { updateDocumentStatus, deleteDocument: deleteDocumentAction } = useDocumentActions({
    loadDocuments,
    loadStats,
    setSelectedDocument,
    setSegments
  });



 

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

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

  const handleDocumentDelete = (documentId: string) => {
    deleteDocumentAction(documentId, selectedDocument);
  };




  if (loading) {
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

        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="tab-content">
          {activeTab === 'overview' && (
            <OverviewTab stats={stats} />
          )}
          {activeTab === 'documents' && (
            <DocumentsTab
              documents={documents}
              onDocumentStatusChange={updateDocumentStatus}
              onDocumentSelect={handleDocumentSelect}
              onDocumentDelete={handleDocumentDelete}
            />
          )}
          {activeTab === 'segments' && (
            <SegmentsTab
              selectedDocument={selectedDocument}
              segments={segments}
              loadingSegments={loadingSegments}
              expandedSegments={expandedSegments}
              onToggleExpansion={toggleSegmentExpansion}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default OutlinerAdmin;
