import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Loader2 } from 'lucide-react';
import { getMyReviewedSegments } from '@/api/outliner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SimplePagination } from '@/components/ui/simple-pagination';
import { useUser } from '@/hooks/useUser';
import { getStatusColor } from '@/components/outliner/utils';

const PAGE_SIZE = 30;

function MyReviewedSegmentsFab() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: currentUser } = useUser();
  const reviewer = searchParams.get('reviewer');
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);

  const showFab = !!currentUser?.id && reviewer === currentUser.id;

  useEffect(() => {
    if (open) setPage(1);
  }, [open]);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['my-reviewed-segments', currentUser?.id, page],
    queryFn: () => getMyReviewedSegments(page, PAGE_SIZE),
    enabled: open && showFab,
    staleTime: 60_000,
  });

  if (!showFab) return null;

  const handleOpenDocument = (documentId: string) => {
    setOpen(false);
    navigate(`/outliner-admin/documents/${documentId}`);
  };

  const hasPrevPage = page > 1;
  const hasNextPage = data?.has_next ?? false;
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total_groups / PAGE_SIZE))
    : 1;

  return (
    <>
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
        <Button
          type="button"
          size="lg"
          className="pointer-events-auto gap-2 shadow-lg"
          onClick={() => setOpen(true)}
        >
          <ClipboardList className="h-4 w-4" />
          My reviewed segments
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(85vh,720px)] flex-col gap-0 overflow-hidden sm:max-w-2xl">
          <DialogHeader className="shrink-0 pb-2">
            <DialogTitle>Segments you reviewed</DialogTitle>
            <DialogDescription>
              Documents with approved segments you recorded as reviewer (30 per page).
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {isLoading && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading…
              </div>
            )}
            {isError && (
              <p className="py-8 text-center text-sm text-destructive">
                Could not load your reviewed segments.
              </p>
            )}
            {!isLoading && !isError && data?.total_groups === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No approved segments recorded under your reviewer account yet.
              </p>
            )}
            {!isLoading && !isError && data && data.total_groups > 0 && (
              <ul className="divide-y rounded-md border border-gray-200 bg-white">
                {data.groups.map((group) => (
                  <li key={group.document_id}>
                    <button
                      type="button"
                      onClick={() => handleOpenDocument(group.document_id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-gray-50"
                    >
                      <span className="min-w-0 flex-1 font-medium text-primary">
                        {group.filename}
                      </span>
                      <Badge
                        variant="outline"
                        className={`shrink-0 capitalize ${getStatusColor('approved')}`}
                      >
                        {group.approved_count} approved
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!isLoading && data && data.total_groups > 0 && (
            <div className="shrink-0 space-y-2 border-t pt-3">
              <p className="text-center text-xs text-muted-foreground">
                {data.total_approved_segments} approved segment
                {data.total_approved_segments === 1 ? '' : 's'} across{' '}
                {data.total_groups} document{data.total_groups === 1 ? '' : 's'}
              </p>
              {(hasPrevPage || hasNextPage) && (
                <SimplePagination
                  canGoPrev={hasPrevPage}
                  canGoNext={hasNextPage}
                  onPrev={() => setPage((p) => Math.max(1, p - 1))}
                  onNext={() => setPage((p) => p + 1)}
                  label={`Page ${page} of ${totalPages}`}
                  labelPosition="center"
                  isDisabled={isFetching}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default MyReviewedSegmentsFab;
