import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Highlighter from 'react-highlight-words';
import { toast } from 'sonner';

import {
  getOutlinerDocument,
  getRandomReviewedDocumentIds,
  getSegmentReviews,
  submitSegmentReview,
  type OutlinerSegment,
  type SegmentReviewStatus,
} from '@/api/outliner';
import { SegmentSearchBar } from '@/components/outliner/SegmentSearchBar';
import { findAllOccurrences, normalizeSearchQuery } from '@/features/outliner';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

function sortSegments(list: OutlinerSegment[] | undefined): OutlinerSegment[] {
  return [...(list ?? [])].sort((a, b) => a.segment_index - b.segment_index);
}

function ReviewActions({
  decision,
  isPending,
  onReview,
}: Readonly<{
  decision: SegmentReviewStatus | undefined;
  isPending: boolean;
  onReview: (status: SegmentReviewStatus) => void;
}>) {
  return (
    <div className="flex shrink-0 gap-2 border-t border-gray-200 pt-4">
      <button
        type="button"
        disabled={isPending}
        onClick={() => onReview('reject')}
        className={cn(
          'flex-1 cursor-pointer rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          decision === 'reject'
            ? 'border-red-600 bg-red-600 text-white hover:bg-red-700'
            : 'border-red-200 bg-white text-red-700 hover:bg-red-50',
        )}
      >
        Reject
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => onReview('approve')}
        className={cn(
          'flex-1 cursor-pointer rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          decision === 'approve'
            ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
            : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50',
        )}
      >
        Approve
      </button>
    </div>
  );
}

function effectiveTitle(s: OutlinerSegment): string {
  const v =
    s.updated_title?.trim() ||
    s.reviewer_title?.trim() ||
    s.title?.trim();
  return v || '—';
}

function effectiveAuthor(s: OutlinerSegment): string {
  const v =
    s.updated_author?.trim() ||
    s.reviewer_author?.trim() ||
    s.author?.trim();
  return v || '—';
}

