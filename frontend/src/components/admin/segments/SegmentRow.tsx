import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSegment, rejectSegment } from '@/api/outliner';
import { toast } from 'sonner';
import { useBdrcWork, type BdrcWorkInfo } from '@/hooks/useBdrcSearch';
import { AlertCircle, FileText, Hash, Loader2, MessageCircle, User } from 'lucide-react';
import type { Segment } from '../shared/types';
import BDRCSeachWrapper from '@/components/outliner/BDRCSeachWrapper';
import AuthorsListing from '@/components/outliner/sidebarFields/AuthorsListing';



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
      className="hover:bg-gray-50 cursor-pointer max-w-full overflow-auto"
      onClick={handleRowClick}
    >
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {segment.comments && segment.comments.length > 0 && (
          <span className="inline-flex rounded-full items-center gap-1 bg-gray-100 text-gray-800 px-2 py-1 text-xs font-semibold">
            <MessageCircle className="w-4 h-4" /> {segment.comments.length}        </span>
       )}
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
          <span className="truncate block font-monlam">
            {segment.text.substring(0, 100)}...
          </span>
          <span className="text-xs text-blue-500 mt-1">
            {isExpanded ? 'Click to collapse' : 'Click to expand'}
          </span>
        </div>
      </TableCell>
      <TableCell className="px-6 py-4">
        <div className="text-sm flex flex-col gap-1">
          <span className="font-medium text-gray-900 flex gap-1 items-center"><FileText className="w-4 h-4"/>{segment.title || "---"}</span>
          <span className="text-xs text-gray-500 flex gap-1 items-center"><User className="w-4 h-4"/>{segment.author || "---"}</span>
        </div>
      </TableCell>
      <TableCell className="px-6 py-4">
        <div className="text-sm">
           <BDRCInfo workId={segment.title_bdrc_id ?? ''} />
        </div>
      </TableCell>
    
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        {segment.status === 'checked' ? (
          <div className="flex gap-2">
            <Button
              size="xs"
              onClick={handleSave}
              disabled={isSaving}
              variant="outline"
            >
              {isSaving ? 'Saving...' : 'Approve'}
            </Button>
            <Button
              size="xs"
              onClick={handleReject}
              disabled={isSaving}
              variant="ghost"
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
              <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto font-monlam">
                {segment.text}
              </div>
        </TableCell>
      </TableRow>
    )}
    </React.Fragment>
  );
}

export default SegmentRow;




const BDRCInfo = ({ workId }: { workId: string }) => {
  const { work, isLoading: workLoading } = useBdrcWork(workId);
  if (!workId || workId==="") return null;
  if (workLoading) return <Loader2 className="h-4 w-4 animate-spin shrink-0" />;
  return (
  <div className="flex  gap-1 flex-col items-start" > 
<BDRCSeachWrapper bdrcId={workId}>

    <span
    className="text-blue-600  hover:text-blue-800 hover:underline font-monlam text-sm"
    >{work?.title}
  </span>
    </BDRCSeachWrapper>
    <span className="text-xs text-gray-500 ml-1">
    <AuthorsListing authors={work?.authors ?? []} />
    </span>
    </div>

  );
}

