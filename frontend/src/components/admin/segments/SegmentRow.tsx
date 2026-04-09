import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSegment, rejectSegment } from '@/api/outliner';
import { toast } from 'sonner';
import { FileText, Loader2, MessageCircle, User } from 'lucide-react';
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

  // --- Inline title / author (admin list) ---
  const [titleEditOpen, setTitleEditOpen] = useState(false);
  const [authorEditOpen, setAuthorEditOpen] = useState(false);
  const [titleInput, setTitleInput] = useState(() => segment.title || '');
  const [authorInput, setAuthorInput] = useState(() => segment.author || '');

  useEffect(() => {
    if (!titleEditOpen) setTitleInput(segment.title || '');
  }, [segment.title, segment.id, titleEditOpen]);

  useEffect(() => {
    if (!authorEditOpen) setAuthorInput(segment.author || '');
  }, [segment.author, segment.id, authorEditOpen]);

  const { mutate: patchTitleOrAuthor, isPending: titleAuthorSaving } = useMutation({
    mutationFn: (payload: { title?: string; author?: string }) => updateSegment(segment.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outliner-admin-document', documentId] });
      toast.success('Title / author updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const commitTitle = useCallback(() => {
    const next = titleInput.trim();
    const prev = (segment.title || '').trim();
    setTitleEditOpen(false);
    if (next === prev) return;
    patchTitleOrAuthor({ title: next });
  }, [titleInput, segment.title, patchTitleOrAuthor]);

  const commitAuthor = useCallback(() => {
    const next = authorInput.trim();
    const prev = (segment.author || '').trim();
    setAuthorEditOpen(false);
    if (next === prev) return;
    patchTitleOrAuthor({ author: next });
  }, [authorInput, segment.author, patchTitleOrAuthor]);

  const cancelTitleEdit = useCallback(() => {
    setTitleInput(segment.title || '');
    setTitleEditOpen(false);
  }, [segment.title]);

  const cancelAuthorEdit = useCallback(() => {
    setAuthorInput(segment.author || '');
    setAuthorEditOpen(false);
  }, [segment.author]);

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
      <TableCell
        className="px-6 py-4 align-top"
        onClick={(e) => e.stopPropagation()}
      >
        <div className=" relative text-sm flex flex-col gap-2 min-w-48 max-w-xs">
        {titleAuthorSaving && (
          <div className="absolute top-0 left-0 z-10 w-full h-full bg-white/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
            Saving...
          </div>
        )}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500 flex gap-1 items-center">
              <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden />
              
            {titleEditOpen ? (
              <Input
                autoFocus
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={() => commitTitle()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitTitle();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelTitleEdit();
                  }
                }}
                disabled={titleAuthorSaving}
                className="h-8 text-sm font-monlam"
              />
            ) : (
              <button
                type="button"
                className="text-left font-medium text-gray-900 font-monlam rounded px-1 py-0.5 -mx-1 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
                onClick={() => {
                  setAuthorEditOpen(false);
                  setTitleInput(segment.title || '');
                  setTitleEditOpen(true);
                }}
                disabled={titleAuthorSaving}
                title="Click to edit title"
              >
                {segment.title?.trim() ? segment.title : '— Click to set —'}
              </button>
            )}
            </span>

          </div>
          <div className="flex flex-col gap-1">
            
            <span className="text-xs font-medium text-gray-500 flex gap-1 items-center">
              <User className="w-3.5 h-3.5 shrink-0" aria-hidden />
             
            {authorEditOpen ? (
              <Input
                autoFocus
                value={authorInput}
                onChange={(e) => setAuthorInput(e.target.value)}
                onBlur={() => commitAuthor()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitAuthor();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelAuthorEdit();
                  }
                }}
                disabled={titleAuthorSaving}
                className="h-8 text-sm font-monlam"
              />
            ) : (
              <button
                type="button"
                className="text-left text-gray-700 text-sm font-monlam rounded px-1 py-0.5 -mx-1 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
                onClick={() => {
                  setTitleEditOpen(false);
                  setAuthorInput(segment.author || '');
                  setAuthorEditOpen(true);
                }}
                disabled={titleAuthorSaving}
                title="Click to edit author"
              >
                {segment.author?.trim() ? segment.author : '— Click to set —'}
              </button>
            )}
            </span>

          </div>
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

