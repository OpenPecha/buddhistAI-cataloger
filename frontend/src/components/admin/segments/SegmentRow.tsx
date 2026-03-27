import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSegment, rejectSegment } from '@/api/outliner';
import { toast } from 'sonner';
import { FileText, MessageCircle, User } from 'lucide-react';
import type { Segment } from '../shared/types';
import type { TextSegment } from '@/components/outliner/types';
import type { FormDataType, Title, Author } from '@/components/outliner/AnnotationSidebar';
import BDRCField from '@/components/outliner/sidebarFields/BDRCField';

interface SegmentRowProps {
  readonly segment: Segment;
  readonly isExpanded: boolean;
  readonly onToggleExpansion: (segmentId: string) => void;
  readonly documentFilename?: string | null;
}

function SegmentRow({
  segment,
  isExpanded,
  onToggleExpansion,
  documentFilename,
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

  // --- BDRC field state ---
  const [formData, setFormData] = useState<FormDataType>({
    title: { name: segment.title || '', bdrc_id: segment.title_bdrc_id || '' },
    author: { id: '', name: segment.author || '', bdrc_id: segment.author_bdrc_id || '' },
  });
  const initialBdrcIdRef = useRef(segment.title_bdrc_id || '');

  useEffect(() => {
    setFormData({
      title: { name: segment.title || '', bdrc_id: segment.title_bdrc_id || '' },
      author: { id: '', name: segment.author || '', bdrc_id: segment.author_bdrc_id || '' },
    });
    initialBdrcIdRef.current = segment.title_bdrc_id || '';
  }, [segment.id, segment.title, segment.author, segment.title_bdrc_id, segment.author_bdrc_id]);

  const bdrcSaveMutation = useMutation({
    mutationFn: (bdrcId: string) =>
      updateSegment(segment.id, { title_bdrc_id: bdrcId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outliner-admin-document', documentId] });
      toast.success('BDRC match saved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save BDRC match: ${error.message}`);
    },
  });

  const bdrcSaveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const bdrcSaveMutationRef = useRef(bdrcSaveMutation);
  bdrcSaveMutationRef.current = bdrcSaveMutation;

  useEffect(() => {
    const currentBdrcId = formData.title.bdrc_id;
    if (currentBdrcId === initialBdrcIdRef.current) return;

    clearTimeout(bdrcSaveTimeoutRef.current);
    bdrcSaveTimeoutRef.current = setTimeout(() => {
      initialBdrcIdRef.current = currentBdrcId;
      bdrcSaveMutationRef.current.mutate(currentBdrcId);
    }, 1000);

    return () => clearTimeout(bdrcSaveTimeoutRef.current);
  }, [formData.title.bdrc_id]);

  const handleBdrcUpdate = useCallback((field: 'title' | 'author', value: Title | Author) => {
    setFormData(prev => {
      if (field === 'title') return { ...prev, title: value as Title };
      return { ...prev, author: value as Author };
    });
  }, []);

  const resetBdrcForm = useCallback(() => {
    setFormData({
      title: { name: segment.title || '', bdrc_id: segment.title_bdrc_id || '' },
      author: { id: '', name: segment.author || '', bdrc_id: segment.author_bdrc_id || '' },
    });
  }, [segment.title, segment.author, segment.title_bdrc_id, segment.author_bdrc_id]);

  const segmentAsTextSegment = useMemo<TextSegment>(() => ({
    id: segment.id,
    text: segment.text,
    span_start: segment.span_start,
    span_end: segment.span_end,
    title: segment.title ?? undefined,
    author: segment.author ?? undefined,
    title_span_start: segment.title_span_start ?? undefined,
    title_span_end: segment.title_span_end ?? undefined,
    updated_title: segment.updated_title ?? undefined,
    author_span_start: segment.author_span_start ?? undefined,
    author_span_end: segment.author_span_end ?? undefined,
    updated_author: segment.updated_author ?? undefined,
    title_bdrc_id: segment.title_bdrc_id ?? undefined,
    author_bdrc_id: segment.author_bdrc_id ?? undefined,
    status: segment.status,
    comments: segment.comments ?? [],
  }), [segment]);




  return (
    <React.Fragment>
    <TableRow
      className="hover:bg-gray-50 cursor-pointer max-w-full overflow-auto"
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
      <TableCell className="px-6 py-4 min-w-[280px]">
        <BDRCField
          segment={segmentAsTextSegment}
          formData={formData}
          onUpdate={handleBdrcUpdate}
          resetForm={resetBdrcForm}
          disabled={segment.status === 'approved'}
          volumeId={documentFilename ?? undefined}
          annotatorAuthorName={formData.author.name}
        />
      </TableCell>
    
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        {segment.status === 'checked' && (
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
        )} 
        { segment.status === 'approved' && (
          <Button size="sm" onClick={handleReset} disabled={isSaving} variant="outline">
            Reset
          </Button>
        )} 
        { segment.status === 'rejected' && (
          <Button size="sm" onClick={handleReset} disabled={isSaving} variant="outline">
            Reset
          </Button>
        )} 
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

