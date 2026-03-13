import * as React from 'react'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination'
import { cn } from '@/lib/utils'

export interface SimplePaginationProps {
  canGoPrev: boolean
  canGoNext: boolean
  onPrev: () => void
  onNext: () => void
  label?: React.ReactNode
  /** 'left' = label left, prev/next right; 'center' = prev | label | next */
  labelPosition?: 'left' | 'center'
  isDisabled?: boolean
  className?: string
}

function SimplePagination({
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  label,
  labelPosition = 'center',
  isDisabled = false,
  className,
}: Readonly<SimplePaginationProps>) {
  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!canGoPrev || isDisabled) return
    onPrev()
  }

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!canGoNext || isDisabled) return
    onNext()
  }

  const prevDisabled = !canGoPrev || isDisabled
  const nextDisabled = !canGoNext || isDisabled

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
        {label && (
          <PaginationItem>
            <span className="text-xs sm:text-sm text-gray-600 text-center">
              {label}
            </span>
          </PaginationItem>
        )}
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