function ViewOnly() {
  const { data, isPending, error } = useQuery({
    queryKey: ['outliner', 'random-reviewed-document-ids'],
    queryFn: () => getRandomReviewedDocumentIds(),
  });

  const documents = data?.documents ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.documents?.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && data.documents.some((d) => d.id === prev)) return prev;
      return data.documents[0].id;
    });
  }, [data]);

  const loading = isPending;
  let errorMessage: string | null = null;
  if (error) {
    errorMessage = error instanceof Error ? error.message : 'Could not load document ids';
  }

  const hasSidebar = !loading && !errorMessage && documents.length > 0;

  const [pageSearchQuery, setPageSearchQuery] = useState('');
  const [searchBarContext, setSearchBarContext] = useState<{
    searchRootId: string;
    bodyText: string;
  } | null>(null);

  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageSearchQuery('');
    setSearchBarContext(null);
    setPageIndex(0);
  }, [selectedId]);

  // Same query key as EachDocument: a cache hit, so the footer can read the
  // current segment without a child→parent effect callback or an extra request.
  const { data: selectedDoc } = useQuery({
    queryKey: ['outliner', 'document', selectedId],
    queryFn: () => getOutlinerDocument(selectedId as string, true),
    enabled: Boolean(selectedId),
  });
  const selectedSegments = useMemo(
    () => sortSegments(selectedDoc?.segments),
    [selectedDoc?.segments],
  );
  const currentSeg = selectedSegments[pageIndex];

  const reviewsQueryKey = ['outliner', 'segment-reviews', selectedId];
  const { data: reviewStatuses } = useQuery({
    queryKey: reviewsQueryKey,
    queryFn: () => getSegmentReviews(selectedId as string),
    enabled: Boolean(selectedId),
  });
  const currentDecision = currentSeg ? reviewStatuses?.[currentSeg.id] : undefined;

  const queryClient = useQueryClient();
  const reviewMutation = useMutation({
    mutationFn: ({ segmentId, status }: { segmentId: string; status: SegmentReviewStatus }) =>
      submitSegmentReview(segmentId, status),
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

  const handleReview = useCallback(
    (status: SegmentReviewStatus) => {
      if (!currentSeg) return;
      const totalPages = selectedSegments.length;
      reviewMutation.mutate(
        { segmentId: currentSeg.id, status },
        { onSuccess: () => setPageIndex((i) => Math.min(i + 1, totalPages - 1)) },
      );
    },
    [currentSeg, selectedSegments.length, reviewMutation],
  );

  const segmentSearchMatchCount = useMemo(
    () => findAllOccurrences(searchBarContext?.bodyText ?? '', pageSearchQuery).length,
    [searchBarContext?.bodyText, pageSearchQuery],
  );

  const onSearchBarContextChange = useCallback(
    (ctx: { searchRootId: string; bodyText: string } | null) => {
      setSearchBarContext(ctx);
    },
    [],
  );

  return (
    <div
      className={cn(
        'mx-auto p-6',
        hasSidebar ? 'flex max-w-7xl min-h-[min(100dvh,56rem)] flex-col gap-6 md:flex-row md:items-start' : 'max-w-5xl',
      )}
    >
      {loading && <p className="text-gray-600">Loading…</p>}
      {errorMessage && <p className="text-red-600">{errorMessage}</p>}
      {!loading && !errorMessage && (
        <>
          {documents.length === 0 ? (
            <p className="text-sm text-gray-600">No approved documents in the database.</p>
          ) : (
            <>
              <aside
                className={cn(
                  'flex w-full shrink-0 flex-col gap-4 border-b border-gray-200 bg-gray-50/95 py-4 backdrop-blur-sm',
                  'sticky top-6 z-10 max-h-[calc(100dvh-5rem)] self-start overflow-hidden md:h-[calc(100dvh-5rem)]',
                  'md:w-64 md:border-t md:border-r md:pr-4 lg:w-72',
                )}
              >
                {searchBarContext ? (
                  <div className="shrink-0">
                    <SegmentSearchBar
                      key={searchBarContext.searchRootId}
                      segmentId={searchBarContext.searchRootId}
                      query={pageSearchQuery}
                      onQueryChange={setPageSearchQuery}
                      matchCount={segmentSearchMatchCount}
                    />
                  </div>
                ) : null}
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-0.5 md:pr-1">
                  <h2 className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Documents
                  </h2>
                  <nav className="flex flex-col gap-1" aria-label="Documents">
                    {documents.map((doc) => (
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
                </div>
                {currentSeg ? (
                  <ReviewActions
                    decision={currentDecision}
                    isPending={reviewMutation.isPending}
                    onReview={handleReview}
                  />
                ) : null}
              </aside>
              <main className="min-w-0 flex-1">
                {selectedId ? (
                  <EachDocument
                    documentId={selectedId}
                    pageSearchQuery={pageSearchQuery}
                    pageIndex={pageIndex}
                    onPageIndexChange={setPageIndex}
                    onSearchBarContextChange={onSearchBarContextChange}
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

function BookPageTurner({
  segments,
  pageIndex,
  onPageIndexChange,
  searchRootId,
  searchQuery,
}: Readonly<{
  segments: OutlinerSegment[];
  pageIndex: number;
  onPageIndexChange: (index: number) => void;
  searchRootId: string;
  searchQuery: string;
}>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' && pageIndex > 0) {
        e.preventDefault();
        onPageIndexChange(pageIndex - 1);
      }
      if (e.key === 'ArrowRight' && pageIndex < segments.length - 1) {
        e.preventDefault();
        onPageIndexChange(pageIndex + 1);
      }
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [pageIndex, segments.length, onPageIndexChange]);

  const totalPages = segments.length;
  const pageNumber = pageIndex + 1;
  const seg = segments[pageIndex];
  const canPrev = pageIndex > 0;
  const canNext = pageIndex < totalPages - 1;
  const bodyText = seg?.text?.trim();
  const hasBodyText = Boolean(bodyText);

  const normalizedQuery = normalizeSearchQuery(searchQuery);

  return (
    <section className="flex flex-col gap-3 sm:flex-row sm:items-stretch" aria-label="Document pages">
      <button
        type="button"
        disabled={!canPrev}
        aria-label="Previous page"
        onClick={() => onPageIndexChange(pageIndex - 1)}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg border px-3 py-4 sm:w-14 sm:py-0',
          canPrev
            ? 'border-amber-900/25 bg-white text-amber-950 shadow-sm hover:bg-amber-50/80'
            : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400',
        )}
      >
        <ChevronLeft className="size-7" strokeWidth={1.5} />
      </button>

      <article
        id={searchRootId}
        className="min-h-[min(70vh,36rem)] flex-1 rounded-md border border-amber-900/15 bg-[#faf7f2] px-6 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] sm:px-10 sm:py-10"
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2 border-b border-amber-900/10 pb-4">
          <p className="text-xs font-medium tracking-wide text-amber-900/70">
            Page {pageNumber} of {totalPages}
            {seg?.label == null ? null : (
              <span className="text-amber-900/50"> · {seg.label}</span>
            )}
          </p>
          <p className="text-xs text-amber-900/50">Use ← → keys to turn pages</p>
        </div>

        {seg ? (
          <>
            <dl className="mb-8 grid gap-4 border-b border-amber-900/10 pb-6 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-amber-900/55">Title</dt>
                <dd className="mt-1.5 text-lg leading-snug text-amber-950 font-monlam">{effectiveTitle(seg)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-amber-900/55">Author</dt>
                <dd className="mt-1.5 font-monlam text-base leading-snug text-amber-950/90">
                  {effectiveAuthor(seg)}
                </dd>
              </div>
            </dl>
            <div className="font-serif text-[1.05rem] leading-[1.75] text-amber-950/95">
              {hasBodyText ? (
                <Highlighter
                  highlightClassName="highlighter rounded-sm bg-amber-200/90 px-0.5"
                  searchWords={normalizedQuery ? [normalizedQuery] : []}
                  autoEscape
                  textToHighlight={bodyText ?? ''}
                  className="wrap-break-word whitespace-pre-wrap font-monlam"
                />
              ) : (
                <p className="text-sm italic text-amber-900/50">No text for this segment.</p>
              )}
            </div>
          </>
        ) : null}
      </article>

      <button
        type="button"
        disabled={!canNext}
        aria-label="Next page"
        onClick={() => onPageIndexChange(pageIndex + 1)}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg border px-3 py-4 sm:w-14 sm:py-0',
          canNext
            ? 'border-amber-900/25 bg-white text-amber-950 shadow-sm hover:bg-amber-50/80'
            : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400',
        )}
      >
        <ChevronRight className="size-7" strokeWidth={1.5} />
      </button>
    </section>
  );
}

function EachDocument({
  documentId,
  pageSearchQuery,
  pageIndex,
  onPageIndexChange,
  onSearchBarContextChange,
}: Readonly<{
  documentId: string;
  pageSearchQuery: string;
  pageIndex: number;
  onPageIndexChange: (index: number) => void;
  onSearchBarContextChange: (ctx: { searchRootId: string; bodyText: string } | null) => void;
}>) {
  const { data, isPending, error } = useQuery({
    queryKey: ['outliner', 'document', documentId],
    queryFn: () => getOutlinerDocument(documentId, true),
    enabled: Boolean(documentId),
  });

  const segments = useMemo(() => sortSegments(data?.segments), [data?.segments]);

  useEffect(() => {
    if (segments.length > 0 && pageIndex > segments.length - 1) {
      onPageIndexChange(segments.length - 1);
    }
  }, [segments.length, pageIndex, onPageIndexChange]);

  const currentSeg = segments[pageIndex];
  const searchRootId = currentSeg
    ? `viewonly-page-${documentId}-${currentSeg.id}`
    : `viewonly-page-${documentId}-empty`;
  const bodyTextForSearch = currentSeg?.text?.trim() ?? '';

  useEffect(() => {
    if (isPending || error || !data || segments.length === 0) {
      onSearchBarContextChange(null);
      return () => {
        onSearchBarContextChange(null);
      };
    }
    onSearchBarContextChange({
      searchRootId,
      bodyText: bodyTextForSearch,
    });
    return () => {
      onSearchBarContextChange(null);
    };
  }, [
    isPending,
    error,
    data,
    segments.length,
    searchRootId,
    bodyTextForSearch,
    onSearchBarContextChange,
  ]);

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

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4">
      <header className="mb-4 border-b border-gray-200 pb-3">
        <h2 className="text-base font-semibold text-gray-900">{data.filename?.trim() || '—'}</h2>
      </header>

      {segments.length === 0 ? (
        <p className="text-sm text-gray-600">This document has no segments.</p>
      ) : (
        <BookPageTurner
          segments={segments}
          pageIndex={pageIndex}
          onPageIndexChange={onPageIndexChange}
          searchRootId={searchRootId}
          searchQuery={pageSearchQuery}
        />
      )}
    </div>
  );
}

export default ViewOnly;
