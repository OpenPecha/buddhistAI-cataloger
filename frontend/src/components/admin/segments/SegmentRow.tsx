import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSegment, rejectSegment } from '@/api/outliner';
import { toast } from 'sonner';
import type { Segment } from '../shared/types';

interface SegmentRowProps {
  readonly segment: Segment;
  readonly isExpanded: boolean;
  readonly onToggleExpansion: (segmentId: string) => void;
  readonly onSegmentClick?: (segment: Segment) => void;
}

function SegmentRow({
  segment,
  isExpanded,
  onToggleExpansion,
  onSegmentClick,
}: SegmentRowProps) {
  const { documentId } = useParams<{ documentId: string }>();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const statusMutation = useMutation({
    mutationFn: (newStatus: 'approved' | 'unchecked') =>
      updateSegment(segment.id, { status: newStatus }),
    onSuccess: (_data, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['outliner-admin-document', documentId] });
      toast.success(newStatus === 'approved' ? 'Segment approved' : 'Segment reset');
    },
    onError: (error: Error, newStatus) => {
      toast.error(
        `Failed to ${newStatus === 'approved' ? 'approve' : 'reset'} segment: ${error.message}`
      );
    },
    onSettled: () => setIsSaving(false),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectSegment(segment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outliner-admin-document', documentId] });
      toast.success('Segment rejected');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reject segment: ${error.message}`);
    },
    onSettled: () => setIsSaving(false),
  });

  const handleSave = () => {
    setIsSaving(true);
    statusMutation.mutate('approved');
  };

  const handleReject = () => {
    setIsSaving(true);
    rejectMutation.mutate();
  };

  const handleReset = () => {
    setIsSaving(true);
    statusMutation.mutate('unchecked');
  };



  const handleRowClick = (e: React.MouseEvent) => {
    // Prevent opening sidebar if clicking on interactive elements
    if ((e.target as HTMLElement).closest('button, input, textarea, [role="button"]')) {
      return;
    }
    onSegmentClick?.(segment);
  };

  return (
    <React.Fragment>
    <TableRow
      className="hover:bg-gray-50 cursor-pointer"
      onClick={handleRowClick}
    >
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {segment.status === 'approved' ? (
          <span
            className="inline-block rounded-full bg-blue-100 text-blue-800 px-2 py-1 text-xs font-semibold"
            title="Segment approved"
          >
            Approved
          </span>
        ) : segment.status === 'rejected' ? (
          <span
            className="inline-block rounded-full bg-red-100 text-red-800 px-2 py-1 text-xs font-semibold"
            title="Segment rejected"
          >
            Rejected{(segment.rejection_count ?? 0) > 1 ? ` (${segment.rejection_count}x)` : ''}
          </span>
        ) : (
          <span
            className={
              segment.status === 'checked'
                ? 'inline-block rounded-full bg-green-100 text-green-800 px-2 py-1 text-xs font-semibold'
                : 'inline-block rounded-full bg-yellow-100 text-yellow-800 px-2 py-1 text-xs font-semibold'
            }
            title={
              segment.status === 'checked'
                ? 'Segment done'
                : 'Segment in progress'
            }
          >
            {segment.status === 'checked' ? 'Done' : 'Under Process'}
          </span>
        )}
      </TableCell>
      <TableCell className="px-6 py-4 max-w-xs">
        <div
          className="text-sm text-gray-900 cursor-pointer hover:text-blue-600"
          onClick={(e) =>{
            e.stopPropagation();
            onToggleExpansion(segment.id)
          }
          } 
        >
          <span className="truncate block">
            {segment.text.substring(0, 100)}...
          </span>
          <span className="text-xs text-blue-500 mt-1">
            {isExpanded ? 'Click to collapse' : 'Click to expand'}
          </span>
        </div>
      </TableCell>
      <TableCell className="px-6 py-4">
        <div className="text-sm">
          {segment.title ? (
            <div>
              <div className="font-medium text-gray-900">{segment.title}</div>
              {segment.title_bdrc_id && (
                <div className="text-xs text-gray-500">BDRC: {segment.title_bdrc_id}</div>
              )}
            </div>
          ) : (
            <div className="text-gray-400 italic">No title</div>
          )}
        </div>
      </TableCell>
      <TableCell className="px-6 py-4">
        <div className="text-sm">
          {segment.author ? (
            <div>
              <div className="font-medium text-gray-900">{segment.author}</div>
              {segment.author_bdrc_id && (
                <div className="text-xs text-gray-500">BDRC: {segment.author_bdrc_id}</div>
              )}
            </div>
          ) : (
            <div className="text-gray-400 italic">No author</div>
          )}
        </div>
      </TableCell>
      <TableCell className="px-6 py-4">
        {segment.comments && segment.comments.length > 0 && (
          <span>{segment.comments.length}</span>
        )}
      </TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        {segment.status === 'checked' ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              variant="outline"
            >
              {isSaving ? 'Saving...' : 'Approve'}
            </Button>
            <Button
              size="sm"
              onClick={handleReject}
              disabled={isSaving}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
            >
              Reject
            </Button>
          </div>
        ) : segment.status === 'approved' ? (
          <Button size="sm" onClick={handleReset} disabled={isSaving} variant="outline">
            Reset
          </Button>
        ) : segment.status === 'rejected' ? (
          <Button size="sm" onClick={handleReset} disabled={isSaving} variant="outline">
            Reset
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
    {isExpanded && (
      <TableRow className="bg-gray-50">
        <TableCell colSpan={6} className="px-6 py-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-900">Full Text:</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                {segment.text}
              </div>
            </CardContent>
          </Card>
        </TableCell>
      </TableRow>
    )}
    </React.Fragment>
  );
}

export default SegmentRow;