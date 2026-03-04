import { useState, useMemo } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="space-y-6">
      { segments.length === 0 && selectedDocument && <Card className="text-center">
          <CardContent className="py-6">
            <p className="text-gray-600">No segments found for this document.</p>
          </CardContent>
        </Card>}

      {loadingSegments && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading segments...</span>
        </div>
      )
     }    
     {selectedDocument && (
        <Card>
          <CardHeader className="px-6 py-4 border-b border-gray-200">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Segments for: {selectedDocument.filename || `Document ${selectedDocument.id.slice(0, 8)}`}
            </CardTitle>
            <CardDescription className="text-sm text-gray-600 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span>Approved: {statusCounts.approved}</span>
                <span className="text-red-600">Rejected: {statusCounts.rejected}</span>
                <span className="text-green-600">Done: {statusCounts.checked}</span>
                <span className="text-yellow-600">Under Process: {statusCounts.unchecked}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as SegmentStatusFilter)}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1"
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
                  disabled={isApproving || !documentId || statusCounts.approved !== segments.length}
                  className="cursor-pointer"
                  title={statusCounts.approved !== segments.length ? `${segments.length - statusCounts.approved} segment(s) are not yet approved` : 'Approve document'}
                >
                  {isApproving ? 'Approving...' : 'Approve All'}
                </Button>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-full divide-y divide-gray-200">
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Index
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Text Preview
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title & BDRC ID
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Author & BDRC ID
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Comment
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white divide-y divide-gray-200">
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
              </Table>
            </div>
          </CardContent>
        </Card>
      ) }

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