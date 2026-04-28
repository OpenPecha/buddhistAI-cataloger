import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/hooks/useUser';
import { updateSegment, rejectSegment } from '@/api/outliner';
import { toast } from 'sonner';
import {FileText, Loader2, Undo, User, X } from 'lucide-react';
import type { Segment } from '../shared/types';
import type { TextSegment } from '@/components/outliner/types';
import type { FormDataType, Title, Author } from '@/components/outliner/AnnotationSidebar';
import { useDocument } from '@/hooks';
import { getLabelColor, getStatusColor } from '@/components/outliner/utils';
import ChevronUporDown from '@/components/outliner/utils/ChevronUporDown';

interface SegmentRowProps {
  readonly segment: Segment;
  readonly isExpanded: boolean;
  readonly onToggleExpansion: (segmentId: string) => void;
  readonly documentFilename?: string | null;
  /** 1-based index in the visible list (matches annotator workspace segment number). */
  readonly listIndex?: number;
  /**
   * Segment body caret for BDRC image sync (document index = span_start + offset).
   * Pass `offset: null` when this row no longer contributes (blur, collapse, unmount).
   */
  readonly onSegmentBodyCaretChange?: (segmentId: string, offset: number | null) => void;
}

/** null = no reviewer suggestion in DB; '' = explicit empty; else trimmed text. */
function storedReviewerNorm(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  return t === '' ? '' : t;
}

/** Reviewer title: never treat '' as distinct from absent; empty input → null in API. */
function storedReviewerTitleNorm(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  return t === '' ? null : t;
}

/** Normalized value to save from the input field (always a string: '' or trimmed text). */
function committedReviewerInput(raw: string): string {
  const t = raw.trim();
  return t === '' ? '' : t;
}

