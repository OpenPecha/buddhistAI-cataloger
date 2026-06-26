import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SplitPane, Pane } from 'react-split-pane';
import { toast } from 'sonner';
import { Check, FileText, PanelRightClose, PanelRightOpen, User, X } from 'lucide-react';

import {
  getOutlinerDocument,
  getRandomReviewedDocumentIds,
  getSegmentReviews,
  submitSegmentReview,
  type OutlinerSegment,
  type RandomReviewedDocumentSummary,
  type SegmentReviewStatus,
} from '@/api/outliner';
import { VolumeImagePanelCore } from '@/components/outliner/ImageWrapper';
import { useVolumeHasImages } from '@/features/outliner/bdrc/hook/useBdrcOtVolume';
import { SegmentSearchBar } from '@/components/outliner/SegmentSearchBar';
import { SegmentHighlightedText } from '@/components/outliner/SegmentHighlightedText';
import { getLabelColor, getStatusColor } from '@/components/outliner/utils';
import ChevronUporDown from '@/components/outliner/utils/ChevronUporDown';
import { findAllOccurrences } from '@/features/outliner';
import { getSegmentHighlightWords } from '@/utils/segmentHighlightWords';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

function sortSegments(list: OutlinerSegment[] | undefined): OutlinerSegment[] {
  return [...(list ?? [])].sort((a, b) => a.segment_index - b.segment_index);
}

// Mirror what is published to BDRC: the reviewer's correction wins (see
// _push_document_segments_to_bdrc, which sends reviewer_title/author when set).
// Fall back to the annotator's manual edit (updated_*), then the original.
function effectiveTitle(s: OutlinerSegment): string {
  const v =
    s.reviewer_title?.trim() ||
    s.updated_title?.trim() ||
    s.title?.trim();
  return v || '—';
}

function effectiveAuthor(s: OutlinerSegment): string {
  const v =
    s.reviewer_author?.trim() ||
    s.updated_author?.trim() ||
    s.author?.trim();
  return v || '—';
}

function errorText(error: unknown): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : 'Could not load document ids';
}

function DecisionBadge({ decision }: Readonly<{ decision: SegmentReviewStatus | undefined }>) {
  if (decision === 'approve') {
    return (
      <span
        className="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800"
        title="Spot-check approved"
      >
        Approved
      </span>
    );
  }
  if (decision === 'reject') {
    return (
      <span
        className="inline-block rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800"
        title="Spot-check rejected"
      >
        Rejected
      </span>
    );
  }
  return (
    <span
      className="inline-block rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800"
      title="Not yet spot-checked"
    >
      Pending
    </span>
  );
}

