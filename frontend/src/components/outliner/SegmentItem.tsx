import React, { useCallback, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronDown, ChevronRight, Merge, ChevronUp, AlertCircle } from 'lucide-react'
import type { TextSegment, SegmentLabel } from './types'
import { SegmentTextContent } from './SegmentTextContent'
import { useDocument,useCursor, useActions } from './contexts'
import { SplitMenu } from './SplitMenu'
import { BubbleMenu } from './BubbleMenu'
import { SEGMENT_LABEL_OPTIONS } from './segment-label'
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument'
import { parseTocFromText } from '@/api/outliner'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '../ui/input'
import { findAllOccurrences } from './utils'



interface SegmentItemProps {
  segment: TextSegment
  index: number
}

const SegmentItem: React.FC<SegmentItemProps> = ({
  segment,
  index,
}) => {


  // Use new contexts
  const { activeSegmentId, segments } = useDocument()
  const { onCursorChange } = useCursor()
  const {
    onSegmentClick,
    onActivate,
    onInput,
    onKeyDown,
    onAttachParent,
    onMergeWithPrevious,
    expandedSegmentIds,
    toggleSegmentExpanded,
  } = useActions()

  const isChecked = segment.status === 'checked' || segment.status === 'approved'
  const isRejected = segment.status === 'rejected'
  const isFirstSegment = index === 0
  const isAttached = isFirstSegment && (segment.is_attached ?? false)
  const isActive = segment.id === activeSegmentId

  const { documentId: outlinerDocumentId, refetchDocument } = useOutlinerDocument()

  const [isTocAiLoading, setIsTocAiLoading] = useState(false)
  const [segmentSearchQuery, setSegmentSearchQuery] = useState('')

  const segmentSearchMatchCount = useMemo(
    () => findAllOccurrences(segment.text, segmentSearchQuery).length,
    [segment.text, segmentSearchQuery]
  )


  const isExpanded =
    segments.length === 1 || expandedSegmentIds.includes(segment.id)
  const isCollapsed = !isExpanded
  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleSegmentExpanded(segment.id)
  }
  
  const validation =   async (value: string) => {
      if (value !== 'TOC') return

      if (segments.some((s) => s.label === 'TOC' && s.id !== segment.id)) {
        toast.error('There can be only one TOC in the document')
        throw new Error('There can be only one TOC in the document')
      }

      setIsTocAiLoading(true)
      try {
        const { is_toc, entries } = await parseTocFromText({
          content: segment.text,
          ...(outlinerDocumentId ? { document_id: outlinerDocumentId } : {}),
        })

        await refetchDocument()

        if (!is_toc) {
          toast.error('This segment does not look like a table of contents')
          return
        }

        const textSegmentCount = segments.filter((s) => s.label === 'TEXT').length
        if (textSegmentCount !== entries.length) {
          toast.warning(
            `TEXT segment count (${textSegmentCount}) does not match AI TOC entries (${entries.length})`
          )
        }
      } finally {
        setIsTocAiLoading(false)
      }
    }

  return (
    <div className="relative">
      {/* Attach Parent Button and Collapse All Button - only for first segment */}
      {isFirstSegment && (
        <div className="flex items-center justify-between gap-2 my-3">
          <Button
            type="button"
            variant={isAttached ? 'default' : 'outline'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onAttachParent()
            }}
            className={`text-xs ${
              isAttached
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {isAttached ? '✓ Attached' : 'Attach Parent'}
          </Button>
        </div>
      )}
      
      <div
      id={segment.id}
        data-segment-id={segment.id}
        data-segment-container-id={segment.id}
        onClick={(e) => {
          // Only handle click if not clicking on text content or menus or buttons
          if (
            !(e.target as HTMLElement).closest('.segment-text-content') &&
            !(e.target as HTMLElement).closest('.split-menu') &&
            !(e.target as HTMLElement).closest('.bubble-menu') &&
            !(e.target as HTMLElement).closest('.cancel-split-button') &&
            !(e.target as HTMLElement).closest('.collapse-button') &&
            !(e.target as HTMLElement).closest('.segment-search-bar')
          ) {
            onSegmentClick(segment.id, e)
            if (!isExpanded) toggleSegmentExpanded(segment.id)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSegmentClick(segment.id)
          }
        }}
        role="button"
        tabIndex={0}
        className={`mb-4 p-4 rounded-lg border-2 cursor-pointer transition-all relative ${
          isChecked ? 'opacity-50' : 'opacity-100'
        } ${
          isRejected
            ? 'border-red-400 bg-red-50'
            : isActive
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
        }`}
      >
       
    <div className="segment-label-bar flex flex-wrap  items-center gap-2 mb-3 pb-2 border-b border-gray-200">
        
        
       <SegmentLabelSelector
          segment={segment}
          validation={validation}
          isTocAiLoading={isTocAiLoading}
        />
      
<div
          className="fixed right-10 flex gap-2 items-center z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <SegmentSearch
            segmentId={segment.id}
            query={segmentSearchQuery}
            onQueryChange={setSegmentSearchQuery}
            matchCount={segmentSearchMatchCount}
          />
        </div>

        </div>
      
        {activeSegmentId === segment.id && index > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onMergeWithPrevious(segment.id)
            }}
            className="cancel-split-button cursor-pointer z-100 absolute -top-3 left-1/2 -translate-x-1/2  bg-white border-2 border-red-500 rounded-full p-1.5 shadow-lg hover:bg-red-50 transition-colors"
            title="Merge with previous segment"
          >
            <Merge className="w-4 h-4 text-red-600" />
          </button>
        )}
        <div className="flex items-start gap-3">
          <div className="shrink-0 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={toggleCollapse}
              className="p-1 hover:bg-gray-200 rounded transition-colors collapse-button"
              aria-label={isCollapsed ? 'Expand segment' : 'Collapse segment'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              )}
            </button>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              isRejected
                ? 'bg-red-500 text-white'
                : isChecked 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
            }`}>
              {index + 1}
            </div>
            {isRejected && (
              <span className="text-[10px] font-semibold text-red-600" title={`Rejected${(segment.rejection_count ?? 0) > 1 ? ` ${segment.rejection_count} times` : ''}`}>
                Rejected{(segment.rejection_count ?? 0) > 1 ? ` (${segment.rejection_count}x)` : ''}
              </span>
            )}
          </div>
          <div className={`flex-1 relative ${isChecked && !isRejected ? 'pointer-events-none' : ''}`}>
          <div className='absolute right-2'>

          <AlertMessage
          segment={segment}
          />
          </div>
            {isCollapsed ? (
              <>
              <button
                type="button"
                className="text-gray-600  font-monlam cursor-pointer text-lg py-2 text-left w-full rounded px-2 -mx-2 transition-colors max-h-[100px] overflow-hidden whitespace-pre-wrap break-words [display:-webkit-box] [WebkitBoxOrient:vertical] [WebkitLineClamp:4]"
                onClick={(e) => {
                  e.stopPropagation()
                  onActivate(segment.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onActivate(segment.id)
                  }
                }}
                tabIndex={0}
                aria-label="Expand segment"
              >
                {segment.text.slice(0,200) +"..."}
              </button>
                <TitleAndAuthor
                title={segment.title}
                author={segment.author}
                title_bdrc_id={segment.title_bdrc_id}
                author_bdrc_id={segment.author_bdrc_id}
              />
              </>
            ) : (
              <>
                <SegmentTextContent
                  segmentId={segment.id}
                  text={segment.text}
                  title={segment.title}
                  author={segment.author}
                  segmentSearchQuery={segmentSearchQuery}
                  onCursorChange={(segmentId, element) => onCursorChange(segmentId, element)}
                  onActivate={() => onActivate(segment.id)}
                  onInput={onInput}
                  onKeyDown={onKeyDown}
                />
                <TitleAndAuthor
                  title={segment.title}
                  author={segment.author}
                  title_bdrc_id={segment.title_bdrc_id}
                  author_bdrc_id={segment.author_bdrc_id}
                />
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Split Menu - positioned relative to segment container */}
        <SplitMenu
          segmentId={segment.id}
        />

      {/* Bubble Menu - positioned relative to segment container */}
        <BubbleMenu
          segmentId={segment.id}
          
        />
    </div>
  )
}

export const SegmentItemMemo = React.memo(SegmentItem)


type TitleAndAuthorProps = {
  title?: string
  author?: string
  title_bdrc_id?: string
  author_bdrc_id?: string
}

const TitleAndAuthor = ({
  title,
  author,
  title_bdrc_id,
  author_bdrc_id,
}: TitleAndAuthorProps) => {
  if (!title && !author && !title_bdrc_id && !author_bdrc_id) return null

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-2">
      {title && (
        <span className="inline-flex items-center px-2 py-1 rounded-md bg-yellow-100 text-yellow-800 text-xs font-medium">
          📄 {title}
          {title_bdrc_id && (
            <span className="ml-1 text-green-600">({title_bdrc_id})</span>
          )}
        </span>
      )}
      {author && (
        <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-100 text-purple-800 text-xs font-medium">
          👤 {author}
          {author_bdrc_id && (
            <span className="ml-1 text-green-600">({author_bdrc_id})</span>
          )}
        </span>
      )}
    </div>
  )
}


