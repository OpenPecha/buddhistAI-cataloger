import { useState, useMemo, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import { TableHeader, TableRow, TableHead, TableBody } from '@/components/ui/table';
import type { Document, Segment } from '../shared/types';
import SegmentRow from './SegmentRow';
import SegmentSidebar from './SegmentSidebar';
import { Button } from '@/components/ui/button';
import { useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type SegmentStatusFilter = 'all' | 'unchecked' | 'checked' | 'approved' | 'rejected';

interface SegmentsTabProps {
  readonly selectedDocument: Document | null;
  readonly segments: Segment[];
  readonly loadingSegments: boolean;
  readonly expandedSegments: Set<string>;
  readonly onToggleExpansion: (segmentId: string) => void;
}

function SegmentsTab({
  selectedDocument,
  segments,
  loadingSegments,
  expandedSegments,
  onToggleExpansion,
}: SegmentsTabProps) {
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SegmentStatusFilter>('all');
  const { documentId } = useParams<{ documentId: string }>();
  const { getAccessTokenSilently } = useAuth0();
  const queryClient = useQueryClient();
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  const updateSpacerWidth = useCallback(() => {
    const table = bottomScrollRef.current?.querySelector('table');
    const spacer = spacerRef.current;
    if (table && spacer) {
      spacer.style.width = `${table.scrollWidth}px`;
    }
  }, []);

  const syncScroll = useCallback((source: 'top' | 'bottom') => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    const top = topScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (top && bottom) {
      if (source === 'top') {
        bottom.scrollLeft = top.scrollLeft;
      } else {
        top.scrollLeft = bottom.scrollLeft;
      }
    }
    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  }, []);

  const filteredSegments = useMemo(() => {
    if (statusFilter === 'all') return segments;
    return segments.filter(s => (s.status ?? 'unchecked') === statusFilter);
  }, [segments, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = { unchecked: 0, checked: 0, approved: 0, rejected: 0 };
    for (const s of segments) {
      const st = (s.status ?? 'unchecked') as keyof typeof counts;
      if (st in counts) counts[st]++;
    }
    return counts;
  }, [segments]);

  useLayoutEffect(() => {
    updateSpacerWidth();
    const top = topScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (top && bottom) {
      top.scrollLeft = bottom.scrollLeft;
    }
  }, [filteredSegments, updateSpacerWidth]);

  useEffect(() => {
    const bottom = bottomScrollRef.current;
    if (!bottom) return;
    const ro = new ResizeObserver(updateSpacerWidth);
    ro.observe(bottom);
    return () => ro.disconnect();
  }, [updateSpacerWidth]);

  const handleSegmentClick = (segment: Segment) => {
    setSelectedSegment(segment);
    setIsSidebarOpen(true);
  };

  const handleSidebarClose = () => {
    setIsSidebarOpen(false);
    setSelectedSegment(null);
  };

  const handleApproveAll = async () => {
    if (!documentId) {
      toast.error('Document ID is required');
      return;
    }

    setIsApproving(true);
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`/api/outliner/documents/${documentId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Failed to approve document');
      }

      await response.json();
      toast.success('Document approved successfully');
      
      // Invalidate queries to refresh the document data
      queryClient.invalidateQueries({ queryKey: ['outliner-admin-document', documentId] });
      queryClient.invalidateQueries({ queryKey: ['outliner-admin-documents'] });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to approve document';
      toast.error(errorMessage);
    } finally {
      setIsApproving(false);
    }
  };



  return (
    <div className="w-full min-w-0">
      {segments.length === 0 && selectedDocument && (
        <div className="flex items-center justify-center py-16 px-6 bg-white/90 border-y border-gray-200">
          <p className="text-gray-500 text-sm">No segments found for this document.</p>
        </div>
      )}

      {loadingSegments && (
        <div className="flex items-center justify-center py-16 px-6 bg-white/90 border-y border-gray-200">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600" />
          <span className="ml-3 text-gray-600 text-sm">Loading segments...</span>
        </div>
      )}

      {selectedDocument && segments.length > 0 && (
        <section className="w-full bg-white border-y border-gray-200">
          <header className="sticky top-0 z-10 flex flex-col gap-4 px-6 py-4 bg-white/95 backdrop-blur-sm border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-base font-semibold text-gray-900 truncate">
                {selectedDocument.filename || `Document ${selectedDocument.id.slice(0, 8)}`}
              </h2>
              <div className="flex items-center gap-3 flex-wrap text-xs">
                <span className="text-gray-500">Approved: <span className="font-medium text-gray-700">{statusCounts.approved}</span></span>
                <span className="text-red-600">Rejected: <span className="font-medium">{statusCounts.rejected}</span></span>
                <span className="text-green-600">Done: <span className="font-medium">{statusCounts.checked}</span></span>
                <span className="text-amber-600">Under Process: <span className="font-medium">{statusCounts.unchecked}</span></span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as SegmentStatusFilter)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All ({segments.length})</option>
                <option value="unchecked">Under Process ({statusCounts.unchecked})</option>
                <option value="checked">Done ({statusCounts.checked})</option>
                <option value="approved">Approved ({statusCounts.approved})</option>
                <option value="rejected">Rejected ({statusCounts.rejected})</option>
              </select>
              <Button
                size="sm"
                onClick={handleApproveAll}
                disabled={isApproving || !documentId || statusCounts.approved < segments.length}
                className="cursor-pointer shrink-0"
                title={statusCounts.approved < segments.length ? `${segments.length - statusCounts.approved} segment(s) are not yet approved` : 'Approve document'}
              >
                {isApproving ? 'Approving...' : 'Submit'}
              </Button>
            </div>
          </header>
          <div
            ref={topScrollRef}
            className="overflow-x-auto overflow-y-hidden border-b border-gray-100 bg-gray-50/50"
            style={{ height: 16 }}
            onScroll={() => syncScroll('top')}
          >
            <div ref={spacerRef} className="h-px min-w-full" />
          </div>
          <div
            ref={bottomScrollRef}
            className="overflow-x-auto"
            onScroll={() => syncScroll('bottom')}
          >
            <table className="min-w-max w-full divide-y divide-gray-200 caption-bottom text-sm">
              <TableHeader className="bg-gray-50/80">
                <TableRow>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Text Preview
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    BDRC match
                  </TableHead>
                  
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-200">
                {filteredSegments.map((segment) => (
                  <SegmentRow
                    key={segment.id}
                    segment={segment}
                    isExpanded={expandedSegments.has(segment.id)}
                    onToggleExpansion={onToggleExpansion}
                    onSegmentClick={handleSegmentClick}
                  />
                ))}
              </TableBody>
            </table>
          </div>
        </section>
      )}

      {/* Segment Sidebar */}
      <SegmentSidebar
        segment={selectedSegment}
        isOpen={isSidebarOpen}
        onClose={handleSidebarClose}
      />
    </div>
  );
}

export default SegmentsTab;