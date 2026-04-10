import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SplitPane, Pane } from 'react-split-pane';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import {
  List,
  useDynamicRowHeight,
  type RowComponentProps,
} from 'react-window';
import type { Document, Segment } from '../shared/types';
import SegmentRow from './SegmentRow';
import { Button } from '@/components/ui/button';
import { VolumeImagePanelCore } from '@/components/outliner/ImageWrapper';
import { useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateDocumentStatus } from '@/api/outliner';

type SegmentStatusFilter = 'all' | 'unchecked' | 'checked' | 'approved' | 'rejected';

function AdminDocumentSegmentRow({
  index,
  style,
  segments,
  expandedSegments,
  onToggleExpansion,
  documentFilename,
}: RowComponentProps<{
  segments: Segment[];
  expandedSegments: Set<string>;
  onToggleExpansion: (segmentId: string) => void;
  documentFilename?: string | null;
}>) {
  const segment = segments[index];
  if (!segment) return null;
  return (
    <div style={style} className="px-1 pb-3 box-border">
      <SegmentRow
        segment={segment}
        isExpanded={expandedSegments.has(segment.id)}
        onToggleExpansion={onToggleExpansion}
        documentFilename={documentFilename}
        listIndex={index + 1}
      />
    </div>
  );
}

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
  const { t } = useTranslation();
  const [isApproving, setIsApproving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SegmentStatusFilter>('all');
  const [imagesPanelVisible, setImagesPanelVisible] = useState(true);
  const { documentId } = useParams<{ documentId: string }>();
  const { getAccessTokenSilently } = useAuth0();
  const queryClient = useQueryClient();
  const filteredSegments = useMemo(() => {
    if (statusFilter === 'all') return segments;
    return segments.filter(s => (s.status ?? 'unchecked') === statusFilter);
  }, [segments, statusFilter]);
  const virtualListKey = useMemo(
    () => filteredSegments.map((s) => s.id).join('\0'),
    [filteredSegments]
  );

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 220,
    key: virtualListKey,
  });

  const statusCounts = useMemo(() => {
    const counts = { unchecked: 0, checked: 0, approved: 0, rejected: 0 };
    for (const s of segments) {
      const st = (s.status ?? 'unchecked') as keyof typeof counts;
      if (st in counts) counts[st]++;
    }
    return counts;
  }, [segments]);

  /** First expanded row in current table order — drives BDRC page sync when enabled on the image panel. */
  const documentCharIndexForImage = useMemo((): number | null => {
    for (const s of filteredSegments) {
      if (expandedSegments.has(s.id) && typeof s.span_start === 'number') {
        return s.span_start;
      }
    }
    return null;
  }, [filteredSegments, expandedSegments]);

  

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

      queryClient.invalidateQueries({ queryKey: ['outliner-admin-document', documentId] });
      queryClient.invalidateQueries({ queryKey: ['outliner-admin-documents'] });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to approve document';
      toast.error(errorMessage);
    } finally {
      setIsApproving(false);
    }
  };

  const undoSkippedMutation = useMutation({
    mutationFn: async () => {
      if (!documentId) throw new Error('Document ID is required');
      return updateDocumentStatus(documentId, 'active');
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['outliner-admin-document', documentId] }),
        queryClient.invalidateQueries({ queryKey: ['outliner-admin-documents'] }),
      ]);
      toast.success('Document restored to active');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update document status');
    },
  });

  const segmentsPanel =
    !loadingSegments && selectedDocument && segments.length > 0 ? (
      <>
        <header className="shrink-0 flex flex-col gap-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-base font-semibold text-gray-900 truncate">
              {selectedDocument.filename || `Document ${selectedDocument.id.slice(0, 8)}`}
            </h2>
            <div className="flex items-center gap-3 flex-wrap text-xs px-6">
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
            <div className="flex items-center gap-2">
              {selectedDocument.status === 'skipped' && (
                <Button
                  variant="outline"
                  onClick={() => undoSkippedMutation.mutate()}
                  disabled={undoSkippedMutation.isPending || !documentId}
                >
                  {undoSkippedMutation.isPending ? 'Restoring...' : 'Undo skipped'}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 px-2"
                onClick={() => setImagesPanelVisible((v) => !v)}
                aria-pressed={imagesPanelVisible}
                aria-label={
                  imagesPanelVisible
                    ? t('outliner.workspace.hideSidePanel')
                    : t('outliner.workspace.showSidePanel')
                }
                title={
                  imagesPanelVisible
                    ? t('outliner.workspace.hideSidePanel')
                    : t('outliner.workspace.showSidePanel')
                }
              >
                {imagesPanelVisible ? (
                  <PanelRightClose className="h-4 w-4" aria-hidden />
                ) : (
                  <PanelRightOpen className="h-4 w-4" aria-hidden />
                )}
              </Button>
              <Button
                size="sm"
                onClick={handleApproveAll}
                disabled={isApproving || !documentId || statusCounts.approved < segments.length}
                className="cursor-pointer shrink-0"
                title={
                  statusCounts.approved < segments.length
                    ? `${segments.length - statusCounts.approved} segment(s) are not yet approved`
                    : 'Approve document'
                }
              >
                {isApproving ? 'Approving...' : 'Submit'}
              </Button>
            </div>
          </div>
        </header>
        <div className="relative min-h-0 flex-1 flex flex-col overflow-hidden rounded-md border border-gray-200 bg-white">
          <div className="flex min-h-0 flex-1 flex-col px-2 pt-2">
            <List
              className="min-h-0 w-full scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 [scrollbar-gutter:stable]"
              style={{ height: '100%' }}
              rowComponent={AdminDocumentSegmentRow}
              rowCount={filteredSegments.length}
              rowHeight={rowHeight}
              rowProps={{
                segments: filteredSegments,
                expandedSegments,
                onToggleExpansion,
                documentFilename: selectedDocument.filename,
              }}
            />
          </div>
        </div>
      </>
    ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col w-full min-w-0">
      {loadingSegments && (
        <div className="flex min-h-48 flex-1 flex-col items-center justify-center px-6 py-8 bg-white/90">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600" />
            <span className="text-gray-600 text-sm">Loading segments...</span>
          </div>
        </div>
      )}

      {!loadingSegments && segments.length === 0 && selectedDocument && (
        <div className="flex flex-1 items-center justify-center py-16 px-6 bg-white/90 rounded-md border border-gray-200">
          <p className="text-gray-500 text-sm">No segments found for this document.</p>
        </div>
      )}

      {segmentsPanel && !imagesPanelVisible && segmentsPanel}

      {segmentsPanel && imagesPanelVisible && selectedDocument && (
        <SplitPane
          direction="horizontal"
          className="outliner-split-pane min-h-0 flex-1 w-full"
          dividerSize={8}
        >
          <Pane minSize={280}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-4">
              {segmentsPanel}
            </div>
          </Pane>
          <Pane defaultSize="30%" minSize={200} maxSize="50%">
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
              <VolumeImagePanelCore
                panelActive={imagesPanelVisible}
                volumeFilename={
                  selectedDocument.filename?.trim() ? selectedDocument.filename : null
                }
                documentCharIndexForImage={documentCharIndexForImage}
              />
            </div>
          </Pane>
        </SplitPane>
      )}

   
    </div>
  );
}

export default SegmentsTab;
