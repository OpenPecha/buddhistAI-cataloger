import { useState } from 'react';
import { useParams, useNavigate, redirect } from 'react-router-dom';
import { SegmentsTab } from '../components/admin';
import {
  useDocument,
} from '../hooks';
import { SkeletonLarger } from '@/components/ui/skeleton';

function OutlinerAdminSegment() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());

  const { document: selectedDocument, isLoading: isLoadingDocument } = useDocument(documentId);
  const segments = selectedDocument?.segments ?? [];

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
      <div className="flex min-h-screen flex-1 flex-col">
      <SkeletonLarger />
    </div>
    );
  }

  if (!selectedDocument) {
   return redirect('/outliner-admin/documents');
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col  ">
      <SegmentsTab
        selectedDocument={selectedDocument}
        segments={segments}
        loadingSegments={isLoadingDocument}
        expandedSegments={expandedSegments}
        onToggleExpansion={toggleSegmentExpansion}
      />
    </div>
  );
}

export default OutlinerAdminSegment;