function SegmentCard({
  segment,
  listIndex,
  decision,
  isPending,
  isExpanded,
  onToggleExpanded,
  onBodyCaretChange,
  onReview,
}: Readonly<{
  segment: OutlinerSegment;
  listIndex: number;
  decision: SegmentReviewStatus | undefined;
  isPending: boolean;
  isExpanded: boolean;
  onToggleExpanded: (expanded: boolean) => void;
  onBodyCaretChange: (segmentId: string, offset: number | null) => void;
  onReview: (status: SegmentReviewStatus, comment?: string) => void;
}>) {
  const [textSearchQuery, setTextSearchQuery] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  // Per-segment body background color, persisted in localStorage (same as reviewer SegmentRow).
  const textBgColorStorageKey = `segment-text-bg-color:${segment.id}`;
  const [textBgColor, setTextBgColor] = useState('#ffffff');
  useEffect(() => {
    try {
      setTextBgColor(localStorage.getItem(textBgColorStorageKey) ?? '#ffffff');
    } catch {
      setTextBgColor('#ffffff');
    }
  }, [textBgColorStorageKey]);
  const handleTextBgColorChange = useCallback(
    (color: string) => {
      setTextBgColor(color);
      try {
        localStorage.setItem(textBgColorStorageKey, color);
      } catch {
        // ignore storage write failures
      }
      if (!isExpanded) onToggleExpanded(true);
    },
    [textBgColorStorageKey, isExpanded, onToggleExpanded]
  );

  const highlightWords = useMemo(() => getSegmentHighlightWords(segment), [segment]);
  const searchWords = useMemo(
    () => (textSearchQuery.trim() ? [textSearchQuery.trim()] : []),
    [textSearchQuery]
  );
  const bodyText = segment.text ?? '';
  const hasBodyHighlightLayer =
    searchWords.length > 0 ||
    highlightWords.titleWords.length > 0 ||
    highlightWords.authorWords.length > 0;
  const segmentSearchMatchCount = useMemo(
    () => findAllOccurrences(bodyText, textSearchQuery).length,
    [bodyText, textSearchQuery]
  );

  const segmentBodyRef = useRef<HTMLDivElement>(null);

  const scrollBodyMatchIntoView = useCallback((matchIndex: number) => {
    const body = segmentBodyRef.current;
    if (!body) return;
    const hits = body.querySelectorAll('.highlighter');
    if (hits.length === 0) return;
    const safeIndex = Math.min(Math.max(0, matchIndex), hits.length - 1);
    const el = hits[safeIndex];
    if (!(el instanceof HTMLElement)) return;

    const containerRect = body.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const deltaTop = elRect.top - containerRect.top;
    const targetScrollTop =
      body.scrollTop + deltaTop - body.clientHeight / 2 + elRect.height / 2;
    const maxScroll = Math.max(0, body.scrollHeight - body.clientHeight);
    body.scrollTop = Math.max(0, Math.min(targetScrollTop, maxScroll));
  }, []);

  const scrollBodyToEdge = useCallback((edge: 'top' | 'bottom') => {
    const body = segmentBodyRef.current;
    if (!body) return;
    const maxScroll = Math.max(0, body.scrollHeight - body.clientHeight);
    body.scrollTop = edge === 'top' ? 0 : maxScroll;
  }, []);

  // Report the click/caret offset within the segment body so the image panel can
  // follow the reader into later pages of a multi-page segment (mirrors the
  // reviewer SegmentRow: documentCharIndex = span_start + offset).
  const reportBodyCaret = useCallback(() => {
    const el = segmentBodyRef.current;
    if (!el) return;
    const selection = globalThis.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;

    const offsetFromRangePoint = (container: Node, nodeOffset: number) => {
      const pre = range.cloneRange();
      pre.selectNodeContents(el);
      pre.setEnd(container, nodeOffset);
      return pre.toString().length;
    };

    const offset = Math.min(
      offsetFromRangePoint(range.startContainer, range.startOffset),
      offsetFromRangePoint(range.endContainer, range.endOffset)
    );
    onBodyCaretChange(segment.id, offset);
  }, [onBodyCaretChange, segment.id]);

  // Clear the reported caret when the segment collapses or unmounts.
  useEffect(() => {
    if (!isExpanded) onBodyCaretChange(segment.id, null);
  }, [isExpanded, segment.id, onBodyCaretChange]);

  useEffect(() => {
    return () => onBodyCaretChange(segment.id, null);
  }, [segment.id, onBodyCaretChange]);

  const isApproved = decision === 'approve';
  const isRejected = decision === 'reject';

  const handleConfirmReject = () => {
    const trimmed = rejectComment.trim();
    if (!trimmed) {
      toast.error('Please enter a reason for rejection');
      return;
    }
    onReview('reject', trimmed);
    setRejectOpen(false);
    setRejectComment('');
  };

  return (
    <div
      id={segment.id}
      className={cn(
        'rounded-lg border-2 p-4 transition-colors',
        isRejected
          ? 'border-red-400 bg-red-50'
          : isApproved
            ? 'border-blue-300 bg-blue-50/40'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100/80'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-gray-200 transition-colors"
            aria-label={isExpanded ? 'Collapse segment' : 'Expand segment'}
          >
            <ChevronUporDown isExpanded={isExpanded} />
          </button>
          <div className="relative">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                getStatusColor(segment.status)
              )}
            >
              {listIndex}
            </div>
            <div className="transform rotate-270 absolute top-20 left-[-20px]">
              <DecisionBadge decision={decision} />
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-3 font-monlam-2">
          <div className="space-y-2 pb-2 border-b border-gray-200">
            <div className="flex flex-wrap justify-between items-center gap-2">
              {segment.label && (
                <div className="inline-flex items-center gap-1 mt-2 mb-1">
                  <span
                    className={cn(
                      'px-2 text-sm font-semibold py-0.5 rounded-full',
                      getLabelColor(segment.label)
                    )}
                    title={`Label: ${segment.label}`}
                  >
                    {segment.label.charAt(0).toUpperCase() + segment.label.slice(1)}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <SegmentSearchBar
                  segmentId={segment.id}
                  query={textSearchQuery}
                  onQueryChange={setTextSearchQuery}
                  matchCount={segmentSearchMatchCount}
                  disableMatchNavigation={!isExpanded}
                  scrollBodyMatchIntoView={scrollBodyMatchIntoView}
                  scrollBodyToEdge={scrollBodyToEdge}
                  bgColor={textBgColor}
                  onBgColorChange={handleTextBgColorChange}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {isExpanded ? (
              <div
                ref={segmentBodyRef}
                tabIndex={0}
                aria-label="Segment text (read-only; click to sync volume image)"
                onMouseUp={reportBodyCaret}
                onFocus={reportBodyCaret}
                onBlur={() => onBodyCaretChange(segment.id, null)}
                style={{ backgroundColor: textBgColor }}
                className="min-h-[8rem] max-h-[min(24rem,50vh)] overflow-y-auto whitespace-pre-wrap wrap-break-word p-3 font-monlam text-sm leading-normal text-gray-800 rounded-md border border-gray-200 cursor-text select-text outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20"
              >
                <SegmentHighlightedText
                  text={bodyText}
                  titleWords={highlightWords.titleWords}
                  authorWords={highlightWords.authorWords}
                  searchWords={searchWords}
                />
              </div>
            ) : (
              <button
                type="button"
                className="text-left w-full text-gray-700 font-monlam text-sm py-1 rounded px-2 -mx-2 transition-colors max-h-[100px] overflow-hidden whitespace-pre-wrap break-words [display:-webkit-box] [WebkitBoxOrient:vertical] [WebkitLineClamp:4] hover:bg-white/60"
                onClick={() => onToggleExpanded(true)}
              >
                {hasBodyHighlightLayer ? (
                  <SegmentHighlightedText
                    text={bodyText.length > 200 ? `${bodyText.slice(0, 200)}…` : bodyText}
                    titleWords={highlightWords.titleWords}
                    authorWords={highlightWords.authorWords}
                    searchWords={searchWords}
                  />
                ) : (
                  `${bodyText.length > 200 ? `${bodyText.slice(0, 200)}…` : bodyText}`
                )}
              </button>
            )}
          </div>

          <div className="relative text-sm flex flex-col gap-2 min-w-0">
            <div className="flex w-full min-w-0 gap-1">
              <span className="text-xs min-w-0 flex-1 font-medium text-gray-500 flex gap-1 items-center">
                <FileText className="w-5 h-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 text-left font-medium text-gray-900 font-monlam flex items-center gap-2">
                  {effectiveTitle(segment)}
                  {segment.is_supplied_title && (
                    <Badge title="is provided by annotator">Supplied</Badge>
                  )}
                </span>
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500 flex gap-1 items-center">
                <User className="w-5 h-5 shrink-0" aria-hidden />
                <span className="text-left text-gray-700 text-sm font-monlam">
                  {effectiveAuthor(segment)}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-200">
            {rejectOpen ? (
              <div className="flex w-full flex-col gap-2">
                <Textarea
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Reason for rejection (required)"
                  className="min-h-[80px] text-sm"
                  disabled={isPending}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={handleConfirmReject}
                    disabled={isPending || !rejectComment.trim()}
                  >
                    {isPending ? 'Rejecting…' : 'Confirm reject'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRejectOpen(false);
                      setRejectComment('');
                    }}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onReview('approve')}
                  disabled={isPending}
                  className={cn(
                    'cursor-pointer hover:bg-blue-50 hover:border-blue-400',
                    isApproved && 'border-blue-400 bg-blue-50'
                  )}
                >
                  <Check className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setRejectOpen(true)}
                  disabled={isPending}
                  className={cn(
                    'border-red-300 cursor-pointer text-red-600 hover:bg-red-50 hover:border-red-400',
                    isRejected && 'bg-red-50'
                  )}
                >
                  <X className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewOnly() {
  const [documents, setDocuments] = useLocalStorage<RandomReviewedDocumentSummary[] | null>(
    'outliner:random-reviewed-documents',
    null,
  );

  const { isFetching, error, refetch } = useQuery({
    queryKey: ['outliner', 'random-reviewed-document-ids'],
    queryFn: async () => {
      const result = await getRandomReviewedDocumentIds();
      setDocuments(result.documents);
      return result.documents;
    },
    enabled: documents === null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Lifted from EachDocument so the container can widen (drop max-w cap) while
  // the image side panel is open, reclaiming the empty space on wide screens.
  const [imagesPanelVisible, setImagesPanelVisible] = useState(false);

  useEffect(() => {
    if (!documents?.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && documents.some((d) => d.id === prev)) return prev;
      return documents[0].id;
    });
  }, [documents]);

  const documentList = documents ?? [];
  const loading = isFetching && documents === null;
  const errorMessage = errorText(error);

  const hasSidebar = !loading && !errorMessage && documentList.length > 0;

  return (
    <div
      className={cn(
        'mx-auto p-6',
        hasSidebar
          ? cn(
              'flex h-[calc(100dvh-3rem)] flex-col gap-6 overflow-hidden md:flex-row md:items-stretch',
              // Use the full width while the image panel is open so the segments +
              // image fill the screen instead of leaving empty space on the right.
              imagesPanelVisible ? 'max-w-none' : 'max-w-7xl',
            )
          : 'max-w-5xl',
      )}
    >
      {loading && <p className="text-gray-600">Loading…</p>}
      {errorMessage && <p className="text-red-600">{errorMessage}</p>}
      {!loading && !errorMessage && (
        <>
          {documentList.length === 0 ? (
            <p className="text-sm text-gray-600">No approved documents in the database.</p>
          ) : (
            <>
              <aside
                className={cn(
                  'flex min-h-0 w-full shrink-0 flex-col gap-4 border-b border-gray-200 bg-gray-50/95 py-4 backdrop-blur-sm',
                  'overflow-hidden md:h-full md:max-h-full',
                  'md:w-64 md:border-b-0 md:border-r md:pr-4 lg:w-72',
                )}
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-0.5 md:pr-1">
                  <h2 className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Documents
                  </h2>
                  <nav className="flex flex-col gap-1" aria-label="Documents">
                    {documentList.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setSelectedId(doc.id)}
                        title={`${doc.filename || '—'}\n${doc.id}`}
                        className={cn(
                          'w-full min-w-0 cursor-pointer rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                          selectedId === doc.id
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-200 bg-white text-gray-900 hover:border-gray-400',
                        )}
                      >
                        <div className="truncate font-medium">{doc.filename?.trim() || '—'}</div>
                      </button>
                    ))}
                  </nav>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="mt-3 w-full shrink-0 cursor-pointer rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isFetching ? 'Loading…' : 'Show 5 more random documents'}
                  </button>
                </div>
              </aside>
              <main className="flex min-h-0 min-w-0 flex-1 flex-col">
                {selectedId ? (
                  <EachDocument
                    key={selectedId}
                    documentId={selectedId}
                    imagesPanelVisible={imagesPanelVisible}
                    onToggleImagesPanel={() => setImagesPanelVisible((v) => !v)}
                  />
                ) : null}
              </main>
            </>
          )}
        </>
      )}
    </div>
  );
}