const SegmentLabelSelector = ({
  segment,
  validation,
  isTocAiLoading,
}: {
  segment: TextSegment
  validation: (value: string) => Promise<void>
  isTocAiLoading: boolean
}) => {
  const { documentId, updateSegment: updateSegmentMutation } = useOutlinerDocument()

  const handleLabelChange = useCallback(
    async (value: string) => {
      if (!segment.id || !documentId) return

      try {
        await validation(value)
      } catch {
        return
      }

      const label = value === 'none' || value === '' ? undefined : (value as SegmentLabel)
      updateSegmentMutation(segment.id, { label }).catch((err) => {
        console.error('Failed to update segment label:', err)
        toast.error(err instanceof Error ? err.message : 'Failed to update label')
      })
    },
    [segment.id, documentId, validation, updateSegmentMutation]
  )
  return (
  <>
    <span className="text-xs font-medium text-gray-500 shrink-0">Label</span>
    <Select
    value={segment.label ?? 'none'}
    onValueChange={handleLabelChange}
      disabled={!documentId || isTocAiLoading}
    >
      <SelectTrigger className="h-8 text-xs flex-1 max-w-[180px]" id={`segment-label-${segment.id}`}>
        <SelectValue placeholder="No label" />
      </SelectTrigger>
      <SelectContent>
    
        {SEGMENT_LABEL_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {isTocAiLoading && (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
        Analyzing TOC…
      </span>
    )}
  </>
  )
}

const SegmentSearch = ({
  segmentId,
  query,
  onQueryChange,
  matchCount,
}: {
  segmentId: string
  query: string
  onQueryChange: (q: string) => void
  matchCount: number
}) => {
  const [activeMatchIndex, setActiveMatchIndex]=useState(0);
  const scrollSegmentToTop = useCallback(() => {
    document.getElementById(segmentId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [segmentId])

  const scrollSegmentToBottom = useCallback(() => {
    document.getElementById(segmentId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [segmentId])
  

  const handleActiveMatch = (index: number) => {
    const segments = document.querySelectorAll('.segment-search-match')
    const targetdom = segments[index]
    if (targetdom) {
      targetdom.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }
  
  /** When there is no active search hit list, arrows scroll the segment in the page. */
  const useScrollForArrows = !query.trim() || matchCount === 0

  const goUp = ()=>{
    if (useScrollForArrows) {
      scrollSegmentToTop()
      return
    }
    handleActiveMatch(activeMatchIndex)
    setActiveMatchIndex(activeMatchIndex - 1)
  }

  const goDown =()=> {
    if (useScrollForArrows) {
      scrollSegmentToBottom()
      return
    }
    handleActiveMatch(activeMatchIndex)
    setActiveMatchIndex(activeMatchIndex +1)

  }

  return (
    <div className="segment-search-bar flex items-center gap-1   rounded-md px-1 py-0.5 ">
      <Input
        className="h-8 w-42 text-xs"
        placeholder="Search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            e.stopPropagation()
            goUp()
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            e.stopPropagation()
            goDown()
          }
        }}
        aria-label="Search within this segment"
      />
      {query.trim().length > 0 && (
        <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap px-0.5">
          {matchCount === 0 ? '0/0' : `${activeMatchIndex + 1}/${matchCount}`}
        </span>
      )}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={goUp}
        aria-label={
          useScrollForArrows ? 'Scroll segment to top' : 'Previous search match'
        }
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={goDown}
        aria-label={
          useScrollForArrows ? 'Scroll segment to bottom' : 'Next search match'
        }
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  )
}

const AlertMessage=({segment}: {segment: TextSegment}) => {
  
  // Check for additional patterns, allow case-insensitive/variant spacing, make extensible
  const BONPO_PATTERNS = ['བམ་པོ', 'ལེའུ', 'བམཔོ', 'བམ་པོ་', 'ལེའུ་', 'བམ པོ'];
  const normalizedText = segment.text.replace(/\s+/g, ''); // Remove extra whitespace
  const showAlertMessage = BONPO_PATTERNS.some(pattern => 
    normalizedText.includes(pattern.replace(/\s+/g, ''))
  );
  if (!showAlertMessage || segment.label !== 'TEXT') return null;
  return (
    <div className="alert-message flex items-center gap-2"> 
      <AlertCircle className="h-4 w-4 animate-bounce text-red-500" />
      <span className="animate-pulse text-xs font-medium text-gray-500">
        Don't segment this text, bonpo text detected
      </span>
    </div>
  )
}