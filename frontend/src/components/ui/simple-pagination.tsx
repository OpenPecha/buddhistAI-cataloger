import * as React from 'react'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination'
import { cn } from '@/lib/utils'
import { useDocuments, type DocumentFilters } from '@/hooks'
import { useSearchParams } from 'react-router-dom'

export interface SimplePaginationProps {
  
  label?: React.ReactNode
  /** 'left' = label left, prev/next right; 'center' = prev | label | next */
  labelPosition?: 'left' | 'center'
  className?: string
}

function SimplePagination({
  labelPosition = 'center',
  className,
}: Readonly<SimplePaginationProps>) {
  const [searchParams,setSearchParams] = useSearchParams();

  const status = searchParams.get('status') || undefined;
  const annotator = searchParams.get('annotator') || undefined;
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const debouncedTitle=searchParams.get('title') || undefined
  const filters:DocumentFilters = React.useMemo(
    () => ({
      status,
      userId: annotator,
      title: debouncedTitle || undefined,
      page,
      pageSize: 20,
      excludeOwnAssignedDocuments: true,
    }),
    [status, annotator, debouncedTitle, page]
  );

  const {
    isFetching:isDisabled,
    page: currentPage,
    hasNextPage:canGoPrev,
    hasPrevPage:canGoNext,
  } = useDocuments(filters);

 

  

  
  const handlePageChange = React.useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams);
      params.set('page', String(newPage));
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!canGoPrev || isDisabled) return
   handlePageChange(currentPage - 1)
  }

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!canGoNext || isDisabled) return
    handlePageChange(currentPage + 1)
  }

  const prevDisabled = !canGoPrev || isDisabled
  const nextDisabled = !canGoNext || isDisabled


  const label = `Page ${currentPage}`


  if (labelPosition === 'left') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-4',
          className
        )}
      >
        {label && (
          <span className="text-sm text-gray-600">{label}</span>
        )}
        <Pagination>
          <PaginationContent className="gap-1">
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={handlePrev}
                aria-disabled={prevDisabled}
                className={cn(
                  prevDisabled && 'pointer-events-none opacity-50'
                )}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={handleNext}
                aria-disabled={nextDisabled}
                className={cn(
                  nextDisabled && 'pointer-events-none opacity-50'
                )}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    )
  }

  return (
    <Pagination
      className={cn(
        'flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 w-full',
        className
      )}
    >
      <PaginationContent className="flex-1 flex flex-row justify-between items-center gap-2 w-full flex-wrap">
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={handlePrev}
            aria-disabled={prevDisabled}
            className={cn(
              'w-full sm:w-auto',
              prevDisabled && 'pointer-events-none opacity-50'
            )}
          />
        </PaginationItem>
        
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={handleNext}
            aria-disabled={nextDisabled}
            className={cn(
              'w-full sm:w-auto',
              nextDisabled && 'pointer-events-none opacity-50'
            )}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

export { SimplePagination }
