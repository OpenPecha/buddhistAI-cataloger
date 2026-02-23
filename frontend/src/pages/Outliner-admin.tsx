import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Components
import { OverviewTab, DocumentsTab, SegmentsTab } from '../components/admin';
import type { Document, Segment } from '../components/admin/shared/types';
// Hooks
import {
  useOutlinerData,
  useDocumentActions,
} from '../hooks';

const ADMIN_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'documents', label: 'Documents'},
  { id: 'segments', label: 'Segments' }
] as const;

type TabId = typeof ADMIN_TABS[number]["id"];

const getTabFromPath = (pathname: string): TabId => {
  if (pathname === '/outliner-admin/documents') return 'documents';
  if (pathname === '/outliner-admin/segments') return 'segments';
  return 'overview';
};

function OutlinerAdmin() {
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>(() => getTabFromPath(location.pathname));

  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]);

  const handleTabChange = (value: string) => {
    const tabId = value as TabId;
    setActiveTab(tabId);
    if (tabId === 'overview') {
      navigate('/outliner-admin');
    } else {
      navigate(`/outliner-admin/${tabId}`);
    }
  };

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
  const handleDocumentSelectAction = (document: Document) => {
    handleDocumentSelect(document);
    navigate('/outliner-admin/segments');
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

        <Tabs defaultValue="overview" value={activeTab} onValueChange={handleTabChange} className="flex flex-col w-full">
          <TabsList className="shrink-0 flex border-b border-gray-200 mb-10">
            {ADMIN_TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                className="bg-white px-5 h-[45px] flex items-center justify-center text-[15px] leading-none text-mauve-6 select-none first:rounded-tl-md last:rounded-tr-md hover:text-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-[inset_0_-1px_0_0,0_1px_0_0] data-[state=active]:shadow-current data-[state=active]:focus:relative outline-none cursor-default"
                value={tab.id}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab stats={stats} />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentsTab
              documents={documents}
              onDocumentStatusChange={updateDocumentStatus}
              onDocumentSelect={handleDocumentSelectAction}
              onDocumentDelete={handleDocumentDelete}
            />
          </TabsContent>

          <TabsContent value="segments">
            <SegmentsTab
              selectedDocument={selectedDocument}
              segments={segments}
              loadingSegments={loadingSegments}
              expandedSegments={expandedSegments}
              onToggleExpansion={toggleSegmentExpansion}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default OutlinerAdmin;