function EachDocument({
  documentId,
  imagesPanelVisible,
  onToggleImagesPanel,
}: Readonly<{
  documentId: string;
  imagesPanelVisible: boolean;
  onToggleImagesPanel: () => void;
}>) {
  const queryClient = useQueryClient();

  // Same query key as the sidebar prefetch in the original ViewOnly: a cache hit.
  const { data, isPending, error } = useQuery({
    queryKey: ['outliner', 'document', documentId],
    queryFn: () => getOutlinerDocument(documentId, true),
    enabled: Boolean(documentId),
  });

  const segments = useMemo(() => sortSegments(data?.segments), [data?.segments]);

  const hasImages = useVolumeHasImages(data?.filename ?? null);

  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());
  const [lastExpandedId, setLastExpandedId] = useState<string | null>(null);

  const [segmentBodyCaret, setSegmentBodyCaret] = useState<{
    segmentId: string;
    offset: number;
  } | null>(null);

  const handleToggleExpanded = useCallback((segmentId: string, expanded: boolean) => {
    setExpandedSegments((prev) => {
      const next = new Set(prev);
      if (expanded) next.add(segmentId);
      else next.delete(segmentId);
      return next;
    });
    if (expanded) setLastExpandedId(segmentId);
  }, []);

  const handleBodyCaretChange = useCallback(
    (segmentId: string, offset: number | null) => {
      setSegmentBodyCaret((prev) => {
        if (offset == null) {
          return prev?.segmentId === segmentId ? null : prev;
        }
        if (prev?.segmentId === segmentId && prev.offset === offset) return prev;
        return { segmentId, offset };
      });
    },
    []
  );

  const documentCharIndexForImage = useMemo((): number | null => {
    if (segmentBodyCaret) {
      const s = segments.find((seg) => seg.id === segmentBodyCaret.segmentId);
      if (s && expandedSegments.has(s.id) && typeof s.span_start === 'number') {
        return s.span_start + Math.max(0, segmentBodyCaret.offset);
      }
    }
    const target =
      lastExpandedId && expandedSegments.has(lastExpandedId)
        ? segments.find((s) => s.id === lastExpandedId)
        : segments.find((s) => expandedSegments.has(s.id));
    return target && typeof target.span_start === 'number' ? target.span_start : null;
  }, [segments, expandedSegments, lastExpandedId, segmentBodyCaret]);

  const reviewsQueryKey = ['outliner', 'segment-reviews', documentId];
  const { data: reviewStatuses } = useQuery({
    queryKey: reviewsQueryKey,
    queryFn: () => getSegmentReviews(documentId),
    enabled: Boolean(documentId),
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      segmentId,
      status,
      comment,
    }: {
      segmentId: string;
      status: SegmentReviewStatus;
      comment?: string;
    }) => submitSegmentReview(segmentId, status, comment),
    onSuccess: (_data, { segmentId, status }) => {
      queryClient.setQueryData<Record<string, SegmentReviewStatus>>(
        reviewsQueryKey,
        (prev) => ({ ...prev, [segmentId]: status }),
      );
      toast.success(status === 'approve' ? 'Segment approved' : 'Segment rejected');
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Could not save your review'),
  });

  const statusCounts = useMemo(() => {
    const counts = { approve: 0, reject: 0, pending: 0 };
    for (const s of segments) {
      const d = reviewStatuses?.[s.id];
      if (d === 'approve') counts.approve++;
      else if (d === 'reject') counts.reject++;
      else counts.pending++;
    }
    return counts;
  }, [segments, reviewStatuses]);

  if (isPending) {
    return <p className="text-sm text-gray-600">Loading document…</p>;
  }

  if (error) {
    const msg = error instanceof Error ? error.message : 'Could not load document';
    return <p className="text-sm text-red-600">{msg}</p>;
  }

  if (!data) {
    return null;
  }

  const showImagePanel = hasImages && imagesPanelVisible;

  const segmentCards = segments.map((segment, index) => (
    <SegmentCard
      key={segment.id}
      segment={segment}
      listIndex={index + 1}
      decision={reviewStatuses?.[segment.id]}
      isPending={reviewMutation.isPending}
      isExpanded={expandedSegments.has(segment.id)}
      onToggleExpanded={(expanded) => handleToggleExpanded(segment.id, expanded)}
      onBodyCaretChange={handleBodyCaretChange}
      onReview={(status, comment) =>
        reviewMutation.mutate({ segmentId: segment.id, status, comment })
      }
    />
  ));

  const scrollableSegments = (
    <div className="relative h-full min-h-0 min-w-0 flex flex-col overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
        {segmentCards}
      </div>
    </div>
  );

  const imagePanel = (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-gray-200 bg-white">
      <VolumeImagePanelCore
        panelActive={showImagePanel}
        volumeFilename={data.filename?.trim() ? data.filename : null}
        documentCharIndexForImage={documentCharIndexForImage}
      />
    </div>
  );

  let body: React.ReactNode;
  if (segments.length === 0) {
    body = (
      <div className="relative min-h-0 flex-1 flex flex-col overflow-hidden rounded-md border border-gray-200 bg-white">
        <p className="p-4 text-sm text-gray-600">This document has no segments.</p>
      </div>
    );
  } else if (showImagePanel) {
    body = (
      <SplitPane
        direction="horizontal"
        className="outliner-split-pane min-h-0 flex-1 w-full"
        dividerSize={8}
      >
        <Pane minSize={280}>{scrollableSegments}</Pane>
        <Pane defaultSize="35%" minSize={220} maxSize="60%">
          {imagePanel}
        </Pane>
      </SplitPane>
    );
  } else {
    body = scrollableSegments;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 flex flex-col gap-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-base font-semibold text-gray-900 truncate">
            {data.filename?.trim() || '—'}
          </h2>
          <div className="flex items-center gap-2 text-xs px-2 flex-wrap">
            {hasImages && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 px-2"
                onClick={onToggleImagesPanel}
                aria-pressed={imagesPanelVisible}
                aria-label={imagesPanelVisible ? 'Hide image panel' : 'Show image panel'}
                title={imagesPanelVisible ? 'Hide image panel' : 'Show image panel'}
              >
                {imagesPanelVisible ? (
                  <PanelRightClose className="h-4 w-4" aria-hidden />
                ) : (
                  <PanelRightOpen className="h-4 w-4" aria-hidden />
                )}
              </Button>
            )}
            <span className="inline-block px-2 py-1 rounded bg-blue-100 text-blue-700">
              Approved: {statusCounts.approve}
            </span>
            <span className="inline-block px-2 py-1 rounded bg-red-100 text-red-700">
              Rejected: {statusCounts.reject}
            </span>
            <span className="inline-block px-2 py-1 rounded bg-yellow-100 text-yellow-700">
              Pending: {statusCounts.pending}
            </span>
          </div>
        </div>
      </header>

      {body}
    </div>
  );
}

export default ViewOnly;