function SegmentRow({
  segment,
  isExpanded,
  onToggleExpansion,
  documentFilename,
  listIndex,
  onSegmentBodyCaretChange,
}: SegmentRowProps) {
  const { documentId } = useParams<{ documentId: string }>();
  const queryClient = useQueryClient();
  const { user: reviewerAccount, isLoading: reviewerAccountLoading } = useUser();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const { document: selectedDocument, isLoading: isLoadingDocument } = useDocument(documentId);
 
  const statusMutation = useMutation({
    mutationFn: (newStatus: 'approved' | 'unchecked' | 'checked') =>
      updateSegment(segment.id, {
        status: newStatus,
      }),
    onSuccess: (_data, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['outliner-admin-document', documentId] });
      if (newStatus === 'approved') toast.success('Segment approved');
      else if (newStatus === 'checked') toast.success('Segment marked done again');
      else toast.success('Segment reset');
    },
    onError: (error: Error, newStatus) => {
      const action =
        newStatus === 'approved' ? 'approve' : newStatus === 'checked' ? 'update' : 'reset';
      toast.error(`Failed to ${action} segment: ${error.message}`);
    }  });

  const rejectMutation = useMutation({
    mutationFn: (comment: string) => rejectSegment(segment.id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outliner-admin-document', documentId] });
      toast.success('Segment rejected');
      setRejectDialogOpen(false);
      setRejectComment('');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reject segment: ${error.message}`);
    }
  });

  const handleSave = () => {
    statusMutation.mutate('approved');
  };

  const handleConfirmReject = () => {
    const trimmed = rejectComment.trim();
    if (!trimmed) {
      toast.error('Please enter a comment explaining the rejection');
      return;
    }
    if (reviewerAccountLoading) {
      toast.error('Loading your account… try again in a moment.');
      return;
    }
    rejectMutation.mutate(trimmed);
  };

  const handleReset = () => {
    statusMutation.mutate('checked');
  };

  const handleUndoReject = () => {
    statusMutation.mutate('checked');
  };

  // --- Inline title / author (admin list) ---
  const [titleEditOpen, setTitleEditOpen] = useState(false);
  const [authorEditOpen, setAuthorEditOpen] = useState(false);
  const [titleInput, setTitleInput] = useState(() => {
    const rt = segment.reviewer_title;
    if (rt !== null && rt !== undefined) return rt;
    if (segment.title !== undefined && segment.title !== null && segment.title !== '') {
      return segment.title;
    }
    return '';
  });

  const [authorInput, setAuthorInput] = useState(() => {
    const ra = segment.reviewer_author;
    if (ra !== null && ra !== undefined) return ra;
    if (segment.author !== undefined && segment.author !== null && segment.author !== '') {
      return segment.author;
    }
    return '';
  });


  const { mutate: patchTitleOrAuthor, isPending: titleAuthorSaving } = useMutation({
    mutationFn: (payload: { reviewer_title?: string | null; reviewer_author?: string | null }) =>
      updateSegment(segment.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outliner-admin-document', documentId] });
      toast.success('Reviewer suggestion saved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const commitTitle = useCallback(() => {
    const next = storedReviewerTitleNorm(titleInput);
    const prev = storedReviewerTitleNorm(segment.reviewer_title);
    setTitleEditOpen(false);
    if (next === prev) return;
    patchTitleOrAuthor({ reviewer_title: next });
  }, [titleInput, segment.reviewer_title, patchTitleOrAuthor]);

  const commitAuthor = useCallback(() => {
    const next = committedReviewerInput(authorInput);
    const prev = storedReviewerNorm(segment.reviewer_author);
    setAuthorEditOpen(false);
    if (next === prev) return;
    patchTitleOrAuthor({ reviewer_author: next });
  }, [authorInput, segment.reviewer_author, patchTitleOrAuthor]);

  const clearReviewerSuggestions = useCallback((segmentId: string) => {
    patchTitleOrAuthor({ reviewer_title: null, reviewer_author: null });
  }, [patchTitleOrAuthor]);

  const cancelTitleEdit = useCallback(() => {
    const rt = segment.reviewer_title;
    setTitleInput(rt !== null && rt !== undefined ? rt : (segment.title ?? ''));
    setTitleEditOpen(false);
  }, [segment.reviewer_title, segment.title]);

  const cancelAuthorEdit = useCallback(() => {
    const ra = segment.reviewer_author;
    setAuthorInput(ra !== null && ra !== undefined ? ra : (segment.author ?? ''));
    setAuthorEditOpen(false);
  }, [segment.reviewer_author, segment.author]);

  useEffect(() => {
    if (titleEditOpen) return;
    const rt = segment.reviewer_title;
    setTitleInput(rt !== null && rt !== undefined ? rt : (segment.title ?? ''));
  }, [segment.reviewer_title, segment.title, segment.id, titleEditOpen]);

  useEffect(() => {
    if (authorEditOpen) return;
    const ra = segment.reviewer_author;
    setAuthorInput(ra !== null && ra !== undefined ? ra : (segment.author ?? ''));
  }, [segment.reviewer_author, segment.author, segment.id, authorEditOpen]);

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





  const toggleCollapse = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleExpansion(segment.id);
    },
    [onToggleExpansion, segment.id]
  );

  const reportBodyCaret = useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      if (!onSegmentBodyCaretChange) return;
      const el = e.currentTarget;
      const offset = Math.min(el.selectionStart, el.selectionEnd);
      onSegmentBodyCaretChange(segment.id, offset);
    },
    [onSegmentBodyCaretChange, segment.id]
  );

  useEffect(() => {
    if (!isExpanded) {
      onSegmentBodyCaretChange?.(segment.id, null);
    }
  }, [isExpanded, segment.id, onSegmentBodyCaretChange]);

  useEffect(() => {
    return () => {
      onSegmentBodyCaretChange?.(segment.id, null);
    };
  }, [segment.id, onSegmentBodyCaretChange]);

  




  const isRejected = segment.status === 'rejected';
  const showApproveButton= selectedDocument?.status==='completed';
  const isSaving = statusMutation.isPending || rejectMutation.isPending || titleAuthorSaving || bdrcSaveMutation.isPending;
  return (
    <div
      className={`rounded-lg border-2 p-4 transition-colors ${
        isRejected
          ? 'border-red-400 bg-red-50'
          : segment.status === 'approved'
            ? 'border-blue-300 bg-blue-50/40'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100/80'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={toggleCollapse}
            className="p-1 rounded hover:bg-gray-200 transition-colors"
            aria-label={isExpanded ? 'Collapse segment' : 'Expand segment'}
          >
            <ChevronUporDown isExpanded={isExpanded} />
          </button>
          {listIndex != null && (
            <>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
               getStatusColor(segment.status)
              }`}
            >
              {listIndex}
            </div>
            <StatusBadge status={segment.status} rejection={segment.rejection} />
              </>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-gray-200">
          
          
                {segment.label && (
             <div className="inline-flex  items-center gap-1 mt-2 mb-1">
               <span
                 className={
                   "px-2 text-sm font-bold py-0.5 rounded-full  " +
                   getLabelColor(segment.label)
                 }
                 title={`Label: ${segment.label}`}
               >
                 {segment.label.charAt(0).toUpperCase() + segment.label.slice(1)}
               </span>
             </div>
           )}
          </div>

          {segment.status === 'rejected' && segment.rejection?.reason?.trim() ? (
            <div className="rounded-md border border-red-200 bg-red-100/60 px-3 py-2 text-sm text-red-900">
              <span className="font-semibold text-red-800">Rejection note: </span>
              <span className="whitespace-pre-wrap">{segment.rejection.reason}</span>
            </div>
          ) : null}
          <div>
            {isExpanded ? (
              <Textarea
                readOnly
                value={segment.text}
                aria-label="Segment text (read-only; use caret for volume image sync)"
                spellCheck={false}
                onSelect={reportBodyCaret}
                onClick={reportBodyCaret}
                onKeyUp={reportBodyCaret}
                onFocus={reportBodyCaret}
                onBlur={() => onSegmentBodyCaretChange?.(segment.id, null)}
                className="min-h-[8rem] max-h-[min(24rem,50vh)] cursor-text resize-none text-sm text-gray-800 whitespace-pre-wrap overflow-y-auto font-monlam rounded-md border border-gray-200 bg-white/80 p-3 focus-visible:ring-2 focus-visible:ring-blue-500/20"
              />
            ) : (
              <button
                type="button"
                className="text-left w-full text-gray-700 font-monlam text-sm py-1 rounded px-2 -mx-2 transition-colors max-h-[100px] overflow-hidden whitespace-pre-wrap break-words [display:-webkit-box] [WebkitBoxOrient:vertical] [WebkitLineClamp:4] hover:bg-white/60"
                onClick={toggleCollapse}
              >
                {segment.text.length > 200 ? `${segment.text.slice(0, 200)}…` : segment.text}
              </button>
            )}
          </div>
       
      
          <div className="relative text-sm flex flex-col gap-2 min-w-0" onClick={(e) => e.stopPropagation()}>
            {titleAuthorSaving && (
              <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center gap-2 rounded">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
                Saving...
              </div>
            )}
            {
            segment.label==='TEXT' && (
              <>
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
                    className="h-8 text-sm font-monlam max-w-full"
                    placeholder="Reviewer suggestion (annotator title unchanged until they apply)"
                  />
                ) : (
                  <button
                    type="button"
                    className="text-left font-medium text-gray-900 font-monlam rounded px-1 py-0.5 -mx-1 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
                    onClick={() => {
                      setAuthorEditOpen(false);
                      const rt = segment.reviewer_title;
                      setTitleInput(rt !== null && rt !== undefined ? rt : (segment.title ?? ''));
                      setTitleEditOpen(true);
                    }}
                    disabled={titleAuthorSaving}
                    title="Annotator title; click to edit reviewer suggestion only"
                  >
                    <span className="block">
                      {segment.title?.trim() ? segment.title : '— No annotator title —'}
                    </span>
                    {segment.reviewer_title != null ? (
                      <span className="block text-xs font-normal text-sky-800 mt-0.5">
                        Suggestion:{' '}
                        {segment.reviewer_title.trim() ? segment.reviewer_title : '— Empty —'}
                      </span>
                    ) : (
                      <span className="block text-xs font-normal text-gray-500 mt-0.5">
                        Click to add reviewer suggestion
                      </span>
                    )}
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
                    className="h-8 text-sm font-monlam max-w-full"
                    placeholder="Reviewer suggestion (annotator author unchanged until they apply)"
                  />
                ) : (
                  <button
                    type="button"
                    className="text-left text-gray-700 text-sm font-monlam rounded px-1 py-0.5 -mx-1 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
                    onClick={() => {
                      setTitleEditOpen(false);
                      const ra = segment.reviewer_author;
                      setAuthorInput(ra !== null && ra !== undefined ? ra : (segment.author ?? ''));
                      setAuthorEditOpen(true);
                    }}
                    disabled={titleAuthorSaving}
                    title="Annotator author; click to edit reviewer suggestion only"
                  >
                    <span className="block">
                      {segment.author?.trim() ? segment.author : '— No annotator author —'}
                    </span>
                    {segment.reviewer_author != null ? (
                      <span className="block text-xs font-normal text-sky-800 mt-0.5">
                        Suggestion:{' '}
                        {segment.reviewer_author.trim() ? segment.reviewer_author : '— Empty —'}
                      </span>
                    ) : (
                      <span className="block text-xs font-normal text-gray-500 mt-0.5">
                        Click to add reviewer suggestion
                      </span>
                    )}
                  </button>
                )}
              </span>
            </div>
            </>)
            }

            
          </div>

          <div className="min-w-0 pt-1 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
            {/* <BDRCField
              segment={segmentAsTextSegment}
              formData={formData}
              onUpdate={handleBdrcUpdate}
              resetForm={resetBdrcForm}
              disabled={segment.status === 'approved'}
              volumeId={documentFilename ?? undefined}
              annotatorAuthorName={formData.author.name}
            /> */}
          </div>

          <div className="flex flex-wrap gap-2 pt-1 justify-between" onClick={(e) => e.stopPropagation()}>
            {segment.status === 'checked' && showApproveButton && (
              <div className='flex gap-2'>
                <Button size="xs" onClick={handleSave} disabled={isSaving} variant="outline">
                  {isSaving ? 'Saving...' : 'Approve'}
                </Button>
                <Button
                  size="xs"
                  onClick={() => {
                    setRejectComment('');
                    setRejectDialogOpen(true);
                  }}
                  disabled={isSaving}
                  variant="ghost"
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                >
                   Reject
                </Button>
              </div>
            )}
            {segment.status === 'approved' && (
              <Button size="sm" onClick={handleReset} disabled={isSaving} variant="outline">
                <Undo className="w-3.5 h-3.5 shrink-0" aria-hidden />
                Undo
              </Button>
            )}
            {segment.status === 'rejected' && (
              <Button size="sm" onClick={handleUndoReject} disabled={isSaving} variant="outline">
                Undo reject 
              </Button>
            )}
            {(segment.reviewer_title != null || segment.reviewer_author != null) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={titleAuthorSaving}
                  onClick={(e) => {
                    e.stopPropagation();
                    clearReviewerSuggestions(segment.id);
                  }}
                  className='w-min'
                >
                <X className="text-red-500 w-3.5 h-3.5 shrink-0" aria-hidden />Clear suggestions
                </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Reject segment</DialogTitle>
            <DialogDescription>
              Explain what needs to change. The annotator will see this on the rejected segment.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Reason for rejection (required)"
            className="min-h-[100px] text-sm"
            disabled={rejectMutation.isPending}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={
                rejectMutation.isPending ||
                !rejectComment.trim() ||
                reviewerAccountLoading ||
                !reviewerAccount?.id
              }
            >
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject segment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SegmentRow;




function StatusBadge({ status, rejection }: { status: Status, rejection: Rejection | null }) {
  return (
    <>
    {status === 'approved' ? (
      <span
      className="inline-block rounded-full bg-blue-100 text-blue-800 px-2 py-1 text-xs font-semibold"
      title="Segment approved"
      >
        Approved
      </span>
    ) : status === 'rejected' ? (
      <span
      className="inline-block rounded-full bg-red-100 text-red-800 px-2 py-1 text-xs font-semibold"
        title="Segment rejected"
      >
        Rejected
        {(rejection?.count ?? 0) > 1 ? ` (${rejection?.count ?? 0}x)` : ''}
      </span>
    ) : (
      <span
      className={
        status === 'checked'
        ? 'inline-block rounded-full bg-green-100 text-green-800 px-2 py-1 text-xs font-semibold'
        : 'inline-block rounded-full bg-yellow-100 text-yellow-800 px-2 py-1 text-xs font-semibold'
      }
      title={status === 'checked' ? 'Segment done' : 'Segment in progress'}
      >
        {status === 'checked' ? 'Done' : 'Under Process'}
      </span>
    )}
    </>
  );
}